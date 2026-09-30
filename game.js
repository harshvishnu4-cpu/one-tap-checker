(() => {
  'use strict';

  const stage = document.querySelector('#stage');
  const gameShell = document.querySelector('#game-shell');

  // Responsive frame: the game is laid out at 1600×900 and scaled as a whole to fit the screen (see styles.css).
  function fitGameToScreen() {
    const view = window.visualViewport;
    const width = view ? view.width : window.innerWidth;
    const height = view ? view.height : window.innerHeight;
    gameShell.style.setProperty('--fit', String(Math.min(width / 1600, height / 900)));
  }
  fitGameToScreen();
  window.addEventListener('resize', fitGameToScreen);
  window.addEventListener('orientationchange', () => setTimeout(fitGameToScreen, 150));
  window.visualViewport?.addEventListener('resize', fitGameToScreen);

  // On phones and tablets, Start goes fullscreen and asks for landscape so the game uses the whole screen.
  function enterPlayMode() {
    if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement) return;
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    Promise.resolve(request.call(root))
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => { /* not supported (e.g. iPhone Safari) — the game still scales to fit */ });
  }
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

  // Bottom CTA + HUD rail lines: the rails only show while a bottom CTA is on screen. When a CTA
  // first appears it pops in and the rails slide out from behind it. Re-renders of the same
  // screen keep the button still; leaving a screen retracts the rails.
  const BOTTOM_CTA = '.bottom-cta, .bottom-actions, .skai-cta';
  let ctaShown = false;
  function hideCtaRails() {
    ctaShown = false;
    gameShell.classList.remove('cta-rails');
  }
  // A CTA only counts as "needed" once it can be pressed: disabled buttons stay hidden (see styles.css)
  // and pop in the moment they become enabled.
  function neededCta() {
    if (typeof narrationLock !== 'undefined' && narrationLock) return null;
    return [...stage.querySelectorAll(BOTTOM_CTA)].find(element =>
      element.matches('button') ? !element.disabled : Boolean(element.querySelector('button:not(:disabled)')));
  }
  function syncCtaRails() {
    const cta = neededCta();
    if (cta && !ctaShown) {
      cta.classList.remove('cta-pop');
      void cta.offsetWidth; // restart the pop if this same button was hidden and shown again
      cta.classList.add('cta-pop');
      gameShell.classList.add('cta-rails');
    } else if (!cta && ctaShown) {
      gameShell.classList.remove('cta-rails');
    }
    ctaShown = Boolean(cta);
  }
  new MutationObserver(syncCtaRails).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  // ---------- Narration ----------
  // Pre-recorded with ElevenLabs Multilingual v2, voice "Suhana J" (Indian English) — see assets/audio/narration/SCRIPT.md.
  // Each screen is narrated the first time it appears. While a line plays the screen is locked and its
  // buttons stay hidden; when the line ends the players can continue.
  const NARRATED_SCREENS = new Set(['setup-count', 'setup-picker', 'setup-team', 'roles', 'intro', 'tutorial', 'ranking', 'sensitivity', 'test', 'result', 'batch', 'cause', 'adjust', 'retest', 'final']);
  const narrationAudio = new Audio();
  narrationAudio.preload = 'auto';
  const narratedOnce = new Set();
  let narrationLock = false;
  let narrationSafety = null;
  let narrationToken = 0;

  // Word-timed highlights: while a line names a clue, its card lights up. Times (seconds) were measured
  // from the pauses in each recording (see assets/audio/narration/SCRIPT.md).
  const NARRATION_CUES = {
    tutorial: [
      { at: 3.0, until: 4.15, clues: ['source'] },                          // "the source"
      { at: 4.18, until: 5.2, clues: ['date'] },                            // "the date"
      { at: 5.25, until: 6.3, clues: ['image'] },                           // "the image"
      { at: 6.35, until: 8.5, clues: ['urgent'] }                           // "and urgent words"
    ],
    ranking: [
      { at: 3.75, until: 5.8, selector: '.allocation-bank' }                 // "Share twenty points"
    ]
  };
  // After a screen's line ends, a hand points at the first thing to tap (removed on the next re-render).
  const NARRATION_NUDGES = {
    ranking: '[data-change="1"][data-id="source"]'
  };
  let cueFrame = null;

  // Lights up what a cue names: clue cards (by id) or any element (by selector).
  function spotlight(cue) {
    const targets = !cue ? [] : cue.selector
      ? [...stage.querySelectorAll(cue.selector)]
      : cue.clues.map(id => stage.querySelector(`[data-clue="${id}"]`)).filter(Boolean);
    stage.querySelectorAll('.narration-spotlight').forEach(el => { if (!targets.includes(el)) el.classList.remove('narration-spotlight'); });
    targets.forEach(el => el.classList.add('narration-spotlight'));
  }

  function showHandNudge(selector) {
    const target = stage.querySelector(selector);
    const screen = stage.querySelector('.screen');
    if (!target || !screen || screen.querySelector('.hand-nudge')) return;
    const t = target.getBoundingClientRect();
    const box = screen.getBoundingClientRect();
    const hand = document.createElement('span');
    hand.className = 'hand-nudge';
    hand.setAttribute('aria-hidden', 'true');
    hand.textContent = '👆';
    hand.style.left = `${((t.left + t.width / 2 - box.left) / box.width) * 100}%`;
    hand.style.top = `${((t.bottom - t.height * .2 - box.top) / box.height) * 100}%`;
    screen.appendChild(hand);
  }

  function afterNarration(key) {
    if (NARRATION_NUDGES[key] && narrationKey() === key) showHandNudge(NARRATION_NUDGES[key]);
  }

  function runNarrationCues(key) {
    cancelAnimationFrame(cueFrame);
    const cues = NARRATION_CUES[key];
    if (!cues) return;
    const tick = () => {
      if (!narrationLock) { spotlight(null); return; }
      const t = narrationAudio.currentTime;
      const cue = cues.find(item => t >= item.at && t < item.until);
      spotlight(cue || null);
      cueFrame = requestAnimationFrame(tick);
    };
    cueFrame = requestAnimationFrame(tick);
  }

  function silenceMusicNow() {
    if (!audioContext || !musicVoice) return;
    try {
      musicVoice.gain.cancelScheduledValues(audioContext.currentTime);
      musicVoice.gain.setTargetAtTime(.0001, audioContext.currentTime, .04);
    } catch { /* note already finished */ }
  }

  const narrationKey = () => (state.view === 'setup' ? `setup-${state.setupStep}` : state.view);

  function setNarrationLock(on) {
    narrationLock = on;
    gameShell.classList.toggle('narrating', on);
    if (!on) {
      gameShell.classList.add('narration-reveal');
      setTimeout(() => gameShell.classList.remove('narration-reveal'), 700);
    }
    syncCtaRails();
  }

  function stopNarration() {
    narrationToken += 1;
    clearTimeout(narrationSafety);
    narrationAudio.onended = narrationAudio.onerror = null;
    narrationAudio.pause();
    cancelAnimationFrame(cueFrame);
    spotlight(null);
    if (narrationLock) setNarrationLock(false);
  }

  function playNarration(key) {
    stopNarration();
    if (!state.soundOn || !NARRATED_SCREENS.has(key)) { afterNarration(key); return; }
    const token = narrationToken;
    const finish = () => { if (token === narrationToken) { stopNarration(); afterNarration(key); } };
    narrationAudio.src = `assets/audio/narration/${key}.mp3`;
    narrationAudio.onended = finish;
    narrationAudio.onerror = finish;
    setNarrationLock(true);
    silenceMusicNow();
    runNarrationCues(key);
    narrationAudio.play().then(() => {
      // Safety net: never keep the players locked longer than the clip (plus a little slack).
      const seconds = Number.isFinite(narrationAudio.duration) ? narrationAudio.duration : 15;
      narrationSafety = setTimeout(finish, (seconds + 2) * 1000);
    }).catch(finish); // autoplay blocked (no tap yet) or file missing: just let them play
  }

  // Narrate the current screen once it is actually visible (after any "your turn" pop-up is closed).
  function narrateScreen({ replay = false } = {}) {
    const key = narrationKey();
    if (!replay && narratedOnce.has(key)) return;
    const turnModal = document.querySelector('#turn-modal');
    if (turnModal && !turnModal.hidden) {
      const watcher = new MutationObserver(() => {
        if (!turnModal.hidden) return;
        watcher.disconnect();
        if (narrationKey() === key) narrateScreen({ replay });
      });
      watcher.observe(turnModal, { attributes: true, attributeFilter: ['hidden'] });
      return;
    }
    narratedOnce.add(key);
    playNarration(key);
  }

  // While narrating, taps and keys on the stage do nothing (the HUD — sound, info, hint — still works).
  ['pointerdown', 'click', 'keydown'].forEach(type => stage.addEventListener(type, event => {
    if (!narrationLock) return;
    event.preventDefault();
    event.stopPropagation();
  }, true));
  const MISSION_SECONDS = 35 * 60;

  const CLUES = [
    { id: 'source', label: 'Source', icon: 'assets/icons/clue_source_reference.png', tip: 'Who sent it?' },
    { id: 'date', label: 'Date', icon: 'assets/icons/clue_date_reference.png', tip: 'Is it current?' },
    { id: 'image', label: 'Image', icon: 'assets/icons/clue_image_reference.png', tip: 'Is the picture reused?' },
    { id: 'urgent', label: 'Urgent Words', icon: 'assets/icons/clue_urgent_reference.png', tip: 'Is it pushing you to act fast?' }
  ];

  const TOTAL_STARS = 20;
  const MIN_STARS = 1;
  const MAX_STARS = 10;

  const SCREEN_PROGRESS = {
    setup: 0, roles: 1, intro: 2, tutorial: 3, ranking: 4,
    sensitivity: 5, test: 6, result: 6, batch: 7, cause: 8, adjust: 9, retest: 9, final: 10
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
      checkerStyle: 'strict',
      reviewThreshold: 6,
      suspiciousThreshold: 8,
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
  let musicVoice = null; // gain node of the music note currently sounding
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
  const messageById = id => window.MESSAGE_DATA.find(message => message.id === id);
  const currentMessage = () => window.MESSAGE_DATA[state.currentMessageIndex];

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
      // Ignore taps on a button that a previous tap already replaced (e.g. a fast double-tap on Next message).
      if (transitioning || !element.isConnected) return;
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
    if (!audioContext || !state.soundOn || !state.musicOn || narrationLock) return;
    const notes = [220, 277.18, 329.63, 277.18, 246.94, 329.63];
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[musicStep % notes.length];
    musicVoice = gain;
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

  // ---------- Screen history for the back tab ----------
  // Each entry is a screen plus the state as it was when that screen was first shown. The back tab
  // restores the previous entry, keeping the team (names, avatars), sound settings and the clock.
  let screenHistory = [];
  let currentScreen = null;
  const snapshot = (source = state) => (typeof structuredClone === 'function' ? structuredClone(source) : JSON.parse(JSON.stringify(source)));

  function goBack() {
    if (transitioning || !screenHistory.length) return;
    const entry = screenHistory.pop();
    scanTimers.forEach(clearTimeout);
    scanTimers.clear();
    const keep = { players: [...state.players], avatars: [...state.avatars], playerCount: state.playerCount, soundOn: state.soundOn, musicOn: state.musicOn, sfxOn: state.sfxOn, timeLeft: state.timeLeft };
    state = Object.assign(snapshot(entry.snapshot), entry.leaveInputs || {}, keep, { finished: false });
    tone('tap');
    setView(entry.view, entry.renderFn, { force: true, back: true });
  }

  // Same as setView but without the screen transition: the checker screen stays put and only its
  // contents update (used between messages). History, the HUD and narration stay in sync.
  function swapView(view, renderFn) {
    if (transitioning) return;
    if (currentScreen) screenHistory.push(currentScreen);
    state.view = view;
    state.activePlayerIndex = roleOwner(view);
    renderFn();
    currentScreen = { view, renderFn, snapshot: snapshot() };
    renderProgress();
    narrateScreen();
  }

  // A short two-note "new message" chime (respects the sound and effects switches).
  function notificationChime() {
    ensureAudio();
    if (!state.soundOn || !state.sfxOn || !audioContext) return;
    [[880, 0], [1320, .12]].forEach(([frequency, delay]) => {
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.07, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .32);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .34);
    });
  }

  function setView(view, renderFn, { force = false, back = false } = {}) {
    if (transitioning && !force) return;
    if (!back && currentScreen) {
      // The ranking screen's own edits (the points) survive going back to it.
      if (currentScreen.view === 'ranking') currentScreen.leaveInputs = { weights: { ...state.weights }, clueOrder: [...state.clueOrder] };
      screenHistory.push(currentScreen);
    }
    document.querySelector('#turn-modal').hidden = true;
    toggleSoundMenu(false);
    clearTimeout(transitionTimer);
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
    transitioning = true;
    stage.inert = true;
    stage.style.pointerEvents = 'none';
    stage.classList.add('leaving');
    stopNarration();
    hideCtaRails();
    transitionTimer = setTimeout(() => {
      const previousOwner = state.activePlayerIndex;
      state.view = view;
      state.activePlayerIndex = roleOwner(view);
      stage.style.pointerEvents = '';
      stage.inert = false;
      stage.classList.remove('leaving');
      stage.classList.add('entering');
      renderFn();
      currentScreen = { view, renderFn, snapshot: snapshot() };
      renderProgress();
      transitioning = false;
      requestAnimationFrame(() => stage.classList.remove('entering'));
      stage.focus({ preventScroll: true });
      const tasks = { ranking: 'Share 20 points across the four clues using plus and minus. Discuss each weight; every clue needs 1–10 points.', test: 'Read the message aloud. Ask your team about the four clues, then press Check.', cause: 'Compare the result with the evidence. Choose the clue that caused the mistake.', adjust: 'Listen to the detective, move one star, then ask the tester to retest.', retest: 'Read the new result aloud. Check whether the change helped or created another mistake.' };
      if (tasks[view] && (previousOwner !== state.activePlayerIndex || view === 'ranking')) {
        const modal = document.querySelector('#turn-modal');
        modal.dataset.task = view;
        modal.style.setProperty('--turn-accent', ['#008c9b','#d62478','#bd6a08','#7754ba'][state.activePlayerIndex]);
        document.querySelector('#turn-title').innerHTML = `<span>${escapeHtml(activePlayerName())},</span> your turn`;
        document.querySelector('#turn-name').textContent = activePlayerName();
        document.querySelector('#turn-avatar').innerHTML = avatarMarkup(state.avatars[state.activePlayerIndex], 'turn-avatar');
        document.querySelector('#turn-art').innerHTML = view === 'ranking'
          ? CLUES.map(clue => `<span class="turn-clue"><img src="${clue.icon}" alt=""></span>`).join('')
          : `<img class="turn-task-icon" src="assets/icons/role_${({test:'tester',cause:'detective',adjust:'fixer',retest:'tester'})[view]}_v2.png" alt="">`;
        document.querySelector('#turn-role').textContent = teamRoles()[state.activePlayerIndex];
        document.querySelector('#turn-task').textContent = tasks[view];
        modal.hidden = false;
        stage.inert = true;
        const ready = document.querySelector('#turn-ready');
        ready.onclick = () => { modal.hidden = true; stage.inert = false; stage.focus({preventScroll:true}); };
        ready.focus();
      }
      narrateScreen();
    }, 220);
  }

  // Updates the SKAI HUD: vertical progress bar, player chips (with the LEAD player lit up) and the mission clock.
  function renderProgress() {
    const isSetup = state.view === 'setup';
    gameShell.classList.toggle('welcome-mode', state.view === 'welcome');
    gameShell.classList.toggle('setup-mode', isSetup);
    skaiBack.disabled = !screenHistory.length;
    skaiBack.setAttribute('aria-label', 'Back to the previous screen');
    const current = isSetup ? 1 : Math.max(1, SCREEN_PROGRESS[state.view] || 1);
    const total = Math.max(...Object.values(SCREEN_PROGRESS));
    skaiProgressText.textContent = `${current}/${total}`;
    // The Figma bar has ten stripes (bottom → top); light up the share of the mission that is done.
    const stripes = skaiProgress.querySelectorAll('.hud-progress-stripes path');
    const lit = Math.round((current / total) * stripes.length);
    stripes.forEach((stripe, index) => stripe.setAttribute('fill', index < lit ? '#FCA01B' : '#FBEBA8'));
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
    // Draining bar inside the timer plate: shows at a glance how much of the mission is left.
    const timerPlate = skaiTimerText.parentElement;
    timerPlate.style.setProperty('--time-left', String(left / MISSION_SECONDS));
    timerPlate.classList.toggle('warn', left > 5 * 60 && left <= 10 * 60);
  }
  function startMissionClock() {
    if (missionTimer) return;
    missionTimer = setInterval(() => {
      if (['welcome', 'setup'].includes(state.view) || state.finished || document.hidden || document.querySelector('.modal:not([hidden])') || state.timeLeft <= 0) return;
      state.timeLeft -= 1;
      renderMissionClock();
    }, 1000);
  }
  renderMissionClock();
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

  function renderWelcome() {
    stage.innerHTML = `<section class="screen welcome-screen" aria-label="Forwarded Message Checker">
      <img class="welcome-thumbnail" src="assets/thumbnails/forwarded-message-checker.png" alt="Forwarded Message Checker — investigate messages together. For 3–4 players.">
      <div class="welcome-actions"><button class="primary-cta" id="start-mission" type="button">Start mission <span aria-hidden="true">→</span></button></div>
    </section>`;
    onTap('#start-mission', () => { tone('tap'); enterPlayMode(); setView('setup', renderSetup); });
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
    return `<span>${label}</span>`;
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
      ? ['Share 20 points across the four clues. Then set how carefully the checker checks.', 'Read each message, run its checks, and retest the repaired rule.', 'Find the clue behind each mistake.', 'Move stars to repair the rule.']
      : ['Share 20 points across the four clues. Then set how carefully the checker checks.', 'Read each message, run its checks, and retest the repaired rule.', 'Find each mistake and move stars to repair the rule.'];
    const roleIcons = ['assets/icons/role_builder_v2.png', 'assets/icons/role_tester_v2.png', 'assets/icons/role_detective_v2.png', 'assets/icons/role_fixer_v2.png'];
    stage.innerHTML = `<section class="screen roles-screen" data-team-size="${state.playerCount}">
      <header class="mission-team-heading"><h1 class="screen-heading">Meet Your Mission Team</h1><p class="screen-support">Everyone has a role. Work together to build and test the checker.</p></header>
      <div class="role-grid">${state.players.map((name, i) => `<article class="panel role-card" style="--role-accent:${['#08b6bf','#ef438f','#ff951b','#8262cf'][i]}">
        <div class="role-identity">${avatarMarkup(state.avatars[i], 'role-avatar')}<h2>${escapeHtml(name)}</h2><strong class="role-ribbon"><span aria-hidden="true">${['✦','✓','⌕','↔'][i]}</span>${teamRoles()[i]}</strong></div>
        <div class="role-job"><img src="${roleIcons[i]}" alt=""><p>${tasks[i]}</p></div>
      </article>`).join('')}</div>
      <p class="team-device-note">One shared device · Pass it on when the active player changes.</p>
      <button class="primary-cta bottom-cta" id="roles-next" type="button">Let’s begin <span aria-hidden="true">→</span></button>
    </section>`;
    onTap('#roles-next', () => { tone('tap'); setView('intro', renderIntro); });
  }

  function renderIntro() {
    stage.innerHTML = `
      <section class="screen intro">
        <div class="intro-parent"><img src="assets/characters/guide_phone_worried.png" alt="A worried parent looking thoughtfully at a forwarded message"></div>
        <h1 class="intro-challenge">Can you build a checker<br>this parent can <span>trust?</span></h1>
        <article class="intro-notification" aria-labelledby="notification-title">
          <header><span>↪ <em>Forwarded</em></span><button id="dismiss-notification" type="button" aria-label="Dismiss notification">×</button></header>
          <div class="notification-body"><div><h1 id="notification-title">School closed today</h1><p>Heavy rain is expected. Classes are closed today. Please check the school notice page for updates.</p></div><img src="assets/icons/icon_school_rain_3d.png" alt="School in heavy rain"></div>
          <footer>6:40 AM</footer>
        </article>
        <button id="reopen-notification" class="secondary-cta" type="button" hidden>Read the notification</button>
        <div class="intro-next"><button class="primary-cta" id="start-game" type="button">Let’s build <span aria-hidden="true">→</span></button></div>
      </section>`;
    onTap('#dismiss-notification', () => {
      stage.querySelector('.intro-notification').hidden = true;
      stage.querySelector('#reopen-notification').hidden = false;
      stage.querySelector('#reopen-notification').focus();
    });
    onTap('#reopen-notification', () => {
      stage.querySelector('.intro-notification').hidden = false;
      stage.querySelector('#reopen-notification').hidden = true;
      stage.querySelector('#dismiss-notification').focus();
    });
    onTap('#start-game', () => {
      tone('tap');
      setView('tutorial', renderTutorial);
    });
  }

  function renderTutorial() {
    stage.innerHTML = `
      <section class="screen tutorial">
        <h1 class="screen-heading">4 CLUES. ONE CHECKER.</h1>
        <p class="screen-support">Each clue asks one question about a message.</p>
        <div class="clue-grid">${CLUES.map((clue, index) => `<button class="clue-card" type="button" data-clue="${clue.id}" aria-pressed="false"><span class="tutorial-art"><img src="assets/icons/clue_${clue.id}_reference.png" alt=""></span><span class="tutorial-copy"><strong>${['Source','Date','Reused Image','Urgent Wording'][index]}</strong><small>${['Is there a real source?','Is it current?','Has this image appeared before?','Is it pushing you to act fast?'][index]}</small></span></button>`).join('')}</div>
        <button class="primary-cta bottom-cta" id="tutorial-next" type="button">Next: Give each clue its weight <span aria-hidden="true">→</span></button>
      </section>`;
    stage.querySelectorAll('.clue-card').forEach(card => {
      card.addEventListener('click', () => {
        tone('tap');
        stage.querySelectorAll('.clue-card').forEach(el => { el.classList.toggle('selected', el === card); el.setAttribute('aria-pressed', String(el === card)); });
      });
    });
    onTap('#tutorial-next', () => {
      tone('tap');
      setView('ranking', renderRanking);
    });
  }

  // ---------- Ranking and checker style ----------

  function renderRanking() {
    const used = CLUES.reduce((sum, clue) => sum + (state.weights[clue.id] || 0), 0);
    const remaining = TOTAL_STARS - used;
    const complete = remaining === 0 && CLUES.every(clue => state.weights[clue.id] >= MIN_STARS);
    stage.innerHTML = `
      <section class="screen ranking allocation-screen">
        <h1 class="screen-heading">HOW MUCH SHOULD EACH CLUE COUNT?</h1>
        <p class="screen-support">Share 20 points across the four clues. Give each clue 1–10 points.</p>
        <div class="allocation-grid">
          ${CLUES.map((clue, i) => {
            const value = state.weights[clue.id] || 0;
            const label = ['Source','Date','Reused Image','Urgent Wording'][i];
            return `<article class="allocation-card" data-allocation="${clue.id}">
              <div class="allocation-art"><img src="assets/icons/clue_${clue.id}_reference.png" alt=""><h2>${label}</h2></div>
              <div class="allocation-controls">
                <div class="allocation-stepper"><button type="button" data-change="-1" data-id="${clue.id}" aria-label="Remove one point from ${label}" ${value === 0 ? 'disabled' : ''}>−</button><output aria-label="${label} points">${value}</output><button type="button" data-change="1" data-id="${clue.id}" aria-label="Add one point to ${label}" ${remaining === 0 || value >= MAX_STARS ? 'disabled' : ''}>+</button></div>
                <div class="allocation-dots" aria-hidden="true">${Array.from({length: MAX_STARS},(_,n)=>`<i class="${n<value?'filled':''}"></i>`).join('')}</div>
              </div>
            </article>`;
          }).join('')}
        </div>
        <div class="allocation-bank"><div class="bank-coins" aria-hidden="true">${Array.from({length:TOTAL_STARS},(_,n)=>`<i class="${n<remaining?'available':'spent'}"></i>`).join('')}</div><p role="status">${remaining ? `${remaining} points left to share` : complete ? 'All 20 points assigned. Your rule is ready!' : 'Give every clue at least 1 point to continue.'}</p></div>
        <button class="primary-cta bottom-cta" id="ranking-next" type="button" ${complete?'':'disabled'}>Set checking thresholds <span aria-hidden="true">→</span></button>
      </section>`;
    stage.querySelectorAll('[data-change]').forEach(button => button.addEventListener('click', () => {
      const id=button.dataset.id, delta=Number(button.dataset.change);
      const value=state.weights[id]||0;
      if (value+delta<0 || value+delta>MAX_STARS || (delta>0 && remaining===0)) return;
      state.weights[id]=value+delta;
      tone('drop');
      renderRanking();
      const next=stage.querySelector(`[data-id="${id}"][data-change="${delta}"]`);
      (next.disabled ? stage.querySelector(`[data-id="${id}"][data-change="${-delta}"]`) : next).focus();
    }));
    onTap('#ranking-next', () => {
      if (!complete) return;
      state.clueOrder = CLUES.map(clue=>clue.id).sort((a,b)=>state.weights[b]-state.weights[a]);
      tone('correct');
      state.currentMessageIndex=0;
      state.testResults=[];
      setView('sensitivity',renderSensitivity);
    });
  }


  // ---------- Rule engine ----------

  function thresholds() {
    return { green: state.reviewThreshold, red: state.suspiciousThreshold };
  }

  function renderSensitivity() {
    const labels = ['Source','Date','Reused image','Urgent wording'];
    const sample = window.MESSAGE_DATA.find(m => m.issues.image) || window.MESSAGE_DATA[0];
    const result = computeResult(sample);
    stage.innerHTML = `<section class="screen sensitivity-screen">
      <h1 class="screen-heading">How careful should our checker be?</h1>
      <p class="screen-support">Set when a message needs review or looks suspicious.</p>
      <div class="sensitivity-example">
        <div class="example-message"><h2>Example message</h2><div><img src="${sample.illustration}" alt=""><p><strong>${escapeHtml(sample.title)}</strong><span>${escapeHtml(sample.body)}</span></p></div></div>
        <div class="example-clues"><h2>Risk score from clues</h2><div class="example-clue-grid">${CLUES.map((c,i)=>`<article><img src="assets/icons/clue_${c.id}_reference.png" alt=""><strong>${labels[i]}</strong><b>${sample.issues[c.id] ? state.weights[c.id] : 0}</b><small>/ ${state.weights[c.id]} points</small></article>`).join('')}</div></div>
        <div class="example-total"><strong>Total risk score</strong><b>${result.score}</b><span>out of ${TOTAL_STARS}</span><em id="example-verdict" aria-live="polite"></em></div>
      </div>
      <div class="threshold-panel">
        <div class="threshold-spectrum" aria-hidden="true"><span>0</span><div id="threshold-colors"></div><span>20</span></div>
        <div class="threshold-controls"><label for="review-threshold">Review starts at <output id="review-value"></output><input id="review-threshold" type="range" min="1" max="19" value="${state.reviewThreshold}"></label><label for="suspicious-threshold">Suspicious starts at <output id="suspicious-value"></output><input id="suspicious-threshold" type="range" min="2" max="20" value="${state.suspiciousThreshold}"></label></div>
        <div class="threshold-legend"><div><strong>LIKELY OKAY</strong><span id="trust-range"></span></div><div><strong>REVIEW</strong><span id="review-range"></span></div><div><strong>SUSPICIOUS</strong><span id="suspicious-range"></span></div></div>
      </div>
      <button class="primary-cta bottom-cta" id="sensitivity-next" type="button">Use these settings →</button>
    </section>`;
    const update = () => {
      const {green,red}=thresholds();
      stage.querySelector('#review-threshold').value=green;
      stage.querySelector('#review-threshold').max=red-1;
      stage.querySelector('#suspicious-threshold').value=red;
      stage.querySelector('#suspicious-threshold').min=green+1;
      stage.querySelector('#review-value').textContent=green;
      stage.querySelector('#suspicious-value').textContent=red;
      stage.querySelector('#trust-range').textContent=`Score below ${green}`;
      stage.querySelector('#review-range').textContent=`Score ${green}–${red-1}`;
      stage.querySelector('#suspicious-range').textContent=`Score ${red} or more`;
      stage.querySelector('#threshold-colors').style.background=`linear-gradient(90deg,#49ce78 0 ${green/20*100}%,#ffcf43 ${green/20*100}% ${red/20*100}%,#ff656b ${red/20*100}% 100%)`;
      const status=computeResult(sample).status;
      const verdict=stage.querySelector('#example-verdict');
      verdict.textContent={green:'LIKELY OKAY',amber:'REVIEW',red:'SUSPICIOUS'}[status];
      verdict.className=status;
    };
    stage.querySelector('#review-threshold').addEventListener('input',event=>{state.reviewThreshold=Math.max(1,Math.min(Number(event.target.value),state.suspiciousThreshold-1));update();});
    stage.querySelector('#suspicious-threshold').addEventListener('input',event=>{state.suspiciousThreshold=Math.min(20,Math.max(Number(event.target.value),state.reviewThreshold+1));update();});
    update();
    onTap('#sensitivity-next',()=>{tone('tap');setView('test',renderTest);});
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

  // ---------- Test run ----------

  function scanTileMarkup(clue) {
    const done = state.view === 'result';
    const issue = currentMessage().issues[clue.id];
    const weight = state.weights[clue.id];
    const label = {source:'Source',date:'Date',image:'Reused image',urgent:'Urgent wording'}[clue.id];
    return `<tr class="rule-row ${done ? issue ? 'issue' : 'safe' : ''}" data-scan="${clue.id}"><th scope="row"><img src="assets/icons/clue_${clue.id}_reference.png" alt=""><span>${label}</span></th><td><span class="rule-coins" aria-hidden="true">${Array.from({length:weight},()=>'<i></i>').join('')}</span><span class="rule-weight">${weight} points</span></td><td><span class="scan-state" aria-label="${label} contribution">${done ? issue ? `+${weight}` : '0' : '—'}</span></td></tr>`;
  }

  function renderTest() {
    const message = currentMessage();
    const done = state.view === 'result';
    const result = done ? state.currentResult : null;
    stage.innerHTML = `
      <section class="screen test-screen">
        <h1 class="screen-heading">Run the checker</h1>
        <p class="screen-support"><strong>${escapeHtml(activePlayerName())}</strong>, lead message ${state.currentMessageIndex + 1} of ${window.MESSAGE_DATA.length}.</p>
        <div class="test-layout">
          <div class="phone-stage"><div class="gameplay-phone">
          <img class="phone-frame" src="assets/decor/gameplay_phone.png" alt="" aria-hidden="true">
          <article class="live-message phone-display" aria-label="Incoming message on phone">
            <header class="message-topline"><span class="chat-avatar" aria-hidden="true">↗</span><div><strong>Forwarded message</strong><small>Read it. Question it. Check it.</small></div><span class="message-counter">${state.currentMessageIndex + 1} / ${window.MESSAGE_DATA.length}</span></header>
            <div class="message-content"><div class="message-copy"><span class="message-eyebrow">INCOMING MESSAGE</span><h2>${escapeHtml(message.title)}</h2><p>${escapeHtml(message.body)}</p></div><div class="message-art"><img src="${message.illustration}" alt="Illustration accompanying the message"></div></div>
            <footer class="message-footer">Your rule: ${thresholds().green} points → review · ${thresholds().red} or more → suspicious</footer>
          </article>
          </div></div>
          <div class="scan-side rule-workspace">
            <div class="rule-heading"><h2>YOUR RULE</h2><span>Total = ${TOTAL_STARS} points</span></div>
            <table class="rule-table"><thead><tr><th>Check</th><th>Your weight</th><th>Message score</th></tr></thead><tbody>${CLUES.map(scanTileMarkup).join('')}</tbody></table>
            <div class="rule-summary" aria-live="polite"><strong>Risk score</strong><div class="risk-total">${done ? `<b>${result.score}</b> / ${TOTAL_STARS}<small>${CLUES.filter(c=>message.issues[c.id]).map(c=>state.weights[c.id]).join(' + ') || '0'} = ${result.score}</small>` : `<b>—</b> / ${TOTAL_STARS}<small>Run all four checks</small>`}</div><div class="risk-verdict ${done ? result.status : ''}">${done ? {green:'LIKELY OKAY',amber:'REVIEW',red:'SUSPICIOUS'}[result.status] : 'READY TO CHECK'}</div></div>
            <div class="checker-bar">
              ${done ? `<button class="primary-cta" id="result-next" type="button">${state.currentMessageIndex === window.MESSAGE_DATA.length-1 ? 'See the batch' : 'Next message'} →</button>` : '<button class="primary-cta" id="check-message" type="button">Check message →</button>'}
            </div>
          </div>
        </div>
      </section>`;
    if (!done) stage.querySelector('#check-message').addEventListener('click', runScan, { once: true });
  }

  function runScan() {
    const button = stage.querySelector('#check-message');
    button.disabled = true;
    button.textContent = 'Checking…';
    const message = currentMessage();
    const result = computeResult(message);
    state.currentResult = result;
    const phone = stage.querySelector('.phone-display');
    const content = phone.querySelector('.message-content');
    phone.classList.add('is-scanning');
    phone.setAttribute('aria-busy', 'true');
    phone.scrollTop = 0;
    const scanNote = document.createElement('div');
    scanNote.className = 'phone-scan-status';
    scanNote.setAttribute('role', 'status');
    scanNote.textContent = 'Scanning message…';
    phone.querySelector('.message-topline').after(scanNote);
    const phrases = {
      source: /school notice page|official forecast|official school page|no source or evidence|Doctors do not want you to know|You won!/gi,
      date: /today|after 6 PM|8:00 AM|last year|4:30 PM|this week/gi,
      image: /dramatic photo|shared again/gi,
      urgent: /closed today|next 5 minutes|given away|Strong winds|Share now/gi
    };
    const highlight = clue => {
      phone.dataset.scanClue = clue.id;
      scanNote.textContent = `Checking ${clue.label.toLowerCase()}…`;
      content.querySelectorAll('mark').forEach(mark => mark.classList.remove('scan-word-active'));
      for (const el of content.querySelectorAll('.message-copy h2, .message-copy p')) {
        // Only transform text nodes; never interpret message text as HTML.
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) if (walker.currentNode.parentElement.tagName !== 'MARK') nodes.push(walker.currentNode);
        for (const node of nodes) {
          const text = node.textContent;
          const matches = [...text.matchAll(phrases[clue.id])];
          if (!matches.length) continue;
          const fragment = document.createDocumentFragment();
          let offset = 0;
          for (const match of matches) {
            fragment.append(text.slice(offset, match.index));
            const mark = document.createElement('mark');
            mark.className = 'scan-word scan-word-active';
            mark.textContent = match[0];
            fragment.append(mark);
            offset = match.index + match[0].length;
          }
          fragment.append(text.slice(offset));
          node.replaceWith(fragment);
        }
      }
    };
    CLUES.forEach((clue, index) => {
      scanLater(() => highlight(clue), 650 * index);
      scanLater(() => {
        const tile = stage.querySelector(`[data-scan="${clue.id}"]`);
        if (!tile) return;
        const hasIssue = message.issues[clue.id];
        const weight = state.weights[clue.id];
        tile.classList.add(hasIssue ? 'issue' : 'safe');
        tile.querySelector('.scan-state').textContent = hasIssue ? `+${weight}` : '0';
        tone('light');
      }, 650 * index + 500);
    });
    scanLater(() => {
      state.testResults[state.currentMessageIndex] = result;
      state.testResults.length = state.currentMessageIndex + 1;
      phone.classList.remove('is-scanning');
      phone.classList.add('scan-complete');
      phone.setAttribute('aria-busy', 'false');
      scanNote.textContent = 'All four clues checked';
      tone(result.status === 'green' ? 'correct' : result.status === 'red' ? 'wrong' : 'drop');
      scanLater(() => swapView('result', renderResult), 650);
    }, 2750);
  }

  function renderResult() {
    const message = currentMessage();
    const result = state.currentResult;
    const copy = resultCopy(result.status);
    const finalMessage = state.currentMessageIndex === window.MESSAGE_DATA.length - 1;
    renderTest();
    onTap('#result-next', () => {
      tone('tap');
      if (finalMessage) {
        state.initialCorrect = window.MESSAGE_DATA.length - findMistakes().length;
        setView('batch', renderBatch);
      } else {
        state.currentMessageIndex += 1;
        swapView('test', renderTest);
        notificationChime();
        stage.querySelector('.phone-display')?.classList.add('message-arrived');
        stage.querySelector('#check-message')?.focus({ preventScroll: true });
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
    if (state.finished || !document.querySelector('#turn-modal').hidden) return;
    toggleSoundMenu(false);
    settingsModal.hidden = false;
    stage.inert = true;
    settingsModal.querySelector('#music-button').textContent = `Music: ${state.musicOn ? 'On' : 'Off'}`;
    settingsModal.querySelector('#sfx-button').textContent = `Sound effects: ${state.sfxOn ? 'On' : 'Off'}`;
    setTimeout(() => settingsModal.querySelector('#resume-button').focus(), 0);
  }

  function closeSettings() {
    settingsModal.hidden = true;
    stage.inert = transitioning || Boolean(document.querySelector('.modal:not([hidden])'));
    skaiInfo.focus();
  }

  function restartGame() {
    toggleSoundMenu(false);
    document.querySelector('#turn-modal').hidden = true;
    stopMissionClock();
    scanTimers.forEach(clearTimeout);
    scanTimers.clear();
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
    state = freshState({ soundOn: state.soundOn, musicOn: state.musicOn, sfxOn: state.sfxOn });
    screenHistory = [];
    currentScreen = null;
    stopNarration();
    narratedOnce.clear();
    settingsModal.hidden = true;
    recapModal.hidden = true;
    updateSoundButton();
    renderMissionClock();
    setView('setup', renderSetup, { force: true });
  }

  function updateSoundButton() {
    skaiSound.classList.toggle('muted', !state.soundOn);
    skaiSound.setAttribute('aria-label', state.soundOn ? 'Sound options' : 'Sound options (muted)');
    document.querySelector('#sound-mute-label').innerHTML = state.soundOn ? 'Mute All<br>Sounds' : 'Turn Sounds<br>On';
  }

  // ---------- Sound menu (Figma 557:2877): replay narration / mute all ----------
  const soundMenu = document.querySelector('#sound-menu');

  function toggleSoundMenu(open = soundMenu.hidden) {
    soundMenu.hidden = !open;
    skaiSound.setAttribute('aria-expanded', String(open));
    if (open) soundMenu.querySelector('.sound-menu-item')?.focus();
  }

  // Reads the current screen's title and instruction aloud with the browser's speech voice.
  function replayNarration() {
    if (!state.soundOn) {
      showToast('Sounds are muted. Turn them on to hear the narration.');
      return;
    }
    if (!NARRATED_SCREENS.has(narrationKey())) {
      showToast('There is no narration for this screen.');
      return;
    }
    narrateScreen({ replay: true });
  }

  // Back tab: always returns to the previous screen.
  function onBackGear() {
    goBack();
  }

  const GAME_HINTS = {
    roles: 'Pass the device to the player marked LEAD whenever the job changes.',
    intro: 'Tap the button to start building your checker.',
    tutorial: 'Tap each clue card to read the question it asks.',
    ranking: 'Use + and − to share 20 points. Give every clue at least 1 and at most 10 points.',
    test: 'Tap Check. Every clue with a problem adds its stars to the risk score.',
    result: 'Compare the total score with the review and suspicious thresholds your team chose.',
    sensitivity: 'Move the sliders to choose when review and suspicious begin. The review threshold must stay below suspicious.',
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
    if (!state.soundOn) stopNarration();
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

  skaiSound.addEventListener('click', () => toggleSoundMenu());
  document.querySelector('#sound-replay').addEventListener('click', () => { toggleSoundMenu(false); replayNarration(); });
  document.querySelector('#sound-mute').addEventListener('click', () => { toggleSoundMenu(false); toggleSound(); });
  document.addEventListener('pointerdown', event => {
    if (!soundMenu.hidden && !soundMenu.contains(event.target) && !skaiSound.contains(event.target)) toggleSoundMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !soundMenu.hidden) {
      toggleSoundMenu(false);
      skaiSound.focus();
    }
  });
  skaiInfo.addEventListener('click', openSettings);
  skaiBack.addEventListener('click', onBackGear);
  document.querySelector('#skai-hint').addEventListener('click', onHintGear);
  settingsModal.addEventListener('click', event => {
    if (event.target === settingsModal) closeSettings();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !settingsModal.hidden) closeSettings();
    if (event.key !== 'Tab') return;
    const modal = document.querySelector('.modal:not([hidden])');
    if (!modal) return;
    const focusable = [...modal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!first) return;
    if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
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
      state.view = 'welcome';
      renderWelcome();
      currentScreen = { view: 'welcome', renderFn: renderWelcome, snapshot: snapshot() };
      narrateScreen();
      renderProgress();
    });
  }

  // ---------- DEV MENU HOOK — only used by dev/dev-menu.js. Delete this block along with the dev/ folder. ----------
  window.CheckerDev = {
    get state() { return state; },
    views: { setup: renderSetup, roles: renderRoles, intro: renderIntro, tutorial: renderTutorial, ranking: renderRanking, sensitivity: renderSensitivity, test: renderTest, result: renderResult, batch: renderBatch, cause: renderCause, adjust: renderAdjust, retest: renderRetest, final: renderFinal },
    go: (view, renderFn) => setView(view, renderFn, { force: true }),
    computeResult,
    findMistakes,
    showRecap
  };
  // ---------- END DEV MENU HOOK ----------

  preload();
})();
