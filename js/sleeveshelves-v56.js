/* SleeveShelves V56: collection-first modal composition.
   Reuses the actual V45.3 record nodes and handlers. No data layer changes. */
(()=>{
 'use strict';
 const $=(s,c=document)=>c.querySelector(s);
 const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
 const app=$('#ssApp'), detail=$('#ssDetail'), overlay=$('#detOv'), modal=$('#detModal');
 const top=$('.m-top',modal), stage=$('#ssTurntableStage'), trackSection=$('#ssV50Tracks');
 const tabs=$('.ss-v50-tabs',modal), body=$('.m-body',modal), meta=$('.ss-record-meta',modal);
 if(!app||!detail||!overlay||!modal||!top||!stage||!tabs||!body||!trackSection) return;
 document.body.classList.add('ss56-modal-app');
 // Restore true dialog semantics, replaced by V46's docked-region experiment.
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','mAlbum');
 detail.setAttribute('aria-label','Record detail dialog');
 const layout=document.createElement('div');layout.className='ss56-content';
 const left=document.createElement('section');left.className='ss56-visual';left.setAttribute('aria-label','Sleeve and turntable');
 const right=document.createElement('section');right.className='ss56-information';right.setAttribute('aria-label','Record information');
 layout.append(left,right);top.insertAdjacentElement('afterend',layout);
 left.append(stage);
 const footer=document.createElement('div');footer.className='ss56-left-footer';
 if(meta)footer.append(meta);
 left.append(footer);
 right.append(tabs,trackSection,body);
 // Native current-record actions are populated by openModal(), keep original click.
 const edit=document.createElement('button');edit.type='button';edit.className='ss56-edit';
 edit.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg><span>Edit</span>';
 edit.setAttribute('aria-label','Edit selected record');
 edit.addEventListener('click',()=>$('#mActions .btn-sm.ed')?.click());
 top.append(edit);
 const favorite=document.createElement('button');favorite.type='button';favorite.className='ss56-favorite';
 favorite.setAttribute('aria-label','Toggle favorite record');favorite.setAttribute('title','Favorite record');favorite.textContent='♡';
 favorite.addEventListener('click',()=>$('#mStateBox .m-rate-btn.favorite')?.click());top.append(favorite);
 const stateBox=$('#mStateBox');
 function syncFavorite(){
  const active=!!stateBox?.querySelector('.m-rate-btn.favorite.on');
  favorite.textContent=active?'♥':'♡';favorite.setAttribute('aria-pressed',String(active));
 }
 if(stateBox)new MutationObserver(syncFavorite).observe(stateBox,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 syncFavorite();
 const close=$('#mClose');if(close) close.title='Close record and return to collection';
 // Add the missing Tracks tab, reusing the real V50 tracklist.
 const tracksTab=document.createElement('button');tracksTab.type='button';tracksTab.id='ssTabtracks';tracksTab.dataset.ssTab='tracks';
 tracksTab.textContent='Tracks';tracksTab.setAttribute('role','tab');tracksTab.setAttribute('aria-controls','ssV50Tracks');tracksTab.setAttribute('aria-selected','true');tracksTab.tabIndex=0;
 tabs.prepend(tracksTab);
 trackSection.setAttribute('role','tabpanel');trackSection.setAttribute('aria-labelledby','ssTabtracks');
 let active='tracks';
 function selectTracks(){
  active='tracks';trackSection.hidden=false;body.hidden=true;
  $$('[role="tab"]',tabs).forEach(b=>{const on=b===tracksTab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 }
 function selectOther(name){
  active=name;trackSection.hidden=true;body.hidden=false;tracksTab.setAttribute('aria-selected','false');tracksTab.tabIndex=-1;
 }
 tracksTab.addEventListener('click',selectTracks);
 tabs.addEventListener('click',e=>{
  const btn=e.target.closest('[role="tab"]');if(!btn||btn===tracksTab)return;
  // Existing V50 handler has already switched its real tab panel by bubbling here.
  selectOther(btn.dataset.ssTab||'details');
 });
 // Capture keyboard navigation so the newly inserted tab participates in the cycle.
 tabs.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.stopImmediatePropagation();e.preventDefault();
  const bs=$$('[role="tab"]',tabs);const i=Math.max(0,bs.findIndex(b=>b.getAttribute('aria-selected')==='true'));
  const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
  bs[next].click();bs[next].focus();
 },true);
 // User approved a functional edit state, not a second editor implementation.
 // Keep the original Supabase-native form, but visually align it with the modal.
 const notePanel=$('#ssPanelnotes'), note=$('#mNote');
 if(notePanel){
  const addNote=document.createElement('button');addNote.type='button';addNote.className='ss56-quiet-action';addNote.textContent='Edit personal note';
  addNote.addEventListener('click',()=>$('#mActions .btn-sm.ed')?.click());
  notePanel.append(addNote);
 }
 const listenPanel=$('#ssPanellistening');
 if(listenPanel){
  const note=document.createElement('p');note.className='ss56-diary-help';note.textContent='Listening status and your latest listen, saved with this record.';
  listenPanel.prepend(note);
 }
 const detailsPanel=$('#ssPaneldetails');
 if(detailsPanel){
  const heading=document.createElement('h3');heading.className='ss56-subheading';heading.textContent='Release information';detailsPanel.prepend(heading);
 }
 const colPanel=$('#ssPanelcollections');
 if(colPanel){
  const h=document.createElement('h3');h.className='ss56-subheading';h.textContent='Your collection labels';colPanel.prepend(h);
 }
 // Bring back visual album metadata beneath the subtitle using original chips.
 function sync(){
  const open=overlay.classList.contains('on');
  document.body.classList.toggle('ss56-record-open',open);
  if(open){
   app.classList.remove('ss-detail-min');
   // Reset tab on a newly opened record. Playback for another record persists.
   const key=($('#mCode')?.textContent||'')+'|'+($('#mAlbum')?.textContent||'');
   if(key!==modal.dataset.ss56Record){modal.dataset.ss56Record=key;selectTracks();}
  }
 }
 new MutationObserver(sync).observe(overlay,{attributes:true,attributeFilter:['class']});
 for(const id of ['mAlbum','mCode']){const n=$('#'+id);if(n)new MutationObserver(sync).observe(n,{childList:true});}
 overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)window.closeModal?.();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('on')&&!$('.f-ov.on,.s-ov.on'))window.closeModal?.();});
 // Keep the real native editor, but organize its existing fields into
 // focused sections rather than stacking yet another form over the record.
 const form=$('#formModal'),formBody=$('#formModal .f-body'),formOverlay=$('#fOv');
 if(form&&formBody){
   const sections=[['basic','Basic'],['tracks','Tracks'],['images','Images'],['collections','Collections'],['notes','Notes']];
   const nav=document.createElement('nav');nav.className='ss56-editor-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Edit record sections');
   const paneHost=document.createElement('div');paneHost.className='ss56-editor-pages';
   const panes={};
   sections.forEach(([key,label])=>{
     const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.dataset.section=key;
     btn.id='ss56EditTab'+key;btn.setAttribute('role','tab');btn.setAttribute('aria-controls','ss56EditPane'+key);
     nav.append(btn);
     const pane=document.createElement('section');pane.className='ss56-editor-pane';pane.id='ss56EditPane'+key;
     pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',btn.id);pane.hidden=key!=='basic';
     panes[key]=pane;paneHost.append(pane);
   });
   const original=Array.from(formBody.children);
   original.forEach(node=>{
     let key='basic';
     if(node.matches('.f-track-editor,.f-sync-warn')||node.querySelector('#fTrackGrid'))key='tracks';
     else if(node.querySelector('#fldImg'))key='images';
     else if(node.querySelector('#fldCollections'))key='collections';
     else if(node.querySelector('#fldNote'))key='notes';
     panes[key].append(node);
   });
   formBody.append(paneHost);formBody.insertAdjacentElement('beforebegin',nav);
   function selectEditorTab(name){
     for(const [key] of sections){
       const chosen=key===name,btn=$('#ss56EditTab'+key);
       panes[key].hidden=!chosen;btn.setAttribute('aria-selected',String(chosen));btn.tabIndex=chosen?0:-1;
     }
     formBody.scrollTop=0;
   }
   nav.addEventListener('click',e=>{const btn=e.target.closest('[data-section]');if(btn)selectEditorTab(btn.dataset.section)});
   nav.addEventListener('keydown',e=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
     const bs=$$('button',nav),i=Math.max(0,bs.findIndex(b=>b.getAttribute('aria-selected')==='true'));
     const j=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
     bs[j].click();bs[j].focus();
   });
   selectEditorTab('basic');
   if(formOverlay)new MutationObserver(()=>{if(formOverlay.classList.contains('on'))selectEditorTab('basic')}).observe(formOverlay,{attributes:true,attributeFilter:['class']});
 }
 // Simple focus containment for the record modal. Editor and Settings own
 // their own dialogs and are intentionally not trapped by this handler.
 document.addEventListener('keydown',e=>{
   if(e.key!=='Tab'||!overlay.classList.contains('on')||$('.f-ov.on,.s-ov.on'))return;
   const visible=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])',modal)
     .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
   if(!visible.length)return;
   const first=visible[0],last=visible[visible.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal)){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modal)){e.preventDefault();first.focus()}
 });
 // Open/close should not affect collection scroll position.
 sync();
})();
