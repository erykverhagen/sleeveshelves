/* SleeveShelves Stage 2: modal keyboard containment and focus restoration.
   No existing Save, Close, playback or record event handlers replaced. */
(()=>{
  'use strict';
  const items='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const dialogs=[['fOv','formModal'],['sOv','userModal'],['detOv','detModal']];
  let restoreTarget=null,activeId=null;
  function visible(el){return !!(el.getClientRects().length) && getComputedStyle(el).visibility!=='hidden';}
  function current(){
    for(const [ov,id] of dialogs){
      if(document.getElementById(ov)?.classList.contains('on')) return document.getElementById(id);
    }
    return null;
  }
  const observer=new MutationObserver(()=>{
    const modal=current();const id=modal?.id||null;
    if(id===activeId)return;
    if(id){
      if(!activeId && document.activeElement instanceof HTMLElement)restoreTarget=document.activeElement;
      activeId=id;
      queueMicrotask(()=>{if(current()===modal && !modal.contains(document.activeElement)){
        const first=[...modal.querySelectorAll(items)].find(visible);
        (first||modal).focus({preventScroll:true});
      }});
    }else{
      activeId=null;
      const target=restoreTarget;restoreTarget=null;
      queueMicrotask(()=>{if(target?.isConnected && visible(target))target.focus({preventScroll:true});});
    }
  });
  for(const [overlay] of dialogs){const node=document.getElementById(overlay);if(node)observer.observe(node,{attributes:true,attributeFilter:['class']});}
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const dialog=current();if(!dialog)return;
    const focusables=[...dialog.querySelectorAll(items)].filter(visible);
    if(!focusables.length){e.preventDefault();dialog.focus();return;}
    const first=focusables[0], last=focusables[focusables.length-1];
    if(e.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))){e.preventDefault();first.focus();}
  },true);
})();
