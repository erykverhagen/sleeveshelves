/* Endgrooves V61.8 Sidebar: animation/ARIA synchronization only.
   Original V61.4.8 handler owns the open/close state and session preference. */
(()=>{
 'use strict';
 const root=document.getElementById('ssApp');
 const row=document.querySelector('#ssNav .ss-brand-row');
 const hamburger=document.getElementById('ssSidebarHamburger');
 if(!root||!row||!hamburger)return;
 const ns='http://www.w3.org/2000/svg';
 // In compact mode, the icon suggests a record tucked into its sleeve.
 const glyph=document.createElementNS(ns,'svg');glyph.setAttribute('viewBox','0 0 24 24');
 glyph.setAttribute('fill','none');glyph.setAttribute('stroke','currentColor');
 glyph.setAttribute('stroke-width','1.7');glyph.setAttribute('stroke-linecap','round');
 glyph.setAttribute('stroke-linejoin','round');glyph.setAttribute('aria-hidden','true');
 const p=document.createElementNS(ns,'path');p.setAttribute('d','M4 6h16M4 12h16M4 18h16');glyph.appendChild(p);
 hamburger.replaceChildren(glyph);
 let last=root.classList.contains('ss-nav-min');
 function sync(){
  const small=root.classList.contains('ss-nav-min');
  hamburger.setAttribute('aria-expanded',String(!small));
  hamburger.setAttribute('aria-label',small?'Expand navigation':'Collapse navigation');
  hamburger.title=small?'Open your shelves':'Tuck your shelves away';
  p.setAttribute('d',small?'M5.5 5.5h13v13h-13z M9 9a4 4 0 1 0 6 6 M12 12h.01':'M4 6h16 M4 12h16 M4 18h16');
  if(last!==small){
   row.classList.remove('eg-during-fold');
   void row.offsetWidth;
   row.classList.add('eg-during-fold');
   last=small;
  }
 }
 const observer=new MutationObserver(sync);
 observer.observe(root,{attributes:true,attributeFilter:['class']});
 row.addEventListener('animationend',event=>{if(event.animationName==='egFoilGlint')row.classList.remove('eg-during-fold')});
 sync();
})();
