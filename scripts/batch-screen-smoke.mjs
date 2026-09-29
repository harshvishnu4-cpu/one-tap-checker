import fs from 'node:fs/promises';
const target = await (await fetch('http://127.0.0.1:9222/json/new?file:///D:/one%20tap%20checker%20app/index.html', {method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const d = JSON.parse(e.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
const cmd = (method, params = {}) => new Promise(r => { pending.set(++id,r); ws.send(JSON.stringify({id,method,params})); });
const run = async expression => { const r = await cmd('Runtime.evaluate',{expression,returnByValue:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const pause = ms => new Promise(r => setTimeout(r,ms));
await pause(3200);
try {
  for (const width of [1600,1024]) {
    await cmd('Emulation.setDeviceMetricsOverride',{width,height:Math.round(width*9/16),deviceScaleFactor:1,mobile:false});
    for (const threshold of [20,6]) {
      await run(`Object.assign(CheckerDev.state,{weights:{source:5,date:5,image:5,urgent:5},reviewThreshold:${threshold},suspiciousThreshold:20});CheckerDev.go('batch',CheckerDev.views.batch)`);
      await pause(900);
      await run(`document.querySelector('#turn-ready')?.click()`);
      await pause(400);
      const check = await run(`(()=>{const layout=document.querySelector('.batch-layout'),button=document.querySelector('#fix-mistakes');return {cards:document.querySelectorAll('.mistake-card').length,overlap:layout.getBoundingClientRect().bottom>button.getBoundingClientRect().top,horizontalOverflow:layout.scrollWidth>layout.clientWidth+1}})()`);
      if (check.overlap || check.horizontalOverflow) throw Error(JSON.stringify(check));
      console.log({width,threshold,...check});
      const shot = await cmd('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(`.test-artifacts/batch-reference-${width}-${threshold}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  await run(`document.querySelector('#fix-mistakes').click()`);
  await pause(900);
  if (!await run(`!!document.querySelector('.cause-screen,.final-screen')`)) throw Error('Batch navigation failed');
} finally { ws.close(); }
