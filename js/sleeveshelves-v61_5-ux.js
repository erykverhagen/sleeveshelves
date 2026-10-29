/* SleeveShelves V61.5 | Review-only UX consolidation.
 * DOM/presentation adapter over V61.4.8 + Affinity. No changes to Supabase,
 * playback authority, record mutations, or collection storage.
 */
(()=>{
 'use strict';
 const $=(s,root=document)=>root.querySelector(s);
 const $$=(s,root=document)=>[...root.querySelectorAll(s)];
 const shell=$('#ssApp'),modal=$('#detModal'),overlay=$('#detOv');
 if(!shell||!modal||!overlay)return;
 document.body.classList.add('ss615-ux');

 // Keep the original filter button and all native filter handlers intact.
 const search=$('#searchWrap'),toggle=$('#filterToggle'),head=$('#hdr .h1');
 if(search&&toggle&&head){
   const zone=document.createElement('div');zone.className='ss615-search-zone';
   search.before(zone);zone.append(search,toggle);
   toggle.title='Refine your search';toggle.setAttribute('aria-label','Show search filters');
   const filter=$('#filterDrawer');
   if(filter)filter.setAttribute('aria-label','Refine your search');
 }
 // The same Settings action is already available within the account icon.
 $('#ss6144Settings')?.remove();

 // The native modal opening function remains responsible for displaying data.
 // Navigation tracks user-initiated record-to-record transitions only.
 const back=document.createElement('button');back.id='ss615Back';back.type='button';
 back.className='ss615-record-back';back.hidden=true;
 back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg><span>Back</span>';
 back.title='Return to previous record';back.setAttribute('aria-label','Back to previous record');
 modal.querySelector('.m-top')?.append(back);
 const history=[];
 let travelling=false;
 const selectedId=()=>window.DW_NATIVE?.getAffinitySnapshot?.().currentRecordId||null;
 function syncBack(){back.hidden=!overlay.classList.contains('on')||history.length===0;}
 function registerNavigation(){
   if(travelling||!overlay.classList.contains('on'))return;
   const id=selectedId();if(!id)return;
   if(history.at(-1)!==id)history.push(id);
   syncBack();
 }
 // Native related cards use a closure-local openRecordById; capture before
 // their inline handler to retain the original target and avoid touching it.
 modal.addEventListener('click',e=>{
   if(e.target.closest('.m-rec-chip,[data-affinity-action="open"]'))registerNavigation();
 },true);
 modal.addEventListener('keydown',e=>{
   if((e.key==='Enter'||e.key===' ')&&e.target.closest('.m-rec-chip'))registerNavigation();
 },true);
 // Affinity cards call this global instead of the closure-local function.
 const openById=window.openRecordById;
 if(typeof openById==='function'){
   window.openRecordById=function(id){
     const current=selectedId();
     if(!travelling&&current&&current!==id&&history.at(-1)!==current)history.push(current);
     const result=openById.apply(this,arguments);
     // A filtered-out target may not be accessible through the native opener.
     if(current===selectedId()&&!travelling&&history.at(-1)===current)history.pop();
     syncBack();
     return result;
   };
 }
 back.addEventListener('click',()=>{
   if(!history.length)return;
   travelling=true;
   const target=history.pop();
   try{openById?.(target);}finally{travelling=false;syncBack();}
 });
 new MutationObserver(()=>{
   if(!overlay.classList.contains('on'))history.length=0;
   syncBack();
 }).observe(overlay,{attributes:true,attributeFilter:['class']});
 const close=window.closeModal;
 if(typeof close==='function')window.closeModal=function(...args){history.length=0;syncBack();return close.apply(this,args);};

 // Minimize means move into the existing playing receiver, NOT stop playback.
 // Move only the existing button; keep its attached V57 needle/session handler.
 const minimize=$('#ss57Minimize');
 if(minimize){
   modal.querySelector('.m-top')?.append(minimize);
   minimize.title='Send to mini-player';
   minimize.setAttribute('aria-label','Minimize to mini-player without stopping playback');
   minimize.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14M12 8v10m-4-4 4 4 4-4M5 21h14"/></svg>';
 }

 // Keep the alphabet dock OUTSIDE the record grid and magnify locally,
 // without changing its anchor destinations or existing grouping rules.
 const jump=$('#jumpBar');
 if(jump){
   jump.setAttribute('aria-label','Jump through your collection');
   const clearMagnify=()=>$$('.jb',jump).forEach(a=>a.style.removeProperty('--ss615-magnify'));
   jump.addEventListener('pointermove',e=>{
     if(e.pointerType==='touch')return;
     $$('.jb',jump).forEach(a=>{
       const box=a.getBoundingClientRect();
       const dist=Math.abs(e.clientY-(box.top+box.height/2));
       const proximity=Math.max(0,1-dist/62);
       a.style.setProperty('--ss615-magnify',(1+proximity*.65).toFixed(3));
     });
   });
   jump.addEventListener('pointerleave',clearMagnify);
   jump.addEventListener('focusout',()=>{if(!jump.contains(document.activeElement))clearMagnify();});
 }
})();
