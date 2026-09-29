// DEV MENU — testing aid only. Lets you jump straight to any screen of the game.
// To remove it: delete this dev/ folder, the two "DEV MENU" lines in index.html,
// and the "DEV MENU HOOK" block at the end of game.js.
(() => {
  'use strict';

  // Shown by default while testing. Add ?dev=0 to the URL to hide it (e.g. for a clean demo).
  if (new URLSearchParams(location.search).get('dev') === '0') return;

  const dev = window.CheckerDev;
  if (!dev) {
    console.warn('Dev menu: window.CheckerDev hook not found in game.js.');
    return;
  }

  const PAGES = [
    { id: 'setup:count', label: 'Setup · How many explorers', group: 'Setup' },
    { id: 'setup:picker', label: 'Setup · Pick an avatar', group: 'Setup' },
    { id: 'setup:team', label: 'Setup · Team', group: 'Setup' },
    { id: 'roles', label: 'Meet your team', group: 'Build the rule' },
    { id: 'intro', label: 'Intro', group: 'Build the rule' },
    { id: 'tutorial', label: 'Tutorial · 4 clues', group: 'Build the rule' },
    { id: 'ranking', label: 'Rank the clues', group: 'Build the rule' },
    { id: 'test', label: 'Check a message', group: 'Test run' },
    { id: 'result', label: 'Result', group: 'Test run' },
    { id: 'batch', label: 'Batch summary', group: 'Test run' },
    { id: 'cause', label: 'Find the cause', group: 'Fix the rule' },
    { id: 'adjust', label: 'Move a star', group: 'Fix the rule' },
    { id: 'retest', label: 'Retest', group: 'Fix the rule' },
    { id: 'final', label: 'Final result', group: 'Finish' },
    { id: 'recap', label: 'Mission recap', group: 'Finish' }
  ];

  const DEMO_NAMES = ['Aarav', 'Maya', 'Rohan', 'Zoya'];
  const DEMO_AVATARS = [3, 2, 1, 0];
  // This ranking leaves a mistake under Strict checking, so repair screens have work to show.
  const DEMO_ORDER = ['source', 'date', 'image', 'urgent'];

  // ---------- Demo data: fill in only what the target page needs and is still missing ----------

  function ensureTeam(s) {
    if (s.playerCount && s.players.length === s.playerCount && s.players.every(name => name.trim()) && s.avatars.every(Number.isInteger)) return;
    s.playerCount = s.playerCount || 3;
    s.players = DEMO_NAMES.slice(0, s.playerCount);
    s.avatars = DEMO_AVATARS.slice(0, s.playerCount);
  }

  function ensureRule(s) {
    ensureTeam(s);
    if (!s.clueOrder.every(Boolean)) s.clueOrder = [...DEMO_ORDER];
    if (Object.keys(s.weights).length !== 4) s.weights = Object.fromEntries(s.clueOrder.map((id, index) => [id, 4 - index]));
    s.checkerStyle = 'strict';
  }

  function ensureTestRun(s) {
    ensureRule(s);
    if (s.testResults.length !== window.MESSAGE_DATA.length) {
      s.testResults = window.MESSAGE_DATA.map(message => dev.computeResult(message));
      s.initialCorrect = window.MESSAGE_DATA.length - dev.findMistakes().length;
    }
  }

  // Makes sure there is a mistake to debug; resets to the demo rule if the current one is already perfect.
  function ensureDebug(s, withTarget) {
    ensureTestRun(s);
    let mistakes = dev.findMistakes();
    if (!mistakes.length) {
      s.clueOrder = [...DEMO_ORDER];
      s.weights = Object.fromEntries(DEMO_ORDER.map((id, index) => [id, 4 - index]));
      s.checkerStyle = 'strict';
      mistakes = dev.findMistakes();
    }
    const stillWrong = s.debug && mistakes.find(item => item.message.id === s.debug.messageId);
    const item = stillWrong || mistakes[0];
    if (!stillWrong) s.debug = { messageId: item.message.id, kind: item.kind, target: null };
    if (withTarget && !s.debug.target) s.debug.target = Object.keys(item.message.issues).find(id => item.message.issues[id]);
    s.causeAttempts = 0;
    s.move = null;
    s.selectedFrom = null;
    s.mistakeIdsBeforeMove = mistakes.map(entry => entry.message.id);
  }

  function prepare(pageId, s) {
    s.finished = false;
    switch (pageId) {
      case 'setup:count':
        s.setupStep = 'count';
        s.returnToTeam = false;
        break;
      case 'setup:picker':
        s.playerCount = s.playerCount || 3;
        s.players = Array.from({ length: s.playerCount }, (_, index) => s.players[index] || '');
        s.avatars = Array.from({ length: s.playerCount }, (_, index) => s.avatars[index] ?? null);
        s.setupStep = 'picker';
        s.pickerIndex = 0;
        s.returnToTeam = false;
        break;
      case 'setup:team':
        ensureTeam(s);
        s.setupStep = 'team';
        s.returnToTeam = false;
        break;
      case 'roles': case 'intro': case 'tutorial':
        ensureTeam(s);
        break;
      case 'ranking':
        ensureTeam(s);
        s.selectedClue = null;
        break;
      case 'test':
        ensureRule(s);
        if (!(s.currentMessageIndex < window.MESSAGE_DATA.length)) s.currentMessageIndex = 0;
        s.testResults = s.testResults.slice(0, s.currentMessageIndex);
        break;
      case 'result':
        ensureRule(s);
        if (!(s.currentMessageIndex < window.MESSAGE_DATA.length)) s.currentMessageIndex = 0;
        s.currentResult = dev.computeResult(window.MESSAGE_DATA[s.currentMessageIndex]);
        break;
      case 'batch':
        ensureTestRun(s);
        s.currentMessageIndex = window.MESSAGE_DATA.length - 1;
        break;
      case 'cause':
        ensureDebug(s, false);
        break;
      case 'adjust':
        ensureDebug(s, true);
        break;
      case 'retest': {
        ensureDebug(s, true);
        const mistakes = dev.findMistakes();
        s.lastRetest = {
          debugFixed: !mistakes.some(item => item.message.id === s.debug.messageId),
          mistakes,
          newlyBroken: [],
          newlyFixed: 0
        };
        break;
      }
      case 'final': case 'recap':
        ensureTestRun(s);
        break;
    }
  }

  // ---------- Jumping ----------

  function closeGameOverlays() {
    ['#settings-modal', '#recap-modal', '#turn-modal'].forEach(selector => {
      const modal = document.querySelector(selector);
      if (modal) modal.hidden = true;
    });
    document.querySelector('#stage').inert = false;
  }

  function jumpTo(pageId) {
    const s = dev.state;
    closeGameOverlays();
    prepare(pageId, s);
    if (pageId === 'recap') {
      dev.go('final', dev.views.final);
      setTimeout(() => { dev.showRecap(); }, 260);
    } else {
      const view = pageId.startsWith('setup:') ? 'setup' : pageId;
      dev.go(view, dev.views[view]);
    }
    // The game shows a "pass the device" pop-up on some screens; skip it unless the tester wants to see it.
    if (skipTurnPopups()) {
      setTimeout(() => {
        const turnModal = document.querySelector('#turn-modal');
        if (turnModal && !turnModal.hidden) document.querySelector('#turn-ready')?.click();
      }, 280);
    }
  }

  function currentPageId() {
    const s = dev.state;
    if (s.finished && !document.querySelector('#recap-modal')?.hidden) return 'recap';
    return s.view === 'setup' ? `setup:${s.setupStep}` : s.view;
  }

  // ---------- Menu UI ----------

  const STORAGE_KEY = 'dev-menu-skip-turn';
  function skipTurnPopups() {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
  }

  const root = document.createElement('div');
  root.className = 'dev-menu';
  root.innerHTML = `
    <button class="dev-menu-toggle" type="button" aria-expanded="false" aria-controls="dev-menu-panel" aria-label="Open dev page menu" title="Dev menu: jump to any page">
      <span></span><span></span><span></span>
    </button>
    <nav class="dev-menu-panel" id="dev-menu-panel" aria-label="Dev page menu" hidden>
      <div class="dev-menu-head"><strong>Jump to page</strong><small>DEV ONLY</small></div>
      <ul class="dev-menu-list"></ul>
      <label class="dev-menu-option"><input type="checkbox" class="dev-menu-skip"> Skip “your turn” pop-ups</label>
    </nav>`;
  document.body.appendChild(root);

  const toggle = root.querySelector('.dev-menu-toggle');
  const panel = root.querySelector('.dev-menu-panel');
  const list = root.querySelector('.dev-menu-list');
  const skipBox = root.querySelector('.dev-menu-skip');

  let lastGroup = '';
  list.innerHTML = PAGES.map(page => {
    const heading = page.group !== lastGroup ? `<li class="dev-menu-group" aria-hidden="true">${page.group}</li>` : '';
    lastGroup = page.group;
    return `${heading}<li><button type="button" class="dev-menu-item" data-page="${page.id}">${page.label}</button></li>`;
  }).join('');

  function markActive() {
    const active = currentPageId();
    list.querySelectorAll('.dev-menu-item').forEach(item => {
      const isActive = item.dataset.page === active;
      item.classList.toggle('active', isActive);
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function openMenu() {
    markActive();
    skipBox.checked = skipTurnPopups();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.classList.add('open');
    (list.querySelector('.dev-menu-item.active') || list.querySelector('.dev-menu-item'))?.focus();
  }

  function closeMenu({ returnFocus = false } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('open');
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (panel.hidden ? openMenu() : closeMenu()));
  list.addEventListener('click', event => {
    const item = event.target.closest('.dev-menu-item');
    if (!item) return;
    closeMenu();
    jumpTo(item.dataset.page);
  });
  skipBox.addEventListener('change', () => {
    try { localStorage.setItem(STORAGE_KEY, skipBox.checked ? 'on' : 'off'); } catch { /* storage unavailable */ }
  });
  // Clicking or tapping anywhere outside the menu closes it.
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !root.contains(event.target)) closeMenu();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      closeMenu({ returnFocus: true });
    }
  }, true);

  // Keep the highlight right if the page changes while the menu is open (e.g. a timed transition).
  setInterval(() => { if (!panel.hidden) markActive(); }, 500);
})();
