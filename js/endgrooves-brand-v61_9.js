/* Endgrooves V61.9: compact logo expands the existing sidebar.
   Expanded logo retains the existing All Records navigation action. */
(()=>{
 'use strict';
 const root=document.getElementById('ssApp');
 const brand=document.getElementById('ssBrandHome');
 const toggler=document.getElementById('ssCollapseNav');
 if(!root||!brand||!toggler)return;
 const sync=()=>{
  const compact=root.classList.contains('ss-nav-min');
  brand.setAttribute('aria-label',compact?'Expand navigation':'Endgrooves · All records');
  brand.title=compact?'Expand navigation':'All records';
 };
 // Capture before the app's existing click-to-home listener; only in compact mode.
 brand.addEventListener('click',event=>{
  if(!root.classList.contains('ss-nav-min'))return;
  event.preventDefault();event.stopImmediatePropagation();
  toggler.click();
 },true);
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});
 sync();
})();
