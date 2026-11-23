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
const page=(title,sub,a,b)=>`<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:1400px;height:800px;background:#fff;font-family:Inter,Helvetica,Arial,sans-serif;color:${INK};padding:18px 20px}h1{font-size:15px;font-weight:800}p.sub{font-size:11.5px;color:${MUTE};margin:3px 0 12px}.row{display:flex;gap:20px}.col{width:670px}.cap{font-size:10.5px;font-weight:800;letter-spacing:.6px;color:#9a9892;margin-bottom:6px;text-transform:uppercase}.pane{width:670px;height:690px;border:1px solid ${LINE};border-radius:12px;background:#fdfdfc;overflow:hidden}svg{display:block}</style></head><body><h1>${title}</h1><p class="sub">${sub}</p><div class="row"><div class="col">${a}</div><div class="col">${b}</div></div></body></html>`;
const PW=670,PH=688;
// leyenda mini
const legend=(y)=>[['k','Lo sabes'],['p','A medias'],['r','Repasar'],['n','Nuevo']].map(([m,t],i)=>dot(m,22+i*84,y,4)+T(32+i*84,y+3.5,t,{a:'start',s:9.5})).join('');

// ================= A: burbujas anidadas con zoom =================
function A(){
 // layout
 const L=SUBJ.map(s=>{const rs=s.u.map(u=>uR(u[2].length)),mx=Math.max(...rs),n=s.u.length;const rho=n===1?0:n===2?mx+2:mx/Math.sin(Math.PI/n)+1;return{s,rs,mx,n,rho,R:rho+mx+12};});
 let o=T(18,28,'Mapa',{a:'start',s:13,w:800,c:INK})+legend(50);
 const rows=[[0,1,2],[3,4]];let y=84;
 rows.forEach(r=>{const mxR=Math.max(...r.map(i=>L[i].R)),tot=r.reduce((a,i)=>a+2*L[i].R,0)+(r.length-1)*26;let x=(PW-tot)/2;const cy=y+22+mxR;
  r.forEach(i=>{const l=L[i],cx=x+l.R;o+=`<circle cx="${cx}" cy="${cy}" r="${l.R}" fill="#f6f6f4" stroke="#e7e5df"/>`;
   o+=T(cx,cy-l.R-8,`${l.s.id} <tspan fill="${MUTE}" font-weight="600" font-size="9.5">${l.s.t}</tspan>`,{s:12.5,w:800,c:INK});
   l.s.u.forEach((u,j)=>{const ang=l.n===2?[Math.PI,0][j]:-Math.PI/2+j*2*Math.PI/l.n,ux=cx+l.rho*Math.cos(ang),uy=cy+l.rho*Math.sin(ang);
    o+=`<circle cx="${ux}" cy="${uy}" r="${l.rs[j]+3}" fill="#fff"/>`+arc(ux,uy,l.rs[j]+3,u[1]/100,2.4)+cluster(u[2],ux,uy,l.rs[j],2.3)+T(ux,uy+l.rs[j]+14,u[0],{s:8.5,c:INK,h:1});});
   x+=2*l.R+26;});y=cy+mxR+44;});
 o+=T(PW/2,PH-18,'Un clic en una burbuja hace zoom hacia dentro · arrastra para reordenar',{s:10,c:'#9a9892'});
 // zoom
 let z=T(18,28,'Mapa  ›  SXE  ›  <tspan fill="'+INK+'" font-weight="800">Teoria</tspan>',{a:'start',s:12.5,w:600})+legend(50);
 const cx=PW/2+20,cy=392,R=262;
 z+=`<circle cx="-70" cy="${cy}" r="150" fill="#f6f6f4" stroke="#e7e5df"/>`+T(40,cy-6,'UD1',{a:'start',s:10,c:INK,w:800})+T(40,cy+8,'0%',{a:'start',s:9});
 z+=`<circle cx="${PW+80}" cy="${cy}" r="150" fill="#f6f6f4" stroke="#e7e5df"/>`+T(PW-34,cy-6,'Entregas',{a:'end',s:10,c:INK,w:800})+T(PW-34,cy+8,'16%',{a:'end',s:9});
 z+=`<circle cx="${cx}" cy="${cy}" r="${R+8}" fill="#fff"/>`+arc(cx,cy,R+8,.21,3.4)+`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fcfcfb" stroke="#eeede9"/>`;
 z+=cluster(TEO,cx,cy,R,9,{lab:1,all:1,cur:1,max:12,fs:9.5});
 z+=T(cx,cy-R-24,'Teoria  <tspan fill="'+MUTE+'" font-weight="600" font-size="10">7/36 · 9 para repasar</tspan>',{s:13,w:800,c:INK});
 return page('A · Burbujas anidadas con zoom','Asignatura › unidad › concepto, siempre como burbuja. Cada nivel contiene al siguiente, así ves los conceptos como puntos desde el Mapa.',pane(PW,PH,o,'1 · Mapa'),pane(PW,PH,z,'2 · Al entrar en SXE › Teoria (mismo lenguaje, más cerca)'));}

// ================= B: lienzo único con zoom continuo =================
function B(){
 const place={SXE:[40,120],PSP:[355,100],PMDM:[40,300],AD:[355,290],DI:[130,470]};
 let o=T(18,28,'Mapa',{a:'start',s:13,w:800,c:INK})+legend(50);const sc=1;
 SUBJ.forEach(s=>{const [X,Y]=place[s.id];const rs=s.u.map(u=>uR(u[2].length));let x=X,pts=[];
  s.u.forEach((u,j)=>{const r=rs[j];const cx=x+r,cy=Y+(j%2?14:-6);pts.push([cx,cy,r,u]);x+=2*r+18;});
  const hull=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]+14}" fill="${TINT[s.id]}"/>`).join('')+pts.slice(1).map((p,i)=>`<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${p[0]}" y2="${p[1]}" stroke="${TINT[s.id]}" stroke-width="22" stroke-linecap="round"/>`).join('');
  o+=hull;pts.slice(1).forEach((p,i)=>o+=`<line x1="${pts[i][0]+pts[i][2]}" y1="${pts[i][1]}" x2="${p[0]-p[2]}" y2="${p[1]}" stroke="#d8d6d0" stroke-width="1.4" stroke-dasharray="3 4"/>`);
  pts.forEach(p=>{o+=cluster(p[3][2],p[0],p[1],p[2],2.3)+T(p[0],p[1]+p[2]+16,`${p[3][0]} · ${p[3][1]}%`,{s:8.5,c:INK,h:1});});
  o+=T(X,Y-uR(Math.max(...s.u.map(u=>u[2].length)))-22,`${s.id} <tspan fill="${MUTE}" font-weight="600" font-size="9.5">${s.t}</tspan>`,{a:'start',s:12.5,w:800,c:INK});});
 o+=`<rect x="${PW-120}" y="${PH-84}" width="102" height="66" rx="8" fill="#fff" stroke="${LINE}"/>`;
 o+=`<rect x="${PW-48}" y="${PH-166}" width="30" height="24" rx="6" fill="#fff" stroke="${LINE}"/>`;
 o+=T(PW-80,PH-44,'minimapa',{s:8.5,c:'#9a9892'})+T(PW/2,PH-18,'Un solo lienzo · arrastra bolitas y regiones · rueda para acercar',{s:10,c:'#9a9892'});
 o+=`<rect x="${PW-114}" y="${PH-78}" width="40" height="28" rx="3" fill="${BLUE}" fill-opacity=".15" stroke="${BLUE}"/>`;
 // zoom
 let z=T(18,28,'Mapa  ›  <tspan fill="'+INK+'" font-weight="800">SXE</tspan>',{a:'start',s:12.5,w:600})+legend(50);
 const Z=3.1,s=SUBJ[0],rs=s.u.map(u=>uR(u[2].length)*Z);let x=14,pts=[];const cy=330;
 s.u.forEach((u,j)=>{const r=rs[j];pts.push([x+r,cy+(j%2?30:-14),r,u]);x+=2*r+14;});
 const k=(PW-28)/(x-14-0);const rect=pts.map(p=>p);
 z+=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]+22}" fill="${TINT.SXE}"/>`).join('')+pts.slice(1).map((p,i)=>`<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${p[0]}" y2="${p[1]}" stroke="${TINT.SXE}" stroke-width="44" stroke-linecap="round"/>`).join('');
 pts.slice(1).forEach((p,i)=>z+=`<line x1="${pts[i][0]+pts[i][2]}" y1="${pts[i][1]}" x2="${p[0]-p[2]}" y2="${p[1]}" stroke="#d8d6d0" stroke-width="1.6" stroke-dasharray="4 5"/>`);
 pts.forEach(p=>{z+=`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]+4}" fill="#fff"/>`+arc(p[0],p[1],p[2]+4,p[3][1]/100,3)+cluster(p[3][2],p[0],p[1],p[2],p[3][0]==='Teoria'?7:6.3,{lab:1,cur:1,max:11,fs:9})+T(p[0],p[1]+p[2]+24,`${p[3][0]}`,{s:11,w:800,c:INK})+T(p[0],p[1]+p[2]+38,`${p[3][1]}%`,{s:9.5});});
 z+=T(20,96,'SXE <tspan fill="'+MUTE+'" font-weight="600" font-size="10">0/1 unidades</tspan>',{a:'start',s:14,w:800,c:INK});
 z+=T(PW/2,PH-18,'A este zoom solo se etiquetan los conceptos a repasar · más zoom → todas las etiquetas',{s:10,c:'#9a9892'});
 z+=`<rect x="18" y="${PH-96}" width="102" height="66" rx="8" fill="#fff" stroke="${LINE}"/><rect x="24" y="${PH-86}" width="50" height="22" rx="3" fill="${BLUE}" fill-opacity=".15" stroke="${BLUE}"/>`;
 return page('B · Un solo lienzo con zoom continuo','Todas las asignaturas en un mismo lienzo libre (como el mapa que arrastrabas). Menos zoom = puntos; más zoom = etiquetas. Los nombres aparecen según lo cerca que estés.',pane(PW,PH,o,'1 · Mapa (zoom lejano)'),pane(PW,PH,z,'2 · Acercando a SXE (mismo lienzo)'));}

// ================= C: tarjetas actuales, con conceptos dentro =================
function C(){
 const cardW=316,gap=16;let o=T(18,28,'Mapa',{a:'start',s:13,w:800,c:INK})+legend(50);
 const miniCard=(s,x,y)=>{const rs=s.u.map(u=>Math.min(26,uR(u[2].length)*.95));const tw=rs.reduce((a,r)=>a+2*r,0),sp=(cardW-40-tw)/(s.u.length-1||1),h=124;
  let c=`<rect x="${x}" y="${y}" width="${cardW}" height="${h}" rx="12" fill="#fff" stroke="${LINE}"/>`+T(x+16,y+24,s.id,{a:'start',s:12.5,w:800,c:INK})+T(x+cardW-16,y+24,s.t,{a:'end',s:9.5});
  let px=x+20;const cy=y+68;const pts=s.u.map((u,j)=>{const p=[px+rs[j],cy,rs[j],u];px+=2*rs[j]+sp;return p;});
  pts.slice(1).forEach((p,i)=>c+=`<line x1="${pts[i][0]+pts[i][2]+3}" y1="${cy}" x2="${p[0]-p[2]-3}" y2="${cy}" stroke="#e6e6e3" stroke-width="2"/>`);
  pts.forEach(p=>{c+=arc(p[0],cy,p[2]+3,p[3][1]/100,2.2)+cluster(p[3][2],p[0],cy,p[2],p[2]>20?2.2:1.9)+T(p[0],cy+p[2]+15,p[3][0],{s:8.5,c:INK,h:1});});
  return c;};
 SUBJ.forEach((s,i)=>{o+=miniCard(s,18+(i%2)*(cardW+gap),84+Math.floor(i/2)*140);});
 o+=T(PW/2,PH-18,'Misma tarjeta, pero cada unidad es un anillo lleno con sus conceptos',{s:10,c:'#9a9892'});
 // expandida
 let z=T(18,28,'Mapa',{a:'start',s:13,w:800,c:INK})+legend(50);
 z+=`<rect x="18" y="68" width="${PW-36}" height="470" rx="12" fill="#fff" stroke="${LINE}"/>`+T(34,94,'SXE',{a:'start',s:12.5,w:800,c:INK})+T(PW-34,94,'0/1 unidades',{a:'end',s:9.5});
 const ux=[[120,'UD1',0,SUBJ[0].u[0][2],22],[PW/2,'Entregas',16,SUBJ[0].u[1][2],22],[PW-120,'Teoria',21,TEO,26]];
 ux.slice(1).forEach((p,i)=>z+=`<line x1="${ux[i][0]+ux[i][4]+4}" y1="140" x2="${p[0]-p[4]-4}" y2="140" stroke="#e6e6e3" stroke-width="2"/>`);
 ux.forEach(p=>{const sel=p[1]==='Teoria';z+=(sel?`<circle cx="${p[0]}" cy="140" r="${p[4]+9}" fill="${BLUE}" fill-opacity=".08" stroke="${BLUE}" stroke-opacity=".4"/>`:'')+arc(p[0],140,p[4]+3,p[2]/100,2.4)+cluster(p[3],p[0],140,p[4],2.2)+T(p[0],140+p[4]+17,`${p[1]} · ${p[2]}%`,{s:9.5,c:INK,w:sel?800:600});});
 // cajón
 z+=`<path d="M${PW-120-10},206 L${PW-120},194 L${PW-120+10},206 Z" fill="#fbfbfa" stroke="${LINE}"/><rect x="34" y="206" width="${PW-68}" height="296" rx="12" fill="#fbfbfa" stroke="${LINE}"/><rect x="${PW-132}" y="205" width="24" height="3" fill="#fbfbfa"/>`;
 z+=T(50,232,'Teoria <tspan fill="'+MUTE+'" font-weight="600" font-size="10">7/36 · 9 para repasar</tspan>',{a:'start',s:12,w:800,c:INK});
 z+=cluster(TEO,PW/2,372,118,9,{lab:1,all:0,cur:1,max:12,fs:9.5,sx:2.15});
 z+=`<text x="${PW-50}" y="232" text-anchor="end" font-size="10" font-weight="700" fill="${MUTE}">✥ arrastra para reordenar</text>`;
 z+=`<rect x="${PW-194}" y="492" width="0" height="0"/>`;
 z+=T(34+16,528,'Ahora: <tspan fill="'+INK+'" font-weight="800">Teoria</tspan>',{a:'start',s:11,c:MUTE})+`<rect x="${PW-168}" y="508" width="134" height="28" rx="8" fill="#fff" stroke="#dcdad4"/>`+T(PW-101,526,'Aprender Teoria →',{s:10.5,c:INK,w:700});
 // otras tarjetas colapsadas
 [['PSP',SUBJ[1]],['PMDM',SUBJ[2]]].forEach(([n,s],i)=>{const y=556+i*58;z+=`<rect x="18" y="${y}" width="${PW-36}" height="48" rx="12" fill="#fff" stroke="${LINE}"/>`+T(34,y+29,n,{a:'start',s:12,w:800,c:INK});let px=PW/2-60;s.u.forEach(u=>{z+=arc(px,y+24,13,u[1]/100,2)+cluster(u[2],px,y+24,10.5,1.7);px+=44;});z+=T(PW-34,y+29,s.t,{a:'end',s:9.5});});
 return page('C · Tus tarjetas actuales, pero con los conceptos dentro','Mismo Mapa de ahora; cada anillo se llena con sus conceptos. Al pulsar una unidad no cambias de pantalla: se despliega el mapa de conceptos en la propia tarjeta.',pane(PW,PH,o,'1 · Mapa'),pane(PW,PH,z,'2 · Al pulsar Teoria (se expande en el sitio)'));}

(async()=>{const b=await chromium.launch();
 for(const [n,f] of [['jerarquia-A-burbujas-anidadas',A],['jerarquia-B-lienzo-unico',B],['jerarquia-C-tarjetas-con-conceptos',C]]){
  const p=await b.newPage({viewport:{width:1400,height:800},deviceScaleFactor:1.5});await p.setContent(f());await p.screenshot({path:`${OUT}/${n}.png`});await p.close();}
 await b.close();})();
