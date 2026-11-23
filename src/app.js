(function(){
'use strict';
const SRC='<!DOCTYPE html>\n'+document.documentElement.outerHTML;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const {norm,STEPK,PANEL_DEF,parseTranscript,analyze,specFromRows,specFromJson,buildPrompt}=window.FluxoorgEngine;
/* ---------- cores e texto ---------- */
const COLORS={yellow:['#FFF3B8','#E0C75E'],peach:['#FFDCC4','#E7A57A'],pink:['#FFD6E4','#E394B4'],green:['#D2EDCB','#86C279'],blue:['#D3E5FF','#7BA9E6'],purple:['#E3D8FA','#A287DB'],white:['#FFFFFF','#CCC7B9']};
const INK={ink:'#26231f',terracotta:'#C2562F',blue:'#2F66D8',green:'#2E8A4B',purple:'#7B4FCB'};
const SZ={small:14,body:16,large:28,title:48,huge:96};
function shade(h){const n=parseInt(h.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=.82;return '#'+[r,g,b].map(x=>Math.round(x*f).toString(16).padStart(2,'0')).join('')}
function colorOf(c,fb){if(COLORS[c])return COLORS[c];if(/^#[0-9a-f]{6}$/i.test(c||''))return[c,shade(c)];return COLORS[fb||'green']}
function inkOf(c){if(INK[c])return INK[c];if(/^#[0-9a-f]{6}$/i.test(c||''))return c;return INK.ink}
function inl(s){return s.replace(/\*\*\*(.+?)\*\*\*/g,'<b><i>$1</i></b>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')}
function md(t){
  let out='',list=null;const close=()=>list?'</'+list+'>':'';
  for(const raw of String(t==null?'':t).split('\n')){
    const l=esc(raw);let m;
    if((m=l.match(/^- (.*)$/))){if(list!=='ul'){out+=close()+'<ul>';list='ul'}out+='<li>'+inl(m[1])+'</li>'}
    else if((m=l.match(/^\d+\. (.*)$/))){if(list!=='ol'){out+=close()+'<ol>';list='ol'}out+='<li>'+inl(m[1])+'</li>'}
    else{out+=close();list=null;out+='<div class="ln">'+(inl(l)||'&nbsp;')+'</div>'}
  }
  return out+close();
}

/* ---------- estado ---------- */
let S={flows:[]};let cur=0;let tool='select';let curColor='white';
const sel=new Set();
const F=()=>S.flows[cur];
const nodes={},labels={};
function prep(f){f.undo=[];f.redo=[];f.view=f.view||null;f.els=f.els||{};f.order=f.order||Object.keys(f.els);return f}
function ser(f){return{id:f.id,title:f.title,locked:!!f.locked,protected:!!f.protected,els:f.els,order:f.order}}
function uid(){return 'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}

/* ---------- utilidades de UI ---------- */
let toastT;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2800)}
function ask(title,msg,ok){return new Promise(res=>{
  const bg=document.createElement('div');bg.className='modalbg';
  bg.innerHTML='<div class="modal"><h3>'+esc(title)+'</h3><p>'+esc(msg)+'</p><div class="row"><button class="btn" data-r="0">Cancelar</button><button class="btn pri" data-r="1">'+esc(ok||'Confirmar')+'</button></div></div>';
  bg.addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(b||e.target===bg){bg.remove();res(!!b&&b.dataset.r==='1')}});
  document.body.appendChild(bg);
})}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText){return navigator.clipboard.writeText(t).then(()=>true,()=>fallbackCopy(t))}
  return Promise.resolve(fallbackCopy(t));
}
function fallbackCopy(t){try{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}catch(e){return false}}

/* ---------- renderização ---------- */
const world=$('#world'),cv=$('#canvas');
let svg,handleEl;
function svgNS(t){return document.createElementNS('http://www.w3.org/2000/svg',t)}
function mkShape(id,d){
  const n=document.createElement('div');const kind=d.kind||'rounded';
  n.className='el shape k-'+kind;
  const [bg,bd]=colorOf(d.color,'green');
  const strokeC=d.stroke?inkOf(d.stroke):bd;
  n.style.left=d.x+'px';n.style.top=d.y+'px';n.style.width=d.w+'px';n.style.height=d.h+'px';
  n.style.fontSize=(SZ[d.size]&&d.size!=='body'?SZ[d.size]:15)+'px';
  const svgKinds={diamond:'50,0 100,50 50,100 0,50',hexagon:'12,0 88,0 100,50 88,100 12,100 0,50',parallelogram:'14,0 100,0 86,100 0,100'};
  if(svgKinds[kind]){
    n.style.background='transparent';
    n.innerHTML='<svg class="bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="'+svgKinds[kind]+'" fill="'+(d.hollow?'none':bg)+'" stroke="'+strokeC+'" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  }else{n.style.background=d.hollow?'transparent':bg;n.style.borderColor=strokeC}
  const t=document.createElement('div');t.className='t';t.innerHTML=md(d.text);
  if(d.textAlign)t.style.textAlign=d.textAlign;
  n.appendChild(t);return n;
}
function mkText(id,d){
  const n=document.createElement('div');n.className='el txt'+(d.wrap?'':' nw');
  n.style.left=d.x+'px';n.style.top=d.y+'px';
  const sz=SZ[d.size]||16;n.style.fontSize=sz+'px';n.style.color=inkOf(d.color);
  n.style.fontWeight=d.size==='title'||d.size==='huge'?'800':d.size==='large'?'700':'400';
  if(d.size==='title'||d.size==='huge')n.style.letterSpacing='-.02em';
  if(d.wrap)n.style.width=d.wrap+'px';
  if(d.textAlign)n.style.textAlign=d.textAlign;
  n.innerHTML=md(d.text);return n;
}
function mkTable(id,d){
  const t=document.createElement('table');t.className='el tbl';t.style.left=d.x+'px';t.style.top=d.y+'px';
  const cols=Object.entries(d.cols||{}).sort((a,b)=>a[1].at-b[1].at);
  const rows=Object.entries(d.rows||{}).sort((a,b)=>a[1].at-b[1].at);
  let w=0;let h='<colgroup>';cols.forEach(([k,c])=>{w+=c.w;h+='<col style="width:'+c.w+'px">'});h+='</colgroup><tbody>';
  rows.forEach(([rk,r])=>{h+='<tr>';cols.forEach(([ck])=>{
    const fill=(d.fills&&d.fills[rk]&&d.fills[rk][ck])||'';let st='';
    if(fill){const c=colorOf(fill,'white');st=' style="background:'+c[0]+'"'}
    h+='<td data-r="'+esc(rk)+'" data-c="'+esc(ck)+'"'+st+'>'+inl(esc(r[ck]||''))+'</td>';
  });h+='</tr>'});
  t.innerHTML=h+'</tbody>';t.style.width=w+'px';
  if(d.size&&SZ[d.size])t.style.fontSize=SZ[d.size]+'px';
  return t;
}
function mkOther(id,d){
  let n;
  if(d.type==='image'){n=document.createElement('img');n.src=d.src||'';n.draggable=false;n.style.width=d.w+'px';n.style.height=d.h+'px'}
  else if(d.type==='stroke'){
    const pts=d.points||[];let xs=[],ys=[];for(let i=0;i<pts.length;i+=2){xs.push(pts[i]);ys.push(pts[i+1])}
    const mx=Math.max(1,...xs),my=Math.max(1,...ys);
    n=document.createElement('div');let p='';for(let i=0;i<pts.length;i+=2)p+=(i?'L':'M')+pts[i]+' '+pts[i+1];
    n.innerHTML='<svg width="'+(mx+20)+'" height="'+(my+20)+'" style="overflow:visible"><path d="'+p+'" fill="none" stroke="'+inkOf(d.color)+'" stroke-width="'+(d.width||4)+'" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }else if(d.type==='link'){
    n=document.createElement('div');n.className='shape';n.style.cssText='width:320px;height:56px;background:#fff;border-color:#ccc7b9;justify-content:flex-start';n.innerHTML='<div class="t" style="text-align:left">'+esc(d.title||d.href||'link')+'</div>';
  }else{
    n=document.createElement('div');n.className='shape';n.style.cssText='width:'+(d.w||300)+'px;height:'+(d.h||200)+'px;background:#f4f1e8;border-style:dashed;border-color:#ccc7b9';n.innerHTML='<div class="t" style="color:#6f6a5e">Incorporado (não exibido nesta ferramenta)</div>';
  }
  n.classList.add('el');n.style.left=(d.x||0)+'px';n.style.top=(d.y||0)+'px';return n;
}
function renderAll(){
  const f=F();
  world.innerHTML='';for(const k in nodes)delete nodes[k];for(const k in labels)delete labels[k];
  const seen=new Set();const ids=f.order.filter(i=>f.els[i]&&!seen.has(i)&&seen.add(i));
  Object.keys(f.els).forEach(i=>{if(!seen.has(i)){ids.push(i);seen.add(i)}});
  const frag=document.createDocumentFragment();
  for(const id of ids){
    const d=f.els[id];let n;
    switch(d.type){
      case 'shape':n=mkShape(id,d);break;
      case 'text':n=mkText(id,d);break;
      case 'table':n=mkTable(id,d);break;
      case 'container':{
        n=document.createElement('div');n.className='el cont';
        n.style.cssText='left:'+d.x+'px;top:'+d.y+'px;width:'+d.w+'px;height:'+d.h+'px';
        if(d.color&&d.color!=='white'){const c=colorOf(d.color,'white');n.style.background=c[0]+'66';n.style.borderColor=c[1]}
        const l=document.createElement('div');l.className='clabel';l.dataset.id=id;l.textContent=d.text||'';l.style.left=d.x+'px';l.style.top=(d.y-32)+'px';
        l.style.position='absolute';labels[id]=l;break}
      case 'arrow':continue;
      default:n=mkOther(id,d);
    }
    if(!n)continue;n.dataset.id=id;nodes[id]=n;
    frag.appendChild(n);
    if(labels[id])frag.appendChild(labels[id]);
  }
  world.appendChild(frag);
  svg=svgNS('svg');svg.id='arrows';world.appendChild(svg);
  handleEl=document.createElement('div');handleEl.className='handle';handleEl.style.display='none';world.appendChild(handleEl);
  renderArrows();applySel();updateHandle();
}
function rectOf(id){
  const d=F().els[id],n=nodes[id];if(!d||!n)return null;
  return{x:d.x,y:d.y,w:d.w||n.offsetWidth,h:d.h||n.offsetHeight};
}
function sidePt(r,s){return s==='top'?{x:r.x+r.w/2,y:r.y}:s==='bottom'?{x:r.x+r.w/2,y:r.y+r.h}:s==='left'?{x:r.x,y:r.y+r.h/2}:{x:r.x+r.w,y:r.y+r.h/2}}
function autoSides(A,B){
  if(B.x>=A.x+A.w+20)return['right','left'];
  if(B.y>=A.y+A.h)return['bottom','top'];
  if(B.y+B.h<=A.y)return['top','bottom'];
  if(B.x+B.w<=A.x-20)return['left','right'];
  return['right','left'];
}
function route(a,sa,b,sb,ext){ext=ext||32;
  const H=s=>s==='left'||s==='right';
  if(H(sa)&&H(sb)){
    if(sa===sb){const e=sa==='right'?Math.max(a.x,b.x)+ext:Math.min(a.x,b.x)-ext;return[a,{x:e,y:a.y},{x:e,y:b.y},b]}
    if(Math.abs(a.y-b.y)<2)return[a,b];
    const mx=(a.x+b.x)/2;return[a,{x:mx,y:a.y},{x:mx,y:b.y},b];
  }
  if(!H(sa)&&!H(sb)){
    if(sa===sb){const e=sa==='bottom'?Math.max(a.y,b.y)+ext:Math.min(a.y,b.y)-ext;return[a,{x:a.x,y:e},{x:b.x,y:e},b]}
    if(Math.abs(a.x-b.x)<2)return[a,b];
    const my=(a.y+b.y)/2;return[a,{x:a.x,y:my},{x:b.x,y:my},b];
  }
  if(H(sa))return[a,{x:b.x,y:a.y},b];
  return[a,{x:a.x,y:b.y},b];
}
function pathD(pts,r){
  const p=pts.filter((q,i)=>!i||q.x!==pts[i-1].x||q.y!==pts[i-1].y);
  let d='M'+p[0].x+' '+p[0].y;
  for(let i=1;i<p.length-1;i++){
    const a=p[i-1],b=p[i],c=p[i+1];const l1=Math.hypot(a.x-b.x,a.y-b.y),l2=Math.hypot(c.x-b.x,c.y-b.y);const rr=Math.min(r,l1/2,l2/2);
    d+=' L'+(b.x+(a.x-b.x)/l1*rr)+' '+(b.y+(a.y-b.y)/l1*rr)+' Q'+b.x+' '+b.y+' '+(b.x+(c.x-b.x)/l2*rr)+' '+(b.y+(c.y-b.y)/l2*rr);
  }
  const L=p[p.length-1];return d+' L'+L.x+' '+L.y;
}
function renderArrows(){
  if(!svg)return;const f=F();
  let h='<defs>';
  for(const k in INK)h+='<marker id="m-'+k+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="'+INK[k]+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>';
  h+='</defs>';svg.innerHTML=h;
  for(const id of f.order){
    const d=f.els[id];if(!d||d.type!=='arrow')continue;
    let a,b,sa=d.fromSide,sb=d.toSide;
    const A=typeof d.from==='string'?rectOf(d.from):null;
    const B=typeof d.to==='string'?rectOf(d.to):null;
    if(typeof d.from==='string'&&!A)continue;if(typeof d.to==='string'&&!B)continue;
    if(A&&B){if(!sa||!sb){const s=autoSides(A,B);sa=sa||s[0];sb=sb||s[1]}a=sidePt(A,sa);b=sidePt(B,sb)}
    else if(A){a=A?sidePt(A,sa=sa||'right'):null;b={x:d.to[0],y:d.to[1]};sb=(sa==='right'||sa==='left')?(b.x>=a.x?'left':'right'):(b.y>=a.y?'top':'bottom')}
    else if(B){b=sidePt(B,sb=sb||'left');a={x:d.from[0],y:d.from[1]};sa=(sb==='right'||sb==='left')?(a.x<=b.x?'right':'left'):(a.y<=b.y?'bottom':'top')}
    else{a={x:d.from[0],y:d.from[1]};b={x:d.to[0],y:d.to[1]};sa='right';sb='left'}
    const pts=route(a,sa,b,sb,d.ext);const dd=pathD(pts,10);
    const col=d.color&&INK[d.color]?d.color:'ink';
    const hs=Array.isArray(d.heads)?d.heads:(d.head==='none'?['none','none']:d.head==='both'?['arrow','arrow']:['none','arrow']);
    const p=svgNS('path');p.setAttribute('d',dd);p.setAttribute('fill','none');p.setAttribute('stroke',INK[col]);p.setAttribute('stroke-width','2');p.setAttribute('stroke-linecap','round');
    if(d.dash)p.setAttribute('stroke-dasharray','7 6');
    if(hs[1]!=='none')p.setAttribute('marker-end','url(#m-'+col+')');
    if(hs[0]!=='none')p.setAttribute('marker-start','url(#m-'+col+')');
    p.dataset.arrow=id;svg.appendChild(p);
    const hit=svgNS('path');hit.setAttribute('d',dd);hit.setAttribute('class','hit');hit.dataset.id=id;svg.appendChild(hit);
    if(d.label){
      let bi=0,bl=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);if(l>bl){bl=l;bi=i}}
      const mx=(pts[bi].x+pts[bi-1].x)/2,my=(pts[bi].y+pts[bi-1].y)/2;
      const t=svgNS('text');t.setAttribute('x',mx);t.setAttribute('y',my-6);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','13');t.setAttribute('fill',INK[col]);t.setAttribute('stroke','#fbfaf6');t.setAttribute('stroke-width','4');t.setAttribute('paint-order','stroke');t.textContent=d.label;svg.appendChild(t);
    }
  }
  applySelArrows();
}

/* ---------- vista ---------- */
function applyView(){
  const v=F().view;world.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.k+')';
  cv.style.backgroundSize=(26*v.k)+'px '+(26*v.k)+'px';cv.style.backgroundPosition=v.x+'px '+v.y+'px';
  $('#zVal').textContent=Math.round(v.k*100)+'%';updateHandle();
}
function bbox(){
  const f=F();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const id in f.els){const d=f.els[id];if(d.type==='arrow')continue;const n=nodes[id];if(!n)continue;
    const w=d.w||n.offsetWidth,h=d.h||n.offsetHeight;const top=d.type==='container'?d.y-34:d.y;
    x0=Math.min(x0,d.x);y0=Math.min(y0,top);x1=Math.max(x1,d.x+w);y1=Math.max(y1,d.y+h)}
  if(x0>x1)return{x:0,y:0,w:800,h:500};return{x:x0,y:y0,w:x1-x0,h:y1-y0};
}
function fit(){
  const b=bbox(),W=cv.clientWidth,H=cv.clientHeight;const pad=48;
  const k=clamp(Math.min((W-pad*2)/b.w,(H-pad*2-50)/b.h),.05,1.2);
  F().view={k,x:(W-b.w*k)/2-b.x*k,y:Math.max(60,(H-b.h*k)/2)-b.y*k+ (b.h*k>H-120?0:0)};
  if(b.h*k>H-120)F().view.y=pad+10-b.y*k;
  applyView();
}
function zoomAt(cx,cy,nk){const v=F().view;nk=clamp(nk,.05,3);v.x=cx-(cx-v.x)*(nk/v.k);v.y=cy-(cy-v.y)*(nk/v.k);v.k=nk;applyView()}

/* ---------- seleção ---------- */
function setSel(ids){sel.clear();ids.forEach(i=>sel.add(i));applySel();updateHandle()}
function applySel(){
  for(const id in nodes)nodes[id].classList.toggle('sel',sel.has(id)&&!labels[id]);
  for(const id in labels)labels[id].classList.toggle('sel',sel.has(id));
  applySelArrows();
}
function applySelArrows(){if(!svg)return;svg.querySelectorAll('path[data-arrow]').forEach(p=>{const s=sel.has(p.dataset.arrow);p.setAttribute('stroke-width',s?'3.5':'2');if(s)p.setAttribute('stroke','#2f66d8')})}
function updateHandle(){
  if(!handleEl)return;handleEl.style.display='none';
  const f=F();if(f.locked||sel.size!==1)return;
  const id=[...sel][0],d=f.els[id];if(!d||!(d.type==='shape'||d.type==='container'||d.type==='image'))return;
  const s=14/f.view.k;handleEl.style.cssText='display:block;width:'+s+'px;height:'+s+'px;left:'+(d.x+d.w-s/2)+'px;top:'+(d.y+d.h-s/2)+'px;border-width:'+(2/f.view.k)+'px';
}

/* ---------- histórico e mutações ---------- */
function snap(){const f=F();return JSON.stringify({els:f.els,order:f.order,title:f.title})}
function beginChange(pre){const f=F();f.undo.push(pre||snap());if(f.undo.length>80)f.undo.shift();f.redo=[]}
function restore(s){const f=F(),o=JSON.parse(s);f.els=o.els;f.order=o.order;f.title=o.title;sel.clear();renderAll();syncHeader()}
function undo(){const f=F();if(f.locked)return lockedMsg();if(!f.undo.length)return;f.redo.push(snap());restore(f.undo.pop())}
function redo(){const f=F();if(f.locked)return lockedMsg();if(!f.redo.length)return;f.undo.push(snap());restore(f.redo.pop())}
function lockedMsg(){toast('Fluxo protegido. Use "Duplicar" para editar uma cópia ou libere a edição no cadeado.');return false}
function mutate(fn){const f=F();if(f.locked)return lockedMsg();beginChange();fn(f);renderAll();return true}
function nextId(f){let m=0;for(const k in f.els){const x=/^e(\d+)$/.exec(k);if(x)m=Math.max(m,+x[1])}return 'e'+(m+1)}
function viewCenter(){const v=F().view;return{x:(cv.clientWidth/2-v.x)/v.k,y:(cv.clientHeight/2-v.y)/v.k}}
function addEl(d,editAfter){
  let nid;
  if(mutate(f=>{nid=nextId(f);f.els[nid]=d;f.order.push(nid)})){setSel([nid]);if(editAfter&&d.type!=='arrow')setTimeout(()=>editText(nid),30)}
}
function deleteSel(){
  if(!sel.size)return;
  mutate(f=>{const rm=new Set(sel);for(const id in f.els){const d=f.els[id];if(d.type==='arrow'&&(rm.has(d.from)||rm.has(d.to)))rm.add(id)}
    rm.forEach(id=>delete f.els[id]);f.order=f.order.filter(i=>!rm.has(i))});sel.clear();applySel();updateHandle();
}

/* ---------- edição inline ---------- */
function editText(id){
  const f=F(),d=f.els[id];if(!d)return;if(f.locked)return lockedMsg();
  const target=labels[id]||nodes[id];if(!target)return;
  const r=target.getBoundingClientRect(),cr=cv.getBoundingClientRect();
  const ta=document.createElement('textarea');ta.className='editor ui';ta.value=d.text||'';
  ta.style.left=(r.left-cr.left)+'px';ta.style.top=(r.top-cr.top)+'px';ta.style.width=Math.max(r.width,240)+'px';ta.style.height=Math.max(r.height,64)+'px';
  cv.appendChild(ta);ta.focus();ta.select();let done=false;
  const end=ok=>{if(done)return;done=true;const v=ta.value;ta.remove();if(ok&&v!==d.text){mutate(ff=>{ff.els[id].text=v})}};
  ta.addEventListener('blur',()=>end(true));
  ta.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();end(false)}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();end(true)}e.stopPropagation()});
}
function editCell(td,id){
  const f=F();if(f.locked)return lockedMsg();
  td.contentEditable='true';td.textContent=f.els[id].rows[td.dataset.r][td.dataset.c]||'';td.focus();
  const r=document.createRange();r.selectNodeContents(td);const s=getSelection();s.removeAllRanges();s.addRange(r);
  let done=false;const end=ok=>{if(done)return;done=true;td.contentEditable='false';const v=td.textContent;if(ok)mutate(ff=>{ff.els[id].rows[td.dataset.r][td.dataset.c]=v});else renderAll()};
  td.addEventListener('blur',()=>end(true));td.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();end(false)}e.stopPropagation()});
}
function editLabel(id,hitEl){
  const f=F();if(f.locked)return lockedMsg();
  const r=hitEl.getBoundingClientRect(),cr=cv.getBoundingClientRect();
  const inp=document.createElement('input');inp.className='einput ui';inp.value=f.els[id].label||'';inp.placeholder='Rótulo da seta';
  inp.style.left=(r.left+r.width/2-cr.left-90)+'px';inp.style.top=(r.top+r.height/2-cr.top-16)+'px';cv.appendChild(inp);inp.focus();inp.select();
  let done=false;const end=ok=>{if(done)return;done=true;const v=inp.value;inp.remove();if(ok&&v!==(f.els[id].label||''))mutate(ff=>{if(v)ff.els[id].label=v;else delete ff.els[id].label})};
  inp.addEventListener('blur',()=>end(true));inp.addEventListener('keydown',e=>{if(e.key==='Enter')end(true);if(e.key==='Escape')end(false);e.stopPropagation()});
}

/* ---------- interação ---------- */
let drag=null,connectFrom=null;
function setTool(t){
  tool=t;connectFrom=null;cv.classList.toggle('arrowtool',t==='arrow');
  document.querySelectorAll('#tb [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
}
function childrenOf(cid){
  const f=F(),c=f.els[cid],out=[];
  for(const id in f.els){if(id===cid)continue;const d=f.els[id];if(d.type==='arrow'||d.x==null)continue;const n=nodes[id];
    const w=d.w||(n?n.offsetWidth:0),h=d.h||(n?n.offsetHeight:0);const cx=d.x+w/2,cy=d.y+h/2;
    if(cx>c.x&&cx<c.x+c.w&&cy>c.y&&cy<c.y+c.h)out.push(id)}
  return out;
}
cv.addEventListener('pointerdown',e=>{
  if(e.target.closest('.ui'))return;
  const f=F(),v=f.view;
  const hnd=e.target.closest('.handle');const hit=e.target.closest('[data-id]');const id=hit&&hit.dataset.id;
  if(tool==='arrow'&&id&&f.els[id]&&f.els[id].type!=='arrow'&&f.els[id].type!=='container'){
    if(f.locked)return lockedMsg();
    if(!connectFrom){connectFrom=id;setSel([id]);toast('Agora clique na caixa de destino')}
    else if(connectFrom!==id){const from=connectFrom;addEl({type:'arrow',from,to:id});setTool('select')}
    return;
  }
  if(e.button===1||(!hit&&!hnd)){
    if(!e.shiftKey)setSel([]);
    drag={m:'pan',sx:e.clientX,sy:e.clientY,vx:v.x,vy:v.y};cv.classList.add('panning');cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);return;
  }
  if(hnd){
    if(f.locked)return lockedMsg();const rid=[...sel][0],d=f.els[rid];
    drag={m:'resize',id:rid,sx:e.clientX,sy:e.clientY,w0:d.w,h0:d.h,pre:snap(),moved:false};return;
  }
  if(e.shiftKey){sel.has(id)?sel.delete(id):sel.add(id);applySel();updateHandle()}
  else if(!sel.has(id))setSel([id]);
  if(f.els[id].type==='arrow'||f.locked)return;
  const ids=new Set([...sel].filter(i=>f.els[i]&&f.els[i].type!=='arrow'));
  [...ids].forEach(i=>{if(f.els[i].type==='container')childrenOf(i).forEach(c=>ids.add(c))});
  const start={};ids.forEach(i=>{const d=f.els[i];if(d.x!=null)start[i]=[d.x,d.y]});
  drag={m:'move',start,sx:e.clientX,sy:e.clientY,moved:false,pre:snap()};
});
window.addEventListener('pointermove',e=>{
  if(!drag)return;const f=F(),k=f.view.k;
  if(drag.m==='pan'){f.view.x=drag.vx+e.clientX-drag.sx;f.view.y=drag.vy+e.clientY-drag.sy;applyView();return}
  const dx=(e.clientX-drag.sx)/k,dy=(e.clientY-drag.sy)/k;
  if(!drag.moved){if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<3)return;drag.moved=true;beginChange(drag.pre)}
  if(drag.m==='move'){
    for(const id in drag.start){const d=f.els[id];d.x=Math.round(drag.start[id][0]+dx);d.y=Math.round(drag.start[id][1]+dy);
      if(nodes[id]){nodes[id].style.left=d.x+'px';nodes[id].style.top=d.y+'px'}
      if(labels[id]){labels[id].style.left=d.x+'px';labels[id].style.top=(d.y-32)+'px'}}
    renderArrows();updateHandle();
  }else if(drag.m==='resize'){
    const d=f.els[drag.id];d.w=Math.max(60,Math.round(drag.w0+dx));d.h=Math.max(36,Math.round(drag.h0+dy));
    const n=nodes[drag.id];n.style.width=d.w+'px';n.style.height=d.h+'px';renderArrows();updateHandle();
  }
});
window.addEventListener('pointerup',()=>{if(drag){cv.classList.remove('panning');if(drag.m!=='pan'&&drag.moved)renderAll();drag=null}});
cv.addEventListener('wheel',e=>{
  e.preventDefault();const f=F(),v=f.view;
  if(e.ctrlKey||e.metaKey){const r=cv.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,v.k*Math.exp(-e.deltaY*.01))}
  else{v.x-=e.deltaX;v.y-=e.deltaY;applyView()}
},{passive:false});
cv.addEventListener('dblclick',e=>{
  if(e.target.closest('.ui'))return;
  const hit=e.target.closest('[data-id]');if(!hit)return;const id=hit.dataset.id,d=F().els[id];if(!d)return;
  if(d.type==='table'){const td=e.target.closest('td');if(td)editCell(td,id);return}
  if(d.type==='arrow'){editLabel(id,hit);return}
  if(d.type==='shape'||d.type==='text'||d.type==='container')editText(id);
});
window.addEventListener('keydown',e=>{
  const tg=e.target;if(tg.matches('input,textarea,select,[contenteditable=true]'))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
  else if(e.key==='Delete'||e.key==='Backspace'){if(sel.size){e.preventDefault();if(F().locked)lockedMsg();else deleteSel()}}
  else if(e.key==='Escape'){setTool('select');setSel([])}
  else if(!mod&&e.key.toLowerCase()==='v')setTool('select');
  else if(!mod&&e.key.toLowerCase()==='a')setTool(tool==='arrow'?'select':'arrow');
});

/* ---------- barra de ferramentas ---------- */
(function(){
  const box=$('#swatches');
  Object.keys(COLORS).forEach(c=>{const b=document.createElement('button');b.className='sw'+(c===curColor?' on':'');b.dataset.c=c;b.title='Cor: '+c;b.style.background=COLORS[c][0];box.appendChild(b)});
  box.addEventListener('click',e=>{const b=e.target.closest('.sw');if(!b)return;curColor=b.dataset.c;box.querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x===b));
    const ids=[...sel].filter(i=>F().els[i]&&(F().els[i].type==='shape'||F().els[i].type==='container'));if(ids.length)mutate(f=>ids.forEach(i=>{f.els[i].color=curColor}))});
  document.querySelectorAll('#tb [data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
  $('#tbShape').onclick=()=>{const c=viewCenter();addEl({type:'shape',kind:'rounded',color:curColor,x:Math.round(c.x-110),y:Math.round(c.y-48),w:220,h:96,text:'Nova etapa'},true)};
  $('#tbText').onclick=()=>{const c=viewCenter();addEl({type:'text',x:Math.round(c.x-80),y:Math.round(c.y-12),text:'Novo texto'},true)};
  $('#tbCont').onclick=()=>{const c=viewCenter();addEl({type:'container',x:Math.round(c.x-260),y:Math.round(c.y-170),w:520,h:340,text:'Nova seção'},true);const f=F();const id=[...sel][0];if(id){f.order=f.order.filter(i=>i!==id);f.order.unshift(id);renderAll();setSel([id])}};
  $('#tbUndo').onclick=undo;$('#tbRedo').onclick=redo;$('#tbDelete').onclick=()=>{if(F().locked)lockedMsg();else deleteSel()};
  $('#tbLock').onclick=async()=>{
    const f=F();
    if(f.locked){const ok=await ask('Liberar edição?',f.protected?'Este é o fluxo original. Liberar a edição permite alterar os dados dele. Se quiser mexer sem risco, use "Duplicar".':'Liberar edição deste fluxo?','Liberar');if(ok){f.locked=false;syncHeader()}}
    else{f.locked=true;syncHeader();toast('Edição bloqueada')}
  };
  $('#zIn').onclick=()=>zoomAt(cv.clientWidth/2,cv.clientHeight/2,F().view.k*1.25);
  $('#zOut').onclick=()=>zoomAt(cv.clientWidth/2,cv.clientHeight/2,F().view.k/1.25);
  $('#zFit').onclick=fit;
})();

/* ---------- cabeçalho e fluxos ---------- */
function syncHeader(){
  const f=F(),sel_=$('#flowSel');
  sel_.innerHTML=S.flows.map((x,i)=>'<option value="'+i+'"'+(i===cur?' selected':'')+'>'+(x.locked?'🔒 ':'')+esc(x.title||'Sem título')+'</option>').join('');
  const ti=$('#flowTitle');ti.value=f.title||'';ti.disabled=!!f.locked;
  $('#btnDel').disabled=!!f.protected;
  $('#tbLock').textContent=f.locked?'🔒 Protegido':'🔓 Editável';
  const b=$('#banner');
  if(f.locked){b.style.display='flex';b.innerHTML='<b>'+(f.protected?'Fluxo original protegido':'Fluxo protegido')+'</b><span>Os dados não podem ser alterados. Você pode navegar, dar zoom e selecionar.</span><span class="spacer"></span><button class="btn sm pri" id="bnDup">Duplicar para editar</button>';
    $('#bnDup').onclick=dupFlow}
  else b.style.display='none';
}
function switchFlow(i){
  cur=clamp(i,0,S.flows.length-1);sel.clear();setTool('select');renderAll();syncHeader();
  requestAnimationFrame(()=>{if(!F().view)fit();else applyView()});
}
function addFlow(f,go){prep(f);S.flows.push(f);if(go!==false)switchFlow(S.flows.length-1);else syncHeader()}
function dupFlow(){
  const f=F();const c=JSON.parse(JSON.stringify(ser(f)));c.id=uid();c.title=(f.title||'Fluxo')+' (cópia)';c.locked=false;c.protected=false;
  addFlow(c);toast('Cópia criada: agora você pode editar');
}
$('#flowSel').onchange=e=>switchFlow(+e.target.value);
$('#flowTitle').oninput=e=>{const f=F();if(f.locked)return;f.title=e.target.value;const o=$('#flowSel').options[cur];if(o)o.textContent=(f.title||'Sem título')};
$('#btnDup').onclick=dupFlow;
$('#btnBlank').onclick=()=>{addFlow({id:uid(),title:'Novo fluxo',locked:false,els:{e1:{type:'text',size:'title',text:'Novo fluxo',x:0,y:0}},order:['e1']})};
$('#btnDel').onclick=async()=>{const f=F();if(f.protected)return;if(await ask('Excluir fluxo?','"'+(f.title||'Sem título')+'" será removido do projeto atual.','Excluir')){S.flows.splice(cur,1);switchFlow(Math.max(0,cur-1))}};
$('#btnSide').onclick=()=>{$('#side').classList.toggle('hide');setTimeout(()=>F().view&&applyView(),50)};

/* ---------- salvar / abrir ---------- */
function projectJson(){return JSON.stringify({app:'fluxoorg',v:1,flows:S.flows.map(ser)},null,1)}
$('#btnSaveJson').onclick=()=>download('fluxoorg.json',projectJson(),'application/json');
$('#btnSaveHtml').onclick=()=>{
  const json=JSON.stringify({flows:S.flows.map(ser)}).replace(/</g,'\\u003c');
  const a=SRC.indexOf('id="seed">')+10,b=SRC.indexOf('<'+'/script>',a);
  let out=SRC.slice(0,a)+json+SRC.slice(b);
  // a spec injetada pela skill já virou fluxo: limpa para não duplicar ao reabrir
  const sa=out.indexOf('id="spec">');if(sa>=0){const s0=sa+10,s1=out.indexOf('<'+'/script>',s0);out=out.slice(0,s0)+out.slice(s1)}
  download('fluxoorg.html',out,'text/html');toast('HTML salvo com todos os fluxos embutidos');
};
$('#btnOpen').onclick=()=>$('#fileProj').click();
$('#fileProj').onchange=e=>{
  const fl=e.target.files[0];if(!fl)return;const r=new FileReader();
  r.onload=()=>{try{
    const o=JSON.parse(r.result);const arr=o.flows||(o.els?[o]:null);if(!arr)throw 0;let n=0;
    arr.forEach(f=>{if(f.id==='original'&&S.flows.some(x=>x.id==='original'))return;const c=JSON.parse(JSON.stringify(f));c.id=uid();c.protected=false;c.locked=!!f.locked;addFlow(c,false);n++});
    if(n){switchFlow(S.flows.length-1);toast(n+' fluxo(s) importado(s)')}else toast('Nada novo para importar');
  }catch(err){toast('Arquivo inválido')}e.target.value=''};
  r.readAsText(fl);
};

/* ---------- revisão ---------- */
const KINDS=[['step','Etapa'],['sys','Sistema'],['cond','Decisão ◇'],['pain','Dor'],['dec','Decisão tomada'],['pen','Pendência'],['rule','Regra'],['want','Necessidade'],['ign','Ignorar']];
let REV=null;
function mkBtn(txt,title,fn){const b=document.createElement('button');b.className='btn sm';b.textContent=txt;b.title=title;b.onclick=fn;return b}
function secRow(title){
  const d=document.createElement('div');d.className='rsec';
  const i=document.createElement('input');i.type='text';i.className='rst';i.value=title||'';i.placeholder='Nome da seção';
  d.appendChild(document.createTextNode('§'));d.appendChild(i);
  d.appendChild(mkBtn('×','Unir com a seção anterior',()=>d.remove()));return d;
}
function itemRow(it){
  const d=document.createElement('div');d.className='ri';d.dataset.sp=it.sp||'';
  const s=document.createElement('select');s.className='rk';
  KINDS.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(v===it.kind)o.selected=true;s.appendChild(o)});
  const t=document.createElement('input');t.type='text';t.className='rt';t.value=it.text;
  const bx=document.createElement('div');bx.className='rb';
  bx.appendChild(mkBtn('↑','Mover para cima',()=>{if(d.previousElementSibling)d.parentNode.insertBefore(d,d.previousElementSibling)}));
  bx.appendChild(mkBtn('↓','Mover para baixo',()=>{if(d.nextElementSibling)d.parentNode.insertBefore(d.nextElementSibling,d)}));
  bx.appendChild(mkBtn('§','Iniciar nova seção aqui',()=>d.parentNode.insertBefore(secRow(''),d)));
  d.appendChild(s);d.appendChild(t);d.appendChild(bx);return d;
}
function showReview(a){
  REV={people:a.people,date:a.date,gloss:a.gloss};
  const box=$('#revList');box.innerHTML='';let last=-1;
  a.items.forEach(it=>{
    if(STEPK.includes(it.kind)&&it.sec!==last){last=it.sec;box.appendChild(secRow(a.secs[it.sec]?a.secs[it.sec].title:''))}
    box.appendChild(itemRow(it));
  });
  $('#review').style.display='block';
  $('#review').scrollIntoView({behavior:'smooth',block:'start'});
}
function readReview(){
  const secs=[{title:''}];let cur=0,steps=0;const rows=[];
  for(const el of $('#revList').children){
    if(el.classList.contains('rsec')){const v=el.querySelector('.rst').value.trim();if(steps===0)secs[cur].title=v||secs[cur].title;else{secs.push({title:v});cur++;steps=0}continue}
    const k=el.querySelector('.rk').value,t=el.querySelector('.rt').value.trim();if(k==='ign'||!t)continue;
    if(STEPK.includes(k))steps++;rows.push({kind:k,text:t,sp:el.dataset.sp||null,sec:cur});
  }
  return{rows,secs};
}
function rowsFromAnalysis(a){return{rows:a.items.map(it=>({kind:it.kind,text:it.text,sp:it.sp,sec:it.sec})),secs:a.secs.map(s=>({title:s.title}))}}
/* ---------- layout do quadro ---------- */
const meas=$('#meas'),measT=meas.querySelector('.t');
function textH(text,w,fs){meas.style.width=w+'px';meas.style.fontSize=(fs||15)+'px';measT.innerHTML=md(text);return meas.scrollHeight}
function nodeH(text,w,min){return Math.max(min,Math.ceil((textH(text,w)+6)/4)*4)}
function buildBoard(spec,o){
  const W=232,GX=64,GY=64,PAD=24,SECGAP=110;
  const els={},order=[];let c=0;const add=d=>{const id='e'+(++c);els[id]=d;order.push(id);return id};
  const conts=[],post=[],edgeDefs=[],rects={};
  let y=220,maxW=0;
  spec.flows.forEach((fl,fi)=>{
    const nodes=fl.nodes.map(n=>{const cond=n.kind==='cond';return Object.assign({},n,{gid:fi+':'+n.id,w:W,h:nodeH(n.text,W,cond?132:96)+(cond?20:0)})});
    const lanes=[];if(o.layout==='lanes')nodes.forEach(n=>{const l=n.lane||'Geral';if(!lanes.includes(l))lanes.push(l)});
    const useLanes=o.layout==='lanes'&&lanes.length>1;let w,bottom;
    if(useLanes){
      const N=nodes.length;w=N*(W+GX)-GX+PAD*2;const maxH=Math.max(...nodes.map(n=>n.h));const laneH=maxH+PAD*2;
      lanes.forEach((l,li)=>conts.push({type:'container',text:fl.title+' · '+l,x:0,y:y+li*(laneH+64),w,h:laneH,_f:fi}));
      nodes.forEach((n,i)=>{const li=lanes.indexOf(n.lane||'Geral');n.x=PAD+i*(W+GX);n.y=y+li*(laneH+64)+PAD+Math.round((maxH-n.h)/2);n.row=li;n.col=i});
      bottom=y+lanes.length*laneH+(lanes.length-1)*64;
    }else{
      const per=clamp(+o.perRow||4,2,8);const rws=[];for(let i=0;i<nodes.length;i+=per)rws.push(nodes.slice(i,i+per));
      w=Math.min(per,nodes.length)*(W+GX)-GX+PAD*2;let ry=y+PAD;
      rws.forEach((r,ri)=>{const mh=Math.max(...r.map(n=>n.h));r.forEach((n,i)=>{n.x=PAD+i*(W+GX);n.y=ry+Math.round((mh-n.h)/2);n.row=ri;n.col=i});ry+=mh+GY});
      bottom=ry-GY+PAD;conts.push({type:'container',text:fl.title,x:0,y,w,h:bottom-y,_f:fi});
    }
    maxW=Math.max(maxW,w);
    nodes.forEach(n=>{rects[n.gid]=n});
    let k=0;
    (fl.edges||[]).forEach(e=>{
      const A=nodes.find(n=>n.id===e.from),B=nodes.find(n=>n.id===e.to);if(!A||!B)return;
      let s,ext;
      if(A.row===B.row&&Math.abs(A.col-B.col)>1){s=A.col<B.col?['bottom','bottom']:['bottom','bottom'];ext=28+(k++%2)*20}
      else s=autoSides(A,B);
      edgeDefs.push({from:A.gid,to:B.gid,fromSide:s[0],toSide:s[1],label:e.label||'',ext});
    });
    post.push(...nodes.map(n=>({n,d:{type:'shape',kind:n.kind==='cond'?'diamond':'rounded',color:n.kind==='sys'?'blue':n.kind==='cond'?'green':'white',text:n.text,x:n.x,y:n.y,w:n.w,h:n.h},gid:n.gid})));
    y=bottom+SECGAP;
  });
  conts.forEach(ct=>{ct.w=Math.max(ct.w,maxW)});
  // quadros
  const panels=spec.panels||[];
  if(panels.length){
    const totalW=Math.max(maxW,1300),pw=Math.floor((totalW-2*40)/3),iw=pw-PAD*2;
    for(let i=0;i<panels.length;i+=3){
      const rowP=panels.slice(i,i+3);let rh=0;const built=[];
      rowP.forEach((p,pi)=>{
        const px=pi*(pw+40);let yy=y+PAD;
        p.items.forEach(t=>{const h=nodeH(t,iw,72);built.push({d:{type:'shape',kind:'rounded',color:p.color,text:t,x:px+PAD,y:yy,w:iw,h}});yy+=h+20});
        const ch=yy-20+PAD-y;rh=Math.max(rh,ch);conts.push({type:'container',text:p.t,x:px,y,w:pw,h:ch});
      });
      post.push(...built);y+=rh+SECGAP-20;
    }
  }
  // tabelas
  const tbls=[];
  (spec.tables||[]).forEach(tb=>{
    const cw=tb.cols.map((cn,ci)=>{let m=cn.length;tb.rows.forEach(r=>{m=Math.max(m,String(r[ci]||'').length)});return clamp(m*8+26,110,400)});
    const rowsO={},colsO={};tb.cols.forEach((cn,ci)=>{colsO['c'+(ci+1)]={at:ci+1,w:cw[ci]}});
    const all=[tb.cols].concat(tb.rows);let hh=0;
    all.forEach((r,ri)=>{const o2={at:ri+1};r.forEach((v,ci)=>{o2['c'+(ci+1)]=v});rowsO['r'+(ri+1)]=o2;
      let lines=1;r.forEach((v,ci)=>{lines=Math.max(lines,Math.ceil(String(v).length*7.6/(cw[ci]-26)))});hh+=16+lines*19+2});
    const tw=cw.reduce((a,b)=>a+b,0);
    conts.push({type:'container',text:tb.title,x:0,y,w:Math.max(tw+PAD*2,420),h:hh+PAD*2});
    tbls.push({type:'table',x:PAD,y:y+PAD,cols:colsO,rows:rowsO});y+=hh+PAD*2+SECGAP;
  });
  // cabeçalho
  const nSteps=spec.flows.reduce((a,f)=>a+f.nodes.length,0);
  const cnt=k=>(panels.find(p=>p.t===PANEL_DEF[k].t)||{items:[]}).items.length;
  const summary=spec.summary||(nSteps+' etapas em '+spec.flows.length+(spec.flows.length===1?' fluxo':' fluxos')+(cnt('pain')?', '+cnt('pain')+' dores':'')+(cnt('dec')?', '+cnt('dec')+' decisões':'')+(cnt('pen')?' e '+cnt('pen')+' pendências':''));
  const hasSys=spec.flows.some(f=>f.nodes.some(n=>n.kind==='sys')),hasCond=spec.flows.some(f=>f.nodes.some(n=>n.kind==='cond'));
  const lg=[];if(hasSys)lg.push('Azul: sistema');if(panels.some(p=>p.color==='peach'))lg.push('Pêssego: dor ou lacuna');if(hasCond||panels.some(p=>p.color==='green'))lg.push('Verde: decisão ou necessidade');lg.push('Branco: etapa, regra ou pendência');
  add({type:'text',text:spec.title,size:'title',x:0,y:0});
  add({type:'text',text:summary,size:'large',x:0,y:68});
  add({type:'text',text:spec.subtitle,size:'small',wrap:1500,x:0,y:116});
  add({type:'text',text:lg.join(' · '),size:'small',wrap:1500,x:0,y:146});
  conts.forEach(ct=>{const d=Object.assign({},ct);delete d._f;add(d)});
  const idMap={};
  post.forEach(p=>{const id=add(p.d);if(p.gid)idMap[p.gid]=id});
  tbls.forEach(t=>add(t));
  edgeDefs.forEach(e=>{const d={type:'arrow',from:idMap[e.from],to:idMap[e.to],fromSide:e.fromSide,toSide:e.toSide};if(e.label)d.label=e.label;if(e.ext)d.ext=e.ext;add(d)});
  return{els,order};
}
function makeSubtitle(spec){
  const p=spec.people&&spec.people.length?' · Participantes: '+spec.people.join(', '):'';
  return 'Reunião'+(spec.date?' de '+spec.date:'')+p;
}
function createFlowFromSpec(spec,o){
  spec.title=spec.title||'Fluxo da reunião';
  spec.subtitle=spec.subtitle||makeSubtitle(spec);
  const b=buildBoard(spec,o);
  addFlow({id:uid(),title:spec.title,locked:false,protected:false,els:b.els,order:b.order});
  const ns=spec.flows.reduce((a,f)=>a+f.nodes.length,0);
  toast('Fluxo criado: '+ns+' etapas em '+spec.flows.length+' seção(ões) · '+(spec.panels||[]).length+' quadro(s)');
}
function readOpts(){
  return{layout:$('#optLayout').value,perRow:+$('#optPer').value||4,detail:+$('#optDetail').value,systems:$('#optSys').value,panels:$('#optPanels').checked};
}
function runAnalysis(){
  const raw=$('#tx').value.trim();
  if(raw.length<30){toast('Cole uma transcrição maior para gerar o fluxo');return null}
  const a=analyze(raw,readOpts());
  if(!a.items.some(x=>STEPK.includes(x.kind))){toast('Não encontrei etapas. Aumente o nível de detalhe ou use o modo IA.');return null}
  return a;
}
function metaFrom(a){return{title:$('#optTitle').value.trim()||('Fluxo da reunião'+(a.date?' de '+a.date:'')),date:a.date,people:a.people,gloss:a.gloss}}
$('#btnAnalyze').onclick=()=>{const a=runAnalysis();if(a)showReview(a)};
$('#btnGen').onclick=()=>{const a=runAnalysis();if(!a)return;const r=rowsFromAnalysis(a);createFlowFromSpec(specFromRows(r.rows,r.secs,metaFrom(a),readOpts()),readOpts())};
$('#btnBuild').onclick=()=>{
  if(!REV)return;const r=readReview();
  if(!r.rows.some(x=>STEPK.includes(x.kind))){toast('Mantenha ao menos uma etapa');return}
  createFlowFromSpec(specFromRows(r.rows,r.secs,{title:$('#optTitle').value.trim()||('Fluxo da reunião'+(REV.date?' de '+REV.date:'')),date:REV.date,people:REV.people,gloss:REV.gloss},readOpts()),readOpts());
};
$('#btnRevClose').onclick=()=>{$('#review').style.display='none'};
function updateInfo(){
  const raw=$('#tx').value;const el=$('#txInfo');
  if(!raw.trim()){el.textContent='';return}
  const {turns,people}=parseTranscript(raw);
  el.textContent=turns.length+' falas · '+raw.trim().split(/\s+/).length+' palavras'+(people.length?' · '+people.join(', '):' · sem nomes de falantes detectados');
}
$('#tx').addEventListener('input',updateInfo);
$('#optDetail').addEventListener('input',e=>{$('#detailVal').textContent=e.target.value});
$('#btnClear').onclick=()=>{$('#tx').value='';updateInfo()};
$('#btnFile').onclick=()=>$('#fileTx').click();
$('#fileTx').onchange=e=>{const fl=e.target.files[0];if(!fl)return;const r=new FileReader();r.onload=()=>{$('#tx').value=r.result;updateInfo();if(!$('#optTitle').value)$('#optTitle').value=fl.name.replace(/\.[^.]+$/,'');toast('Transcrição carregada')};r.readAsText(fl);e.target.value=''};
const SAMPLE="Marina: Pessoal, o objetivo hoje é mapear como um lead vira cliente ativo na Orbita. Reunião de 12/03/2026.\nRafael: Primeiro o lead entra pelo site ou pelo WhatsApp e cai no HubSpot. O problema é que os leads de eventos ainda chegam por planilha, na mão.\nMarina: Depois o SDR qualifica o lead por telefone e registra o resultado no HubSpot.\nRafael: Se a empresa tiver mais de 50 usuários, o SDR encaminha para um executivo de contas. Se não, segue para o time de inside sales.\nBruno: E quem monta a proposta?\nRafael: O time de pricing calcula o desconto no HubSpot e a proposta sai em PDF. Em seguida o executivo envia a proposta por e-mail para o cliente.\nMarina: Quando o cliente assina, o financeiro cadastra o contrato no ERP e gera a primeira fatura no Stripe.\nBruno: E o onboarding?\nMarina: Agora sobre o onboarding. O time de sucesso do cliente agenda o kickoff em até cinco dias e cria o workspace do cliente.\nRafael: A conta só conta como ativa depois do primeiro login, nunca na data da assinatura. MQL significa lead qualificado pelo marketing. ARR é a receita recorrente anual do contrato.\nRafael: Hoje a gente não tem vínculo no sistema entre o executivo e o contrato no ERP, então a comissão é calculada manualmente e dá retrabalho.\nMarina: A gente queria ver no painel a conversão por etapa e o tempo médio até o primeiro login.\nMarina: Ficou combinado que vamos criar um ID único de cliente e usar esse código como chave entre HubSpot e ERP.\nBruno: Ótimo. Eu vou enviar o dicionário de campos do HubSpot até sexta.\nRafael: Preciso confirmar com o jurídico o prazo de cancelamento e te aviso na terça.\nMarina: Decidimos também que o relatório de ARR vai sair direto do Databricks, sem planilha.";
$('#btnSample').onclick=()=>{$('#tx').value=SAMPLE;$('#optTitle').value='Exemplo · Orbita, do lead ao cliente ativo';updateInfo()};

$('#btnPrompt').onclick=async()=>{
  const ok=await copyText(buildPrompt($('#tx').value));
  if(ok){toast('Prompt copiado. Cole no Claude e traga o JSON de volta.');$('#aiBox').open=true}
  else toast('Não consegui copiar automaticamente');
};
function fromJsonText(t){
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('JSON não encontrado');
  const spec=specFromJson(JSON.parse(t.slice(a,b+1)));
  if(!spec.flows.length)throw new Error('o JSON não tem etapas');
  createFlowFromSpec(spec,readOpts());
}
$('#btnJsonGen').onclick=()=>{try{fromJsonText($('#jsonIn').value)}catch(e){toast('JSON inválido: '+e.message)}};
$('#btnAI').onclick=async()=>{
  const raw=$('#tx').value.trim();if(raw.length<30){toast('Cole uma transcrição maior');return}
  const key=$('#aiKey').value.trim();if(!key){toast('Informe a chave da API da Anthropic');return}
  const btn=$('#btnAI');btn.disabled=true;btn.textContent='Analisando…';
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:$('#aiModel').value.trim()||'claude-sonnet-5-5',max_tokens:8000,messages:[{role:'user',content:buildPrompt(raw)}]})});
    const j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
    fromJsonText((j.content||[]).map(b=>b.text||'').join(''));
  }catch(e){toast('Falha no modo IA: '+e.message)}
  finally{btn.disabled=false;btn.textContent='Gerar com IA'}
};

/* ---------- início ---------- */
function readJsonScript(id){try{const t=($('#'+id)||{}).textContent||'';return t.trim()&&t.trim()[0]!=='/'?JSON.parse(t):null}catch(e){console.warn('Fluxoorg: JSON inválido em #'+id,e);return null}}
(function init(){
  const seed=readJsonScript('seed')||{flows:[]};
  S.flows=(seed.flows||[]).map(prep);
  $('#detailVal').textContent=$('#optDetail').value;
  if(innerWidth<=760)$('#side').classList.add('hide');
  // 1) spec injetada pela skill (scripts/render.py) ou por window.FLUXOORG_SPEC
  let specs=window.FLUXOORG_SPEC||readJsonScript('spec');
  if(specs&&!Array.isArray(specs))specs=[specs];
  let made=0;
  (specs||[]).forEach(s=>{try{const sp=specFromJson(s);if(sp.flows.length){createFlowFromSpec(sp,readOpts());made++}}catch(e){console.warn('Fluxoorg: spec ignorada',e)}});
  // 2) primeira abertura: fluxo de exemplo protegido, montado a partir de uma spec fictícia
  if(!S.flows.length){
    const demo=readJsonScript('demo');
    if(demo){const sp=specFromJson(demo);sp.title=sp.title||'Exemplo';createFlowFromSpec(sp,{layout:'linear',perRow:4});const f=F();f.id='exemplo';f.locked=true;$('#toast').classList.remove('on')}
  }
  if(!S.flows.length)S.flows.push(prep({id:uid(),title:'Novo fluxo',locked:false,els:{e1:{type:'text',size:'title',text:'Novo fluxo',x:0,y:0}},order:['e1']}));
  switchFlow(made?S.flows.length-made:0);
  window.addEventListener('resize',()=>{if(F().view)applyView()});
})();
})();
