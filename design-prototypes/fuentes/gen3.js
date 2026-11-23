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

// ---------- datos: 90 conceptos sueltos ----------
let seed=7;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const TOP=['Docker','ERP','GPL','Cloud','SQL'],ASP=['definición','ventajas','riesgos','coste','ejemplo','límites','tipos','historia','casos','errores','seguridad','migración'];
const L=[];TOP.forEach(t=>ASP.forEach(a=>L.push({n:`${t}: ${a}`,tag:t})));
for(let i=1;i<=30;i++)L.push({n:`Idea suelta ${i}`,tag:null});
L.forEach(o=>{const r=rnd();o.m=r<.12?'r':r<.27?'p':r<.37?'k':'n';});
const cnt=(a,m)=>a.filter(x=>x.m===m).length;
const byS=a=>[...a].sort((x,y)=>rank.indexOf(x.m)-rank.indexOf(y.m));
const LOOSE=['Conceptos sueltos',cnt(L,'k'),L.length];
const pack=(n,R)=>{const c=(R-7)/Math.sqrt(n);return Array.from({length:n},(_,i)=>[c*Math.sqrt(i+.5)*Math.cos(i*2.39996),c*Math.sqrt(i+.5)*Math.sin(i*2.39996)]);};
const mini=(g,cx,cy,R)=>{let o='';const ch=g[3].slice(1);const pos=ch.map((c,i)=>{const a=-Math.PI/2+i*2*Math.PI/ch.length;return [cx+R*Math.cos(a),cy+R*Math.sin(a)];});
 ch.forEach((c,i)=>{const on=c[1]==='k';o+=`<line x1="${cx}" y1="${cy}" x2="${pos[i][0]}" y2="${pos[i][1]}" stroke="${on?BLUE:'#d9d7d1'}" stroke-width="${on?2.2:1.3}" ${on?'':'stroke-dasharray="3 4"'}/>`;});
 o+=nd('k',cx,cy,11)+lab(trunc(g[0],16),cx,cy+25,1,'k',10);
 ch.forEach((c,i)=>{const [x,y]=pos[i];o+=nd(c[1],x,y,c[2]?10:8,c[2]===1)+(c[2]===1?lab('Tipos de despliegue',x,y-17,1,'k',10):'');});return o;};
const chip=(x,y,t,w)=>`<rect x="${x}" y="${y}" width="${w}" height="20" rx="10" fill="#fcebea"/><text x="${x+w/2}" y="${y+14}" text-anchor="middle" font-size="10" font-weight="800" fill="${RED}">${t}</text>`;
const sec=(x,y,t)=>`<text x="${x}" y="${y}" font-size="9.5" font-weight="800" letter-spacing="1" fill="#9a9892">${t}</text>`;
const D2=['Despliegue',2,7,D[3]],S2=['Software libre vs open source',2,5,S[3]];
const tabs=TABS;

// ===== A: campo ordenado =====
function PA(){
 let s=head(D,18,66)+head(['Software libre vs open source',2,5],258,66).replace('Software libre vs open source','Software libre vs open…');
 s+=mini(D2,120,150,50)+mini(['Software libre',2,5,S[3]],366,150,50);
 s+=`<line x1="18" x2="${W-18}" y1="236" y2="236" stroke="${LINE}"/>`;
 s+=head(LOOSE,18,262)+chip(W-98,252,`${cnt(L,'r')} para repasar`,80);
 const r=L.filter(x=>x.m==='r');
 s+=sec(18,294,`PARA REPASAR · ${r.length}`);
 r.forEach((o,i)=>{const x=50+(i%5)*98,y=318+Math.floor(i/5)*46;s+=nd('r',x,y,8)+lab(trunc(o.n,14),x,y+21,0,'r',9.5);});
 let y=410;
 [['p','A MEDIAS'],['k','DOMINADOS'],['n','NUEVOS']].forEach(([m,t])=>{const a=L.filter(x=>x.m===m);s+=sec(18,y,`${t} · ${a.length}`);
  a.forEach((o,i)=>s+=nd(m,26+(i%22)*20.5,y+16+Math.floor(i/22)*20,6.5));y+=16+Math.ceil(a.length/22)*20+22;});
 // tooltip sobre un punto "nuevo"
 const tx=26+9*20.5, ty=472+ (16+20+22)*0 ;const ny=y; 
 return shell({body:open(s),tabs,legend:LEG});}

// ===== B: burbujas + lupa =====
function PB(){
 let s='';
 const bub=(g,cx,cy,R,items,dr,label)=>{
  s+=`<circle cx="${cx}" cy="${cy}" r="${R+6}" fill="#fff" stroke="${LINE}"/>`+ring(cx,cy,R+6,g[1]/g[2],2.6).replace(/stroke-width="2.6"/g,'stroke-width="2.6"');
  const p=pack(items.length,R);items.forEach((it,i)=>{s+=nd(it.m||it[1],cx+p[i][0],cy+p[i][1],dr,it[2]===1);});
  s+=`<text x="${cx}" y="${cy-R-16}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${INK}">${label} <tspan fill="${MUTE}" font-weight="600">${g[1]}/${g[2]}</tspan></text>`;};
 bub(D,125,142,52,D[3],8.5,'Despliegue');bub(S,368,142,52,S[3],8.5,'Software libre vs open…');
 const cx=246,cy=435,R=148,items=byS(L),p=pack(items.length,R);
 bub(LOOSE,cx,cy,R,items,6,'Conceptos sueltos');
 // lupa
 const ri=items.findIndex((o,i)=>o.m==='r'&&i===4);const sx=cx+p[ri][0],sy=cy+p[ri][1],lx=388,ly=560,LR=70,Z=2.5;
 const src=p.map((q,i)=>[q[0]+cx,q[1]+cy,i]).filter(q=>Math.hypot(q[0]-sx,q[1]-sy)<26).slice(0,5);
 s+=`<circle cx="${sx}" cy="${sy}" r="26" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 3"/><line x1="${sx+18}" y1="${sy+18}" x2="${lx-50}" y2="${ly-50}" stroke="${INK}" stroke-width="1.2"/>`;
 s+=`<clipPath id="lc"><circle cx="${lx}" cy="${ly}" r="${LR}"/></clipPath><circle cx="${lx}" cy="${ly}" r="${LR+2}" fill="#fff" stroke="${INK}" stroke-width="1.4"/><g clip-path="url(#lc)">`;
 src.forEach(q=>{const x=lx+(q[0]-sx)*Z,y=ly+(q[1]-sy)*Z;const it=items[q[2]];s+=nd(it.m,x,y,11)+lab(trunc(it.n,13),x,y+21,it.m==='r',it.m,9);});
 s+='</g>';
 return shell({body:open(s),tabs,legend:LEG});}

// ===== C: subgrupos por etiqueta =====
function PC(){
 let s=head(D,18,66)+head(['x',2,5],258,66).replace('>x ','>Software libre vs open… ');
 s+=mini(D2,120,150,48)+mini(['Software libre',2,5,S[3]],366,150,48);
 s+=`<line x1="18" x2="${W-18}" y1="226" y2="226" stroke="${LINE}"/>`;
 s+=head(LOOSE,18,250)+`<text x="${W-18}" y="254" text-anchor="end" font-size="10" font-weight="600" fill="${MUTE}">agrupados por etiqueta</text>`;
 const cells=[...TOP.map(t=>[t,L.filter(o=>o.tag===t)]),['Sin etiqueta',L.filter(o=>!o.tag)]];
 cells.forEach(([t,a],i)=>{const col=i%3,row=Math.floor(i/3);const x0=12+col*155,y0=274+row*190,w=148,h=178;
  s+=`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="14" fill="#fff" stroke="${LINE}"/>`;
  s+=ring(x0+17,y0+20,6.5,cnt(a,'k')/a.length,3)+`<text x="${x0+30}" y="${y0+24}" font-size="11.5" font-weight="800" fill="${INK}">${t} <tspan fill="${MUTE}" font-weight="600">${cnt(a,'k')}/${a.length}</tspan></text>`;
  const sorted=byS(a),R=t==='Sin etiqueta'?60:50,pk=pack(sorted.length,R);
  sorted.forEach((o,j)=>s+=nd(o.m,x0+w/2+pk[j][0],y0+104+pk[j][1],t==='Sin etiqueta'?5.2:6));
  const rv=cnt(a,'r');if(rv)s+=`<text x="${x0+w/2}" y="${y0+h-8}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${RED}">${rv} para repasar</text>`;});
 return shell({body:open(s),tabs,legend:LEG});}

(async()=>{const b=await chromium.launch();
 for(const [n,f] of [['mapa-A-campo-ordenado',PA],['mapa-B-burbujas-con-lupa',PB],['mapa-C-subgrupos-por-etiqueta',PC]]){
  const p=await b.newPage({viewport:{width:1000,height:760},deviceScaleFactor:2});await p.setContent(f());await p.screenshot({path:`${OUT}/${n}.png`});await p.close();}
 await b.close();})();
