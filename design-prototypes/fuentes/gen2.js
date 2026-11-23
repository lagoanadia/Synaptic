const { chromium } = require('playwright');
const OUT=__dirname, BLUE='#2383e2', RED='#e16259', INK='#37352f', MUTE='#74736e', LINE='rgba(55,53,47,.09)', PBG='#fbfbfa';
const W=493;
const D=['Despliegue',2,7,[['Despliegue','k'],['Tipos de despliegue','k',1],['On-premise','k'],['Cloud','n'],['IaaS','n'],['PaaS','n'],['SaaS','r']]];
const S=['Software libre vs open source',2,5,[['Software libre vs open source','k'],['Las 4 libertades','k'],['Open core','p'],['Fork','n'],['MIT vs GPL','n']]];
const O=['Otros conceptos',2,25,[...['TCO fórmula','Volumen (Docker)','Docker','Copyleft y la GPL','Trampas de licencias','Arquitectura de ERP','Vendor lock-in','Backup'].map(n=>[n,'r']),['CI/CD','k'],['Kubernetes','k'],...['Contenedores','Escalabilidad','Odoo','SLA','Migración','Seguridad'].map(n=>[n,'p']),...['Dolibarr','SAP','Módulos ERP','Soporte','Licencias','Mantenimiento','API REST','Cron','Logs'].map(n=>[n,'n'])]];
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const DEFS=`<defs><linearGradient id="half" x1="0" x2="1"><stop offset=".5" stop-color="${BLUE}"/><stop offset=".5" stop-color="#fff"/></linearGradient></defs>`;
const chk=(x,y,r)=>`<path d="M${x-r*.32},${y+r*.02} l${r*.22},${r*.24} l${r*.42},${-r*.5}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const nd=(m,x,y,r,cur)=>{
 if(m==='k')return (cur?`<circle cx="${x}" cy="${y}" r="${r+5}" fill="${BLUE}" fill-opacity=".14" stroke="${BLUE}" stroke-opacity=".35" stroke-width="2"/>`:'')+`<circle cx="${x}" cy="${y}" r="${r}" fill="${BLUE}" stroke="#fff" stroke-width="2"/>`+(r>=8?chk(x,y,r*1.5):'');
 if(m==='p')return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#half)" stroke="${BLUE}" stroke-width="2"/>`;
 if(m==='r')return `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED}" stroke="#fff" stroke-width="2"/>`;
 return `<circle cx="${x}" cy="${y}" r="${r}" fill="${PBG}" stroke="#c9c7c1" stroke-width="1.6"/>`;};
const lab=(t,x,y,b,m,fs)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs||(b?11:10)}" font-weight="${b?800:700}" fill="${m==='n'?'#74736e':INK}" style="paint-order:stroke;stroke:${PBG};stroke-width:3.5px;stroke-linejoin:round">${t}</text>`;
const ring=(cx,cy,r,p,sw=3)=>{const C=2*Math.PI*r;return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e9e8e4" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BLUE}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${Math.max(C*p,2)} ${C}" transform="rotate(-90 ${cx} ${cy})"/>`;};
const head=(g,x,y,fs=13)=>ring(x+8,y,7.5,g[1]/g[2])+`<text x="${x+22}" y="${y+4.5}" font-size="${fs}" font-weight="800" fill="${INK}">${g[0]} <tspan fill="${MUTE}" font-weight="600">${g[1]}/${g[2]}</tspan></text>`;
const rank=['r','p','k','n'];const sorted=a=>[...a].sort((x,y)=>rank.indexOf(x[1])-rank.indexOf(y[1]));
const rail=(a,b,xa,xb,y)=>{const on=a==='k'&&b==='k';return `<line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" stroke="${on?BLUE:'#dcdad4'}" stroke-width="${on?2.2:1.4}" ${on?'':'stroke-dasharray="3 4"'}/>`;};

function shell({body,tabs,legend,right}){return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{width:1000px;height:760px;background:#fff;font-family:Inter,Helvetica,Arial,sans-serif;color:${INK};position:relative;overflow:hidden}
.side{position:absolute;left:0;top:0;bottom:0;width:36px;background:#f7f7f5;border-right:1px solid ${LINE}}.side i{display:block;width:16px;height:16px;border:1.5px solid #9a9892;border-radius:4px;margin:20px auto 0}
.bc{position:absolute;left:72px;top:24px;font-size:11px;color:${MUTE}}
.panel{position:absolute;left:72px;top:48px;width:${W}px;height:690px;background:${PBG};border:1px solid ${LINE};border-radius:12px;overflow:hidden}
.tabs{position:absolute;left:8px;top:7px;display:flex;gap:6px;z-index:5}.tabs span{padding:5px 11px;border-radius:99px;font-size:10.5px;font-weight:700;background:#fff;box-shadow:0 0 0 1px ${LINE}}.tabs .on{background:#2b2a27;color:#fff;box-shadow:none}
.plus{position:absolute;right:8px;top:7px;width:28px;height:28px;border-radius:7px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.1);display:grid;place-items:center;font-size:17px;color:#6f6e69;z-index:5}
.legend{position:absolute;left:0;right:0;bottom:0;height:46px;display:flex;align-items:center;gap:12px;padding:0 14px;font-size:10px;color:#6f6e69;z-index:5;background:${PBG}}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
.cta{margin-left:auto;color:#fff;background:${RED};font-weight:700;font-size:11px;padding:7px 14px;border-radius:99px}
svg{position:absolute;left:0;top:0}.right{position:absolute;left:600px;top:48px;width:360px}</style></head><body>
<div class="side"><i></i><i style="border-radius:50%"></i><i></i></div><div class="bc">School &nbsp;/&nbsp; SXE &nbsp;/&nbsp; Teoria</div>
<div class="panel">${body}${tabs}<div class="plus">+</div><div class="legend">${legend}</div></div>
<div class="right"><div style="display:flex;justify-content:space-between"><h1 style="font-size:28px;letter-spacing:-.6px;font-weight:800">Tipos de despliegue</h1><span style="color:#9a9892;letter-spacing:2px">···</span></div>
<p style="margin-top:20px;font-size:15px;color:#74736e">Tipos de despliegue en una frase.</p><p style="margin-top:22px;font-size:14px">Tipos de despliegue explicado.</p>
<div style="margin-top:22px;display:flex;gap:10px"><div style="width:56px;height:56px;border-radius:50%;background:${BLUE};display:grid;place-items:center"><svg width="22" height="22" viewBox="0 0 24 24" style="position:static"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div style="width:48px;height:48px;margin-top:4px;border-radius:50%;border:1px solid #e3e1dc;display:grid;place-items:center">💡</div></div></div></body></html>`;}
const LEG=`<span><i style="background:${BLUE}"></i>Lo sabes</span><span><i style="background:linear-gradient(90deg,${BLUE} 50%,#fff 50%);box-shadow:inset 0 0 0 1.5px ${BLUE}"></i>A medias</span><span><i style="background:${RED}"></i>Repasar</span><span><i style="background:#fff;box-shadow:inset 0 0 0 1.5px #c9c7c1"></i>Nuevo</span><span class="cta">Repasar 8 ›</span>`;
const TABS=`<div class="tabs"><span class="on">Todo</span><span>Despliegue</span><span>Software libre vs ope…</span><span>Otros conceptos</span></div>`;
const open=b=>`<svg width="${W}" height="690" viewBox="0 0 ${W} 690">${DEFS}${b}</svg>`;

// ===== 1. CARRILES =====
function P1(){
 let s='';const lane=(g,y,last)=>{s+=head(g,18,y+14);if(!last)s+=`<line x1="18" x2="${W-18}" y1="${y+104}" y2="${y+104}" stroke="${LINE}"/>`;};
 const rows=(g,y)=>{const cy=y+56;const items=g[3];const xs=items.map((_,i)=>i===0?46:122+(i-1)*60);
  items.forEach((it,i)=>{if(i>0)s+=rail(items[i-1][1],it[1],xs[i-1]+(i===1?14:9),xs[i]-9,cy);});
  items.forEach((it,i)=>{const hub=i===0;s+=nd(it[1],xs[i],cy,hub?13:9,it[2]===1)+lab(trunc(it[0],hub?18:11),xs[i],cy+(hub?30:24),hub||it[2]===1,it[1],hub?11:9.5);});};
 lane(D,52);rows(D,52);lane(S,158);rows(S,158);
 s+=head(O,18,278+14);
 sorted(O[3]).forEach((it,i)=>{const c=i%5,r=Math.floor(i/5);const x=52+c*97,y=332+r*58;s+=nd(it[1],x,y,9)+lab(trunc(it[0],15),x,y+23,0,it[1],9.5);});
 return shell({body:open(s),tabs:TABS,legend:LEG});}

// ===== 2. LISTA + FOCO =====
function P2(){
 let s=`<rect x="0" y="0" width="156" height="690" fill="#f5f5f3"/><line x1="156" x2="156" y1="0" y2="690" stroke="${LINE}"/>`;
 s+=`<text x="16" y="28" font-size="10" font-weight="800" letter-spacing="1" fill="#9a9892">GRUPOS</text>`;
 const items=[[['Todo'],6,37,0],[['Despliegue'],2,7,1],[['Software libre','vs open source'],2,5,0],[['Otros conceptos'],2,25,0]];
 items.forEach((it,i)=>{const y=46+i*62;const sel=it[3];
  if(sel)s+=`<rect x="8" y="${y}" width="140" height="54" rx="10" fill="#fff" stroke="${LINE}"/><rect x="8" y="${y+14}" width="3" height="26" rx="1.5" fill="${BLUE}"/>`;
  s+=ring(30,y+27,10,it[1]/it[2],3.4);
  it[0].forEach((l,j)=>s+=`<text x="48" y="${y+(it[0].length>1?22:25)+j*13}" font-size="11.5" font-weight="800" fill="${INK}">${l}</text>`);
  s+=`<text x="48" y="${y+(it[0].length>1?48:41)}" font-size="10" font-weight="600" fill="${MUTE}">${it[1]}/${it[2]}${i===3?'  ·  8 para repasar':''}</text>`;});
 // focus
 const X=156, cx=X+(W-X)/2;
 s+=head(D,X+22,86,17);
 s+=`<text x="${X+22}" y="112" font-size="11" font-weight="600" fill="${MUTE}">5 por aprender · 1 para repasar</text>`;
 const cy=290,R=100,ch=D[3].slice(1);
 const pos=ch.map((c,i)=>{const a=-Math.PI/2+i*2*Math.PI/ch.length;return [cx+R*Math.cos(a),cy+R*Math.sin(a)];});
 ch.forEach((c,i)=>{const on=c[1]==='k';s+=`<line x1="${cx}" y1="${cy}" x2="${pos[i][0]}" y2="${pos[i][1]}" stroke="${on?BLUE:'#d9d7d1'}" stroke-width="${on?2.4:1.4}" ${on?'':'stroke-dasharray="3 4"'}/>`;});
 s+=nd('k',cx,cy,17)+lab('Despliegue',cx,cy+36,1,'k',12);
 ch.forEach((c,i)=>{const [x,y]=pos[i];s+=nd(c[1],x,y,c[2]?15:12,c[2]===1)+lab(c[0],x,y+(i===0?-26:y>cy?30:-20),c[2]===1,c[1],11);});
 // next up card
 s+=`<rect x="${X+20}" y="460" width="${W-X-40}" height="150" rx="12" fill="#fff" stroke="${LINE}"/><text x="${X+36}" y="486" font-size="10" font-weight="800" letter-spacing="1" fill="#9a9892">SIGUIENTE EN ESTE GRUPO</text>`;
 [['SaaS','r','Para repasar'],['Cloud','n','Nuevo'],['IaaS','n','Nuevo'],['PaaS','n','Nuevo']].forEach((it,i)=>{const y=512+i*26;s+=nd(it[1],X+44,y,6.5)+`<text x="${X+60}" y="${y+4}" font-size="11.5" font-weight="700" fill="${INK}">${it[0]}</text><text x="${W-36}" y="${y+4}" text-anchor="end" font-size="10" font-weight="600" fill="${it[1]==='r'?RED:'#9a9892'}">${it[2]}</text>`;});
 return shell({body:open(s),tabs:'',legend:LEG});}

// ===== 3. ACORDEÓN =====
function P3(){
 let s='';const all=[...D[3],...S[3],...O[3]];const cnt=m=>all.filter(x=>x[1]===m).length;
 s+=`<text x="18" y="30" font-size="10" font-weight="800" letter-spacing="1" fill="#9a9892">PROGRESO TOTAL</text><text x="18" y="62" font-size="24" font-weight="800" fill="${INK}">6 <tspan font-size="14" fill="${MUTE}" font-weight="600">/ 37 conceptos</tspan></text>`;
 let x=18;const bw=457;[['k',BLUE],['p','#8ab8ee'],['r',RED],['n','#e4e2dc']].forEach(([m,c])=>{const w=bw*cnt(m)/all.length;s+=`<rect x="${x}" y="76" width="${w-2}" height="8" rx="4" fill="${c}"/>`;x+=w;});
 s+=`<text x="18" y="102" font-size="10" fill="${MUTE}" font-weight="600">${cnt('k')} dominados · ${cnt('p')} a medias · <tspan fill="${RED}" font-weight="800">${cnt('r')} para repasar</tspan> · ${cnt('n')} nuevos</text>`;
 const card=(y,h)=>`<rect x="10" y="${y}" width="${W-20}" height="${h}" rx="12" fill="#fff" stroke="${LINE}"/>`;
 // expanded
 s+=card(118,230)+head(D,26,144)+`<path d="M${W-34},140 l6,6 l6,-6" fill="none" stroke="#9a9892" stroke-width="1.8" stroke-linecap="round"/>`;
 const cx=118,cy=248,R=62,ch=D[3].slice(1);const pos=ch.map((c,i)=>{const a=-Math.PI/2+i*2*Math.PI/ch.length;return [cx+R*Math.cos(a),cy+R*Math.sin(a)];});
 ch.forEach((c,i)=>{const on=c[1]==='k';s+=`<line x1="${cx}" y1="${cy}" x2="${pos[i][0]}" y2="${pos[i][1]}" stroke="${on?BLUE:'#d9d7d1'}" stroke-width="${on?2.2:1.3}" ${on?'':'stroke-dasharray="3 4"'}/>`;});
 s+=nd('k',cx,cy,12)+lab('Despliegue',cx,cy+27,1,'k',10.5);
 ch.forEach((c,i)=>{const [px,py]=pos[i];s+=nd(c[1],px,py,c[2]?11:9,c[2]===1)+(c[2]===1?'':lab(trunc(c[0],10),px,py+(py>cy?21:-15),0,c[1],9.5));});
 s+=lab('Tipos de despliegue',cx,cy-R-22,1,'k',10.5);
 s+=`<line x1="236" x2="236" y1="170" y2="330" stroke="${LINE}"/>`;
 s+=`<text x="256" y="186" font-size="10" font-weight="800" letter-spacing="1" fill="#9a9892">SIGUIENTE</text>`;
 [['SaaS','r','Repasar'],['Cloud','n','Nuevo'],['IaaS','n','Nuevo'],['PaaS','n','Nuevo']].forEach((it,i)=>{const y=214+i*28;s+=nd(it[1],266,y,6.5)+`<text x="282" y="${y+4}" font-size="11.5" font-weight="700" fill="${INK}">${it[0]}</text><text x="${W-30}" y="${y+4}" text-anchor="end" font-size="10" font-weight="600" fill="${it[1]==='r'?RED:'#9a9892'}">${it[2]}</text>`;});
 // collapsed rows
 const strip=(g,y,perRow,badge)=>{const items=sorted(g[3]);const rows=Math.ceil(items.length/perRow);const h=46+rows*20+14;
  s+=card(y,h)+head(g,26,y+26)+`<path d="M${W-34},${y+23} l6,6 l6,-6" fill="none" stroke="#9a9892" stroke-width="1.8" stroke-linecap="round" transform="rotate(-90 ${W-28} ${y+26})"/>`;
  if(badge)s+=`<rect x="${W-122}" y="${y+14}" width="72" height="20" rx="10" fill="#fcebea"/><text x="${W-86}" y="${y+28}" text-anchor="middle" font-size="10" font-weight="800" fill="${RED}">${badge}</text>`;
  items.forEach((it,i)=>{s+=nd(it[1],34+(i%perRow)*24,y+54+Math.floor(i/perRow)*20,7);});return y+h+12;};
 let y=strip(S,360,19,null);y=strip(O,y,19,'8 repasar');
 return shell({body:open(s),tabs:`<div class="tabs"><span class="on">Todo</span><span>Despliegue</span><span>Software libre vs ope…</span><span>Otros conceptos</span></div>`.replace('class="tabs"','class="tabs" style="display:none"'),legend:LEG});}

(async()=>{const b=await chromium.launch();
 for(const [n,f] of [['estructura-1-carriles',P1],['estructura-2-lista-y-foco',P2],['estructura-3-acordeon',P3]]){
  const p=await b.newPage({viewport:{width:1000,height:760},deviceScaleFactor:2});await p.setContent(f());await p.screenshot({path:`${OUT}/${n}.png`});await p.close();}
 await b.close();})();
