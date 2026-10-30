/* Endgrooves 61.7 Brass iconography adapter.
   Presentation only. Does not replace native handlers or alter stored data.
   The original V61.5 UX script remains authoritative for placement/back/minimize. */
(()=>{
 'use strict';
 const make=(name,cls='')=>{
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('class',`eg-icon ${cls}`.trim()); svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const use=document.createElementNS(ns,'use');use.setAttribute('href',`#eg-${name}`);svg.append(use);return svg;
 };
 const update=(selector,name,opts={})=>{
  document.querySelectorAll(selector).forEach(target=>{
   if(target.dataset.egGlyph===name)return;
   if(opts.slot){
    const slot=target.querySelector(opts.slot);
    if(!slot)return;
    slot.replaceChildren(make(name));target.dataset.egGlyph=name;
   }else if(opts.content){
    // Preserve accessible label and all event listeners on the button.
    target.replaceChildren(make(name));target.dataset.egGlyph=name;
   }else{
    const old=target.querySelector('svg');if(!old)return;
    old.replaceWith(make(name));target.dataset.egGlyph=name;
   }
  });
 };
 function apply(){
  update('#filterToggle','filters');
  update('#userMenuBtn','account');
  update('.btn-add','add',{slot:'svg'});
  update('#ssAddCollection','add');
  update('#btnGrid','grid');update('#btnList','list');update('#btnFlow','coverflow');
  update('#ss615Back','back',{slot:'svg'});
  update('#ss57Minimize','minimize',{content:true});
  update('#ssMinimizeDetail','minimize',{content:true});
  update('#mClose','close',{content:true});
  update('#ssNavCollections .ss-nav-ico','collection',{content:true});
  update('#ssOtherShelvesList .ss-nav-ico','other-shelves',{content:true});
  // The original receiver play/pause and stop events remain attached to their buttons.
  update('#ss57Receiver [data-ss57="stop"]','stop',{content:true});
  update('#ss57Receiver [data-ss57="reopen"]','arrow-up-right',{content:false});
  // The needle control has TWO stateful SVGs. Restyle them rather than replacing either.
  document.querySelectorAll('#ss57Receiver [data-ss57="needle"] svg').forEach(svg=>svg.setAttribute('stroke','currentColor'));
  document.querySelectorAll('.ss57-empty-cover').forEach(node=>{if(node.textContent.trim()==='SS')node.textContent='EG';});
  document.querySelectorAll('button[title="Settings"] svg,button[aria-label="Settings"] svg').forEach(svg=>{
   if(svg.classList.contains('eg-icon'))return;svg.replaceWith(make('settings'));
  });
 }
 let pending=false;
 function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply();});}
 // Mutations are scoped to dynamic controls. Avoid observing the entire app tree and
 // avoid work triggered by our own icon updates where possible.
 for(const selector of ['#ssNavCollections','#ssOtherShelvesList','#ss57Receiver','#ssProfileSlot','#detModal']){
  const node=document.querySelector(selector);if(node)new MutationObserver(schedule).observe(node,{childList:true,subtree:false});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();schedule();});
 else{apply();schedule();}
 window.EndgroovesIcons=Object.freeze({version:'61.7',refresh:schedule,create:make});
})();
