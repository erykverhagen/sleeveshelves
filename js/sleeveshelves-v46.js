/* SleeveShelves V46 layout integration. No own database, no synthetic records.
   Native render/auth/filter/event logic is retained in deadwax-native-exact-v43.js. */
(() => {
 'use strict';
 const $=(s,ctx=document)=>ctx.querySelector(s);
 const $$=(s,ctx=document)=>Array.from(ctx.querySelectorAll(s));
 const app=$('#ssApp'), detail=$('#ssDetail'), overlay=$('#detOv'), modal=$('#detModal');
 if(!app||!detail||!overlay||!window.DW_NATIVE)return;
 const api=window.DW_NATIVE;
 const navList=$('#ssNavCollections');
 const main=$('#mainArea');
 let lastCollection='', lastNav='all', lastRecord='', drawing=false;
 const escaped=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Move existing, fully functional Settings/Sign out menu to the lower-left.
 const menu=$('#userMenuWrap');
 if(menu)$('#ssProfileSlot').append(menu);
 // Move original edit/remove actions visually over the record cover without changing handlers.
 const actions=$('#mActions');
 if(actions)$('#detModal .m-cover-stack')?.append(actions);
 // V46.1: detach metadata from the compressed modal header. Move the SAME
 // native nodes (and their original handlers), never clone/re-render them.
 const recordTop=$('#detModal .m-top');
 if(recordTop && !$('#ssRecordMeta')){
  const meta=document.createElement('div');
  meta.className='ss-record-meta';meta.id='ssRecordMeta';
  meta.setAttribute('aria-label','Record details and collection status');
  for(const id of ['mStateBox','mChips','mCollectionBox']){
   const field=$('#'+id);if(field)meta.appendChild(field);
  }
  recordTop.insertAdjacentElement('afterend',meta);
 }
 // Show the original physical tracklist before the About text. Reparent,
 // do not clone: all V45.3 event handlers and Supabase bindings remain intact.
 const mainDetail=$('#detModal .m-main'), nativeTracks=$('#detModal #mTl');
 if(mainDetail && nativeTracks) mainDetail.insertBefore(nativeTracks,mainDetail.firstChild);
 // The right-side detail is a persistent region, not an aria-modal overlay.
 modal?.setAttribute('aria-modal','false');
 modal?.setAttribute('role','region');
 function restoreScroll(pos){ if(pos!=null && main)main.scrollTop=pos; }
 function setSelected(navKey){
  lastNav=navKey;
  $$('.ss-nav-item[data-ss-nav]').forEach(btn=>{const selected=btn.dataset.ssNav===navKey;btn.classList.toggle('is-active',selected);btn.setAttribute('aria-current',selected?'page':'false');});
 }
 function saveNavPreference(min){try{sessionStorage.setItem('ss46_nav_min',min?'1':'0');}catch{}}
 function setNavMin(min){app.classList.toggle('ss-nav-min',min);$('#ssCollapseNav').textContent=min?'››':'‹‹';$('#ssCollapseNav').setAttribute('aria-label',min?'Expand navigation':'Collapse navigation');$('#ssCollapseNav').setAttribute('aria-expanded',String(!min));saveNavPreference(min)}
 $('#ssCollapseNav')?.addEventListener('click',()=>setNavMin(!app.classList.contains('ss-nav-min')));
 try{const saved=sessionStorage.getItem('ss46_nav_min');setNavMin(saved===null?window.innerWidth<=1190:saved==='1');}catch{setNavMin(window.innerWidth<=1190)}
 function resetFilters(){ $('#btnClr')?.click(); }
 function navigate(k){
  if(k==='discover'){window.randomize?.();return;}
  resetFilters();
  if(k==='listened'){$('#fListened').checked=true;$('#fListened').dispatchEvent(new Event('change',{bubbles:true}));}
  else if(k==='favorites'){$('#fRating').value='favorite';$('#fRating').dispatchEvent(new Event('change',{bubbles:true}));}
  else if(k==='grails'){$('#fGrail').checked=true;$('#fGrail').dispatchEvent(new Event('change',{bubbles:true}));}
  else if(k.startsWith('collection:')){api.setCollectionFilter?.(k.slice(11));}
  setSelected(k);renderNav();main?.scrollTo({top:0});
 }
 $$('.ss-nav-item[data-ss-nav]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.ssNav)));
 $('#ssBrandHome')?.addEventListener('click',()=>navigate('all'));
 $('#ssPickRandom')?.addEventListener('click',()=>window.randomize?.());
 $('#ssAddCollection')?.addEventListener('click',()=>{window.openSett?.();window.showUserTab?.('collections')});
 navList?.addEventListener('click',e=>{const btn=e.target.closest('[data-ss-collection]');if(btn)navigate('collection:'+btn.dataset.ssCollection)});
 function renderNav(){
  const data=api.getNavigationData?.(); if(!data)return;
  $('#ssAllCount').textContent=String(data.total||0);
  const list=data.collections||[];
  const html=list.map(c=>`<button type="button" data-ss-collection="${escaped(c.id)}" class="ss-nav-item ss-collection-item ${lastNav==='collection:'+c.id?'is-active':''}" title="${escaped(c.name)}"><span class="ss-nav-ico">▥</span><span class="ss-nav-name">${escaped(c.name)}</span><span class="ss-nav-count">${c.count}</span></button>`).join('');
  if(navList && navList.innerHTML!==html)navList.innerHTML=html||'<div class="ss-empty-collections">Make this archive your own.<br>Create your first collection.</div>';
  const heading=$('#ssVisibleHeading');
  if(heading){
   const selected=list.find(c=>lastNav==='collection:'+c.id);
   heading.textContent=selected?.name||(lastNav==='favorites'?'Favorites':lastNav==='listened'?'Listened records':lastNav==='grails'?'Grail records':'Your collection');
  }
 }
 function syncRecordPanel(){
  const opened=overlay.classList.contains('on');
  const code=$('#mCode')?.textContent?.trim()||'';
  const album=$('#mAlbum')?.textContent?.trim()||'';
  const artist=$('#mArtist')?.textContent?.trim()||'';
  app.classList.toggle('ss-has-detail',opened);
  if(!opened){app.classList.remove('ss-detail-min');lastRecord='';return;}
  const key=[code,album,artist].join('|');
  if(lastRecord && lastRecord!==key)app.classList.remove('ss-detail-min');
  lastRecord=key;
  $('#ssFloatingAlbum').textContent=album||'Record details';
  $('#ssFloatingArtist').textContent=artist;
  const slot=$('.ss-floating-cover'),cover=$('#mCover img');
  if(slot){
   const current=slot.querySelector('img');
   if(cover?.src && current?.src!==cover.src){slot.replaceChildren(cover.cloneNode(false));}
   else if(!cover)slot.replaceChildren();
  }
  // Keep the original main/workspace independent from the selected detail scroll.
  document.body.classList.remove('dw-modal-open');
 }
 $('#ssMinimizeDetail')?.addEventListener('click',()=>{ if(overlay.classList.contains('on'))app.classList.add('ss-detail-min'); });
 $('#ssRestoreDetail')?.addEventListener('click',()=>{app.classList.remove('ss-detail-min');modal?.focus({preventScroll:true})});
 // Native code modifies the class and panel content in place. Observe, never rebuild them.
 const observer=new MutationObserver(()=>{if(drawing)return;drawing=true;queueMicrotask(()=>{drawing=false;syncRecordPanel()})});
 observer.observe(overlay,{attributes:true,attributeFilter:['class']});
 const albumObserver=new MutationObserver(()=>syncRecordPanel());
 for(const id of ['mAlbum','mArtist','mCode','mCover']){const node=$('#'+id);if(node)albumObserver.observe(node,{childList:true,subtree:id==='mCover'});}
 // Native filters / view mode produce an event, but the original handlers stay in control.
 window.addEventListener('sleeveshelves:render',renderNav);
 const collectionManager=$('#collectionList');
 if(collectionManager){new MutationObserver(renderNav).observe(collectionManager,{childList:true});}
 // Native settings can remain open while a detail is selected; only dialogs lock the app.
 for(const id of ['fOv','sOv']){
  const dlg=$('#'+id);if(!dlg)continue;
  new MutationObserver(()=>{document.body.classList.toggle('dw-modal-open',!!$('.f-ov.on,.s-ov.on'));}).observe(dlg,{attributes:true,attributeFilter:['class']});
 }
 // Original jump bar, if visible, is scoped to the scrolling workspace.
 const jump=$('#jumpBar'); if(jump)$('#ssWorkspace').append(jump);
 renderNav();syncRecordPanel();
})();
