/* SleeveShelves V48: presentation-only composition of existing native controls.
   No synthetic record store, no listener/data reset, no Supabase writes. */
(() => {
 'use strict';
 const $=(sel,scope=document)=>scope.querySelector(sel);
 const $$=(sel,scope=document)=>Array.from(scope.querySelectorAll(sel));
 const app=$('#ssApp'),header=$('#hdr'),main=$('#mainArea'),detail=$('#detModal');
 if(!app||!header||!main||!detail)return;
 // The reference places navigation and grid actions ahead of search.
 const h1=$('#hdr .h1');
 if(h1){
  const actions=document.createElement('div');actions.className='ss-toolbar-leading';
  const collapse=document.createElement('button');collapse.type='button';collapse.className='ss-leading-btn';collapse.title='Toggle navigation';collapse.setAttribute('aria-label','Toggle navigation');collapse.textContent='☰';collapse.addEventListener('click',()=>$('#ssCollapseNav')?.click());
  const grid=document.createElement('button');grid.type='button';grid.className='ss-leading-btn';grid.title='Grid view';grid.setAttribute('aria-label','Grid view');grid.innerHTML='▦';grid.addEventListener('click',()=>$('#btnGrid')?.click());
  actions.append(collapse,grid);h1.prepend(actions);
 }

 // Reference collection shortcuts. Real group/filter engines own every state change.
 const modes=[['all','All'],['artist','Artists'],['alpha','Albums'],['genre','Genres'],['decade','Years'],['grail','Grails']];
 const group=$('#groupSelect');
 const bar=document.createElement('nav');
 bar.className='ss-browse-bar';bar.setAttribute('aria-label','Explore your collection');
 for(const [id,label] of modes){
  const button=document.createElement('button');button.type='button';button.className='ss-browse-btn';button.textContent=label;
  button.dataset.mode=id;button.setAttribute('aria-pressed',id==='all'?'true':'false');
  button.addEventListener('click',()=>{
   if(id==='grail'){
    $('#btnClr')?.click();const el=$('#fGrail');if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));}
   }else{
    if($('#fGrail')?.checked){$('#fGrail').checked=false;$('#fGrail').dispatchEvent(new Event('change',{bubbles:true}));}
    if(group){group.value=id==='all'?'shelf':id;group.dispatchEvent(new Event('change',{bubbles:true}));}
   }
   selectMode(id);
  });
  bar.append(button);
 }
 const counter=document.createElement('span');counter.className='ss-browse-count';counter.setAttribute('aria-live','polite');bar.append(counter);
 header.insertAdjacentElement('afterend',bar);
 function selectMode(id){for(const btn of $$('.ss-browse-btn',bar)){const on=btn.dataset.mode===id;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',String(on));}}
 selectMode('all');
 function updateCount(){const value=$('#countPill strong')?.textContent?.trim() || $('#ssAllCount')?.textContent?.trim();if(value)counter.textContent=value+' records';}
 const countNode=$('#countPill strong');
 if(countNode)new MutationObserver(updateCount).observe(countNode,{childList:true,characterData:true,subtree:true});
 updateCount();
 group?.addEventListener('change',()=>{if(!$('#fGrail')?.checked)selectMode(group.value==='shelf'?'all':group.value)});
 // Keep the real editor's existing handler; move the very same button node.
 const originalActions=$('#mActions');
 const editHost=document.createElement('div');editHost.className='ss-detail-edit-host';
 if(originalActions){editHost.append(originalActions);detail.append(editHost)}
 // V50: screen hierarchy is header -> sleeve/turntable hero -> tracklist
 // -> information tabs -> selected content. Re-use native nodes/handlers.
 const modalBody=$('.m-body',detail),originalMain=$('.m-main',detail),originalSide=$('.m-side',detail);
 const tl=$('#mTl'),wiki=$('#mWiki'),styles=$('#mStyles'),links=$('#mLinks'),force=$('#mForce'),note=$('#mNote'),collections=$('#mCollectionBox'),status=$('#mStateBox'),shelfCode=$('#mCode');
 const stage=$('#ssTurntableStage'),top=$('.m-top',detail),meta=$('.ss-record-meta',detail);
 if(!modalBody||!originalMain||!tl||!stage||!top)return;
 // Hero is a real media region shared between sleeve and working turntable.
 // Moving the existing stage keeps the playback code and listeners connected.
 (meta || top).insertAdjacentElement('afterend',stage);
 stage.setAttribute('aria-label','Album sleeve or active turntable');
 const trackSection=document.createElement('section');
 trackSection.id='ssV50Tracks';trackSection.className='ss-v50-track-section';
 trackSection.setAttribute('aria-label','Physical record tracklist');
 trackSection.innerHTML='<div class="ss-v50-track-heading"><strong>TRACKLIST</strong><span id="ssV50TrackSide"></span></div>';
 trackSection.append(tl);
 stage.insertAdjacentElement('afterend',trackSection);
 const tabs=document.createElement('nav');tabs.className='ss-detail-tabs ss-v50-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Record information');
 const panels={};
 const list=[['details','Details'],['notes','Notes'],['listening','Listening'],['collections','Collection'],['more','More']];
 const host=document.createElement('div');host.className='ss-tab-host';
 for(const [key,label] of list){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.ssTab=key;
   b.id='ssTab'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls','ssPanel'+key);
   b.setAttribute('aria-selected',key==='details'?'true':'false');b.tabIndex=key==='details'?0:-1;
   b.addEventListener('click',()=>activateTab(key));tabs.append(b);
   const panel=document.createElement('div');panel.className='ss-tab-section';panel.id='ssPanel'+key;
   panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);panel.hidden=key!=='details';
   panels[key]=panel;host.append(panel);
 }
 for(const node of [shelfCode,wiki,styles,links,force])if(node)panels.details.append(node);
 if(note)panels.notes.append(note);
 if(status)panels.listening.append(status);
 if(collections)panels.collections.append(collections);
 if(originalSide)panels.more.append(originalSide);
 const origHeading=originalMain.querySelector('.sec-lbl');
 if(origHeading){origHeading.classList.add('sr-only');panels.details.prepend(origHeading);}
 // Existing native controls are moved, never copied.
 originalMain.append(host);
 trackSection.insertAdjacentElement('afterend',tabs);
 tabs.insertAdjacentElement('afterend',modalBody);
 function activateTab(key){
   for(const [name] of list){
     const active=name===key,b=$('#ssTab'+name);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;panels[name].hidden=!active;
   }
   if(key==='notes'&&note)note.style.display='block';
 }
 tabs.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const bs=$$('[role="tab"]',tabs),i=bs.findIndex(b=>b.getAttribute('aria-selected')==='true');
   const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
   bs[next].click();bs[next].focus();
 });
 // Keep all details, including the physical-listened toggle, accessible.
 // V45.3 does not have a full session diary UI, so this tab is "Listening".
 const code=$('#mCode');
 function syncGrail(){
   const grail=detail.classList.contains('grail-detail');
   $('#ssDetail')?.classList.toggle('ss-v50-grail',grail);
 }
 const grailObserver=new MutationObserver(syncGrail);
 grailObserver.observe(detail,{attributes:true,attributeFilter:['class']});syncGrail();
 // Refresh the stage whenever existing record details or artwork changes,
 // without mutating database state or creating a render loop.
 const watch=$('#mCover');
 if(watch)new MutationObserver(()=>window.DW_TURNTABLE_V45?.refresh?.()).observe(watch,{childList:true,subtree:false});
 window.addEventListener('sleeveshelves:render',updateCount);
})();
