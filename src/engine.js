/* Fluxoorg · motor de análise (sem DOM).
 * Transforma a transcrição de uma reunião em itens classificados e em uma
 * especificação de fluxo ("spec") que o app desenha no quadro.
 * Exposto como window.FluxoorgEngine (navegador) ou module.exports (Node).
 */
(function(root){
'use strict';
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function shorten(s,max){
  max=max||130;if(s.length<=max)return s;
  let cut=s.slice(0,max);const i=Math.max(cut.lastIndexOf(', '),cut.lastIndexOf(' – '),cut.lastIndexOf(' - '));
  cut=i>max*.5?cut.slice(0,i):cut.slice(0,cut.lastIndexOf(' '));
  return cut.replace(/[,;:\s]+$/,'')+'…';
}
const SPK=/^\s*(?:[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?\s*[-–]?\s*)?([A-ZÀ-ÖØ-Þ][\p{L}.'’-]*(?:\s+[\p{L}.'’-]+){0,3})\s*(?:[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?)?\s*[:：]\s*(.*)$/u;
const SPK_LINE=/^([A-ZÀ-ÖØ-Þ][\p{L}.'’ -]{1,40}?)\s+[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?$/u;
function parseTranscript(raw){
  const rows=[];let pend=null;
  for(let ln of String(raw||'').replace(/\r/g,'').split('\n')){
    ln=ln.trim();
    if(!ln||/^WEBVTT/i.test(ln)||/^NOTE\b/.test(ln)||/^\d+$/.test(ln)||/-->/.test(ln)){continue}
    let m=ln.match(/^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/);
    if(m){rows.push({sp:m[1].trim(),tx:m[2].trim(),sure:true});continue}
    ln=ln.replace(/<[^>]+>/g,'').trim();if(!ln)continue;
    m=ln.match(SPK_LINE);
    if(m){pend=m[1].trim();continue}
    m=ln.match(SPK);
    if(m){rows.push({sp:m[1].trim(),tx:m[2].trim(),cand:true,orig:ln});pend=null;continue}
    if(pend){rows.push({sp:pend,tx:ln,sure:true});continue}
    rows.push({sp:null,tx:ln});
  }
  const cnt={};rows.forEach(r=>{if(r.cand)cnt[r.sp]=(cnt[r.sp]||0)+1});
  const turns=[];let curT=null;
  for(const r of rows){
    let sp=r.sp,tx=r.tx;
    if(r.cand&&cnt[sp]<2){sp=null;tx=r.orig}
    if(sp){if(curT&&curT.sp===sp)curT.text+=' '+tx;else{curT={sp,text:tx};turns.push(curT)}}
    else{if(curT)curT.text+=' '+tx;else{curT={sp:null,text:tx};turns.push(curT)}}
  }
  const people=[];turns.forEach(t=>{if(t.sp&&!people.includes(t.sp))people.push(t.sp)});
  return{turns,people};
}
function splitSentences(t){
  t=t.replace(/\s+/g,' ').trim();const out=[];
  t.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9"“'(\[])|;\s+/).forEach(p=>{
    p.split(/,\s*(?=(?:aí|ai|então|entao|depois|em seguida|na sequência|na sequencia|por fim)\s)/i).forEach(x=>{x=x.trim();if(x)out.push(x)});
  });return out;
}
function cleanSentence(s){
  s=s.replace(/^(?:(?:é|e|aí|ai|então|entao|bom|bem|olha|ah|eh|tá|ta|certo|ok|mas|só que|ou seja|na verdade|basicamente|tipo|assim|pois é|sim)[,]?\s+)+/i,'');
  // conectivos de sequência já viram setas no quadro: não precisam ficar no texto
  s=s.replace(/^(?:primeiro|primeiramente|depois|em seguida|na sequ[eê]ncia|por fim|finalmente)[,]?\s+(?=\S)/i,'');
  s=s.replace(/[,]?\s*\b(né|entendeu|sabe|tá|ok)\s*[?!.]*$/i,'');
  s=s.replace(/^se n[aã]o,?\s+/i,'Senão: ');
  s=s.replace(/\s+/g,' ').trim().replace(/[.,;:\s]+$/,'');
  return s.charAt(0).toUpperCase()+s.slice(1);
}
const RX={
  dec:/\b(decidimos|decidiu|decidido|decisao|ficou (?:definido|combinado|acordado|decidido)|combinado|combinamos|definimos|definido que|vamos (?:usar|adotar|seguir|fazer|manter|trazer|criar|separar|incluir|padronizar|centralizar|migrar|passar)|fica assim|a regra e|passa a ser|passaremos a|ficara assim|esta decidido|acordamos)\b/,
  pen:/\b(pendente|pendencia|pendencias|fica de|ficou de|vou (?:enviar|mandar|ver|checar|confirmar|agendar|marcar|alinhar|verificar|levantar|validar|olhar|passar|trazer)|vai (?:enviar|mandar|confirmar|validar|agendar|passar|trazer)|preciso (?:de|que|confirmar|validar|enviar)|precisamos (?:de|confirmar|validar|definir|alinhar|enviar)|falta (?:confirmar|definir|validar|fechar|enviar)|proximo passo|proximos passos|a confirmar|ate (?:segunda|terca|quarta|quinta|sexta|amanha|o dia|dia \d+)|nova (?:conversa|reuniao)|marcar (?:uma )?reuniao|me (?:envia|manda|passa)|te (?:envio|mando|passo|aviso))\b/,
  pain:/\b(problema|problemas|dor|dores|manual|manualmente|na mao|excel|planilha|erro|erros|errado|errada|dificuldade|dificil|nao (?:tem|temos|existe|consegue|conseguimos|sabemos|ha|integra|acessa|e possivel|ha como)|sem (?:controle|vinculo|padrao|integracao|visibilidade|rastreio|historico)|faltando|falta|gargalo|demora|demorado|retrabalho|risco|perdemos|incompleto|inconsisten\w*|duplicad\w*|lacuna|limitacao|desencontr\w*)\b/,
  want:/\b(queremos|quero|gostaria|gostariamos|precisamos ver|precisa ver|queria ver|quer ver|preciso enxergar|expectativa|necessidade|seria (?:bom|ideal|importante|interessante)|deveria|o objetivo e|a ideia e)\b/,
  rule:/\b(?:sempre|nunca|somente|so (?:vale|conta|entra|existe)|apenas|exceto|excecao|obrigatori\w*|regra|limite|minimo|maximo|prazo|carencia|vigencia|ate \d+|a partir (?:de|do|da))\b|\d+ (?:dias|horas|meses|vidas)|\d+%|r\$ ?\d+/,
  seq:/\b(primeiro|primeiramente|depois|em seguida|apos|quando|por fim|finalmente|na sequencia|passo|etapa|fluxo|processo|se (?:o|a|os|as|for|tiver|nao)|caso)\b/,
  verb:/\b(?:chega|entra|sai|vira|gera|envia|recebe|cria|abre|fecha|valida|aprova|classifica|registra|implanta|cadastra|encaminha|distribui|libera|emite|paga|cobra|digita|aciona|dispara|consulta|preenche|assina|contrata|vende|atende|analisa|calcula|atualiza|solicita|publica|carrega|ingere|extrai|importa|exporta|qualifica|precifica|confirma|cai|segue|passa|conta|processa|ativa)\w*/,
  skip:/^(?:pessoal|bom dia|boa tarde|boa noite|o objetivo hoje|hoje o objetivo|vamos comecar|obrigad|valeu|perfeito|otimo|beleza|combinado entao|ate mais|ate logo|tchau)/,
  sec:/^(?:agora\b|passando\b|sobre (?:o|a|os|as)\b|no caso d[oa]s?\b|ja no caso\b|outro (?:ponto|assunto|fluxo)\b|falando d[oa]s?\b|quanto (?:ao|a|aos|as)\b|em relacao (?:ao|a|aos|as)\b|para (?:o|a) (?:caso|fluxo|processo)\b)/
};
const STOP=new Set('para com uma uns umas por mais como mas foi sao tem ter ser esta estao isso essa esse aqui entao ainda tambem quando onde pelo pela pelos pelas sobre entre ate sem sua seu suas seus fica ficar vamos fazer feito cada todo toda todos todas nosso nossa nos eles elas ele ela quem qual quais depois antes durante muito pouco tudo nada algo alguem outro outra outros outras ficou vezes forma aquele aquela deles delas tambem nessa nesse'.split(' '));
const GL=/\b([A-Z][A-Z0-9]{2,}|\d{3,}[A-Z0-9]*)\s*(?:=|:|significa|é o|é a|é um|é uma|são)\s+([^.;\n]{3,80})/;
function sysRegex(list){
  const items=String(list||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!items.length)return null;return new RegExp('(?:^|[^\\p{L}\\d])(?:'+items.join('|')+')(?![\\p{L}\\d])','iu');
}
function wordSet(s){return new Set(norm(s).split(/[^a-z0-9]+/).filter(w=>w.length>3))}
function similar(a,b){let i=0;a.forEach(w=>{if(b.has(w))i++});const u=a.size+b.size-i;return u?i/u:0}
const STEPK=['step','sys','cond'];
function secTitleFrom(c){
  let t=c;for(let k=0;k<2;k++)t=t.replace(/^(?:agora (?:vamos (?:falar|ver) )?|passando (?:para|pra) |sobre |no caso d[oa]s? |já no caso d[oa]s? |outro (?:ponto|assunto|fluxo):? |falando d[oa]s? |quanto (?:ao|à|aos|às) |em relação (?:ao|à|aos|às) )(?:d[oa]s? |o |a |os |as )?/i,'');
  t=t.split(/[,:]| é | vamos | fica | tem | a gente /i)[0].trim().split(/\s+/).slice(0,5).join(' ');
  return t.length>=2&&t.length<50?t.charAt(0).toUpperCase()+t.slice(1):'';
}
function autoTitle(texts){
  const cnt={},orig={};
  texts.forEach(t=>{const seen=new Set();t.split(/[^\p{L}\d]+/u).forEach(w=>{const n=norm(w);if(n.length<5||STOP.has(n)||/^\d+$/.test(n)||seen.has(n))return;seen.add(n);cnt[n]=(cnt[n]||0)+1;if(!orig[n])orig[n]=w})});
  const top=Object.keys(cnt).filter(k=>cnt[k]>=2).sort((a,b)=>cnt[b]-cnt[a]).slice(0,2);
  if(!top.length)return '';
  return 'Fluxo · '+top.map(k=>{const w=orig[k];return w===w.toUpperCase()?w:w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()}).join(' e ');
}
function analyze(raw,o){
  const {turns,people}=parseTranscript(raw);const sysRx=sysRegex(o.systems);
  let items=[];let idx=0,sec=0,stepsInSec=0,newSec=false,nextTitle='';const titles={0:''};const gloss=[];
  for(const t of turns){
    for(const sn of splitSentences(t.text)){
      const orig=sn.trim();
      const gm=orig.match(GL);if(gm&&gloss.length<14&&!gloss.some(g=>g[0]===gm[1]))gloss.push([gm[1],shorten(gm[2].trim(),70)]);
      if(gm&&gm.index===0)continue; // definição de termo vai só para a tabela
      if(/\?\s*$/.test(orig))continue;
      const c=cleanSentence(orig);const words=c.split(/\s+/).length;const n=norm(c);
      if(words<3||RX.skip.test(n))continue;
      const hasSys=!!(sysRx&&sysRx.test(c));
      const seqHit=RX.seq.test(norm(orig)); // antes da limpeza, que tira "primeiro", "depois"…
      if(RX.sec.test(n)){newSec=true;nextTitle=secTitleFrom(c);if(words<=6&&!hasSys)continue}
      let kind;
      if(RX.dec.test(n))kind='dec';else if(RX.pen.test(n))kind='pen';else if(RX.pain.test(n))kind='pain';
      else if(RX.want.test(n))kind='want';
      else if(RX.rule.test(n)&&!seqHit)kind='rule';
      else kind=(seqHit||RX.verb.test(n)||hasSys)?(hasSys?'sys':'step'):'note';
      const score=(words>=6&&words<=30?1:0)+(seqHit?2:0)+(RX.verb.test(n)?1:0)+(hasSys?2:0)+(kind==='dec'||kind==='pen'?2:0)+(kind==='pain'||kind==='rule'||kind==='want'?1:0);
      if(STEPK.includes(kind)||kind==='note'){
        if(newSec&&stepsInSec>=1){sec++;stepsInSec=0;titles[sec]=nextTitle}
        else if(newSec&&nextTitle&&!titles[sec])titles[sec]=nextTitle;
        newSec=false;nextTitle='';stepsInSec++;
      }
      items.push({i:idx++,sp:t.sp,text:c,kind,score,ws:wordSet(c),sec});
    }
  }
  const pick=(kinds,limit)=>{
    const pool=items.filter(x=>kinds.includes(x.kind)).sort((a,b)=>b.score-a.score||a.i-b.i);const chosen=[];
    for(const x of pool){if(chosen.length>=limit)break;if(chosen.some(c=>similar(c.ws,x.ws)>.6))continue;chosen.push(x)}
    return chosen;
  };
  const D=o.detail;
  let steps=pick(['step','sys'],D);
  if(steps.length<3){const extra=pick(['note'],D-steps.length).filter(x=>x.score>=1||steps.length<2);extra.forEach(x=>x.kind='step');steps=steps.concat(extra)}
  let chosen=steps;
  if(o.panels)chosen=chosen.concat(pick(['pain'],Math.ceil(D/2)),pick(['dec'],Math.ceil(D/2)),pick(['pen'],Math.ceil(D*.6)),pick(['rule'],Math.ceil(D*.5)),pick(['want'],Math.ceil(D*.4)));
  chosen.sort((a,b)=>a.i-b.i);
  // "Se X, Y" vira losango + consequência
  const out=[];
  chosen.forEach(it=>{
    if((it.kind==='step'||it.kind==='sys')&&/^se\s+(?!n[aã]o\b)/i.test(it.text)&&it.text.indexOf(',')>0){
      const k=it.text.indexOf(',');const q=it.text.slice(0,k).replace(/^se\s+/i,'');
      out.push(Object.assign({},it,{kind:'cond',text:shorten(q.charAt(0).toUpperCase()+q.slice(1)+'?',90)}));
      const rest=cleanSentence(it.text.slice(k+1));
      if(rest.length>3)out.push(Object.assign({},it,{kind:(sysRx&&sysRx.test(rest))?'sys':'step',text:shorten(rest)}));
    }else out.push(Object.assign({},it,{text:shorten(it.text,it.kind==='rule'?160:130)}));
  });
  items=out;
  refineSections(items);
  // renumera por ordem de aparição
  const orderIds=[];items.forEach(it=>{if(STEPK.includes(it.kind)&&!orderIds.includes(it.sec))orderIds.push(it.sec)});
  const secs=orderIds.map(id=>({title:titles[id]||''}));
  items.forEach(it=>{it.sec=Math.max(0,orderIds.indexOf(it.sec))});
  secs.forEach((s,k)=>{if(!s.title){s.title=secs.length===1?'Fluxo do processo':(autoTitle(items.filter(x=>STEPK.includes(x.kind)&&x.sec===k).map(x=>x.text))||'Fluxo '+(k+1))}});
  if(!secs.length)secs.push({title:'Fluxo do processo'});
  const date=(String(raw).slice(0,600).match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)||[])[0]||'';
  return{people,date,items,secs,gloss:gloss.length>=2?gloss:[]};
}
function refineSections(items){
  let guard=0,changed=true;
  while(changed&&guard++<20){
    changed=false;const by={};
    items.forEach(it=>{if(STEPK.includes(it.kind))(by[it.sec]=by[it.sec]||[]).push(it)});
    for(const s in by){const L=by[s];if(L.length>12){
      let best=-1,bv=2;
      for(let k=4;k<=L.length-4;k++){const a=new Set(),b=new Set();L.slice(Math.max(0,k-3),k).forEach(x=>x.ws.forEach(w=>a.add(w)));L.slice(k,k+3).forEach(x=>x.ws.forEach(w=>b.add(w)));const sim=similar(a,b);if(sim<bv){bv=sim;best=k}}
      if(best<0)best=Math.floor(L.length/2);
      const nid=Math.max(...items.map(x=>x.sec))+1;
      L.slice(best).forEach(x=>x.sec=nid);changed=true;break;
    }}
  }
}
/* ---------- spec ---------- */
function buildEdges(nodes){
  const edges=[];let pending=[],cond=null,keep=false;
  nodes.forEach(n=>{
    if(n.alt&&cond){edges.push({from:cond.id,to:n.id,label:'não'});pending.push({id:n.id,label:''});cond=null;keep=false;return}
    pending.forEach(p=>edges.push({from:p.id,to:n.id,label:p.label}));
    if(n.kind==='cond'){cond=n;keep=true;pending=[{id:n.id,label:'sim'}]}
    else{pending=[{id:n.id,label:''}];if(keep)keep=false;else cond=null}
  });
  return edges;
}
const PANEL_DEF={pain:{t:'Dores e lacunas',color:'peach'},dec:{t:'Decisões',color:'green'},pen:{t:'Pendências e próximos passos',color:'white'},rule:{t:'Regras e números citados',color:'white'},want:{t:'O que precisam ver',color:'green'}};
function specFromRows(rows,secs,meta,o){
  const flows=secs.map(()=>({title:'',nodes:[]}));const pb={pain:[],dec:[],pen:[],rule:[],want:[]};
  rows.forEach(r=>{
    if(STEPK.includes(r.kind)){
      const f=flows[Math.min(r.sec,flows.length-1)];const alt=/^Senão:/i.test(r.text);
      let text=r.text.replace(/^Senão:\s*/i,'');text=text.charAt(0).toUpperCase()+text.slice(1);
      if(r.kind==='cond'&&!/\?$/.test(text))text+='?';
      f.nodes.push({id:'s'+(f.nodes.length+1),text,kind:r.kind,lane:r.sp,alt});
    }else if(pb[r.kind])pb[r.kind].push(r.text);
  });
  const live=[];
  flows.forEach((f,i)=>{if(!f.nodes.length)return;f.edges=buildEdges(f.nodes);f.title=(secs[i]&&secs[i].title)||'';live.push(f)});
  live.forEach((f,i)=>{if(!f.title)f.title=live.length===1?'Fluxo do processo':(autoTitle(f.nodes.map(n=>n.text))||'Fluxo '+(i+1))});
  const panels=Object.keys(PANEL_DEF).filter(k=>pb[k].length).map(k=>({t:PANEL_DEF[k].t,color:PANEL_DEF[k].color,items:pb[k]}));
  const tables=meta.gloss&&meta.gloss.length>=2?[{title:'Termos e códigos citados',cols:['Termo','Significado'],rows:meta.gloss}]:[];
  return{title:meta.title,date:meta.date,people:meta.people,flows:live,panels,tables};
}
function specFromJson(j){
  const g=(o,...ks)=>{for(const k of ks)if(o&&o[k]!=null)return o[k]};
  const mapKind=k=>/sist|system/i.test(k||'')?'sys':/cond|decis|decision/i.test(k||'')?'cond':'step';
  const arr=v=>(Array.isArray(v)?v:[]).map(x=>typeof x==='string'?x:String(g(x,'texto','text')||''));
  const parseFlow=(f,fi)=>{
    const st=g(f,'etapas','steps','nodes')||[];
    const nodes=st.map((s,i)=>typeof s==='string'?{id:'s'+(i+1),text:s,kind:'step',lane:null}:{id:String(g(s,'id')!=null?g(s,'id'):'s'+(i+1)),text:String(g(s,'texto','text','label')||''),kind:mapKind(g(s,'tipo','type','kind')),lane:g(s,'raia','lane')||null});
    let edges=(g(f,'ligacoes','links','edges')||[]).map(e=>({from:String(g(e,'de','from')),to:String(g(e,'para','to')),label:String(g(e,'rotulo','label')||'')}));
    if(!edges.length)for(let i=0;i<nodes.length-1;i++)edges.push({from:nodes[i].id,to:nodes[i+1].id,label:''});
    return{title:String(g(f,'titulo','title')||(fi?'Fluxo '+(fi+1):'Fluxo do processo')),nodes,edges};
  };
  let flows=(g(j,'fluxos','flows')||[]).map(parseFlow);
  if(!flows.length&&(g(j,'etapas','steps','nodes')||[]).length)flows=[parseFlow(j,0)];
  flows=flows.filter(f=>f.nodes.length);
  const tmap={dor:'pain',dores:'pain',pain:'pain',decisao:'dec',decisoes:'dec',decision:'dec',pendencia:'pen',pendencias:'pen',pending:'pen',regra:'rule',regras:'rule',rule:'rule',desejo:'want',necessidade:'want',want:'want'};
  const panels=[];
  (g(j,'quadros','panels')||[]).forEach(q=>{const k=tmap[norm(String(g(q,'tipo','type')||''))]||'rule';const items=arr(g(q,'itens','items'));if(items.length)panels.push({t:String(g(q,'titulo','title')||PANEL_DEF[k].t),color:PANEL_DEF[k].color,items})});
  [['dores','pain'],['pains','pain'],['decisoes','dec'],['decisions','dec'],['pendencias','pen'],['action_items','pen'],['regras','rule'],['rules','rule']].forEach(([key,k])=>{const items=arr(g(j,key));if(items.length&&!panels.some(p=>p.t===PANEL_DEF[k].t))panels.push({t:PANEL_DEF[k].t,color:PANEL_DEF[k].color,items})});
  const tables=(g(j,'tabelas','tables')||[]).map(t=>({title:String(g(t,'titulo','title')||'Tabela'),cols:(g(t,'colunas','cols')||[]).map(String),rows:(g(t,'linhas','rows')||[]).map(r=>r.map(String))})).filter(t=>t.cols.length&&t.rows.length);
  const people=(g(j,'participantes','participants')||[]).map(p=>typeof p==='string'?p:String(g(p,'nome','name')||''));
  return{title:g(j,'titulo','title')||'',summary:g(j,'resumo','summary')||'',date:g(j,'data','date')||'',people,flows,panels,tables};
}
function buildPrompt(raw){
  raw=String(raw||'').trim();if(raw.length>120000)raw=raw.slice(0,120000)+'\n[transcrição cortada]';
  return `Você é um analista de processos sênior. Leia a transcrição de reunião abaixo e organize as ideias em fluxos conectados, no estilo de um quadro de processos. Responda APENAS com um JSON válido (sem texto antes ou depois, sem comentários), exatamente neste formato:

{
  "titulo": "título curto da reunião ou do processo",
  "resumo": "conclusão principal em até 10 palavras",
  "data": "dd/mm/aaaa ou vazio",
  "participantes": ["Nome (papel)"],
  "fluxos": [
    {
      "titulo": "nome do fluxo ou do assunto (um fluxo por processo ou tema distinto)",
      "etapas": [
        {"id": "s1", "texto": "até 15 palavras, verbo no presente", "tipo": "etapa | sistema | condicao", "raia": "quem executa (pessoa, área ou sistema)"}
      ],
      "ligacoes": [
        {"de": "s1", "para": "s2", "rotulo": "opcional: sim / não"}
      ]
    }
  ],
  "quadros": [
    {"titulo": "Dores e lacunas", "tipo": "dor", "itens": ["..."]},
    {"titulo": "Decisões", "tipo": "decisao", "itens": ["..."]},
    {"titulo": "Pendências e próximos passos", "tipo": "pendencia", "itens": ["responsável: ação (prazo)"]},
    {"titulo": "Regras e números citados", "tipo": "regra", "itens": ["..."]},
    {"titulo": "O que precisam ver", "tipo": "necessidade", "itens": ["..."]}
  ],
  "tabelas": [
    {"titulo": "nome da tabela", "colunas": ["Código", "Significado"], "linhas": [["...", "..."]]}
  ]
}

Regras:
- Ordene as etapas na ordem em que o processo acontece, não na ordem da conversa. Separe assuntos diferentes em fluxos diferentes (no máximo 12 etapas por fluxo).
- tipo "sistema" = etapa feita em ou por um sistema; "condicao" = pergunta de decisão terminada em "?", com duas ligações de saída rotuladas "sim" e "não".
- Use "ligacoes" para mostrar ramificações e junções, não só sequência linear.
- Preserve nomes, códigos, números e datas exatamente como foram ditos. Não invente nada que não esteja na transcrição.
- Dores, decisões, pendências, regras e necessidades vão em "quadros" (omita quadros vazios); listas de códigos, valores e prazos vão em "tabelas".
- Textos curtos, sem pontuação final.

TRANSCRIÇÃO:
${raw||'[cole aqui a transcrição]'}`;
}

const api={version:'@VERSION@',norm,shorten,parseTranscript,splitSentences,cleanSentence,analyze,buildEdges,specFromRows,specFromJson,buildPrompt,autoTitle,STEPK,PANEL_DEF};
root.FluxoorgEngine=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
