import fs from 'node:fs/promises';
const target = await (await fetch('http://127.0.0.1:9222/json/new?file:///D:/one%20tap%20checker%20app/index.html?phone-qa', {method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}));
let id = 0;
const pending = new Map();
ws.onmessage = event => { const r = JSON.parse(event.data); if (pending.has(r.id)) { pending.get(r.id)(r.result); pending.delete(r.id); } };
const cmd = (method, params={}) => new Promise(resolve => { pending.set(++id, resolve); ws.send(JSON.stringify({id,method,params})); });
const evaluate = async expression => (await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function click(selector) { for(let i=0;i<80;i++){ if(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) break; await pause(100); } await evaluate(`(()=>{const modal=document.querySelector('#turn-modal');if(modal && !modal.hidden) document.querySelector('#turn-ready').click();document.querySelector(${JSON.stringify(selector)}).click();})()`); await pause(400); }
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
await cmd('Page.reload',{ignoreCache:true});
await pause(2800);
await click('[data-player-count="3"]');
for(let i=0;i<3;i++) {
  await click(`[data-avatar="${i}"]`);
  await evaluate(`(()=>{const el=document.querySelector('#picker-name');el.value=${JSON.stringify(['Aarav','Maya','Rohan'][i])};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('#picker-next');
}
await click('#team-start');
await click('#roles-next');
await fs.mkdir('.test-artifacts',{recursive:true});
await pause(500);
const introShot = await cmd('Page.captureScreenshot',{format:'png'});
await fs.writeFile('.test-artifacts/notification-intro.png',Buffer.from(introShot.data,'base64'));
await click('#dismiss-notification');
await click('#reopen-notification');
await click('#start-game');
await click('#tutorial-next');
for(let i=0;i<4;i++){for(let n=0;n<4-i;n++)await click(`[data-id="${['source','date','image','urgent'][i]}"][data-change="1"]`);}
await click('#ranking-next');
await click('#sensitivity-next');
await pause(400);
const handoff = await evaluate(`({visible: !document.querySelector('#turn-modal').hidden, name:document.querySelector('#turn-title').textContent,role:document.querySelector('#turn-role').textContent})`);
if (!handoff.visible || !handoff.name.includes('Maya') || handoff.role !== 'Message Tester') throw new Error('Tester handoff missing');
await click('#turn-ready');
const check = await evaluate(`({tablet:!!document.querySelector('.tablet-frame'), text:document.querySelector('.tablet-display').innerText, loaded:document.querySelector('.tablet-frame').naturalWidth>0, strict:CheckerDev.state.checkerStyle==='strict', styleChooserRemoved:!CheckerDev.views.style})`);
await fs.mkdir('.test-artifacts',{recursive:true});
const shot=await cmd('Page.captureScreenshot',{format:'png'});
await fs.writeFile('.test-artifacts/tablet-gameplay.png',Buffer.from(shot.data,'base64'));
await click('#check-message');
await pause(2500);
check.result = await evaluate(`!!document.querySelector('#result-next')`);
for(let i=1;i<8;i++) {
  await click('#result-next');
  await click('#check-message');
  await pause(2500);
  if(!await evaluate(`!!document.querySelector('#result-next')`)) throw new Error(`Message ${i+1} did not finish`);
}
await click('#result-next');
check.allMessages = await evaluate(`CheckerDev.state.testResults.length===8 && CheckerDev.state.view==='batch'`);
check.strictBoundaries = await evaluate(`(()=>{const m={id:'qa',issues:{source:true,date:false,image:false,urgent:false}};return [2,3,4].map(source=>CheckerDev.computeResult(m,{source,date:0,image:0,urgent:0}).status).join(',')==='green,amber,red';})()`);
console.log(JSON.stringify(check,null,2));
ws.close();
if(!check.loaded || !check.result || !check.strict || !check.styleChooserRemoved || !check.allMessages || !check.strictBoundaries)process.exitCode=1;
