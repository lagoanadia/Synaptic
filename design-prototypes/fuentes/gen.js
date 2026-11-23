const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname;

// ---- data (k=known p=partial r=review n=new) ----
const G = [
 {id:'d', name:'Despliegue', done:2, total:7, nodes:[
  ['Despliegue','k',0],['Tipos de despliegue','k',1],['On-premise','k',2],['Cloud','n',3],['IaaS','n',4],['PaaS','n',5],['SaaS','r',6]]},
 {id:'s', name:'Software libre vs open source', done:2, total:5, nodes:[
  ['Software libre vs open source','k',0],['Las 4 libertades','k',1],['Open core','p',2],['Fork','n',3],['MIT vs GPL','n',4]]},
 {id:'o', name:'Otros conceptos', done:2, total:25, nodes:[
  ['TCO fórmula','r'],['Volumen (Docker)','r'],['Docker','r'],['Copyleft y la GPL','r'],['Trampas de licencias','r'],['Arquitectura de ERP','r'],['Vendor lock-in','r'],['Backup','r'],
  ['CI/CD','k'],['Kubernetes','k'],
  ['Contenedores','p'],['Escalabilidad','p'],['Odoo','p'],['SLA','p'],['Migración','p'],['Seguridad','p'],
  ['Dolibarr','n'],['SAP','n'],['Módulos ERP','n'],['Soporte','n'],['Licencias','n'],['Mantenimiento','n'],['API REST','n'],['Cron','n'],['Logs','n']]},
];
const BLUE='#2383e2', RED='#e16259';
const W=493;
const tw=(s,fs)=>s.length*fs*0.56;
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;

// ---- shared page shell ----
function shell({bg, panelBg, panelBorder, ink, inkMute, sidebarBg, tabs, legend, body, right, accent}) {
 return `<!doctype html><html><head><meta charset="utf-8"><style>
 *{box-sizing:border-box;margin:0;padding:0}
 body{width:1000px;height:760px;background:${bg};font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:${ink};position:relative;overflow:hidden}
 .side{position:absolute;left:0;top:0;bottom:0;width:36px;background:${sidebarBg};border-right:1px solid ${panelBorder}}
 .side i{display:block;width:16px;height:16px;border:1.5px solid ${inkMute};border-radius:4px;margin:20px auto 0;opacity:.7}
 .bc{position:absolute;left:72px;top:24px;font-size:11px;color:${inkMute}}
 .panel{position:absolute;left:72px;top:48px;width:${W}px;height:690px;background:${panelBg};border:1px solid ${panelBorder};border-radius:16px;overflow:hidden}
 .tabs{position:absolute;left:8px;top:7px;right:44px;display:flex;gap:6px;z-index:5}
 .plus{position:absolute;right:7px;top:7px;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:17px;z-index:5}
 .legend{position:absolute;left:0;right:0;bottom:0;height:46px;display:flex;align-items:center;gap:12px;padding:0 14px;font-size:10px;z-index:5}
 .legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
 .cta{margin-left:auto;color:#fff;font-weight:700;font-size:11px;padding:7px 14px;border-radius:99px}
 svg{position:absolute;left:0;top:0}
 .right{position:absolute;left:600px;top:48px;width:360px}
 </style></head><body>
 <div class="side"><i></i><i style="border-radius:50%"></i><i></i><i></i></div>
 <div class="bc">School &nbsp;/&nbsp; SXE &nbsp;/&nbsp; Teoria</div>
 <div class="panel">${body}${tabs}<div class="legend">${legend}</div></div>
 <div class="right">${right}</div></body></html>`;
}
const tabsHtml=(on,off,plus)=>{
 const t=(n,a)=>`<span style="padding:5px 11px;border-radius:99px;font-size:10.5px;font-weight:700;${a?on:off}">${n}</span>`;
 return `<div class="tabs">${t('Todo',1)}${t('Despliegue')}${t('Software libre vs ope…')}${t('Otros conceptos')}</div><div class="plus" style="${plus}">+</div>`;
};
const rightHtml=(c)=>`
 <div style="display:flex;justify-content:space-between;align-items:flex-start"><h1 style="font-size:28px;letter-spacing:-.6px;font-weight:800;color:${c.ink}">Tipos de despliegue</h1><span style="color:${c.mute};letter-spacing:2px">···</span></div>
 <p style="margin-top:20px;font-size:15px;color:${c.mute}">Tipos de despliegue en una frase.</p>
 <p style="margin-top:22px;font-size:14px;color:${c.ink}">Tipos de despliegue explicado.</p>
 <div style="margin-top:22px;display:flex;gap:10px">
  <div style="width:56px;height:56px;border-radius:50%;background:${c.acc};display:grid;place-items:center;box-shadow:${c.glow||'none'}"><svg width="22" height="22" viewBox="0 0 24 24" style="position:static"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
  <div style="width:48px;height:48px;margin-top:4px;border-radius:50%;background:${c.btn};border:1px solid ${c.line};display:grid;place-items:center;color:${c.mute};font-size:18px">💡</div>
 </div>`;
const ring=(cx,cy,r,p,col,track,sw=3)=>{const C=2*Math.PI*r;return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*p} ${C}" transform="rotate(-90 ${cx} ${cy})"/>`};
const check=(x,y,s,c='#fff',w=2)=>`<path d="M${x-s*.45},${y+s*.02} l${s*.3},${s*.32} l${s*.6},${-s*.68}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// =============== VARIANT A : soft cards ===============
function A(){
 let s=`<svg width="${W}" height="690" viewBox="0 0 ${W} 690"><defs>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#37352f" flood-opacity=".08"/></filter>
  <filter id="nsh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#2383e2" flood-opacity=".35"/></filter>
  <linearGradient id="half" x1="0" x2="1"><stop offset=".5" stop-color="${BLUE}"/><stop offset=".5" stop-color="#fff"/></linearGradient></defs>`;
 const card=(x,y,w,h,g)=>{
  let o=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" filter="url(#sh)"/>`;
  o+=ring(x+24,y+24,9,g.done/g.total,BLUE,'#e8edf3',3.2);
  o+=`<text x="${x+42}" y="${y+28}" font-size="12.5" font-weight="800" fill="#2b2a27">${trunc(g.name,20)}</text>`;
  o+=`<text x="${x+w-14}" y="${y+28}" text-anchor="end" font-size="11" font-weight="700" fill="#9a9892">${g.done}/${g.total}</text>`;
  return o;};
 const node=(m,x,y,r,cur)=>{
  if(m==='k') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${BLUE}" filter="url(#nsh)"/>${cur?`<circle cx="${x}" cy="${y}" r="${r+5}" fill="none" stroke="${BLUE}" stroke-opacity=".3" stroke-width="3"/>`:''}${check(x,y,r*.9)}`;
  if(m==='p') return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#half)" stroke="${BLUE}" stroke-width="2"/>`;
  if(m==='r') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED}"/><rect x="${x-1}" y="${y-r*.5}" width="2" height="${r*.6}" rx="1" fill="#fff"/><circle cx="${x}" cy="${y+r*.4}" r="1.1" fill="#fff"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#d6d4ce" stroke-width="1.6" stroke-dasharray="2.5 2.5"/>`;};
 const lab=(t,x,y,b,m)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${b?10.5:9}" font-weight="${b?800:600}" fill="${m==='n'?'#9a9892':'#37352f'}">${trunc(t,16)}</text>`;
 // hub clusters
 const hub=(g,x,y,w,h)=>{
  s+=card(x,y,w,h,g);
  const cx=x+w/2, cy=y+h/2+16, R=58;
  const sp=g.nodes.slice(1); const pos=sp.map((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/sp.length;return [cx+R*Math.cos(a),cy+R*Math.sin(a)];});
  sp.forEach((n,i)=>{const on=n[1]==='k';s+=`<path d="M${cx},${cy} L${pos[i][0]},${pos[i][1]}" stroke="${on?BLUE:'#e3e1dc'}" stroke-width="${on?2.4:1.4}" ${on?'':'stroke-dasharray="3 4"'} stroke-linecap="round"/>`;});
  s+=node('k',cx,cy,13,false)+lab(g.nodes[0][0],cx,cy+27,1,'k');
  sp.forEach((n,i)=>{const [px,py]=pos[i];s+=node(n[1],px,py,n[2]===1?11:9,n[2]===1&&g.id==='d');
   const ly=py+(py>cy?19:-14); s+=lab(n[0],px,py<cy-10&&Math.abs(px-cx)<5?py-17:ly,n[2]===1,n[1]);});
 };
 hub(G[0],12,48,230,206); hub(G[1],251,48,230,206);
 // big card with rings
 const x=12,y=266,w=469,h=378; s+=card(x,y,w,h,G[2]);
 const o=G[2].nodes, order=['r','p','k','n'];
 const ord=[...o].sort((a,b)=>order.indexOf(a[1])-order.indexOf(b[1]));
 const cx=x+w/2, cy=y+h/2+22;
 s+=`<circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#eceae5" stroke-dasharray="2 5"/><circle cx="${cx}" cy="${cy}" r="132" fill="none" stroke="#eceae5" stroke-dasharray="2 5"/>`;
 const rings=[[0,8,70,-Math.PI/2],[8,25,132,-Math.PI/2+.2]];
 rings.forEach(([a,b,R,off])=>{const n=b-a;ord.slice(a,b).forEach((d,i)=>{const ang=off+i*2*Math.PI/n;const px=cx+R*1.32*Math.cos(ang)*(R>100?1:1),py=cy+R*Math.sin(ang);
  const X=cx+(R>100?R*1.55:R*1.25)*Math.cos(ang), Y=cy+R*Math.sin(ang);
  s+=node(d[1],X,Y,8,false)+lab(d[0],X,Y+18,0,d[1]);});});
 s+='</svg>';
 const legend=`<span><i style="background:${BLUE}"></i>Lo sabes</span><span><i style="background:linear-gradient(90deg,${BLUE} 50%,#fff 50%);box-shadow:inset 0 0 0 1.5px ${BLUE}"></i>A medias</span><span><i style="background:${RED}"></i>Repasar</span><span><i style="background:#fff;box-shadow:inset 0 0 0 1.5px #c9c7c1"></i>Nuevo</span><span class="cta" style="background:${RED}">Repasar 8 ›</span>`;
 return shell({bg:'#f4f4f1',panelBg:'#f4f6f9',panelBorder:'rgba(55,53,47,.09)',ink:'#37352f',inkMute:'#7a7873',sidebarBg:'#f7f7f5',
  tabs:tabsHtml('background:#2b2a27;color:#fff','background:#fff;color:#37352f;box-shadow:0 1px 2px rgba(0,0,0,.08)','background:#fff;color:#6f6e69;box-shadow:0 1px 2px rgba(0,0,0,.1)'),
  legend,body:s,right:rightHtml({ink:'#2b2a27',mute:'#7a7873',acc:BLUE,btn:'#fff',line:'#e3e1dc',glow:'0 6px 16px rgba(35,131,226,.35)'})});
}

// =============== VARIANT B : dark constellation ===============
function B(){
 const c={k:'#4cc2ff',p:'#8f7bff',r:'#ff7a6b',n:'#4b5468'};
 let s=`<svg width="${W}" height="690" viewBox="0 0 ${W} 690"><defs>
  <filter id="gl" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
  <radialGradient id="aB"><stop offset="0" stop-color="#4cc2ff" stop-opacity=".22"/><stop offset="1" stop-color="#4cc2ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="aP"><stop offset="0" stop-color="#8f7bff" stop-opacity=".22"/><stop offset="1" stop-color="#8f7bff" stop-opacity="0"/></radialGradient>
  <radialGradient id="aR"><stop offset="0" stop-color="#ff7a6b" stop-opacity=".14"/><stop offset="1" stop-color="#ff7a6b" stop-opacity="0"/></radialGradient></defs>`;
 for(let i=0;i<70;i++){const x=(i*97%W),y=(i*211%690);s+=`<circle cx="${x}" cy="${y}" r="${(i%3)*.4+.4}" fill="#fff" opacity="${.08+(i%5)*.04}"/>`;}
 const node=(m,x,y,r,cur)=>{const col=c[m];
  let o='';
  if(m!=='n') o+=`<circle cx="${x}" cy="${y}" r="${r*1.5}" fill="${col}" opacity=".55" filter="url(#gl)"/>`;
  if(m==='n') o+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#171c2a" stroke="${col}" stroke-width="1.4"/>`;
  else if(m==='p') o+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#171c2a" stroke="${col}" stroke-width="2"/><path d="M${x},${y-r} A${r},${r} 0 0 0 ${x},${y+r}Z" fill="${col}"/>`;
  else o+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
  if(m==='k') o+=check(x,y,r*.9,'#06202e',2);
  if(cur) o+=`<circle cx="${x}" cy="${y}" r="${r+6}" fill="none" stroke="${col}" stroke-opacity=".6" stroke-width="1.5"/>`;
  return o;};
 const lab=(t,x,y,b,m)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${b?10.5:9}" font-weight="${b?700:500}" fill="${m==='n'?'#6d7790':'#d9e0f2'}">${trunc(t,17)}</text>`;
 const head=(g,x,y,col)=>ring(x,y,8,g.done/g.total,col,'#26304a',3)+`<text x="${x+16}" y="${y+4.5}" font-size="12" font-weight="800" fill="#eef2ff">${trunc(g.name,22)} <tspan fill="#6d7790" font-weight="600">${g.done}/${g.total}</tspan></text>`;
 const hub=(g,cx,cy,aura)=>{
  s+=`<circle cx="${cx}" cy="${cy+10}" r="125" fill="url(#${aura})"/>`;
  s+=head(g,cx-95,cy-98,c.k);
  const sp=g.nodes.slice(1),R=62;const pos=sp.map((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/sp.length;return [cx+R*Math.cos(a),cy+14+R*Math.sin(a)];});
  sp.forEach((n,i)=>{const on=n[1]==='k';s+=`<line x1="${cx}" y1="${cy+14}" x2="${pos[i][0]}" y2="${pos[i][1]}" stroke="${on?c.k:'#2c3550'}" stroke-width="${on?1.8:1}" ${on?'':'stroke-dasharray="2 4"'} ${on?'opacity=".9"':''}/>`;});
  s+=node('k',cx,cy+14,12)+lab(g.nodes[0][0],cx,cy+36,1,'k');
  sp.forEach((n,i)=>{const [px,py]=pos[i];s+=node(n[1],px,py,n[2]===1?10:8,n[2]===1&&g.id==='d');s+=lab(n[0],px,py+(py>cy+20?18:-14),n[2]===1,n[1]);});
 };
 hub(G[0],122,150,'aB'); hub(G[1],368,150,'aP');
 // galaxy
 const cx=W/2, cy=476; s+=`<circle cx="${cx}" cy="${cy}" r="190" fill="url(#aR)"/>`;
 s+=head(G[2],cx-85,282,c.k);
 const order=['r','p','k','n'];const ord=[...G[2].nodes].sort((a,b)=>order.indexOf(a[1])-order.indexOf(b[1]));
 const pts=ord.map((d,i)=>{const rad=24+Math.sqrt(i+.5)*33, ang=i*2.39996; return [Math.min(W-48,Math.max(48,cx+rad*Math.cos(ang)*1.3)),cy+rad*Math.sin(ang)*.8,d];});
 pts.forEach((p,i)=>{if(i>0){const q=pts[Math.max(0,i-1-(i%3))];s+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#2c3550" stroke-width=".8" opacity=".8"/>`;}});
 pts.forEach(p=>{s+=node(p[2][1],p[0],p[1],p[2][1]==='r'?8:7);s+=lab(p[2][0],p[0],p[1]+(p[2][1]==='r'?20:17),0,p[2][1]);});
 s+='</svg>';
 const legend=`<span style="color:#9aa4bf"><i style="background:${c.k}"></i>Lo sabes</span><span style="color:#9aa4bf"><i style="background:linear-gradient(90deg,${c.p} 50%,#171c2a 50%);box-shadow:inset 0 0 0 1.5px ${c.p}"></i>A medias</span><span style="color:#9aa4bf"><i style="background:${c.r}"></i>Repasar</span><span style="color:#9aa4bf"><i style="background:#171c2a;box-shadow:inset 0 0 0 1.5px ${c.n}"></i>Nuevo</span><span class="cta" style="background:linear-gradient(135deg,#ff7a6b,#ff5c8a);box-shadow:0 4px 14px rgba(255,100,120,.4)">Repasar 8 ›</span>`;
 return shell({bg:'#0b0f19',panelBg:'#0f1424',panelBorder:'#1e2640',ink:'#eef2ff',inkMute:'#7d88a6',sidebarBg:'#0d1220',
  tabs:tabsHtml('background:#eef2ff;color:#0b0f19','background:#171e33;color:#9aa4bf;box-shadow:inset 0 0 0 1px #242d4a','background:#171e33;color:#9aa4bf;box-shadow:inset 0 0 0 1px #242d4a'),
  legend,body:s,right:rightHtml({ink:'#eef2ff',mute:'#8b96b4',acc:'#4cc2ff',btn:'#171e33',line:'#242d4a',glow:'0 0 24px rgba(76,194,255,.55)'})});
}

// =============== VARIANT C : chip clusters on warm paper ===============
function C(){
 const st={k:{bg:'#e6f1fd',fg:'#1b64b4',dot:BLUE,bd:'#bcd9f7'},p:{bg:'#eef0fd',fg:'#4a4fb5',dot:'#6f74e8',bd:'#cfd2f7'},r:{bg:'#fdeceb',fg:'#b13d35',dot:RED,bd:'#f6c4c0'},n:{bg:'#fff',fg:'#8a8880',dot:'#d6d4ce',bd:'#e6e3dc'}};
 let s=`<svg width="${W}" height="690" viewBox="0 0 ${W} 690"><defs>
  <linearGradient id="half" x1="0" x2="1"><stop offset=".5" stop-color="#6f74e8"/><stop offset=".5" stop-color="#fff"/></linearGradient></defs>`;
 const chip=(d,x,y,big,cur)=>{ // x,y = left, center-y
  const fs=big?11.5:10, h=big?28:23, w=tw(d[0],fs)+(big?44:34), t=st[d[1]];
  let o=`<g><rect x="${x}" y="${y-h/2}" width="${w}" height="${h}" rx="${h/2}" fill="${t.bg}" stroke="${t.bd}" stroke-width="1" ${cur?`style="filter:drop-shadow(0 3px 6px rgba(35,131,226,.35))"`:''}/>`;
  const dx=x+h/2-.5;
  if(d[1]==='p') o+=`<circle cx="${dx}" cy="${y}" r="4.2" fill="url(#half)" stroke="${t.dot}" stroke-width="1.3"/>`;
  else if(d[1]==='n') o+=`<circle cx="${dx}" cy="${y}" r="4" fill="#fff" stroke="${t.dot}" stroke-width="1.4"/>`;
  else o+=`<circle cx="${dx}" cy="${y}" r="${big?6:4.6}" fill="${t.dot}"/>`+(d[1]==='k'&&big?check(dx,y,7,'#fff',1.6):'');
  o+=`<text x="${x+h/2+8}" y="${y+3.6}" font-size="${fs}" font-weight="${big||d[1]!=='n'?700:600}" fill="${t.fg}">${d[0]}</text></g>`;
  return {svg:o,w};};
 const flow=(items,cx,top,maxW,gap=7,rowH=30,bigIdx=-1)=>{
  const rows=[];let row=[],rw=0;
  items.forEach((d,i)=>{const big=i===bigIdx;const w=tw(d[0],big?11.5:10)+(big?44:34);if(rw+w>maxW&&row.length){rows.push([row,rw-gap]);row=[];rw=0;}row.push([d,w,big]);rw+=w+gap;});
  rows.push([row,rw-gap]);let o='';
  rows.forEach(([r,w],ri)=>{let x=cx-w/2;r.forEach(([d,ww,big])=>{o+=chip(d,x,top+ri*rowH,big,big&&d[1]==='k'&&d[0]==='Tipos de despliegue').svg;x+=ww+gap;});});
  return {svg:o,h:rows.length*rowH};};
 const blob=(x,y,w,h,fill,stroke,g,col)=>{
  s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  const p=g.done/g.total;
  s+=`<text x="${x+18}" y="${y+27}" font-size="12.5" font-weight="800" fill="#2b2a27">${trunc(g.name,24)}</text>`;
  const bx=x+18,bw=w-36;
  s+=`<rect x="${bx}" y="${y+38}" width="${bw}" height="5" rx="2.5" fill="rgba(55,53,47,.08)"/><rect x="${bx}" y="${y+38}" width="${Math.max(6,bw*p)}" height="5" rx="2.5" fill="${col}"/>`;
  s+=`<text x="${x+w-18}" y="${y+27}" text-anchor="end" font-size="11" font-weight="700" fill="#8a8880">${g.done}/${g.total}</text>`;};
 // hub groups: hub big chip centered, rest below in flow
 const hubGroup=(g,x,y,w,h,fill,stroke,col)=>{
  blob(x,y,w,h,fill,stroke,g,col);
  const cx=x+w/2; const hn=[trunc(g.nodes[0][0],24),g.nodes[0][1]];const hub=chip(hn,cx-(tw(hn[0],11.5)+44)/2,y+78,true,false);
  s+=hub.svg;
  s+=`<path d="M${cx},${y+92} L${cx},${y+106}" stroke="${stroke}" stroke-width="1.5"/>`;
  const f=flow(g.nodes.slice(1),cx,y+122,w-36);s+=f.svg;};
 hubGroup(G[0],12,48,230,236,'#eef5fd','#d3e4f8',BLUE);
 hubGroup(G[1],251,48,230,236,'#f0f0fc','#d9daf5','#6f74e8');
 blob(12,296,469,348,'#fbf3e8','#f0e1cb',G[2],RED);
 const order=['r','p','k','n'];const ord=[...G[2].nodes].sort((a,b)=>order.indexOf(a[1])-order.indexOf(b[1]));
 // sectioned flows
 let y=352;
 [['Para repasar','r'],['A medias','p'],['Dominados','k'],['Sin empezar','n']].forEach(([t,m])=>{
  const items=ord.filter(d=>d[1]===m);
  s+=`<text x="31" y="${y}" font-size="8.5" font-weight="800" letter-spacing="1" fill="#a29a8a">${t.toUpperCase()}</text>`;
  const rows=(()=>{let r=1,rw=0;items.forEach(d=>{const w=tw(d[0],10)+34+7;if(rw+w>433){r++;rw=0;}rw+=w;});return r;})();
  // left aligned flow
  let x=31,ry=y+15,rw=0;items.forEach(d=>{const w=tw(d[0],10)+34;if(x+w>462){x=31;ry+=27;}const c=chip(d,x,ry,false,false);s+=c.svg;x+=w+7;});
  y=ry+24;});
 s+='</svg>';
 const legend=`<span><i style="background:${BLUE}"></i>Lo sabes</span><span><i style="background:linear-gradient(90deg,#6f74e8 50%,#fff 50%);box-shadow:inset 0 0 0 1.5px #6f74e8"></i>A medias</span><span><i style="background:${RED}"></i>Repasar</span><span><i style="background:#fff;box-shadow:inset 0 0 0 1.5px #c9c7c1"></i>Nuevo</span><span class="cta" style="background:#2b2a27">Repasar 8 ›</span>`;
 return shell({bg:'#fdfbf7',panelBg:'#fffdf9',panelBorder:'#efe9dc',ink:'#2b2a27',inkMute:'#8a8880',sidebarBg:'#faf6ef',
  tabs:tabsHtml('background:#2b2a27;color:#fff','background:#f6f1e7;color:#5b594f','background:#f6f1e7;color:#5b594f'),
  legend,body:s,right:rightHtml({ink:'#2b2a27',mute:'#8a8880',acc:BLUE,btn:'#f6f1e7',line:'#efe9dc',glow:'0 6px 16px rgba(35,131,226,.3)'})});
}

(async()=>{
 const b=await chromium.launch();
 for(const [n,f] of [['prototype-1-soft-cards',A],['prototype-2-dark-constellation',B],['prototype-3-chip-clusters',C]]){
  const p=await b.newPage({viewport:{width:1000,height:760},deviceScaleFactor:2});
  await p.setContent(f());await p.screenshot({path:`${OUT}/${n}.png`});await p.close();
 }
 await b.close();
})();
