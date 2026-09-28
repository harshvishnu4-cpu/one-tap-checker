import fs from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const artifactDir = path.resolve('.test-artifacts');
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 1600);
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || 900);
const testPlayerCount = Number(process.env.TEST_PLAYER_COUNT || 3);
// Clue ids from most to least important, e.g. "urgent,source,date,image".
const testOrder = (process.env.TEST_ORDER || 'source,date,image,urgent').split(',');
const testStyle = process.env.TEST_STYLE || 'balanced';
const shotPrefix = process.env.SHOT_PREFIX || '';
// Clues the simulated fixer prefers to take stars from (otherwise: the clue with the most stars).
const donorPreference = (process.env.TEST_DONOR_PREF || '').split(',').filter(Boolean);
const maxFixRounds = 8;

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function getPageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`${endpoint}/json/list`).then(response => response.json());
      const target = targets.find(item => item.type === 'page' && item.url.includes('index.html'));
      if (target) return target;
    } catch {}
    await sleep(250);
  }
  throw new Error('Could not find the game page through Chrome DevTools Protocol.');
}

const target = await getPageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const browserErrors = [];
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text || 'Runtime exception');
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    browserErrors.push(message.params.entry.text);
  }
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function exists(selector) {
  return evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
}

async function waitFor(selector, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await exists(selector)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

async function click(selector) {
  await waitFor(selector);
  const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`Element was not clickable: ${selector}`);
  await sleep(280);
}

async function screenshot(name) {
  await sleep(80);
  await fs.mkdir(artifactDir, { recursive: true });
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(artifactDir, shotPrefix + name), Buffer.from(result.data, 'base64'));
}

async function expectRole(role, step) {
  const text = await evaluate(`document.querySelector('#skai-players .skai-chip.active')?.textContent || ''`);
  if (!text.includes(role)) throw new Error(`${role} must lead ${step} (active: ${text})`);
}

await command('Runtime.enable');
await command('Log.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: false
});
await command('Page.reload', { ignoreCache: true });
await sleep(400);

await waitFor('.skai-count-card');
await sleep(550);
const initialViewport = await evaluate(`({ bodyScroll: document.body.scrollHeight > innerHeight, shell: (() => { const r = document.querySelector('#game-shell').getBoundingClientRect(); return { width: r.width, height: r.height }; })() })`);
await screenshot('00-setup-count.png');

await click('#skai-info');
await waitFor('#settings-modal:not([hidden])');
await click('#resume-button');
await click(`[data-player-count="${testPlayerCount}"]`);

const testNames = ['Aarav', 'Maya', 'Rohan', 'Zoya'];
const testAvatars = [3, 2, 1, 0];
for (let player = 0; player < testPlayerCount; player += 1) {
  await waitFor('#picker-name');
  const heading = await evaluate(`document.querySelector('.skai-player-panel h2').textContent`);
  if (heading !== `Player ${player + 1}`) throw new Error(`Picker shows "${heading}" instead of Player ${player + 1}`);
  if (!await evaluate(`document.querySelector('#picker-next').disabled`)) throw new Error('Next must wait for an avatar and a name');
  if (player === 0) await screenshot('00-setup-picker-empty.png');
  if (player > 0 && await evaluate(`!document.querySelector('[data-avatar="${testAvatars[0]}"]').disabled`)) throw new Error('A taken avatar must be disabled');
  await click(`[data-avatar="${testAvatars[player]}"]`);
  await evaluate(`(() => { const input = document.querySelector('#picker-name'); input.value = ${JSON.stringify(testNames[player])}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  if (player === 0) await screenshot('00-setup-picker.png');
  await click('#picker-next');
  if (player === 1) {
    // The back gear returns to the previous explorer with their choices kept.
    await waitFor('#picker-name');
    await click('#skai-back');
    await waitFor('#picker-name');
    const kept = await evaluate(`document.querySelector('#picker-name').value`);
    if (kept !== testNames[1]) throw new Error(`Back lost the name (got "${kept}")`);
    await click('#picker-next');
  }
}
await waitFor('#team-start');
const teamCards = await evaluate(`document.querySelectorAll('.skai-team-card').length`);
if (teamCards !== testPlayerCount) throw new Error('Team screen is missing players');
await screenshot('00-setup-team.png');
await click('#team-start');
await waitFor('#roles-next');
const assignedRoles = await evaluate(`document.querySelectorAll('.role-card').length`);
if (assignedRoles !== testPlayerCount) throw new Error('Missing player roles');
await screenshot('00-roles.png');
await click('#roles-next');
await waitFor('#start-game');
const configuredPlayers = await evaluate(`document.querySelectorAll('#skai-players .skai-chip').length`);
await screenshot('01-intro.png');
await click('#start-game');

await waitFor('#tutorial-next');
for (const clue of ['source', 'date', 'image', 'urgent']) await click(`[data-clue="${clue}"]`);
await screenshot('01-tutorial.png');
await click('#tutorial-next');

await waitFor('.rank-slot');
await expectRole('Rule Builder', 'ranking');
if (!await evaluate(`document.querySelector('#ranking-next').disabled`)) throw new Error('Next must be disabled until all clues are ranked');
await screenshot('05-ranking-empty.png');
for (let slot = 0; slot < 4; slot += 1) {
  await click(`.rank-pool [data-clue="${testOrder[slot]}"]`);
  await click(`.rank-slot[data-slot="${slot}"]`);
}
await screenshot('05-ranking.png');
await click('#ranking-next');

await click(`[data-style="${testStyle}"]`);
await screenshot('06-style.png');
await click('#style-next');

for (let index = 0; index < 8; index += 1) {
  await waitFor('#check-message');
  await expectRole('Message Tester', 'scans');
  const counter = await evaluate(`document.querySelector('.test-screen .screen-support').textContent`);
  if (!counter.includes(`message ${index + 1} of 8`)) throw new Error(`Expected message ${index + 1}, got "${counter}"`);
  if (index === 0) await screenshot('08-checker.png');
  await click('#check-message');
  await waitFor('#result-next', 6000);
  if (index === 0) {
    await screenshot('09-result.png');
    // A fast double press must only advance one message.
    await evaluate(`(() => { const el = document.querySelector('#result-next'); el.click(); el.click(); })()`);
    await sleep(320);
  } else {
    await click('#result-next');
  }
}

await waitFor('#fix-mistakes');
const batchSummary = await evaluate(`({ good: Number(document.querySelector('.score-card.good strong').textContent), review: Number(document.querySelector('.score-card.review strong').textContent), cards: document.querySelectorAll('.mistake-card').length })`);
await screenshot('02-batch.png');
if (batchSummary.good + batchSummary.review !== 8 || batchSummary.cards !== batchSummary.review) throw new Error('Batch summary does not add up');
await click('#fix-mistakes');

let fixRounds = 0;
let retestHeadlines = [];
if (batchSummary.review > 0) {
  while (true) {
    await sleep(300);
    if (await exists('.cause-screen')) {
      await expectRole('Detective', 'diagnosis');
      if (fixRounds === 0) await screenshot('06-cause.png');
      for (const clue of ['source', 'date', 'image', 'urgent']) {
        if (await exists('#cause-next')) break;
        await click(`[data-answer="${clue}"]`);
      }
      await click('#cause-next');
    }
    await waitFor('.adjust-screen');
    await expectRole('Fixer', 'repair');
    if (!await evaluate(`document.querySelector('#retest-button').disabled`)) throw new Error('Test again must wait for a star move');
    if (fixRounds === 0) await screenshot('07-adjust-before.png');
    const plan = await evaluate(`(() => {
      const kind = document.querySelector('.adjust-screen').dataset.mistakeKind;
      const cards = [...document.querySelectorAll('[data-weight-card]')].map(card => ({ id: card.dataset.weightCard, weight: Number(card.dataset.weight), target: card.classList.contains('target'), safe: card.dataset.safe === 'true' }));
      const target = cards.find(card => card.target);
      const others = cards.filter(card => !card.target);
      const preferred = ${JSON.stringify(donorPreference)};
      const heedWarnings = ${JSON.stringify(process.env.TEST_IGNORE_WARNINGS !== '1')};
      const rank = card => (heedWarnings && card.safe ? 1000 : 0) + (preferred.includes(card.id) ? 100 : 0) + card.weight;
      if (kind === 'miss') return { from: others.filter(card => card.weight > 1).sort((a, b) => rank(b) - rank(a))[0].id, to: target.id };
      return { from: target.id, to: others.filter(card => card.weight < 5).sort((a, b) => (b.safe - a.safe) || a.weight - b.weight)[0].id };
    })()`);
    await click(`[data-star-from="${plan.from}"]`);
    await click(`[data-weight-card="${plan.to}"]`);
    if (fixRounds === 0) await screenshot('07-adjust.png');
    const total = await evaluate(`[...document.querySelectorAll('[data-weight-card]')].reduce((sum, card) => sum + Number(card.dataset.weight), 0)`);
    if (total !== 10) throw new Error(`Star total changed to ${total}`);
    await click('#retest-button');
    await waitFor('.retest-result');
    await expectRole('Message Tester', 'retest');
    fixRounds += 1;
    retestHeadlines.push(await evaluate(`document.querySelector('.retest-result h2').textContent`));
    if (fixRounds === 1) await screenshot('10-retest.png');
    if (await exists('#retest-final')) { await click('#retest-final'); break; }
    if (fixRounds >= maxFixRounds) { await click('#retest-finish'); break; }
    if (await exists('#retest-again')) await click('#retest-again');
    else await click('#retest-next-mistake');
  }
}

await waitFor('#finish-button');
const finalSummary = await evaluate(`({
  heading: document.querySelector('.final-screen .screen-heading').textContent,
  badges: document.querySelectorAll('.badge-row .badge').length,
  earned: document.querySelectorAll('.badge-row .badge:not(.locked)').length,
  messages: document.querySelectorAll('.message-mini').length,
  review: document.querySelectorAll('.message-mini.needs-review').length
})`);
await sleep(1900);
await screenshot('03-final.png');
await click('#finish-button');
await waitFor('#recap-modal:not([hidden]) #play-again');
const recapCount = await evaluate(`document.querySelectorAll('.recap-point').length`);
await screenshot('04-recap.png');
await click('#skai-sound');
await click('#play-again');
await waitFor('.skai-count-card');
const muteKept = await evaluate(`document.querySelector('#skai-sound').classList.contains('muted')`);
await click('#skai-sound');
await click('#skai-info');
await waitFor('#settings-modal:not([hidden])');
const settingsIntact = await evaluate(`['#resume-button', '#music-button', '#sfx-button', '#restart-button'].every(selector => document.querySelector(selector))`);
await click('#resume-button');

const result = {
  scenario: { players: testPlayerCount, order: testOrder, style: testStyle },
  initialViewport,
  batchSummary,
  fixRounds,
  retestHeadlines,
  finalSummary,
  recapCount,
  configuredPlayers,
  muteKept,
  settingsIntact,
  restartReturnedToSetup: await evaluate(`Boolean(document.querySelector('.skai-count-card')) && document.querySelector('#settings-modal').hidden && document.querySelector('#recap-modal').hidden`),
  browserErrors
};

console.log(JSON.stringify(result, null, 2));
socket.close();

if (initialViewport.bodyScroll || configuredPlayers !== testPlayerCount || finalSummary.badges !== 3 || finalSummary.messages !== 8 || recapCount < 3 || !muteKept || !settingsIntact || !result.restartReturnedToSetup || browserErrors.length) {
  process.exitCode = 1;
}
