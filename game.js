(() => {
  'use strict';

  const stage = document.querySelector('#stage');
  const gameShell = document.querySelector('#game-shell');
  const toastEl = document.querySelector('#toast');
  const loadingEl = document.querySelector('#loading');
  const settingsModal = document.querySelector('#settings-modal');
  const recapModal = document.querySelector('#recap-modal');
  const skaiBack = document.querySelector('#skai-back');
  const skaiSound = document.querySelector('#skai-sound');
  const skaiInfo = document.querySelector('#skai-info');
  const skaiPlayers = document.querySelector('#skai-players');
  const skaiProgress = document.querySelector('#skai-progress');
  const skaiProgressText = document.querySelector('#skai-progress-text');
  const skaiTimerText = document.querySelector('#skai-timer-text');
  const MISSION_SECONDS = 35 * 60;

  const CLUES = [
    { id: 'source', label: 'Source', icon: 'assets/icons/icon_source_3d.png', tip: 'Who sent it?' },
    { id: 'date', label: 'Date', icon: 'assets/icons/icon_date_3d.png', tip: 'Is it current?' },
    { id: 'image', label: 'Image', icon: 'assets/icons/icon_image_3d.png', tip: 'Is the picture reused?' },
    { id: 'urgent', label: 'Urgent Words', icon: 'assets/icons/icon_urgent_words_3d.png', tip: 'Is it pushing you to act fast?' }
  ];

  // green: scores below this stay "Likely okay". red: scores at or above this are "Suspicious".
  const STYLES = [
    { id: 'careful', label: 'Careful', asset: 'assets/styles/checker_style_careful.png', green: 2, red: 7 },
    { id: 'balanced', label: 'Balanced', asset: 'assets/styles/checker_style_balanced.png', green: 3, red: 5 },
    { id: 'strict', label: 'Strict', asset: 'assets/styles/checker_style_strict.png', green: 3, red: 4 }
  ];

  const TOTAL_STARS = 10;
  const MIN_STARS = 1;
  const MAX_STARS = 5;

  const SCREEN_PROGRESS = {
    setup: 0, roles: 1, intro: 2, tutorial: 3, ranking: 4, style: 5,
    test: 6, result: 6, batch: 7, cause: 8, adjust: 9, retest: 9, final: 10
  };

  function freshState(audio = {}) {
    return {
      view: 'setup',
      setupStep: 'count',
      timeLeft: MISSION_SECONDS,
      pickerIndex: 0,
      returnToTeam: false,
      playerCount: null,
      players: [],
      avatars: [],
      activePlayerIndex: 0,
      clueOrder: [null, null, null, null],
      selectedClue: null,
      weights: {},
      checkerStyle: null,
      currentMessageIndex: 0,
      testResults: [],
      currentResult: null,
      initialCorrect: 0,
      debug: null,
      move: null,
      selectedFrom: null,
      mistakeIdsBeforeMove: [],
      lastRetest: null,
      fixHistory: [],
      causeAttempts: 0,
      badges: { cause: false, fix: false },
      soundOn: audio.soundOn ?? true,
      musicOn: audio.musicOn ?? true,
      sfxOn: audio.sfxOn ?? true,
      finished: false
    };
  }

  let state = freshState();
  let audioContext = null;
  let musicTimer = null;
  let musicStep = 0;
  let toastTimer = null;
  let transitionTimer = null;
  let transitioning = false;
  const scanTimers = new Set();
  const teamRoles = () => state.playerCount === 4
    ? ['Rule Builder', 'Message Tester', 'Detective', 'Rule Fixer']
    : ['Rule Builder', 'Message Tester', 'Detective / Fixer'];
  function roleOwner(view) {
    if (['test', 'result', 'batch', 'retest'].includes(view)) return 1;
    if (view === 'cause') return 2;
    if (view === 'adjust') return state.playerCount === 4 ? 3 : 2;
    return 0;
  }
  function scanLater(callback, delay) {
    const timer = setTimeout(() => { scanTimers.delete(timer); callback(); }, delay);
    scanTimers.add(timer);
  }

  const clueById = id => CLUES.find(clue => clue.id === id);
  const styleById = id => STYLES.find(style => style.id === id);
  const messageById = id => window.MESSAGE_DATA.find(message => message.id === id);
  const currentMessage = () => window.MESSAGE_DATA[state.currentMessageIndex];
  const playerColors = ['#309ce8', '#7e58d6', '#2bbe6f', '#eb951f'];

  // The avatar sheet (assets/skai/avatars.png) is a 4 × 3 grid. Each avatar is cropped with
  // the offsets used in the Figma design (a 165 × 179 window onto the sheet).
  const AVATAR_NAMES = ['Blue', 'Purple', 'Green', 'Yellow', 'Orange', 'Pink', 'Teal', 'Red', 'Mint', 'Grey', 'Navy', 'Rose'];
  const AVATAR_X = [0, -94.07, -194.04, -288.24];
  const AVATAR_Y = [-30.41, -131.83, -233.25];
  // Columns 1 and 3 of the sheet sit close to their right-hand neighbour; trim that sliver.
  const AVATAR_CLIP = [5.9, 0, 5.9, 0];
  // Where each avatar sits on one 619 × 619 sheet in the picker design.
  const SHEET_X = [0, 150, 309.4, 459.6];
  const SHEET_Y = [52.6, 228, 403.5];

  function avatarMarkup(id, className = '') {
    if (!Number.isInteger(id)) return `<span class="avatar-crop avatar-empty ${className}" aria-hidden="true"><img src="assets/skai/avatar_placeholder.svg" alt=""></span>`;
    return `<span class="avatar-crop ${className}" style="--ax:${AVATAR_X[id % 4]}%;--ay:${AVATAR_Y[Math.floor(id / 4)]}%;--clip:${AVATAR_CLIP[id % 4]}%" aria-hidden="true"><img src="assets/skai/avatars.png" alt=""></span>`;
  }
  const stars = count => `${count} star${count === 1 ? '' : 's'}`;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function activePlayerName() {
    return state.players[state.activePlayerIndex] || 'Team';
  }

  // Binds a click handler that is ignored while a screen transition is running,
  // so a fast double press (mouse or keyboard) cannot fire an action twice.
  function onTap(target, handler) {
    const element = typeof target === 'string' ? stage.querySelector(target) : target;
    element?.addEventListener('click', event => {
      if (transitioning) return;
      handler(event);
    });
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext?.state === 'suspended') audioContext.resume();
  }

  function tone(kind = 'tap') {
    ensureAudio();
    updateMusicLoop();
    if (!state.soundOn || !state.sfxOn) return;
    if (!audioContext) return;
    const presets = {
      tap: [420, .055, 'sine'],
      drop: [560, .08, 'triangle'],
      correct: [740, .16, 'sine'],
      wrong: [170, .13, 'sawtooth'],
      light: [520, .1, 'triangle'],
      badge: [880, .18, 'sine']
    };
    const [frequency, duration, type] = presets[kind] || presets.tap;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    if (kind === 'correct' || kind === 'badge') {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, audioContext.currentTime + duration);
    }
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055, audioContext.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + .02);
  }

  function playMusicNote() {
    if (!audioContext || !state.soundOn || !state.musicOn) return;
    const notes = [220, 277.18, 329.63, 277.18, 246.94, 329.63];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[musicStep % notes.length];
    musicStep += 1;
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.012, audioContext.currentTime + .04);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .62);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + .65);
  }

  function updateMusicLoop() {
    const shouldPlay = Boolean(audioContext && state.soundOn && state.musicOn);
    if (!shouldPlay && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
      return;
    }
    if (shouldPlay && !musicTimer) {
      playMusicNote();
      musicTimer = setInterval(playMusicNote, 920);
    }
  }

  function showToast(message, duration = 1800) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function setView(view, renderFn, { force = false } = {}) {
    if (transitioning && !force) return;
    clearTimeout(transitionTimer);
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
    transitioning = true;
    stage.inert = true;
    stage.style.pointerEvents = 'none';
    stage.classList.add('leaving');
    transitionTimer = setTimeout(() => {
      const previousOwner = state.activePlayerIndex;
      state.view = view;
      state.activePlayerIndex = roleOwner(view);
      stage.style.pointerEvents = '';
      stage.inert = false;
      stage.classList.remove('leaving');
      stage.classList.add('entering');
      renderFn();
      renderProgress();
      transitioning = false;
      requestAnimationFrame(() => stage.classList.remove('entering'));
      stage.focus({ preventScroll: true });
      const tasks = { ranking: 'Rank the four clues. Discuss their importance with your team, then place them in order.', test: 'Read the message aloud. Ask your team about the four clues, then press Check.', cause: 'Compare the result with the evidence. Choose the clue that caused the mistake.', adjust: 'Listen to the detective, move one star, then ask the tester to retest.', retest: 'Read the new result aloud. Check whether the change helped or created another mistake.' };
      if (tasks[view] && (previousOwner !== state.activePlayerIndex || view === 'ranking')) {
        const modal = document.querySelector('#turn-modal');
        document.querySelector('#turn-title').textContent = `${activePlayerName()}, your turn`;
        document.querySelector('#turn-role').textContent = teamRoles()[state.activePlayerIndex];
        document.querySelector('#turn-task').textContent = tasks[view];
        modal.hidden = false;
        stage.inert = true;
        const ready = document.querySelector('#turn-ready');
        ready.onclick = () => { modal.hidden = true; stage.inert = false; stage.focus({preventScroll:true}); };
        ready.focus();
      }
    }, 220);
  }

  // Updates the SKAI HUD: vertical progress bar, player chips (with the LEAD player lit up) and the mission clock.
  function renderProgress() {
    const isSetup = state.view === 'setup';
    gameShell.classList.toggle('setup-mode', isSetup);
    skaiBack.disabled = isSetup && state.setupStep === 'count';
    skaiBack.setAttribute('aria-label', isSetup ? 'Go back' : 'Open the mission menu');
    const current = isSetup ? 1 : Math.max(1, SCREEN_PROGRESS[state.view] || 1);
    const total = Math.max(...Object.values(SCREEN_PROGRESS));
    skaiProgressText.textContent = `${current}/${total}`;
    skaiProgress.style.setProperty('--fill', String(current / total));
    skaiProgress.setAttribute('aria-label', `Mission step ${current} of ${total}`);
    if (isSetup) {
      skaiPlayers.innerHTML = '';
      return;
    }
    startMissionClock();
    const roles = teamRoles();
    skaiPlayers.className = `skai-chips hud-chips team-${state.playerCount}`;
    skaiPlayers.innerHTML = state.players.map((name, index) => {
      const active = index === state.activePlayerIndex;
      return `<li class="skai-chip ${active ? 'active' : ''}" title="${escapeHtml(name)} — ${roles[index]}">${avatarMarkup(state.avatars[index], 'chip-avatar')}<span class="skai-chip-name">${escapeHtml(name)}</span><span class="skai-chip-role">${roles[index]}</span>${active ? '<span class="visually-hidden"> (lead)</span>' : ''}</li>`;
    }).join('');
  }

  // A 35-minute mission clock that starts once the team leaves setup. It pauses while a menu is open
  // and simply stops at 00:00 — running out of time does not end the game.
  let missionTimer = null;
  function renderMissionClock() {
    const left = Math.max(0, state.timeLeft);
    skaiTimerText.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    skaiTimerText.parentElement.classList.toggle('low', left > 0 && left <= 5 * 60);
  }
  function startMissionClock() {
    if (missionTimer) return;
    missionTimer = setInterval(() => {
      if (state.view === 'setup' || state.finished || !settingsModal.hidden || state.timeLeft <= 0) return;
      state.timeLeft -= 1;
      renderMissionClock();
    }, 1000);
  }
  function stopMissionClock() {
    clearInterval(missionTimer);
    missionTimer = null;
  }

  // ---------- Setup and intro ----------

  function setupReady() {
    if (![3, 4].includes(state.playerCount) || state.players.length !== state.playerCount) return false;
    const names = state.players.map(name => name.trim()).filter(Boolean);
    return names.length === state.playerCount && new Set(names.map(name => name.toLowerCase())).size === names.length;
  }

  function setupError() {
    if (!state.playerCount) return 'Choose 3 or 4 players to continue.';
    if (state.players.some(name => !name.trim())) return 'Enter a name for every player.';
    if (new Set(state.players.map(name => name.trim().toLowerCase())).size !== state.players.length) return 'Give each player a different name.';
    return '';
  }

  // Setup is three SKAI-styled steps inside the "setup" view: count → picker (once per player) → team.
  function goSetup(step) {
    state.setupStep = step;
    setView('setup', renderSetup);
  }

  function renderSetup() {
    if (state.setupStep === 'picker') renderSetupPicker();
    else if (state.setupStep === 'team') renderSetupTeam();
    else renderSetupCount();
  }

  function setupStepsMarkup(variant) {
    const steps = [
      ['Pick an avatar', 'and type your name'],
      ['Get your role', 'rule builder, tester or detective'],
      ['Run the mission', 'taking turns, one screen']
    ];
    return `<ol class="skai-steps ${variant}" aria-label="How the mission works">
      <li class="skai-step-line" aria-hidden="true"></li><li class="skai-step-line" aria-hidden="true"></li>
      ${steps.map(([title, detail], index) => `<li class="skai-step"><span class="skai-step-badge"><img src="assets/skai/step_hex.svg" alt=""><b>${index + 1}</b></span><strong>${title}</strong><small>${detail}</small></li>`).join('')}
    </ol>`;
  }

  function renderSetupCount() {
    stage.innerHTML = `
      <section class="screen skai-screen skai-count">
        <h1 class="skai-title">How many explorers are playing?</h1>
        <div class="skai-count-cards">
          ${[3, 4].map(number => `<button class="skai-card skai-count-card count-${number} ${state.playerCount === number ? 'selected' : ''}" type="button" data-player-count="${number}" aria-label="${number} explorers">
            <span class="skai-count-number">${number}</span>
            <span class="skai-explorers-row" aria-hidden="true"><img src="assets/skai/explorers_row.png" alt=""></span>
            <span class="skai-explorers-label">EXPLORERS</span>
          </button>`).join('')}
        </div>
        ${setupStepsMarkup('count')}
        <p class="skai-footnote">Three mission roles are shared out. With <b>4 explorers</b>, one role splits in two so everyone has a job.</p>
      </section>`;
    stage.querySelectorAll('[data-player-count]').forEach(button => {
      onTap(button, () => {
        const count = Number(button.dataset.playerCount);
        state.playerCount = count;
        state.players = Array.from({ length: count }, (_, index) => state.players[index] || '');
        state.avatars = Array.from({ length: count }, (_, index) => state.avatars[index] ?? null);
        state.pickerIndex = 0;
        state.returnToTeam = false;
        tone('tap');
        goSetup('picker');
      });
    });
  }

  function nameProblem(index) {
    const name = (state.players[index] || '').trim();
    if (!name) return 'Type your name to continue.';
    const clash = state.players.some((other, otherIndex) => otherIndex !== index && other.trim().toLowerCase() === name.toLowerCase());
    return clash ? 'Another explorer already has that name.' : '';
  }

  function pickerProblem(index) {
    if (!Number.isInteger(state.avatars[index])) return 'Tap an avatar to pick it.';
    return nameProblem(index);
  }

  function renderSetupPicker() {
    const index = state.pickerIndex;
    const chosen = state.avatars[index];
    const takenByOthers = new Set(state.avatars.filter((id, other) => other !== index && Number.isInteger(id)));
    const last = index === state.playerCount - 1;
    const nextLabel = state.returnToTeam ? 'BACK TO TEAM' : last ? 'MEET THE TEAM' : 'NEXT EXPLORER';
    const cells = [0, 1].map(sheet => `<div class="skai-avatar-sheet" role="group" aria-label="Avatars ${sheet ? '13 to 24' : '1 to 12'}">${AVATAR_NAMES.map((name, id) => {
      const taken = takenByOthers.has(id);
      return `<button class="skai-avatar-option ${chosen === id ? 'selected' : ''} ${taken ? 'taken' : ''}" type="button" data-avatar="${id}" style="--x:${SHEET_X[id % 4]};--y:${SHEET_Y[Math.floor(id / 4)]}" aria-pressed="${chosen === id}" aria-label="${name} robot${taken ? ' (taken)' : ''}" ${taken ? 'disabled' : ''}>${avatarMarkup(id)}</button>`;
    }).join('')}</div>`).join('');
    stage.innerHTML = `
      <section class="screen skai-screen skai-picker">
        <h1 class="visually-hidden">Explorer ${index + 1}: pick an avatar and type your name</h1>
        <div class="skai-avatar-grid">${cells}</div>
        <div class="skai-card skai-player-panel">
          ${Number.isInteger(chosen) ? avatarMarkup(chosen, 'panel-avatar') : '<img class="panel-placeholder" src="assets/skai/avatar_placeholder.svg" alt="">'}
          <h2>Player ${index + 1}</h2>
          <label class="skai-name-field">
            <img src="assets/skai/icon_user.svg" alt="">
            <input type="text" id="picker-name" value="${escapeHtml(state.players[index] || '')}" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Enter your name" aria-label="Player ${index + 1} name">
          </label>
          <p class="skai-field-note" id="picker-note" role="status">${pickerProblem(index)}</p>
        </div>
        ${setupStepsMarkup('picker')}
        <button class="skai-cta" id="picker-next" type="button" ${pickerProblem(index) ? 'disabled' : ''}>${skaiCtaInner(nextLabel)}</button>
      </section>`;

    const input = stage.querySelector('#picker-name');
    const refresh = () => {
      const problem = pickerProblem(index);
      stage.querySelector('#picker-note').textContent = problem;
      stage.querySelector('#picker-next').disabled = Boolean(problem);
    };
    stage.querySelectorAll('[data-avatar]').forEach(button => {
      button.addEventListener('click', () => {
        state.avatars[index] = Number(button.dataset.avatar);
        tone('drop');
        renderSetupPicker();
        stage.querySelector(pickerProblem(index) ? '#picker-name' : '#picker-next')?.focus();
      });
    });
    input.addEventListener('input', () => {
      state.players[index] = input.value;
      refresh();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') stage.querySelector('#picker-next').click();
    });
    onTap('#picker-next', () => {
      if (pickerProblem(index)) return;
      state.players[index] = state.players[index].trim();
      tone('correct');
      if (state.returnToTeam || last) {
        state.returnToTeam = false;
        goSetup('team');
      } else {
        state.pickerIndex += 1;
        goSetup('picker');
      }
    });
    if (!Number.isInteger(chosen)) stage.querySelector('.skai-avatar-option:not(:disabled)')?.focus();
  }

  function skaiCtaInner(label) {
    return `${['tl', 'bl', 'tr', 'br'].map(corner => `<img class="skai-cta-volt ${corner}" src="assets/skai/volt_button.svg" alt="">`).join('')}<span>${label}</span>`;
  }

  function teamReady() {
    return setupReady() && state.avatars.every(Number.isInteger);
  }

  function renderSetupTeam() {
    const count = state.playerCount;
    const chips = state.players.map((name, index) => `<li class="skai-chip">${avatarMarkup(state.avatars[index], 'chip-avatar')}<span class="skai-chip-name">${escapeHtml(name.trim() || `Player ${index + 1}`)}</span></li>`).join('');
    stage.innerHTML = `
      <section class="screen skai-screen skai-team team-${count}">
        <h1 class="visually-hidden">Your team of ${count} explorers</h1>
        <ul class="skai-chips" aria-label="Team">${chips}</ul>
        <div class="skai-team-cards">
          ${state.players.map((name, index) => `<div class="skai-card skai-team-card">
            <button class="skai-team-avatar" type="button" data-change-avatar="${index}" aria-label="Change Player ${index + 1}’s avatar">${avatarMarkup(state.avatars[index])}</button>
            <h2>Player ${index + 1}</h2>
            <label class="skai-name-field">
              <img src="assets/skai/icon_user.svg" alt="">
              <input type="text" data-team-name="${index}" value="${escapeHtml(name)}" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Enter your name" aria-label="Player ${index + 1} name">
            </label>
          </div>`).join('')}
        </div>
        <p class="skai-field-note team-note" id="team-note" role="status">${teamReady() ? '' : setupError()}</p>
        <button class="skai-cta" id="team-start" type="button" ${teamReady() ? '' : 'disabled'}>${skaiCtaInner('LET’S INVESTIGATE')}</button>
      </section>`;

    stage.querySelectorAll('[data-team-name]').forEach(input => {
      const index = Number(input.dataset.teamName);
      input.addEventListener('input', () => {
        state.players[index] = input.value;
        stage.querySelectorAll('.skai-chip-name')[index].textContent = input.value.trim() || `Player ${index + 1}`;
        stage.querySelector('#team-start').disabled = !teamReady();
        stage.querySelector('#team-note').textContent = teamReady() ? '' : setupError();
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') stage.querySelector('#team-start').click();
      });
    });
    stage.querySelectorAll('[data-change-avatar]').forEach(button => {
      onTap(button, () => {
        state.pickerIndex = Number(button.dataset.changeAvatar);
        state.returnToTeam = true;
        tone('tap');
        goSetup('picker');
      });
    });
    onTap('#team-start', () => {
      if (!teamReady()) {
        tone('wrong');
        return;
      }
      state.players = state.players.map(name => name.trim());
      state.activePlayerIndex = 0;
      tone('correct');
      setView('roles', renderRoles);
    });
  }

  function setupBack() {
    if (transitioning || state.view !== 'setup') return;
    tone('tap');
    if (state.setupStep === 'team') {
      state.pickerIndex = state.playerCount - 1;
      state.returnToTeam = false;
      goSetup('picker');
    } else if (state.setupStep === 'picker') {
      if (state.returnToTeam) {
        state.returnToTeam = false;
        goSetup('team');
      } else if (state.pickerIndex > 0) {
        state.pickerIndex -= 1;
        goSetup('picker');
      } else {
        goSetup('count');
      }
    }
  }

  function setupHint() {
    const hints = {
      count: 'Tap 3 or 4 to choose how many explorers are playing.',
      picker: 'Tap a robot to make it yours, then type your name.',
      team: 'Check every name, then tap Let’s investigate. Tap an avatar to change it.'
    };
    tone('tap');
    showToast(hints[state.setupStep] || hints.count, 2600);
  }

  function renderRoles() {
    const tasks = state.playerCount === 4
      ? ['Rank the clues and choose the checker style.', 'Run the message checks and retest the repaired rule.', 'Find the clue behind each mistake.', 'Move stars to repair the rule.']
      : ['Rank the clues and choose the checker style.', 'Run the message checks and retest the repaired rule.', 'Find each mistake and move stars to repair the rule.'];
    stage.innerHTML = `<section class="screen roles-screen"><h1 class="screen-heading">Meet your mission team</h1><p class="screen-support">Share one device. Pass it on when the highlighted role changes.</p><div class="role-grid">${state.players.map((name, i) => `<article class="panel role-card">${avatarMarkup(state.avatars[i], 'role-avatar')}<h2>${escapeHtml(name)}</h2><strong>${teamRoles()[i]}</strong><p>${tasks[i]}</p></article>`).join('')}</div><button class="primary-cta bottom-cta" id="roles-next" type="button">Team ready</button></section>`;
    onTap('#roles-next', () => { tone('tap'); setView('intro', renderIntro); });
  }

  function renderIntro() {
    stage.innerHTML = `
      <section class="screen intro">
        <img class="character left" src="assets/characters/guide_phone_worried.png" alt="A parent looking thoughtfully at a forwarded message">
        <img class="intro-message" src="assets/messages/message_school_closure_3d.png" alt="Forwarded school closure message">
        <div class="speech">Can your team help this parent check a forward?</div>
        <img class="character right" src="assets/characters/kids_group_listening.png" alt="Three students ready to help">
        <button class="primary-cta bottom-cta" id="start-game" type="button">Let’s build a checker!</button>
      </section>`;
    onTap('#start-game', () => {
      tone('tap');
      setView('tutorial', renderTutorial);
    });
  }

  function clueCardMarkup(clue, options = {}) {
    const selected = options.selected ? 'selected' : '';
    const draggable = options.draggable ? 'draggable="true"' : '';
    return `<button class="clue-card ${selected}" type="button" data-clue="${clue.id}" ${draggable} aria-pressed="${Boolean(options.selected)}">
      <img src="${clue.icon}" alt="">
      <strong>${clue.label}</strong>
      <small>${options.small || clue.tip}</small>
    </button>`;
  }

  function renderTutorial() {
    stage.innerHTML = `
      <section class="screen tutorial">
        <h1 class="screen-heading">We check 4 things.</h1>
        <p class="screen-support">Each clue asks one question about a message.</p>
        <div class="clue-grid">${CLUES.map(clue => clueCardMarkup(clue)).join('')}</div>
        <img class="character right small" src="assets/characters/guide_smiling_neutral.png" alt="The guide smiling">
        <button class="primary-cta bottom-cta" id="tutorial-next" type="button">Next</button>
      </section>`;
    stage.querySelectorAll('.clue-card').forEach(card => {
      card.addEventListener('click', () => {
        tone('tap');
        stage.querySelectorAll('.clue-card').forEach(el => el.classList.toggle('selected', el === card));
      });
    });
    onTap('#tutorial-next', () => {
      tone('tap');
      setView('ranking', renderRanking);
    });
  }

  // ---------- Ranking and checker style ----------

  function availableClues() {
    return CLUES.filter(clue => !state.clueOrder.includes(clue.id));
  }

  function placeClue(clueId, slotIndex) {
    if (!clueById(clueId) || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) return;
    const previousIndex = state.clueOrder.indexOf(clueId);
    const displaced = state.clueOrder[slotIndex];
    if (previousIndex >= 0) state.clueOrder[previousIndex] = displaced || null;
    state.clueOrder[slotIndex] = clueId;
    state.selectedClue = null;
    tone('drop');
    renderRanking();
  }

  function starRowMarkup(count) {
    return `<span class="mini-stars" aria-hidden="true">${'★'.repeat(count)}</span>`;
  }

  function renderRanking() {
    const pool = availableClues();
    const complete = state.clueOrder.every(Boolean);
    const support = state.selectedClue
      ? `Now tap a numbered slot for ${clueById(state.selectedClue).label}.`
      : 'Drag each clue—or tap it, then tap a numbered slot. Tap a placed clue to move it.';
    stage.innerHTML = `
      <section class="screen ranking">
        <h1 class="screen-heading">Which clues matter most?</h1>
        <p class="screen-support">${support}</p>
        <div class="ranking-layout">
          <div class="clue-grid rank-pool ${pool.length ? '' : 'complete'}">
            ${pool.length ? pool.map(clue => clueCardMarkup(clue, { draggable: true, selected: state.selectedClue === clue.id })).join('') : '<p class="screen-support">Your first rule is ready. Higher clues get more stars.</p>'}
          </div>
          <div class="rank-slots" aria-label="Clue importance ranking">
            <span class="rail-label more">MATTERS MORE</span><span class="rail-label less">MATTERS LESS</span>
            ${state.clueOrder.map((id, index) => {
              const clue = id ? clueById(id) : null;
              const weight = 4 - index;
              return `<button class="rank-slot ${clue ? 'filled' : ''} ${state.selectedClue ? 'awaiting' : ''}" type="button" data-slot="${index}" aria-label="Slot ${index + 1}${clue ? `: ${clue.label}, ${stars(weight)}` : ', empty'}">
                <span class="rank-number">${index + 1}</span>
                ${clue ? `<img src="${clue.icon}" alt=""><strong>${clue.label}</strong>` : '<strong class="slot-empty">Place a clue</strong>'}
                <em>${starRowMarkup(weight)} ${stars(weight)}</em>
              </button>`;
            }).join('')}
          </div>
        </div>
        <button class="primary-cta bottom-cta" id="ranking-next" type="button" ${complete ? '' : 'disabled'}>Next</button>
      </section>`;

    stage.querySelectorAll('.rank-pool .clue-card').forEach(card => {
      card.addEventListener('click', () => {
        state.selectedClue = state.selectedClue === card.dataset.clue ? null : card.dataset.clue;
        tone('tap');
        renderRanking();
      });
      card.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', card.dataset.clue);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    stage.querySelectorAll('.rank-slot').forEach(slot => {
      const slotIndex = Number(slot.dataset.slot);
      slot.addEventListener('click', () => {
        if (state.selectedClue) placeClue(state.selectedClue, slotIndex);
        else if (state.clueOrder[slotIndex]) {
          state.selectedClue = state.clueOrder[slotIndex];
          state.clueOrder[slotIndex] = null;
          tone('tap');
          renderRanking();
        }
      });
      slot.addEventListener('dragover', event => { event.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('over'));
      slot.addEventListener('drop', event => {
        event.preventDefault();
        placeClue(event.dataTransfer.getData('text/plain'), slotIndex);
      });
    });
    onTap('#ranking-next', () => {
      state.weights = Object.fromEntries(state.clueOrder.map((id, index) => [id, 4 - index]));
      tone('correct');
      setView('style', renderStyle);
    });
  }

  function styleRuleCopy(style) {
    return `Closer look at ${style.green}★ · Suspicious at ${style.red}★`;
  }

  function renderStyle() {
    stage.innerHTML = `
      <section class="screen checker-style">
        <h1 class="screen-heading">How careful should our checker be?</h1>
        <p class="screen-support">Each message gets a risk score: the stars of every clue with a problem.</p>
        <div class="style-grid">
          ${STYLES.map(item => `<button class="style-card ${state.checkerStyle === item.id ? 'selected' : ''}" type="button" data-style="${item.id}" aria-pressed="${state.checkerStyle === item.id}" aria-label="${item.label}: ${styleRuleCopy(item)}"><img src="${item.asset}" alt=""><span class="style-rule">${styleRuleCopy(item)}</span></button>`).join('')}
        </div>
        <img class="character left small" src="assets/characters/guide_pointing_right.png" alt="The guide pointing to the options">
        <button class="primary-cta bottom-cta" id="style-next" type="button" ${state.checkerStyle ? '' : 'disabled'}>Use this rule</button>
      </section>`;
    stage.querySelectorAll('.style-card').forEach(card => {
      card.addEventListener('click', () => {
        state.checkerStyle = card.dataset.style;
        tone('drop');
        renderStyle();
        stage.querySelector(`[data-style="${card.dataset.style}"]`)?.focus();
      });
    });
    onTap('#style-next', () => {
      state.currentMessageIndex = 0;
      state.testResults = [];
      tone('correct');
      setView('test', renderTest);
    });
  }

  // ---------- Rule engine ----------

  function thresholds() {
    const style = styleById(state.checkerStyle) || styleById('balanced');
    return { green: style.green, red: style.red };
  }

  function computeResult(message, weights = state.weights) {
    const score = CLUES.reduce((sum, clue) => sum + (message.issues[clue.id] ? weights[clue.id] : 0), 0);
    const limits = thresholds();
    const status = score < limits.green ? 'green' : score < limits.red ? 'amber' : 'red';
    return { messageId: message.id, score, status };
  }

  // A real message must not be flagged red; a fake or misleading one must not pass as green.
  function mistakeKind(result, message) {
    if (message.truth === 'real') return result.status === 'red' ? 'false-alarm' : null;
    return result.status === 'green' ? 'miss' : null;
  }

  function findMistakes(weights = state.weights) {
    return window.MESSAGE_DATA
      .map(message => {
        const result = computeResult(message, weights);
        return { message, result, kind: mistakeKind(result, message) };
      })
      .filter(item => item.kind);
  }

  function resultCopy(status) {
    if (status === 'green') return { headline: 'LIKELY OKAY', icon: '✓' };
    if (status === 'amber') return { headline: 'NEEDS A CLOSER LOOK', icon: '?' };
    return { headline: 'SUSPICIOUS', icon: '!' };
  }

  function explainResult(message, result) {
    const limits = thresholds();
    const active = CLUES.filter(clue => message.issues[clue.id]).sort((a, b) => state.weights[b.id] - state.weights[a.id]);
    if (!active.length) return 'No clue showed a problem, so the risk score stayed at 0★.';
    const names = active.map(clue => `${clue.label} (${state.weights[clue.id]}★)`).join(' + ');
    const verdict = result.status === 'green'
      ? `That is below ${limits.green}★, so it looks okay.`
      : result.status === 'amber'
        ? `That reaches ${limits.green}★, so it needs a closer look.`
        : `That reaches ${limits.red}★, so it is flagged suspicious.`;
    return `${names} = ${result.score}★. ${verdict}`;
  }

  function scoreMeterMarkup(score) {
    const limits = thresholds();
    const pct = value => `${(Math.min(value, TOTAL_STARS) / TOTAL_STARS) * 100}%`;
    return `<div class="score-meter" role="img" aria-label="Risk score ${score} of ${TOTAL_STARS}. Closer look from ${limits.green}, suspicious from ${limits.red}.">
      <div class="meter-track" style="--green-end:${pct(limits.green)};--red-start:${pct(limits.red)}">
        <span class="meter-marker" style="left:${pct(score)}"><b>${score}★</b></span>
      </div>
      <div class="meter-scale" aria-hidden="true"><span>0</span><span style="left:${pct(limits.green)}">${limits.green}</span><span style="left:${pct(limits.red)}">${limits.red}</span><span style="left:100%">${TOTAL_STARS}</span></div>
    </div>`;
  }

  // ---------- Test run ----------

  function scanTileMarkup(clue) {
    return `<div class="scan-tile" data-scan="${clue.id}"><img src="${clue.icon}" alt=""><strong>${clue.label}</strong><span class="scan-weight">${starRowMarkup(state.weights[clue.id])}</span><span class="scan-state">?</span></div>`;
  }

  function renderTest() {
    const message = currentMessage();
    stage.innerHTML = `
      <section class="screen test-screen">
        <h1 class="screen-heading">Check this message</h1>
        <p class="screen-support"><strong>${escapeHtml(activePlayerName())}</strong>, lead message ${state.currentMessageIndex + 1} of ${window.MESSAGE_DATA.length}.</p>
        <div class="test-layout">
          <div class="phone-stage"><div class="gameplay-phone">
          <img class="phone-frame" src="assets/decor/gameplay_phone.png" alt="" aria-hidden="true">
          <article class="live-message phone-display" aria-label="Incoming message on phone">
            <header class="message-topline"><span class="chat-avatar" aria-hidden="true">↗</span><div><strong>Forwarded message</strong><small>Read it. Question it. Check it.</small></div><span class="message-counter">${state.currentMessageIndex + 1} / ${window.MESSAGE_DATA.length}</span></header>
            <div class="message-content"><div class="message-copy"><span class="message-eyebrow">INCOMING MESSAGE</span><h2>${escapeHtml(message.title)}</h2><p>${escapeHtml(message.body)}</p></div><div class="message-art"><img src="${message.illustration}" alt="Illustration accompanying the message"></div></div>
            <footer class="message-footer">A forward is a claim. Look at all four clues before deciding.</footer>
          </article>
          </div></div>
          <div class="scan-side">
            <div class="scan-heading"><span>YOUR CHECKLIST</span><strong>Inspect the evidence</strong></div>
            <div class="scan-grid">${CLUES.map(scanTileMarkup).join('')}</div>
            <div class="checker-bar">
              <button class="primary-cta" id="check-message" type="button">Check</button>
            </div>
          </div>
        </div>
      </section>`;
    stage.querySelector('#check-message').addEventListener('click', runScan, { once: true });
  }

  function runScan() {
    const button = stage.querySelector('#check-message');
    button.disabled = true;
    button.textContent = 'Checking…';
    const message = currentMessage();
    const result = computeResult(message);
    state.currentResult = result;
    CLUES.forEach((clue, index) => {
      scanLater(() => {
        const tile = stage.querySelector(`[data-scan="${clue.id}"]`);
        if (!tile) return;
        const hasIssue = message.issues[clue.id];
        const weight = state.weights[clue.id];
        tile.classList.add(hasIssue ? (weight >= 3 ? 'issue' : 'warn') : 'safe');
        tile.querySelector('.scan-state').textContent = hasIssue ? `+${weight}` : '✓';
        tone('light');
      }, 330 * (index + 1));
    });
    scanLater(() => {
      state.testResults.push(result);
      tone(result.status === 'green' ? 'correct' : result.status === 'red' ? 'wrong' : 'drop');
      scanLater(() => setView('result', renderResult), 650);
    }, 330 * 5);
  }

  function renderResult() {
    const message = currentMessage();
    const result = state.currentResult;
    const copy = resultCopy(result.status);
    const finalMessage = state.currentMessageIndex === window.MESSAGE_DATA.length - 1;
    stage.innerHTML = `
      <section class="screen result-screen">
        <h1 class="screen-heading">Here’s what your rule decided</h1>
        <div class="panel result-layout">
          <div class="result-head ${result.status}"><span class="result-icon">${copy.icon}</span><h2>${copy.headline}</h2></div>
          ${scoreMeterMarkup(result.score)}
          <p class="result-reason">${explainResult(message, result)}</p>
          <div class="result-clues">
            ${CLUES.map(clue => `<div class="result-clue ${message.issues[clue.id] ? 'issue' : ''}"><img src="${clue.icon}" alt=""><strong>${clue.label}</strong><span>${message.issues[clue.id] ? `+${stars(state.weights[clue.id])}` : 'Looks okay'}</span></div>`).join('')}
          </div>
        </div>
        <img class="character right small" src="assets/characters/guide_pointing_right.png" alt="The guide pointing at the result">
        <button class="primary-cta bottom-cta" id="result-next" type="button">${finalMessage ? 'See the batch' : 'Next message'}</button>
      </section>`;
    onTap('#result-next', () => {
      tone('tap');
      if (finalMessage) {
        state.initialCorrect = window.MESSAGE_DATA.length - findMistakes().length;
        setView('batch', renderBatch);
      } else {
        state.currentMessageIndex += 1;
        setView('test', renderTest);
      }
    });
  }

  function mistakeSummary(item) {
    return item.kind === 'miss'
      ? `Your rule said likely okay, but it is really: ${item.message.truthLabel.toLowerCase()}.`
      : `Your rule said suspicious, but it is really a ${item.message.truthLabel.toLowerCase()}.`;
  }

  function renderBatch() {
    const mistakes = findMistakes();
    const total = window.MESSAGE_DATA.length;
    const correct = total - mistakes.length;
    const perfect = mistakes.length === 0;
    const cards = mistakes.map(item => `<div class="panel mistake-card ${item.kind}"><img src="${item.message.asset}" alt=""><div><span class="mistake-tag">${item.kind === 'miss' ? 'MISSED' : 'FALSE ALARM'}</span><strong>${item.message.short}</strong><span>${mistakeSummary(item)}</span></div></div>`).join('');
    const support = perfect
      ? 'Every message was sorted correctly on the first try.'
      : `${mistakes.length === 1 ? 'One tricky example' : `${mistakes.length} tricky examples`} exposed a weak spot in the rule.`;
    stage.innerHTML = `
      <section class="screen batch-screen">
        <h1 class="screen-heading">${perfect ? 'Perfect! Your rule got every message right.' : 'You checked all the messages!'}</h1>
        <p class="screen-support">${support}</p>
        <div class="batch-layout">
          <div class="score-row">
            <div class="panel score-card good"><strong>${correct}</strong><span>behaved as expected</span></div>
            <div class="panel score-card review"><strong>${mistakes.length}</strong><span>need attention</span></div>
          </div>
          ${perfect ? '' : `<div class="mistake-row ${mistakes.length > 2 ? 'compact' : ''}">${cards}</div>`}
        </div>
        <img class="character right small" src="assets/characters/kids_group_celebrating.png" alt="Students celebrating their test run">
        <button class="primary-cta bottom-cta" id="fix-mistakes" type="button">${perfect ? 'See final result' : 'Fix the mistakes'}</button>
      </section>`;
    onTap('#fix-mistakes', () => {
      tone('tap');
      if (perfect) setView('final', renderFinal);
      else startDebug(mistakes[0]);
    });
  }

  // ---------- Debug loop: find cause → move a star → retest ----------

  function startDebug(item) {
    state.debug = { messageId: item.message.id, kind: item.kind, target: null };
    state.causeAttempts = 0;
    setView('cause', renderCause);
  }

  function renderCause() {
    const message = messageById(state.debug.messageId);
    const result = computeResult(message);
    const tooLittle = state.debug.kind === 'miss';
    stage.innerHTML = `
      <section class="screen cause-screen" data-mistake-kind="${state.debug.kind}">
        <h1 class="screen-heading">What fooled the checker?</h1>
        <p class="screen-support"><strong>${escapeHtml(activePlayerName())}</strong>, find the clue that got ${tooLittle ? 'too little' : 'too much'} weight.</p>
        <div class="cause-layout">
          <div class="cause-evidence">
            <img class="cause-message" src="${message.asset}" alt="${escapeHtml(message.title)}">
            <div class="panel compare-panel">
              <div><strong>ACTUAL</strong><span>${message.truthLabel}</span></div>
              <div class="${result.status}"><strong>APP SAID</strong><span>${resultCopy(result.status).headline} (${result.score}★)</span></div>
            </div>
          </div>
          <div class="answer-grid">
            ${CLUES.map(clue => `<button class="answer-tile" type="button" data-answer="${clue.id}"><img src="${clue.icon}" alt="">${clue.label}<small>${stars(state.weights[clue.id])}</small></button>`).join('')}
            <p class="hint" id="cause-hint" role="status"></p>
          </div>
        </div>
        <img class="character left small" src="assets/characters/kid_blue_thinking.png" alt="A student thinking about the cause">
      </section>`;
    stage.querySelectorAll('.answer-tile').forEach(tile => {
      tile.addEventListener('click', () => checkCause(tile));
    });
  }

  function checkCause(tile) {
    const message = messageById(state.debug.messageId);
    const answer = tile.dataset.answer;
    const hint = stage.querySelector('#cause-hint');
    if (message.issues[answer]) {
      state.debug.target = answer;
      state.badges.cause = true;
      tone('correct');
      tile.classList.add('correct');
      stage.querySelectorAll('.answer-tile').forEach(item => { item.disabled = true; });
      const clue = clueById(answer);
      const score = computeResult(message).score;
      const limits = thresholds();
      hint.textContent = state.debug.kind === 'miss'
        ? `${clue.label} has only ${stars(state.weights[answer])}, so the score stayed at ${score}★—below the ${limits.green}★ line.`
        : `${clue.label} has ${stars(state.weights[answer])}, pushing this real message to ${score}★—the ${limits.red}★ red line.`;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'cause-next';
      button.className = 'primary-cta bottom-cta';
      button.textContent = 'Fix this';
      stage.querySelector('.screen').appendChild(button);
      onTap(button, () => { tone('tap'); enterAdjust(); });
      button.focus();
      return;
    }
    state.causeAttempts += 1;
    tone('wrong');
    tile.classList.remove('wrong');
    void tile.offsetWidth;
    tile.classList.add('wrong');
    hint.textContent = state.causeAttempts >= 2
      ? `Hint: ${message.note}`
      : `${clueById(answer).label} looks fine in this message. Which clue shows a problem?`;
  }

  function enterAdjust() {
    state.move = null;
    state.selectedFrom = null;
    state.mistakeIdsBeforeMove = findMistakes().map(item => item.message.id);
    setView('adjust', renderAdjust);
  }

  // A miss needs a star moved TO the target; a false alarm needs one moved FROM it.
  function canGive(clueId) {
    const { kind, target } = state.debug;
    if (state.weights[clueId] <= MIN_STARS) return false;
    return kind === 'miss' ? clueId !== target : clueId === target;
  }

  function canReceive(clueId) {
    const { kind, target } = state.debug;
    if (state.weights[clueId] >= MAX_STARS || clueId === state.selectedFrom) return false;
    return kind === 'miss' ? clueId === target : clueId !== target;
  }

  // Which currently-correct messages would break if this card gave (miss) or took (false alarm) the star.
  function movePreview(clueId) {
    const { kind, target } = state.debug;
    const usable = kind === 'miss' ? canGive(clueId) : clueId !== target && state.weights[clueId] < MAX_STARS;
    if (state.move || !usable) return null;
    const from = kind === 'miss' ? clueId : target;
    const to = kind === 'miss' ? target : clueId;
    const trial = { ...state.weights, [from]: state.weights[from] - 1, [to]: state.weights[to] + 1 };
    const current = new Set(findMistakes().map(item => item.message.id));
    return findMistakes(trial).filter(item => !current.has(item.message.id)).map(item => item.message.short);
  }

  function weightCardMarkup(clue) {
    const { target, kind } = state.debug;
    const preview = movePreview(clue.id);
    const weight = state.weights[clue.id];
    const isTarget = clue.id === target;
    const giving = !state.move && canGive(clue.id);
    const receiving = !state.move && state.selectedFrom && canReceive(clue.id);
    const delta = state.move ? (state.move.to === clue.id ? '+1' : state.move.from === clue.id ? '−1' : '') : '';
    const tag = isTarget ? (kind === 'miss' ? 'Needs more stars' : 'Has too many stars') : '';
    const starButtons = Array.from({ length: MAX_STARS }, (_, index) => {
      if (index >= weight) return `<span class="weight-star empty" aria-hidden="true"><img src="assets/weights/star_empty.png" alt=""></span>`;
      const movable = giving && index === weight - 1;
      const selected = movable && state.selectedFrom === clue.id;
      return movable
        ? `<button class="weight-star movable ${selected ? 'selected' : ''}" type="button" draggable="true" data-star-from="${clue.id}" aria-pressed="${selected}" aria-label="Pick up a star from ${clue.label}"><img src="assets/weights/star_full.png" alt=""></button>`
        : `<span class="weight-star" aria-hidden="true"><img src="assets/weights/star_full.png" alt=""></span>`;
    }).join('');
    const risk = preview
      ? `<small class="weight-risk ${preview.length ? 'bad' : 'ok'}">${preview.length ? `Would break: ${preview.join(', ')}` : 'Safe move'}</small>`
      : '';
    return `<div class="panel weight-card ${isTarget ? 'target' : ''} ${receiving ? 'drop-ready' : ''} ${state.selectedFrom === clue.id ? 'giving' : ''}" data-weight-card="${clue.id}" data-weight="${weight}" ${preview ? `data-safe="${!preview.length}"` : ''} ${receiving ? `role="button" tabindex="0" aria-label="Drop the star on ${clue.label}"` : ''}>
      ${tag ? `<span class="weight-tag">${tag}</span>` : ''}
      ${delta ? `<span class="weight-delta ${delta === '+1' ? 'up' : 'down'}">${delta}</span>` : ''}
      <img class="clue-icon" src="${clue.icon}" alt=""><h2>${clue.label}</h2>
      <div class="stars">${starButtons}</div>
      <p>${stars(weight)}</p>
      ${risk}
    </div>`;
  }

  function adjustInstruction() {
    const { kind, target } = state.debug;
    const label = clueById(target).label;
    if (state.move) return `you moved a star from ${clueById(state.move.from).label} to ${clueById(state.move.to).label}. Test it, or undo.`;
    if (kind === 'miss') {
      return state.selectedFrom
        ? `now tap ${label} to drop the star.`
        : 'pick up a star from another clue. Taking stars away can weaken other checks!';
    }
    return state.selectedFrom
      ? 'now tap the clue that should get the star.'
      : `pick up a star from ${label}, then give it to another clue.`;
  }

  function renderAdjust() {
    const { kind, target } = state.debug;
    const label = clueById(target).label;
    stage.innerHTML = `
      <section class="screen adjust-screen" data-mistake-kind="${kind}">
        <h1 class="screen-heading">${kind === 'miss' ? `Give ${label} one more star` : `Take one star from ${label}`}</h1>
        <p class="screen-support"><strong>${escapeHtml(activePlayerName())}</strong>, ${adjustInstruction()}</p>
        <div class="adjust-layout">${CLUES.map(weightCardMarkup).join('')}</div>
        <p class="adjust-total">Total: ${TOTAL_STARS} stars · each clue keeps ${MIN_STARS}–${MAX_STARS}</p>
        <div class="bottom-actions">
          ${state.move ? '<button class="secondary-cta small-cta" id="undo-move" type="button">Undo</button>' : ''}
          <button class="primary-cta" id="retest-button" type="button" ${state.move ? '' : 'disabled'}>Test again</button>
        </div>
      </section>`;

    stage.querySelectorAll('[data-star-from]').forEach(star => {
      star.addEventListener('click', event => {
        event.stopPropagation();
        state.selectedFrom = state.selectedFrom === star.dataset.starFrom ? null : star.dataset.starFrom;
        tone('tap');
        renderAdjust();
        stage.querySelector('.weight-card.drop-ready')?.focus();
      });
      star.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', `star:${star.dataset.starFrom}`);
        state.selectedFrom = star.dataset.starFrom;
      });
    });
    stage.querySelectorAll('[data-weight-card]').forEach(card => {
      const clueId = card.dataset.weightCard;
      card.addEventListener('click', () => {
        if (state.move) return;
        if (state.selectedFrom && canReceive(clueId)) applyMove(state.selectedFrom, clueId);
        else if (canGive(clueId)) {
          state.selectedFrom = state.selectedFrom === clueId ? null : clueId;
          tone('tap');
          renderAdjust();
          stage.querySelector('.weight-card.drop-ready')?.focus();
        } else {
          const full = state.weights[clueId] >= MAX_STARS ? ' It already has the most stars.' : '';
          const empty = state.weights[clueId] <= MIN_STARS && clueId !== target ? ` ${clueById(clueId).label} must keep at least ${stars(MIN_STARS)}.` : '';
          showToast(kind === 'miss'
            ? `Pick up a star from another clue, then tap ${label}.${empty}`
            : `Only ${label} can give a star here, to any other clue.${full}`);
        }
      });
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && card.classList.contains('drop-ready')) {
          event.preventDefault();
          card.click();
        }
      });
      card.addEventListener('dragover', event => {
        if (!state.move && state.selectedFrom && canReceive(clueId)) {
          event.preventDefault();
          card.classList.add('drop-ready');
        }
      });
      card.addEventListener('dragleave', () => card.classList.remove('drop-ready'));
      card.addEventListener('drop', event => {
        event.preventDefault();
        const from = event.dataTransfer.getData('text/plain').replace(/^star:/, '');
        if (!state.move && clueById(from) && canGive(from)) {
          state.selectedFrom = from;
          if (canReceive(clueId)) applyMove(from, clueId);
        }
      });
    });
    onTap('#undo-move', undoMove);
    onTap('#retest-button', () => {
      tone('tap');
      runRetest();
    });
  }

  function applyMove(from, to) {
    if (state.move || !canGive(from) || !canReceive(to)) return;
    const before = { ...state.weights };
    state.weights[from] -= 1;
    state.weights[to] += 1;
    state.move = { from, to, before };
    state.selectedFrom = null;
    tone('drop');
    showToast('One star moved. The total stayed the same.');
    renderAdjust();
    stage.querySelector('#retest-button')?.focus();
  }

  function undoMove() {
    if (!state.move) return;
    state.weights = { ...state.move.before };
    state.move = null;
    state.selectedFrom = null;
    tone('tap');
    renderAdjust();
  }

  function runRetest() {
    const mistakes = findMistakes();
    const ids = new Set(mistakes.map(item => item.message.id));
    const before = new Set(state.mistakeIdsBeforeMove);
    const debugFixed = !ids.has(state.debug.messageId);
    if (debugFixed) state.badges.fix = true;
    state.fixHistory.push({ ...state.move, after: { ...state.weights }, debugFixed });
    state.lastRetest = {
      debugFixed,
      mistakes,
      newlyBroken: mistakes.filter(item => !before.has(item.message.id)),
      newlyFixed: state.mistakeIdsBeforeMove.filter(id => !ids.has(id)).length
    };
    setView('retest', renderRetest);
  }

  function batchStripMarkup(mistakes) {
    const wrong = new Set(mistakes.map(item => item.message.id));
    return `<div class="batch-strip" aria-label="Batch results">${window.MESSAGE_DATA.map(message => `<span class="batch-dot ${wrong.has(message.id) ? 'bad' : 'good'}" title="${escapeHtml(message.short)}">${wrong.has(message.id) ? '!' : '✓'}</span>`).join('')}</div>`;
  }

  function renderRetest() {
    const { debugFixed, mistakes, newlyBroken } = state.lastRetest;
    const message = messageById(state.debug.messageId);
    const result = computeResult(message);
    const copy = resultCopy(result.status);
    const total = window.MESSAGE_DATA.length;
    const allCorrect = mistakes.length === 0;
    const target = clueById(state.debug.target);
    let detail;
    if (debugFixed) detail = `${target.label} now has the right weight for this message.`;
    else if (state.debug.kind === 'miss') detail = `${target.label} still needs more stars to lift the score to ${thresholds().green}★.`;
    else detail = `${target.label} still pushes this real message into red.`;
    const brokenNote = newlyBroken.length
      ? `<p class="broken-note">Careful! That move broke: ${newlyBroken.map(item => item.message.short).join(', ')}.</p>`
      : '';
    let primary;
    if (allCorrect) primary = { id: 'retest-final', label: 'See final result' };
    else if (!debugFixed) primary = { id: 'retest-again', label: 'Adjust again' };
    else primary = { id: 'retest-next-mistake', label: 'Fix next mistake' };
    stage.innerHTML = `
      <section class="screen retest-screen">
        <h1 class="screen-heading">Retest the batch</h1>
        <p class="screen-support">The checker scanned all ${total} messages again with your new rule.</p>
        <div class="retest-layout">
          <img class="message-image" src="${message.asset}" alt="${escapeHtml(message.title)}">
          <div class="panel retest-result ${debugFixed ? 'fixed' : 'not-fixed'}">
            <div class="big-check">${debugFixed ? '✓' : '?'}</div>
            <h2>${debugFixed ? 'FIX CHECKED!' : 'ONE MORE LOOK'}</h2>
            <p>This message now shows <strong>${copy.headline}</strong> (${result.score}★).</p>
            <p>${detail}</p>
            ${brokenNote}
            <p class="batch-count"><strong>${total - mistakes.length} of ${total}</strong> correct</p>
            ${batchStripMarkup(mistakes)}
          </div>
        </div>
        <img class="character right small ${debugFixed ? 'celebrate' : ''}" src="assets/characters/${debugFixed ? 'kid_yellow_excited' : 'kid_yellow_thinking'}.png" alt="A student reacting to the retest">
        <div class="bottom-actions">
          ${allCorrect ? '' : '<button class="secondary-cta small-cta" id="retest-finish" type="button">Finish with review</button>'}
          <button class="primary-cta" id="${primary.id}" type="button">${primary.label}</button>
        </div>
      </section>`;
    tone(debugFixed ? 'correct' : 'wrong');
    onTap('#retest-final', () => setView('final', renderFinal));
    onTap('#retest-finish', () => setView('final', renderFinal));
    onTap('#retest-again', () => { tone('tap'); enterAdjust(); });
    onTap('#retest-next-mistake', () => { tone('tap'); startDebug(mistakes[0]); });
  }

  // ---------- Final and recap ----------

  function renderFinal() {
    const mistakes = findMistakes();
    const wrong = new Set(mistakes.map(item => item.message.id));
    const total = window.MESSAGE_DATA.length;
    const verified = total - mistakes.length;
    const improved = verified - state.initialCorrect;
    const rounds = state.fixHistory.length;
    const support = [];
    if (state.fixHistory.length) support.push(`First run: ${state.initialCorrect} of ${total}. ${improved > 0 ? `Up ${improved} after ${rounds} star move${rounds === 1 ? '' : 's'}.` : `${rounds} star move${rounds === 1 ? '' : 's'} tested.`}`);
    support.push(mistakes.length ? 'Messages marked ! still need a human check.' : 'The whole batch passed.');
    const badges = [
      { src: 'assets/badges/badge_rule_tested.png', label: 'Rule Tested', earned: true },
      { src: 'assets/badges/badge_cause_found.png', label: 'Cause Found', earned: state.badges.cause },
      { src: 'assets/badges/badge_fix_checked.png', label: 'Fix Checked', earned: state.badges.fix }
    ];
    stage.innerHTML = `
      <section class="screen final-screen">
        <h1 class="screen-heading">${mistakes.length ? `Your rule: ${verified} of ${total} checked correctly` : `Your rule checked all ${total} correctly!`}</h1>
        <p class="screen-support">${support.join(' ')}</p>
        <div class="final-layout">
          <div class="message-check-grid">
            ${window.MESSAGE_DATA.map(message => `<div class="message-mini ${wrong.has(message.id) ? 'needs-review' : ''}"><img src="${message.asset}" alt=""><strong>${message.short}</strong><small>${wrong.has(message.id) ? 'Review needed' : message.truthLabel}</small></div>`).join('')}
          </div>
          <div class="badge-row">
            ${badges.map(badge => `<figure class="badge ${badge.earned ? '' : 'locked'}"><img src="${badge.src}" alt="${badge.label} badge${badge.earned ? '' : ' (not earned)'}"><figcaption>${badge.earned ? 'Earned' : 'Not needed'}</figcaption></figure>`).join('')}
          </div>
        </div>
        <img class="character left small celebrate" src="assets/characters/guide_and_kids_happy.png" alt="The guide and students celebrating">
        <button class="primary-cta bottom-cta" id="finish-button" type="button">Finish</button>
      </section>`;
    tone('badge');
    onTap('#finish-button', showRecap);
  }

  function showRecap() {
    state.finished = true;
    const remaining = findMistakes().length;
    const points = ['You built a rule and tested every message.'];
    points.push(state.badges.cause ? 'You found what fooled the checker.' : 'Your first rule made no mistakes.');
    if (state.fixHistory.length) points.push(`You moved ${state.fixHistory.length === 1 ? 'a star' : `stars ${state.fixHistory.length} times`} and retested the batch.`);
    points.push(remaining ? `${remaining} message${remaining === 1 ? '' : 's'} still need${remaining === 1 ? 's' : ''} a human check—no rule is perfect!` : 'Remember: even a good rule needs a human to double-check.');
    recapModal.querySelector('.modal-card').innerHTML = `
      <div class="recap">
        <h2 id="recap-title">Mission complete!</h2>
        <div class="recap-points">${points.map(point => `<div class="recap-point">${point}</div>`).join('')}</div>
        <button class="menu-button primary" id="play-again" type="button">Play again</button>
      </div>`;
    recapModal.hidden = false;
    recapModal.querySelector('#play-again').addEventListener('click', restartGame);
    recapModal.querySelector('#play-again').focus();
    tone('correct');
  }

  // ---------- Settings, restart and boot ----------

  function openSettings() {
    if (state.finished) return;
    settingsModal.hidden = false;
    settingsModal.querySelector('#music-button').textContent = `Music: ${state.musicOn ? 'On' : 'Off'}`;
    settingsModal.querySelector('#sfx-button').textContent = `Sound effects: ${state.sfxOn ? 'On' : 'Off'}`;
    setTimeout(() => settingsModal.querySelector('#resume-button').focus(), 0);
  }

  function closeSettings() {
    settingsModal.hidden = true;
    skaiInfo.focus();
  }

  function restartGame() {
    document.querySelector('#turn-modal').hidden = true;
    stopMissionClock();
    scanTimers.forEach(clearTimeout);
    scanTimers.clear();
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
    state = freshState({ soundOn: state.soundOn, musicOn: state.musicOn, sfxOn: state.sfxOn });
    settingsModal.hidden = true;
    recapModal.hidden = true;
    updateSoundButton();
    renderMissionClock();
    setView('setup', renderSetup, { force: true });
  }

  function updateSoundButton() {
    skaiSound.classList.toggle('muted', !state.soundOn);
    skaiSound.setAttribute('aria-pressed', String(!state.soundOn));
    skaiSound.setAttribute('aria-label', state.soundOn ? 'Mute sound' : 'Turn sound on');
  }

  // Back gear: steps back through setup; during the mission it opens the menu (resume / restart).
  function onBackGear() {
    if (state.view === 'setup') setupBack();
    else openSettings();
  }

  const GAME_HINTS = {
    roles: 'Pass the device to the player marked LEAD whenever the job changes.',
    intro: 'Tap the button to start building your checker.',
    tutorial: 'Tap each clue card to read the question it asks.',
    ranking: 'Put the clue you trust most in slot 1. Tap a clue, then tap a slot.',
    style: 'Careful sends more messages for a closer look. Strict flags more as suspicious.',
    test: 'Tap Check. Every clue with a problem adds its stars to the risk score.',
    result: 'The meter shows where this score landed against your checker style.',
    batch: 'A miss is a fake that passed as okay. A false alarm is real news flagged red.',
    cause: 'Pick a clue that shows a problem in this message.',
    adjust: 'Look for a card marked “Safe move” before you move a star.',
    retest: 'Fix the next mistake, or finish and leave it for a human to check.',
    final: 'Tap Finish to see your mission recap.'
  };

  function onHintGear() {
    if (state.view === 'setup') {
      setupHint();
      return;
    }
    tone('tap');
    showToast(GAME_HINTS[state.view] || 'Follow the instructions under the title.', 3000);
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    updateSoundButton();
    updateMusicLoop();
    if (state.soundOn) tone('tap');
  }

  settingsModal.querySelector('#resume-button').addEventListener('click', closeSettings);
  settingsModal.querySelector('#music-button').addEventListener('click', event => {
    state.musicOn = !state.musicOn;
    event.currentTarget.textContent = `Music: ${state.musicOn ? 'On' : 'Off'}`;
    updateMusicLoop();
    tone('tap');
  });
  settingsModal.querySelector('#sfx-button').addEventListener('click', event => {
    state.sfxOn = !state.sfxOn;
    event.currentTarget.textContent = `Sound effects: ${state.sfxOn ? 'On' : 'Off'}`;
    if (state.sfxOn) tone('tap');
  });
  settingsModal.querySelector('#restart-button').addEventListener('click', restartGame);

  skaiSound.addEventListener('click', toggleSound);
  skaiInfo.addEventListener('click', openSettings);
  skaiBack.addEventListener('click', onBackGear);
  document.querySelector('#skai-hint').addEventListener('click', onHintGear);
  settingsModal.addEventListener('click', event => {
    if (event.target === settingsModal) closeSettings();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !settingsModal.hidden) closeSettings();
  });

  function preload() {
    const critical = [
      'assets/skai/avatars.png',
      'assets/skai/explorers_row.png',
      'assets/characters/guide_phone_worried.png',
      'assets/characters/kids_group_listening.png',
      'assets/messages/message_school_closure_3d.png',
      ...CLUES.map(clue => clue.icon)
    ];
    const tasks = critical.map(src => new Promise(resolve => {
      const image = new Image();
      image.onload = image.onerror = resolve;
      image.src = src;
    }));
    Promise.race([Promise.all(tasks), new Promise(resolve => setTimeout(resolve, 2200))]).then(() => {
      loadingEl.classList.add('hidden');
      setTimeout(() => loadingEl.remove(), 450);
      renderProgress();
      renderSetup();
    });
  }

  // ---------- DEV MENU HOOK — only used by dev/dev-menu.js. Delete this block along with the dev/ folder. ----------
  window.CheckerDev = {
    get state() { return state; },
    views: { setup: renderSetup, roles: renderRoles, intro: renderIntro, tutorial: renderTutorial, ranking: renderRanking, style: renderStyle, test: renderTest, result: renderResult, batch: renderBatch, cause: renderCause, adjust: renderAdjust, retest: renderRetest, final: renderFinal },
    go: (view, renderFn) => setView(view, renderFn, { force: true }),
    computeResult,
    findMistakes,
    showRecap
  };
  // ---------- END DEV MENU HOOK ----------

  preload();
})();
