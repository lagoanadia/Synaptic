const { chromium } = require('playwright');
const OUT=__dirname,BLUE='#2383e2',RED='#e16259',INK='#2b2a27',MUTE='#74736e',NAVY='#1c2540',LINE='#ececec',GRAY='#c9c7c1';
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const mk=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
// ---- datos ----
const TEO=(()=>{const r=['SaaS','TCO fórmula','Volumen (Docker)','Las 4 libertades','Trampas de licencias','Copyleft y la GPL','Docker','Arquitectura de ERP','Vendor lock-in'],p=['Contenedores','Escalabilidad','Odoo','SLA','Migración'],k=['On-premise','Cloud','CI/CD','Kubernetes','Backup','Logs','Despliegue'],n=['Dolibarr','SAP','Módulos ERP','Soporte','Licencias','Mantenimiento','API REST','Cron','IaaS','PaaS','Redes','DNS','Proxy','Firewall'];
 return [{m:'k',n:'Tipos de despliegue',cur:1},...r.map(n=>({m:'r',n})),...p.map(n=>({m:'p',n})),...k.map(n=>({m:'k',n})),...n.map(n=>({m:'n',n}))];})();
const gen=(n,pct,seed)=>{const R=mk(seed),a=[];const k=Math.round(n*pct/100*1.2),r=Math.round(n*.12),p=Math.round(n*.14);for(let i=0;i<n;i++)a.push({m:i<k?'k':i<k+r?'r':i<k+r+p?'p':'n',n:`Concepto ${i+1}`});return a.sort((x,y)=>'rpkn'.indexOf(x.m)-'rpkn'.indexOf(y.m));};
const SUBJ=[
 {id:'SXE',t:'0/1 unidades',u:[['UD1',0,gen(22,0,1)],['Entregas',16,gen(18,16,2)],['Teoria',21,TEO]]},
 {id:'PSP',t:'0/2 unidades',u:[['UD1',0,gen(14,0,3)],['UD3',2,gen(20,2,4)],['Entregas',0,gen(9,0,5)]]},
 {id:'PMDM',t:'0/3 unidades',u:[['UD1',2,gen(28,2,6)],['UD2',0,gen(17,0,7)],['UD3',0,gen(24,0,8)],['Entregas',13,gen(12,13,9)]]},
 {id:'AD',t:'0/3 unidades',u:[['UD1',0,gen(16,0,10)],['UD2',0,gen(12,0,11)],['UD3',17,gen(22,17,12)],['Entregas',0,gen(8,0,13)],['General',0,gen(15,0,14)]]},
 {id:'DI',t:'0/2 unidades',u:[['UD1',1,gen(30,1,15)],['UD3',0,gen(18,0,16)],['General',0,gen(14,0,17)]]}];
const TINT={SXE:'#eef5fd',PSP:'#f1f0fc',PMDM:'#eef7f1',AD:'#fcf3ea',DI:'#fbeff2'};
// ---- primitivas ----
const pack=(n,R,sx=1)=>{const c=(R-5)/Math.sqrt(n);return Array.from({length:n},(_,i)=>[c*Math.sqrt(i+.5)*Math.cos(i*2.39996)*sx,c*Math.sqrt(i+.5)*Math.sin(i*2.39996)]);};
const chk=(x,y,r)=>`<path d="M${x-r*.32},${y+r*.02} l${r*.22},${r*.24} l${r*.42},${-r*.5}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot=(m,x,y,r,cur)=>{
 if(r<5){if(m==='k')return `<circle cx="${x}" cy="${y}" r="${r}" fill="${BLUE}"/>`;if(m==='r')return `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED}"/>`;
  if(m==='p')return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${BLUE}" stroke-width="1"/><path d="M${x},${y-r} A${r},${r} 0 0 0 ${x},${y+r}Z" fill="${BLUE}"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${GRAY}" stroke-width="1"/>`;}
 if(m==='k')return (cur?`<circle cx="${x}" cy="${y}" r="${r+5}" fill="${BLUE}" fill-opacity=".14" stroke="${BLUE}" stroke-opacity=".35" stroke-width="2"/>`:'')+`<circle cx="${x}" cy="${y}" r="${r}" fill="${BLUE}" stroke="#fff" stroke-width="2"/>`+(r>=8?chk(x,y,r*1.5):'');
 if(m==='p')return `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#half)" stroke="${BLUE}" stroke-width="2"/>`;
 if(m==='r')return `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED}" stroke="#fff" stroke-width="2"/>`;
 return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${GRAY}" stroke-width="1.6"/>`;};
const arc=(cx,cy,r,p,sw=2.6,col=NAVY)=>{const C=2*Math.PI*r;return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8e8e6" stroke-width="${sw}"/>`+(p>0?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${Math.max(C*p,2.5)} ${C}" transform="rotate(-90 ${cx} ${cy})"/>`:'');};
const T=(x,y,t,o={})=>`<text x="${x}" y="${y}" text-anchor="${o.a||'middle'}" font-size="${o.s||9}" font-weight="${o.w||600}" fill="${o.c||MUTE}" ${o.h?`style="paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round"`:''}>${t}</text>`;
const uR=n=>4.2*Math.sqrt(n)+7;
const cluster=(items,cx,cy,R,dr,o={})=>{let s='';const p=pack(items.length,R,o.sx||1);items.forEach((it,i)=>{s+=dot(it.m,cx+p[i][0],cy+p[i][1],dr,it.cur&&o.cur);if(o.lab&&(it.m==='r'||it.cur||o.all))s+=T(cx+p[i][0],cy+p[i][1]+dr+11,trunc(it.n,o.max||14),{s:o.fs||9.5,w:700,c:it.m==='n'?MUTE:INK,h:1});});return s;};
const DEFS=`<defs><linearGradient id="half" x1="0" x2="1"><stop offset=".5" stop-color="${BLUE}"/><stop offset=".5" stop-color="#fff"/></linearGradient></defs>`;
const pane=(w,h,inner,cap)=>`<div class="cap">${cap}</div><div class="pane"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${DEFS}${inner}</svg></div>`;
const PW=670,PH=688;
// leyenda mini
const legend=(y)=>[['k','Lo sabes'],['p','A medias'],['r','Repasar'],['n','Nuevo']].map(([m,t],i)=>dot(m,22+i*84,y,4)+T(32+i*84,y+3.5,t,{a:'start',s:9.5})).join('');

const AMBER='#f5b82e',DARK='#18181b';
const page5=(title,sub,svg,cols)=>`<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:1400px;height:800px;background:#fff;font-family:Inter,Helvetica,Arial,sans-serif;color:${INK};padding:20px 30px}h1{font-size:18px;font-weight:800;letter-spacing:-.3px}p.sub{font-size:12.5px;color:${MUTE};margin:4px 0 6px;max-width:1100px;line-height:1.45}svg{display:block}.cols{display:flex;gap:30px;margin-top:6px}.cols div{flex:1;font-size:11.5px;line-height:1.5;color:#4b4a45}.cols b{display:block;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#9a9892;margin-bottom:3px}</style></head><body><h1>${title}</h1><p class="sub">${sub}</p>${svg}<div class="cols">${cols.map(c=>`<div><b>${c[0]}</b>${c[1]}</div>`).join('')}</div></body></html>`;
const SW=400,SH=430,GAP=70;
const GDEFS=`<defs><linearGradient id="half" x1="0" x2="1"><stop offset=".5" stop-color="${BLUE}"/><stop offset=".5" stop-color="#fff"/></linearGradient><linearGradient id="av" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f08a4b"/><stop offset="1" stop-color="#dd5b2a"/></linearGradient><pattern id="dg" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#2c2c31"/></pattern><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="${INK}" stroke-width="1.4"/></marker></defs>`;
const frame=(i,x,label,inner,dark)=>`<g transform="translate(${x},34)"><text x="0" y="-12" font-size="11.5" font-weight="800" fill="${INK}">${label}</text><clipPath id="cp${i}"><rect width="${SW}" height="${SH}" rx="14"/></clipPath><rect width="${SW}" height="${SH}" rx="14" fill="${dark?DARK:'#fdfdfc'}" stroke="${dark?'#2c2c31':'#e4e3df'}"/><g clip-path="url(#cp${i})">${inner}</g></g>`;
const link=(i,t)=>{const x=(i+1)*SW+i*GAP+8;return `<line x1="${x}" y1="250" x2="${x+GAP-16}" y2="250" stroke="${INK}" stroke-width="1.6" marker-end="url(#ar)"/>`+t.split('|').map((l,k)=>`<text x="${x+(GAP-16)/2}" y="${232-k*0+ -k*0+k*11-(t.split('|').length-1)*11}" text-anchor="middle" font-size="8.5" font-weight="700" fill="${INK}">${l}</text>`).join('');};
const avatar=(cx,cy,r)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#av)"/><circle cx="${cx}" cy="${cy+r*.12}" r="${r*.52}" fill="#f6d3b3"/><path d="M${cx-r*.55},${cy-r*.02} a${r*.55},${r*.55} 0 0 1 ${r*1.1},0 z" fill="#3a2418"/><circle cx="${cx-r*.2}" cy="${cy+r*.1}" r="${r*.07}" fill="#3a2418"/><circle cx="${cx+r*.2}" cy="${cy+r*.1}" r="${r*.07}" fill="#3a2418"/>`;
const xp=(x,y,v,dark)=>`<rect x="${x}" y="${y}" width="62" height="26" rx="13" fill="${dark?'#2a2a2e':'#fff'}" ${dark?'':`stroke="${LINE}"`}/>`+avatar(x+14,y+13,10)+`<text x="${x+30}" y="${y+17.5}" font-size="12" fill="${AMBER}">✦</text><text x="${x+43}" y="${y+17.5}" font-size="11" font-weight="800" fill="${dark?'#fff':INK}">${v}</text>`;
const rchip=(x,y,l,sub,p,dark)=>{const C=2*Math.PI*9;return `<rect x="${x}" y="${y}" width="104" height="26" rx="13" fill="${dark?'#2a2a2e':'#fff'}" ${dark?'':`stroke="${LINE}"`}/><circle cx="${x+15}" cy="${y+13}" r="9" fill="none" stroke="${dark?'#45454d':'#e8e8e6'}" stroke-width="3"/><circle cx="${x+15}" cy="${y+13}" r="9" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C*p} ${C}" transform="rotate(-90 ${x+15} ${y+13})"/><text x="${x+31}" y="${y+12}" font-size="8.5" font-weight="800" fill="${dark?'#fff':INK}">${l}</text><text x="${x+31}" y="${y+21}" font-size="7.5" fill="${dark?'#9a9aa3':MUTE}">${sub}</text>`;};
const btn=(x,y,w,t,o={})=>`<rect x="${x}" y="${y}" width="${w}" height="${o.h||26}" rx="${(o.h||26)/2}" fill="${o.f||'#fff'}" stroke="${o.s||'#dcdad4'}"/><text x="${x+w/2}" y="${y+(o.h||26)/2+3.5}" text-anchor="middle" font-size="${o.fs||9.5}" font-weight="700" fill="${o.c||INK}">${t}</text>`;
const card=(x,y,w,h,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${LINE}" ${extra}/>`;
// tarjeta mapa pequeña
const mcard=(s,x,y,w,h,hl)=>{const rs=s.u.map(u=>Math.min(17,uR(u[2].length)*.56));const tw=rs.reduce((a,r)=>a+2*r,0),sp=(w-34-tw)/(s.u.length-1||1);let c=card(x,y,w,h,hl?`style="filter:drop-shadow(0 0 0 ${BLUE})" stroke="${BLUE}" stroke-width="1.6"`:'')+T(x+12,y+19,s.id,{a:'start',s:11,w:800,c:INK})+T(x+w-12,y+19,s.t,{a:'end',s:8});
 let px=x+17;const cy=y+h*.58;const pts=s.u.map((u,j)=>{const p=[px+rs[j],cy,rs[j],u];px+=2*rs[j]+sp;return p;});
 pts.slice(1).forEach((p,i)=>c+=`<line x1="${pts[i][0]+pts[i][2]+2}" y1="${cy}" x2="${p[0]-p[2]-2}" y2="${cy}" stroke="#e6e6e3" stroke-width="1.5"/>`);
 pts.forEach(p=>c+=arc(p[0],cy,p[2]+2,p[3][1]/100,2)+cluster(p[3][2],p[0],cy,p[2],1.4)+T(p[0],cy+p[2]+11,p[3][0],{s:7,c:INK}));return c;};
// juego oscuro
const game=(chipL,chipS,chipP,xpv,topBar)=>{let g=`<rect width="${SW}" height="${SH}" fill="${DARK}"/><rect width="${SW}" height="${SH}" fill="url(#dg)"/>`+rchip(14,12,chipL,chipS,chipP,1)+xp(SW-76,12,xpv,1);
 g+=topBar;
 g+=`<rect x="30" y="118" width="340" height="92" rx="12" fill="#fff"/><text x="200" y="140" text-anchor="middle" font-size="8" fill="#9a9892">PSP</text><text x="200" y="166" text-anchor="middle" font-size="13" font-weight="800" fill="#111">¿Qué diferencia principal hay</text><text x="200" y="184" text-anchor="middle" font-size="13" font-weight="800" fill="#111">entre proceso y hilo?</text><rect x="30" y="204" width="270" height="6" fill="#f97a4d"/><rect x="30" y="204" width="270" height="6" fill="url(#tm)"/>`;
 const A=[['#ff6b5a','1',['Los hilos son procesos ligeros','con memoria independiente']],['#8b5cf6','2',['Los procesos comparten memoria;','los hilos tienen su propia']],['#14b8a6','3',['Procesos tienen memoria propia;','hilos comparten la del proceso.']],['#f5b82e','4',['Ambos usan el mismo espacio','de memoria siempre']]];
 A.forEach((a,i)=>{const x=30+(i%2)*174,y=226+Math.floor(i/2)*62;g+=`<rect x="${x}" y="${y+3}" width="166" height="54" rx="9" fill="#000" opacity=".25"/><rect x="${x}" y="${y}" width="166" height="54" rx="9" fill="${a[0]}"/><rect x="${x+9}" y="${y+16}" width="20" height="20" rx="5" fill="#fff"/><text x="${x+19}" y="${y+30}" text-anchor="middle" font-size="10" font-weight="800" fill="${a[0]}">${a[1]}</text>`+a[2].map((l,k)=>`<text x="${x+37}" y="${y+24+k*11}" font-size="7.6" font-weight="800" fill="#fff">${l}</text>`).join('');});
 return g;};
const seg=(n,lit)=>Array.from({length:n},(_,i)=>`<rect x="${(SW-n*26)/2+i*26}" y="62" width="21" height="4" rx="2" fill="${i<lit?'#fff':'#3a3a40'}"/>`).join('');
const TM=`<linearGradient id="tm" x1="0" x2="1"><stop offset="0" stop-color="#ff6b5a"/><stop offset="1" stop-color="#f5b82e"/></linearGradient>`;
const SVGW=1340,SVGH=500;
const wrap=s=>`<svg width="${SVGW}" height="${SVGH}" viewBox="0 0 ${SVGW} ${SVGH}">${GDEFS.replace('</defs>',TM+'</defs>')}${s}</svg>`;
const X=i=>i*(SW+GAP);
const sub=(m)=>SUBJ.find(s=>s.id===m);

// ===================== GEN6: pantallas completas =====================
const W6=1280,H6=800,fs=require('fs');
const DEF6=GDEFS.replace('</defs>',TM+`<filter id="gl6" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"/></filter><filter id="sh6" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="-8" dy="0" stdDeviation="14" flood-color="#000" flood-opacity=".14"/></filter><filter id="sh7" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".12"/></filter></defs>`);
const doc6=(inner,dark)=>`<!doctype html><html><body style="margin:0;background:${dark?DARK:'#fff'}"><svg width="${W6}" height="${H6}" viewBox="0 0 ${W6} ${H6}" style="display:block;font-family:Inter,Helvetica,Arial,sans-serif">${DEF6}<rect width="${W6}" height="${H6}" fill="${dark?DARK:'#fff'}"/>${dark?`<rect width="${W6}" height="${H6}" fill="url(#dg)"/>`:''}${inner}</svg></body></html>`;
// ---------- datos de la unidad ----------
const BASE=TEO.map(o=>['Backup','Logs','Despliegue'].includes(o.n)?{...o,m:'n'}:o);
const OKR=['SaaS','TCO fórmula','Volumen (Docker)','Las 4 libertades','Trampas de licencias','Copyleft y la GPL'],OKP=['Contenedores','Escalabilidad','Odoo'];
const AFTER=BASE.map(o=>OKR.includes(o.n)?{...o,m:'p'}:OKP.includes(o.n)?{...o,m:'k'}:o);
const QUIZ=['Docker','TCO fórmula','Las 4 libertades','SaaS','Volumen (Docker)','Copyleft y la GPL','Trampas de licencias','Arquitectura de ERP','Vendor lock-in','Contenedores','Escalabilidad','Odoo'];
const stOf=(list,n)=>list.find(o=>o.n===n).m;
const SELIDX=BASE.map((o,i)=>QUIZ.includes(o.n)?i:-1).filter(i=>i>=0);
// ---------- piezas ----------
const rail=()=>`<rect width="56" height="${H6}" fill="#f7f7f5"/><line x1="56" x2="56" y1="0" y2="${H6}" stroke="${LINE}"/><rect x="19" y="26" width="18" height="16" rx="4" fill="none" stroke="#8a8984" stroke-width="1.6"/><line x1="26" x2="26" y1="26" y2="42" stroke="#8a8984" stroke-width="1.6"/><rect x="10" y="74" width="36" height="36" rx="9" fill="#ebebea"/><path d="M20 95 l8 -8 l8 8 v8 h-5 v-5 h-6 v5 h-5z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><rect x="19" y="132" width="18" height="16" rx="3" fill="none" stroke="#8a8984" stroke-width="1.6"/><line x1="19" x2="37" y1="138" y2="138" stroke="#8a8984" stroke-width="1.6"/><rect x="21" y="180" width="14" height="18" rx="3" fill="none" stroke="#8a8984" stroke-width="1.6"/>`;
const xpB=(val,dark,glow)=>`<g transform="translate(${W6-40-77},22) scale(1.25)">${glow?`<rect x="-4" y="-4" width="70" height="34" rx="17" fill="${AMBER}" opacity=".55" filter="url(#gl6)"/>`:''}${xp(0,0,val,dark)}</g>`;
const crumb=parts=>`<text x="84" y="46" font-size="13" fill="${MUTE}">${parts.map((p,i)=>i===parts.length-1?`<tspan fill="${INK}" font-weight="800">${p}</tspan>`:`${p} <tspan fill="#c9c7c1">/</tspan> `).join('')}</text>`;
const rc2=(l,sub,p0,p1,dark)=>{const C=2*Math.PI*9;return `<rect width="104" height="26" rx="13" fill="${dark?'#2a2a2e':'#fff'}" ${dark?'':`stroke="${LINE}"`}/><circle cx="15" cy="13" r="9" fill="none" stroke="${dark?'#45454d':'#e8e8e6'}" stroke-width="3"/><circle cx="15" cy="13" r="9" fill="none" stroke="${BLUE}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C*p0} ${C}" transform="rotate(-90 15 13)"/>${p1>p0?`<circle cx="15" cy="13" r="9" fill="none" stroke="#8fd0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C*(p1-p0)} ${C}" transform="rotate(${-90+p0*360} 15 13)"/>`:''}<text x="31" y="12" font-size="8.5" font-weight="800" fill="${dark?'#fff':INK}">${l}</text><text x="31" y="21" font-size="7.5" fill="${dark?'#9a9aa3':MUTE}">${sub}</text>`;};
const chipAt=(x,y,s,l,sub,p0,p1,dark,glow)=>`<g transform="translate(${x},${y}) scale(${s})">${glow?`<rect x="-6" y="-6" width="116" height="38" rx="19" fill="${BLUE}" opacity=".5" filter="url(#gl6)"/>`:''}${rc2(l,sub,p0,p1,dark)}</g>`;
const callout=(n,x,y,t,w)=>`<g><circle cx="${x}" cy="${y}" r="11" fill="${BLUE}"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${n}</text><rect x="${x+16}" y="${y-13}" width="${w}" height="26" rx="13" fill="#fff" style="filter:drop-shadow(0 3px 8px rgba(0,0,0,.25))"/><text x="${x+16+w/2}" y="${y+4}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${t}</text></g>`;
const SW6=(m)=>({k:'Lo sabes',p:'A medias',r:'Repasar',n:'Nuevo'}[m]);
const legend6=(x,y,dark)=>['k','p','r','n'].map((m,i)=>dot(m,x+i*92,y,5)+T(x+11+i*92,y+4,SW6(m),{a:'start',s:11,c:dark?'#9a9aa3':MUTE})).join('');
// ---------- tarjeta de asignatura (Mapa) ----------
function mapCard(s,x,y,o={}){const w=570,h=196;
 let c=card(x,y,w,h)+T(x+22,y+34,s.id,{a:'start',s:16,w:800,c:INK})+T(x+w-22,y+34,s.t,{a:'end',s:11.5});
 const units=s.u.map(u=>u[0]==='Teoria'&&s.id==='SXE'?[u[0],o.pct??21,o.items||BASE]:u);
 const rs=units.map(u=>Math.min(38,uR(u[2].length)*1.2));const tot=rs.reduce((a,r)=>a+2*r,0),n=units.length;const avail=w-60,sp=n>1?(avail-tot)/(n-1):0;
 let px=x+30;const cy=y+86;const pts=units.map((u,j)=>{const p=[px+rs[j],cy,rs[j],u];px+=2*rs[j]+sp;return p;});
 pts.slice(1).forEach((p,i)=>c+=`<line x1="${pts[i][0]+pts[i][2]+6}" y1="${cy}" x2="${p[0]-p[2]-6}" y2="${cy}" stroke="#e6e6e3" stroke-width="2.4"/>`);
 pts.forEach(p=>{let R=p[2];const isT=p[3][0]==='Teoria'&&s.id==='SXE';const pulse=isT&&o.pulse;if(pulse){R*=1.2;c+=`<circle cx="${p[0]}" cy="${cy}" r="${R+12}" fill="${BLUE}" opacity=".35" filter="url(#gl6)"/>`;}
  if(isT&&o.hover)c+=`<circle cx="${p[0]}" cy="${cy}" r="${R+14}" fill="${BLUE}" fill-opacity=".07" stroke="${BLUE}" stroke-opacity=".5" stroke-width="1.5"/>`;
  c+=`<circle cx="${p[0]}" cy="${cy}" r="${R+6}" fill="#fff"/>`+arc(p[0],cy,R+6,p[3][1]/100,pulse?5:3.4)+cluster(p[3][2],p[0],cy,R,pulse?3.8:3)+T(p[0],cy+R+20,`${p[3][0]} · ${p[3][1]}%`,{s:11,w:isT&&(o.hover||pulse)?800:600,c:INK});});
 c+=`<line x1="${x+22}" x2="${x+w-22}" y1="${y+158}" y2="${y+158}" stroke="${LINE}"/>`;
 const nowU=s.id==='SXE'?'Teoria':s.u[0][0];c+=T(x+22,y+183,`Ahora: <tspan fill="${INK}" font-weight="800">${nowU}</tspan>`,{a:'start',s:12.5,c:MUTE})+btn(x+w-170,y+163,148,`Aprender ${nowU} →`,{h:30,fs:11});
 return c;}
function mapInner(o={}){let s=rail()+T(84,92,'Mapa',{a:'start',s:26,w:800,c:INK})+`<rect x="${W6-40-206}" y="68" width="206" height="34" rx="17" fill="${RED}"/><text x="${W6-40-103}" y="90" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">Para repasar hoy · ${o.rev??9}  ▸</text>`;
 ['SXE','PSP','PMDM','AD','DI'].forEach((id,i)=>{s+=mapCard(SUBJ.find(q=>q.id===id),84+(i%2)*586,124+Math.floor(i/2)*212,id==='SXE'?o:{});});
 return s+xpB(o.xp??46,false,o.xpGlow);}
// ---------- hojas laterales ----------
const dim=()=>`<rect width="${W6}" height="${H6}" fill="#fff" opacity=".62"/>`;
const sheetBg=(x)=>`<rect x="${x}" y="0" width="${W6-x}" height="${H6}" fill="#fff" stroke="${LINE}" filter="url(#sh6)"/><text x="${W6-34}" y="48" text-anchor="middle" font-size="16" fill="${MUTE}">✕</text>`;
const histRow=(x,y,w,t,sub,pct)=>card(x,y,w,48)+`<text x="${x+16}" y="${y+21}" font-size="12.5" font-weight="800" fill="${INK}">${t}</text><text x="${x+16}" y="${y+37}" font-size="10.5" fill="${MUTE}">${sub}</text><text x="${x+w-96}" y="${y+29}" text-anchor="end" font-size="14" font-weight="800" fill="${INK}">${pct}</text>`+btn(x+w-82,y+12,66,'Rehacer',{h:24,fs:10.5});
function S2(){let s=mapInner({hover:1})+dim();const sx=700,sw=W6-sx;s+=sheetBg(sx);
 s+=T(sx+32,70,'SXE · Teoria',{a:'start',s:24,w:800,c:INK})+T(sx+32,94,'36 conceptos · 9 para repasar · 5 que ya sabes',{a:'start',s:12.5})+arc(sx+sw-80,76,28,.21,6)+T(sx+sw-80,81,'21%',{s:13,w:800,c:INK});
 s+=cluster(BASE,sx+sw/2,242,118,7,{cur:1});
 s+=legend6(sx+120,388);
 s+=btn(sx+32,414,sw-64,'Quiz rápido · 12 conceptos',{f:INK,s:INK,c:'#fff',h:50,fs:14})+`<text x="${W6-62}" y="444" text-anchor="end" font-size="11.5" font-weight="800" fill="${AMBER}">hasta 5 ✦</text>`;
 s+=btn(sx+32,476,(sw-76)/2,'⠿  Elegir conceptos…',{h:40,fs:12})+btn(sx+32+(sw-76)/2+12,476,(sw-76)/2,'Ver mapa completo',{h:40,fs:12});
 s+=card(sx+32,530,sw-64,78)+T(sx+50,556,'Test final',{a:'start',s:13.5,w:800,c:INK})+T(sx+50,575,'Faltan 36 de 48 tarjetas',{a:'start',s:11.5})+btn(sx+sw-336,550,176,'Repasar lo que falta',{f:'#f1f1ef',s:'#f1f1ef',h:34,fs:11.5})+btn(sx+sw-150,550,92,'Hacerlo ya',{h:34,fs:11.5});
 s+=T(sx+32,640,'HISTORIAL',{a:'start',s:10,w:800,c:'#9a9892'})+histRow(sx+32,652,sw-64,'Quiz · Teoria','12 preguntas · 22 nov','83%')+histRow(sx+32,708,sw-64,'Quiz · Teoria','8 preguntas · 19 nov','62%');
 return s;}
function S12(){let s=mapInner({})+dim();const sx=700,sw=W6-sx;s+=sheetBg(sx);
 s+=T(sx+32,70,'SXE',{a:'start',s:26,w:800,c:INK})+T(sx+32,94,'0/1 unidades · 18% del total',{a:'start',s:12.5})+arc(sx+sw-80,76,28,.18,6)+T(sx+sw-80,81,'18%',{s:13,w:800,c:INK});
 const U=SUBJ[0].u.map(u=>u[0]==='Teoria'?[u[0],21,BASE]:u),px=[sx+120,sx+sw/2,sx+sw-120];
 U.slice(1).forEach((u,i)=>s+=`<line x1="${px[i]+50}" y1="190" x2="${px[i+1]-50}" y2="190" stroke="#e6e6e3" stroke-width="2.4"/>`);
 U.forEach((u,i)=>{s+=arc(px[i],190,46,u[1]/100,4)+cluster(u[2],px[i],190,40,3.2)+T(px[i],190+70,`${u[0]} · ${u[1]}%`,{s:12,w:700,c:INK});});
 s+=T(sx+32,310,'TESTS DE LA ASIGNATURA',{a:'start',s:10,w:800,c:'#9a9892'});
 s+=card(sx+32,322,sw-64,92)+T(sx+50,350,'Test final',{a:'start',s:14,w:800,c:INK})+T(sx+50,370,'Faltan 36 de 48 tarjetas',{a:'start',s:11.5});
 let bx=sx+50;[[5,BLUE],[5,'#8ab8ee'],[9,RED],[17,'#e4e2dc']].forEach(([n,c])=>{const w=(sw-100)*n/36;s+=`<rect x="${bx}" y="384" width="${Math.max(w-2,0)}" height="6" rx="3" fill="${c}"/>`;bx+=w;});
 s+=btn(sx+sw-336,336,176,'Repasar lo que falta',{f:'#f1f1ef',s:'#f1f1ef',h:34,fs:11.5})+btn(sx+sw-150,336,92,'Hacerlo ya',{h:34,fs:11.5});
 s+=btn(sx+32,432,sw-64,'Quiz rápido de toda la asignatura · 12 conceptos',{f:INK,s:INK,c:'#fff',h:46,fs:13})+`<text x="${W6-62}" y="460" text-anchor="end" font-size="11.5" font-weight="800" fill="${AMBER}">hasta 5 ✦</text>`;
 s+=T(sx+32,520,'HISTORIAL',{a:'start',s:10,w:800,c:'#9a9892'})+histRow(sx+32,532,sw-64,'Quiz · Teoria','12 preguntas · 22 nov','83%')+histRow(sx+32,588,sw-64,'Quiz · Entregas','10 preguntas · 20 nov','70%');
 return s;}
// ---------- mapa de la unidad ----------
const hull=pts=>{const P=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];P.forEach(p=>{while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);});[...P].reverse().forEach(p=>{while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);});return lo.slice(0,-1).concat(up.slice(0,-1));};
function unitMap(mode){const cx=640,cy=474,R=250;const pts=pack(BASE.length,R);
 let s=rail()+crumb(['Mapa','SXE','Teoria'])+xpB(46);
 // controles
 s+=`<rect x="${640-150}" y="64" width="300" height="38" rx="19" fill="#f1f1ef"/>`;[['Explorar',0],['Elegir conceptos',1]].forEach(([t,i])=>{const act=(mode==='sel')===!!i;const x=640-146+i*118,w=i?172:114;if(act)s+=`<rect x="${x}" y="68" width="${w}" height="30" rx="15" fill="${INK}"/>`;s+=`<text x="${x+w/2}" y="88" text-anchor="middle" font-size="12" font-weight="800" fill="${act?'#fff':MUTE}">${t}</text>`;});
 s+=chipAt(84,66,1.35,'SXE · Teoria','',0.21,0.21,false);
 // lados
 s+=`<circle cx="-70" cy="${cy}" r="170" fill="#f6f6f4" stroke="#e7e5df"/>`+T(40,cy-4,'UD1',{a:'start',s:13,w:800,c:INK})+T(40,cy+14,'0%',{a:'start',s:11})+`<circle cx="${W6+70}" cy="${cy}" r="170" fill="#f6f6f4" stroke="#e7e5df"/>`+T(W6-40,cy-4,'Entregas',{a:'end',s:13,w:800,c:INK})+T(W6-40,cy+14,'16%',{a:'end',s:11});
 s+=`<circle cx="${cx}" cy="${cy}" r="${R+12}" fill="#fff"/>`+arc(cx,cy,R+12,.21,5)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fcfcfb" stroke="#eeede9"/>`;
 const sel=new Set(mode==='sel'?SELIDX:[]);
 if(mode==='sel'){const hp=hull(SELIDX.map(i=>[cx+pts[i][0],cy+pts[i][1]]));const ps=hp.map(p=>p.join(',')).join(' ');s+=`<polygon points="${ps}" fill="${BLUE}" fill-opacity=".06" stroke="${BLUE}" stroke-opacity=".07" stroke-width="64" stroke-linejoin="round"/><polygon points="${ps}" fill="none" stroke="${BLUE}" stroke-width="1.8" stroke-dasharray="6 6" stroke-linejoin="round" transform="translate(0,0)" opacity="0"/>`;}
 BASE.forEach((o,i)=>{const x=cx+pts[i][0],y=cy+pts[i][1];if(sel.has(i))s+=`<circle cx="${x}" cy="${y}" r="19" fill="#fff" stroke="${BLUE}" stroke-width="2"/>`;s+=dot(o.m,x,y,10,o.cur&&mode!=='sel')+T(x,y+(sel.has(i)?32:25),trunc(o.n,14),{s:10.5,w:o.m==='n'?600:700,c:o.m==='n'?MUTE:INK,h:1});});
 s+=T(cx,cy-R-30,'Teoria <tspan fill="'+MUTE+'" font-weight="600" font-size="12">5 que ya sabes · 9 para repasar · 36 conceptos</tspan>',{s:16,w:800,c:INK});
 s+=legend6(84,H6-14);
 if(mode!=='sel'){const di=BASE.findIndex(o=>o.n==='Docker'),tx=cx+pts[di][0],ty=cy+pts[di][1];
  s+=`<rect x="${tx+18}" y="${ty-52}" width="236" height="96" rx="12" fill="#fff" stroke="${LINE}" filter="url(#sh7)"/>`+dot('r',tx+40,ty-28,7)+`<text x="${tx+54}" y="${ty-24}" font-size="13.5" font-weight="800" fill="${INK}">Docker</text><text x="${tx+32}" y="${ty-4}" font-size="10.5" fill="${MUTE}">Para repasar · falló el 21 nov</text>`+btn(tx+32,ty+8,206,'Repasar este concepto',{h:26,fs:10.5});
  s+=T(W6-40,H6-14,'arrastra las bolitas para reordenarlas',{a:'end',s:11,c:'#9a9892'});}
 else{
  s+=['Todo lo que falta · 36','Solo rojos · 9','Rojos + a medias · 14','Test final · 48','Limpiar'].map((t,i)=>{const ws=[170,130,166,120,80],xs=[300,478,616,790,918];return btn(xs[i],116,ws[i],t,{h:30,fs:11,s:i===2?BLUE:'#dcdad4',c:i===2?BLUE:INK,f:i===2?'#eaf3fd':'#fff'});}).join('');
  s+=T(84,150,'GUARDADAS',{a:'start',s:10,w:800,c:'#9a9892'})+btn(84,160,150,'Quiz 22 nov · 83%',{h:28,fs:11})+btn(84,196,150,'Quiz 19 nov · 62%',{h:28,fs:11});
  s+=`<rect x="${640-300}" y="${H6-92}" width="600" height="62" rx="31" fill="${INK}" filter="url(#sh7)"/><text x="${640-268}" y="${H6-65}" font-size="15" font-weight="800" fill="#fff">12 seleccionados</text><text x="${640-268}" y="${H6-46}" font-size="11" fill="#bbb">9 para repasar · 3 a medias · hasta 5 ✦</text>`+btn(640+8,H6-81,128,'Guardar',{f:'#3a3a3f',s:'#3a3a3f',c:'#fff',h:40,fs:12})+`<rect x="${640+146}" y="${H6-81}" width="142" height="40" rx="20" fill="${BLUE}"/><text x="${640+217}" y="${H6-56}" text-anchor="middle" font-size="13.5" font-weight="800" fill="#fff">Quiz de 12 ▶</text>`;
  s+=`<text x="${W6-40}" y="${H6-12}" text-anchor="end" font-size="11" fill="#9a9892">arrastra para dibujar un lazo · pulsa una bolita para añadirla o quitarla</text>`;}
 return s;}
// ---------- juego ----------
const dbar=(states,cur,y=78)=>states.map((m,i)=>{const x=640-(states.length*38)/2+i*38+19;return dot(m,x,y,8,false)+(i===cur?`<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#fff" stroke-width="1.8"/>`:'');}).join('');
const ANS=[['#ff6b5a','1',['Controlas toda la infraestructura','y los datos']],['#8b5cf6','2',['No hay que instalar ni mantener','servidores propios']],['#14b8a6','3',['Pagas una única vez,','sin cuotas']],['#f5b82e','4',['Solo funciona sin','conexión a Internet']]];
const tiles=(st)=>ANS.map((a,i)=>{const x=190+(i%2)*458,y=416+Math.floor(i/2)*124,s=st[i]||'n';const op=s==='dim'?.28:1;
 return `<g opacity="${op}"><rect x="${x}" y="${y+5}" width="442" height="108" rx="14" fill="#000" opacity=".28"/><rect x="${x}" y="${y}" width="442" height="108" rx="14" fill="${a[0]}"/><rect x="${x+22}" y="${y+34}" width="40" height="40" rx="10" fill="#fff"/><text x="${x+42}" y="${y+62}" text-anchor="middle" font-size="20" font-weight="800" fill="${a[0]}">${a[1]}</text>`+a[2].map((l,k)=>`<text x="${x+82}" y="${y+50+k*24}" font-size="17.5" font-weight="800" fill="#fff">${l}</text>`).join('')+(s==='ok'?`<rect x="${x-3}" y="${y-3}" width="448" height="114" rx="16" fill="none" stroke="#fff" stroke-width="4"/><circle cx="${x+418}" cy="${y+54}" r="17" fill="#fff"/>${chk(x+418,y+54,24).replace('stroke="#fff"',`stroke="${a[0]}"`)}`:'')+(s==='bad'?`<rect x="${x-3}" y="${y-3}" width="448" height="114" rx="16" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="8 6"/><circle cx="${x+418}" cy="${y+54}" r="17" fill="#fff"/><path d="M${x+410},${y+46} l16,16 m0,-16 l-16,16" stroke="#c0392b" stroke-width="3.4" stroke-linecap="round"/>`:'')+`</g>`;}).join('');
const qcard=(tagM)=>`<rect x="190" y="236" width="900" height="158" rx="18" fill="#fff"/><text x="640" y="268" text-anchor="middle" font-size="12" fill="#9a9892">SXE · Teoria</text><rect x="${640-52}" y="278" width="104" height="26" rx="13" fill="#f6f6f4" stroke="#eceae5"/>${dot(tagM,640-30,291,5.5)}<text x="${640-18}" y="295" font-size="12" font-weight="800" fill="${INK}">SaaS</text><text x="640" y="338" text-anchor="middle" font-size="27" font-weight="800" fill="#111">¿Qué ventaja principal tiene el despliegue</text><text x="640" y="372" text-anchor="middle" font-size="27" font-weight="800" fill="#111">SaaS frente a on-premise?</text><rect x="190" y="388" width="900" height="6" rx="3" fill="#eee"/><rect x="190" y="388" width="640" height="6" rx="3" fill="url(#tm)"/>`;
const dHead=(p0,p1,xpv,o={})=>`<text x="40" y="50" text-anchor="middle" font-size="22" fill="#9a9aa3">✕</text>`+chipAt(84,26,o.s||1.25,'SXE · Teoria',Math.round(p1*100)+'%',p0,p1,true,o.glow)+xpB(xpv,true,o.xpGlow);
const BAR_Q=['r','p','p','r','r','r','r','r','r','p','p','p'];
function S5(){let s=dHead(.21,.21,46)+`<rect x="340" y="150" width="600" height="500" rx="22" fill="#232328" stroke="#33333a"/><text x="640" y="214" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="1.5" fill="#9a9aa3">SXE · TEORIA</text><text x="640" y="256" text-anchor="middle" font-size="32" font-weight="800" fill="#fff">Quiz de 12 conceptos</text>`;
 BASE.filter(o=>QUIZ.includes(o.n)).forEach((o,i)=>{s+=dot(o.m,640-(12*38)/2+i*38+19,312,9);});
 s+=`<text x="640" y="350" text-anchor="middle" font-size="13" fill="#bdbdc6">9 para repasar · 3 a medias</text>`;
 s+=`<text x="640" y="392" text-anchor="middle" font-size="12.5" fill="#9a9aa3">Incluye: Docker, TCO fórmula, Las 4 libertades, SaaS, Volumen (Docker) y 7 más</text>`;
 s+=`<rect x="410" y="420" width="460" height="64" rx="14" fill="#2c2c33"/><text x="440" y="452" font-size="12.5" fill="#d7d7de">Cada acierto sube una bolita:</text><text x="440" y="470" font-size="12.5" fill="#d7d7de">rojo → a medias → azul</text>`+dot('r',640+100,452,8)+`<text x="${640+114}" y="456" font-size="14" fill="#fff">→</text>`+dot('p',640+142,452,8)+`<text x="${640+156}" y="456" font-size="14" fill="#fff">→</text>`+dot('k',640+184,452,8);
 s+=`<text x="640" y="516" text-anchor="middle" font-size="13" font-weight="800" fill="${AMBER}">✦ hasta 5 según lo bien que lo hagas</text>`+`<rect x="480" y="540" width="320" height="64" rx="16" fill="#14b8a6"/><rect x="480" y="604" width="320" height="6" rx="3" fill="#0e8f80"/><text x="640" y="580" text-anchor="middle" font-size="20" font-weight="800" fill="#fff">Empezar</text><text x="640" y="634" text-anchor="middle" font-size="12.5" fill="#9a9aa3" text-decoration="underline">Cambiar selección</text>`;
 return s;}
function S6(){return dHead(.21,.21,46)+dbar(BAR_Q,3)+`<text x="640" y="118" text-anchor="middle" font-size="12" fill="#9a9aa3">Pregunta 4 de 12</text>`+qcard('r')+tiles([])+callout(1,100,128,'Cada punto es un concepto de tu selección',300).replace('<g>','<g opacity="0">');}
function S7(){let s=dHead(.21,.22,46,{s:1.9,glow:1,xpGlow:1});
 const states=[...BAR_Q];states[3]='p';s+=dbar(states,3);
 const bx=640-(12*38)/2+3*38+19;s+=`<circle cx="${bx}" cy="78" r="20" fill="${BLUE}" opacity=".5" filter="url(#gl6)"/>`+dot('p',bx,78,8);
 s+=qcard('p')+tiles(['dim','ok','dim','dim']);
 s+=`<text x="640" y="172" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" opacity="0">¡Bien!</text>`;
 const q=(p0,c,p1,t)=>[(1-t)*(1-t)*p0[0]+2*(1-t)*t*c[0]+t*t*p1[0],(1-t)*(1-t)*p0[1]+2*(1-t)*t*c[1]+t*t*p1[1]];
 const P0=[574,291],C=[330,150],P1=[112,50];s+=`<path d="M${P0} Q${C} ${P1}" fill="none" stroke="#8fd0ff" stroke-width="2" stroke-dasharray="3 6" opacity=".7"/>`;
 [.22,.42,.6].forEach((t,i)=>{const p=q(P0,C,P1,t);s+=dot('p',p[0],p[1],6+i*1.2);});const lp=q(P0,C,P1,.8);s+=`<circle cx="${lp[0]}" cy="${lp[1]}" r="16" fill="${BLUE}" opacity=".55" filter="url(#gl6)"/>`+dot('p',lp[0],lp[1],9);
 const Q0=[869,464],QC=[1060,180],Q1=[1201,42];[.28,.5,.72].forEach((t,i)=>{const p=q(Q0,QC,Q1,t);s+=`<text x="${p[0]}" y="${p[1]+5}" text-anchor="middle" font-size="${14+i*4}" fill="${AMBER}">✦</text>`;});
 s+=`<text x="1201" y="102" text-anchor="middle" font-size="16" font-weight="800" fill="${AMBER}">+1 ✦</text>`;
 s+=callout(1,545,128,'Se enciende: rojo → a medias',230)+callout(2,300,196,'Vuela al anillo de la unidad',210)+callout(3,100,150,'El anillo crece y se llena · 21% → 22%',286).replace(/x="100"/g,'x="100"')+callout(4,940,236,'+1 ✦ vuela a tu avatar',186);
 return s;}
function S8(){let s=dHead(.21,.21,46);const st=[...BAR_Q];s+=dbar(st,3)+`<circle cx="${640-(12*38)/2+3*38+19}" cy="78" r="20" fill="${RED}" opacity=".5" filter="url(#gl6)"/>`+dot('r',640-(12*38)/2+3*38+19,78,8)+qcard('r')+tiles(['bad','ok','dim','dim']);
 s+=`<rect x="${640-210}" y="672" width="420" height="52" rx="26" fill="#2c2c33"/><text x="640" y="704" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">Casi. SaaS seguirá en rojo: lo veremos otra vez</text>`+`<rect x="1000" y="680" width="90" height="38" rx="19" fill="#fff"/><text x="1045" y="704" text-anchor="middle" font-size="13" font-weight="800" fill="${INK}">Siguiente</text>`;
 s+=callout(1,545,128,'La bolita sigue roja, sin vuelo ni ✦',270)+callout(2,100,130,'El anillo no cambia',150);return s;}
function S9(){const res=QUIZ.map(n=>stOf(AFTER,n));let s=dHead(.21,.33,50,{xpGlow:1})+`<text x="640" y="108" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="2" fill="#9a9aa3">TEST TERMINADO</text>`;
 s+=dbar(res,-1,142).replace(/r="8"/g,'r="8"');
 // anillo
 const C=2*Math.PI*84;s+=`<circle cx="260" cy="320" r="84" fill="none" stroke="#33333a" stroke-width="14"/><circle cx="260" cy="320" r="84" fill="none" stroke="${BLUE}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C*.21} ${C}" transform="rotate(-90 260 320)"/><circle cx="260" cy="320" r="84" fill="none" stroke="#8fd0ff" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C*.12} ${C}" transform="rotate(${-90+.21*360} 260 320)"/><circle cx="260" cy="320" r="96" fill="none" stroke="${BLUE}" stroke-opacity=".4" stroke-width="2"/>`+`<text x="260" y="316" text-anchor="middle" font-size="40" font-weight="800" fill="#fff">33%</text><text x="260" y="342" text-anchor="middle" font-size="12.5" fill="#9a9aa3">antes 21%</text><text x="260" y="450" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">SXE · Teoria</text><text x="260" y="470" text-anchor="middle" font-size="12" fill="#9a9aa3">el anillo ha subido un 12%</text>`;
 // puntuación
 s+=`<text x="640" y="336" text-anchor="middle" font-size="86" font-weight="800" fill="#fff">9<tspan font-size="44" fill="#6b6b75">/12</tspan></text><text x="640" y="372" text-anchor="middle" font-size="14" fill="#bdbdc6">aciertos</text><rect x="${640-62}" y="396" width="124" height="46" rx="23" fill="#2c2c33" stroke="${AMBER}" stroke-width="2"/><text x="640" y="427" text-anchor="middle" font-size="22" font-weight="800" fill="${AMBER}">+4 ✦</text>`;
 // avatar y traje
 const AC=2*Math.PI*66;s+=`<circle cx="1020" cy="318" r="66" fill="none" stroke="#33333a" stroke-width="9"/><circle cx="1020" cy="318" r="66" fill="none" stroke="${AMBER}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${AC} ${AC}" transform="rotate(-90 1020 318)"/><circle cx="1020" cy="318" r="76" fill="${AMBER}" opacity=".25" filter="url(#gl6)"/>`+avatar(1020,318,52)+`<text x="1020" y="418" text-anchor="middle" font-size="22" font-weight="800" fill="${AMBER}">✦ 50 / 50</text><text x="1020" y="444" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">¡Traje «Graduado» desbloqueado!</text><text x="1020" y="464" text-anchor="middle" font-size="12" fill="#9a9aa3">antes 46 / 50</text>`;
 // cambios
 const chips=(x,y,t,list,m)=>T(x,y,t,{a:'start',s:11,w:800,c:'#9a9aa3'})+list.map((n,i)=>{const w=n.length*7.4+34,xx=x+(i?list.slice(0,i).reduce((a,q)=>a+q.length*7.4+42,0):0);return `<rect x="${xx}" y="${y+10}" width="${w}" height="28" rx="14" fill="#2c2c33"/>${dot(m,xx+16,y+24,5)}<text x="${xx+28}" y="${y+28.5}" font-size="11.5" font-weight="700" fill="#e8e8ee">${n}</text>`;}).join('');
 s+=chips(190,520,'LLEGAN A «LO SABES» · 3',['Contenedores','Escalabilidad','Odoo'],'k')+chips(640,520,'SUBEN A «A MEDIAS» · 6',['SaaS','TCO fórmula','Volumen (Docker)'],'p')+chips(190,586,'SIGUEN EN ROJO · 3',['Docker','Arquitectura de ERP','Vendor lock-in'],'r');
 s+=`<rect x="${640-300}" y="680" width="270" height="52" rx="26" fill="#14b8a6"/><text x="${640-165}" y="712" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">Volver al mapa</text><rect x="${640-14}" y="680" width="314" height="52" rx="26" fill="none" stroke="#4a4a52" stroke-width="2"/><text x="${640+143}" y="712" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">Repasar los 3 en rojo</text>`;
 return s;}
function S10(){let s=mapInner({items:AFTER,pct:33,pulse:1,xp:50,xpGlow:1,rev:3});
 s+=`<rect x="700" y="676" width="540" height="64" rx="32" fill="${INK}" filter="url(#sh7)"/><text x="970" y="702" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">+4 ✦ · 3 conceptos aprendidos · Teoria 21% → 33%</text><text x="970" y="722" text-anchor="middle" font-size="12" font-weight="700" fill="${AMBER}">¡Nuevo traje desbloqueado: Graduado!</text>`;
 s+=`<path d="M470,106 C 500,150 540,170 590,192" fill="none" stroke="${BLUE}" stroke-width="1.8" stroke-dasharray="4 5"/>`+callout(1,300,92,'El anillo de Teoria crece y las bolitas cambian de color',380);return s;}
function S11(){let s=mapInner({items:AFTER,pct:33,xp:50,xpGlow:1,rev:3})+`<rect width="${W6}" height="${H6}" fill="#000" opacity=".25"/>`;
 const px=W6-40-420,py=74;s+=`<rect x="${px}" y="${py}" width="420" height="430" rx="18" fill="#fff" filter="url(#sh7)"/>`+avatar(px+52,py+58,34)+`<text x="${px+104}" y="${py+46}" font-size="20" font-weight="800" fill="${INK}">Tu avatar</text><text x="${px+104}" y="${py+66}" font-size="11.5" fill="${MUTE}">Cada test te da hasta 5 ✦ según lo</text><text x="${px+104}" y="${py+81}" font-size="11.5" fill="${MUTE}">bien que lo hagas.</text><text x="${px+104}" y="${py+104}" font-size="14" font-weight="800" fill="${AMBER}">✦ <tspan fill="${INK}">50</tspan></text>`;
 const T6=[['Graduado',50,1],['Mago',120],['Astronauta',250],['Superhéroe',400],['Dinosaurio',600],['Rey o reina',800]];
 T6.forEach((t,i)=>{const x=px+20+(i%3)*128,y=py+128+Math.floor(i/3)*140;s+=`<rect x="${x}" y="${y}" width="120" height="128" rx="12" fill="${t[2]?'#fffaf0':'#fff'}" stroke="${t[2]?AMBER:LINE}" stroke-width="${t[2]?2:1}"/><circle cx="${x+60}" cy="${y+40}" r="28" fill="${t[2]?'url(#av)':'#d8d8d8'}"/>`+(t[2]?avatar(x+60,y+40,28):'')+`<text x="${x+60}" y="${y+88}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${INK}">${t[0]}</text>`+(t[2]?`<rect x="${x+22}" y="${y+98}" width="76" height="22" rx="11" fill="${INK}"/><text x="${x+60}" y="${y+113}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">Ponerlo</text><rect x="${x+66}" y="${y-8}" width="52" height="18" rx="9" fill="${AMBER}"/><text x="${x+92}" y="${y+5}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#111">¡NUEVO!</text>`:`<rect x="${x+14}" y="${y+98}" width="92" height="5" rx="2.5" fill="#eee"/><rect x="${x+14}" y="${y+98}" width="${92*Math.min(50/t[1],1)}" height="5" rx="2.5" fill="${AMBER}"/><text x="${x+60}" y="${y+119}" text-anchor="middle" font-size="10.5" fill="${MUTE}">50 / ${t[1]} ✦</text>`);});
 return s;}

const SCREENS=[
 ['01-mapa-inicio',()=>mapInner({hover:1}),0,'Mapa · inicio','Una sola pantalla de inicio. Las tarjetas de asignatura con anillos llenos de bolitas.'],
 ['02-hoja-de-unidad',S2,0,'Hoja de la unidad','Al pulsar un anillo: Quiz rápido, elegir conceptos, test final e historial.'],
 ['03-hoja-de-asignatura',S12,0,'Hoja de la asignatura','Al pulsar el nombre de la asignatura: sus unidades, test final y quizzes.'],
 ['04-mapa-de-la-unidad',()=>unitMap('exp'),0,'Mapa de la unidad','El mapa de bolitas arrastrable, con etiquetas y detalle de cada concepto.'],
 ['05-elegir-conceptos',()=>unitMap('sel'),0,'Elegir conceptos','Seleccionas bolitas (o atajos) y esas bolitas son el test.'],
 ['06-antes-de-empezar',S5,1,'Antes de empezar','Resumen del quiz: las 12 bolitas y cómo evolucionan.'],
 ['07-pregunta',S6,1,'Pregunta','El juego de siempre. Arriba, las bolitas del test como barra de progreso.'],
 ['08-acierto-animacion',S7,1,'Acierto · animación','La bolita se enciende, vuela al anillo (que crece y se llena) y el ✦ vuela al avatar.'],
 ['09-fallo',S8,1,'Fallo','La bolita sigue roja, sin vuelo ni ✦.'],
 ['10-resultados',S9,1,'Resultados','Anillo antes/después, puntuación, ✦ y progreso del traje.'],
 ['11-vuelta-al-mapa',S10,0,'Vuelta al mapa','El anillo de la unidad pulsa, las bolitas han cambiado y se avisa del traje.'],
 ['12-trajes',S11,0,'Trajes','El panel de avatar con el traje recién desbloqueado y el progreso de los demás.']];
(async()=>{const b=await chromium.launch();
 for(const [n,f,d] of SCREENS){const p=await b.newPage({viewport:{width:W6,height:H6},deviceScaleFactor:1.5});await p.setContent(doc6(f(),d));await p.screenshot({path:`${OUT}/${n}.png`});await p.close();}
 const flow=`<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:1700px;background:#fff;font-family:Inter,Helvetica,Arial,sans-serif;color:${INK};padding:30px 36px 36px}h1{font-size:24px;font-weight:800}p{font-size:13.5px;color:${MUTE};margin:6px 0 22px;max-width:1200px;line-height:1.5}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:26px 22px}.c img{width:100%;display:block;border-radius:10px;border:1px solid #e4e3df}.c b{display:block;font-size:13px;margin:8px 0 2px}.c b i{font-style:normal;display:inline-block;width:22px;height:22px;border-radius:11px;background:${BLUE};color:#fff;text-align:center;line-height:22px;font-size:12px;margin-right:6px}.c span{font-size:11.5px;color:${MUTE};line-height:1.4}.k{display:flex;gap:40px;margin-top:26px;font-size:12.5px;line-height:1.5;color:#4b4a45}.k div{flex:1}.k b{display:block;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#9a9892;margin-bottom:3px}</style></head><body><h1>Synaptic · Mapa como puerta única + quiz de bolitas</h1><p>Recorrido: <b>1</b> Mapa → <b>2</b> pulsar un anillo → <b>5</b> elegir conceptos (o «Quiz rápido») → <b>6</b>–<b>9</b> juego → <b>10</b> resultados → <b>11</b> vuelta al mapa → <b>12</b> trajes. La hoja de asignatura (<b>3</b>) se abre desde el nombre de cada tarjeta y el mapa completo de la unidad (<b>4</b>) desde «Ver mapa completo».</p><div class="g">${SCREENS.map((s,i)=>`<div class="c"><img src="${s[0]}.png"><b><i>${i+1}</i>${s[3]}</b><span>${s[4]}</span></div>`).join('')}</div><div class="k"><div><b>La bolita</b>Es el concepto en todas las pantallas. Rojo → a medias → azul, con cada acierto.</div><div><b>El anillo</b>Es el progreso de unidad y asignatura: en el Mapa, en la hoja y en la cabecera del juego.</div><div><b>El ✦ y el avatar</b>Chip fijo arriba a la derecha en todo. Cada test da hasta 5 ✦ hacia el siguiente traje.</div></div></body></html>`;
 fs.writeFileSync(`${OUT}/overview.html`,flow);const p=await b.newPage({viewport:{width:1700,height:900},deviceScaleFactor:1.2});await p.goto('file://'+OUT+'/overview.html');await p.waitForTimeout(400);await p.screenshot({path:`${OUT}/00-recorrido-completo.png`,fullPage:true});await p.close();
 await b.close();})();
