/* SleeveShelves V58. Collector-first refinements; no data writes or duplicate player. */
(()=>{
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const receiver=$('#ss57Receiver'),browse=$('.ss-browse-bar'),counter=$('.ss-browse-count');
  const modal=$('#detModal'),overlay=$('#detOv'),wiki=$('#mWiki');
  // Keep search full width. The receiver sits beside the browsing shortcuts.
  if(receiver&&browse){
    receiver.classList.add('ss58-receiver');
    const compact=window.matchMedia('(max-width:800px)');
    const placeReceiver=()=>{
      if(compact.matches){
        if(receiver.parentElement!==document.body)document.body.append(receiver);
      }else if(receiver.parentElement!==browse){
        if(counter&&counter.parentElement===browse)browse.insertBefore(receiver,counter);
        else browse.append(receiver);
      }
    };
    placeReceiver();
    compact.addEventListener?.('change',placeReceiver);
  }
  // The original controls remain the sole source of persistence and reactions.
  const visual=$('.ss56-visual',modal), state=$('#mStateBox'), footer=$('.ss56-left-footer',modal);
  if(visual&&state&&footer){
    state.classList.add('ss58-reactions');
    if(state.parentElement!==visual)visual.insertBefore(state,footer);
    else visual.insertBefore(state,footer);
    const decorateReactions=()=>{
      const listened=$('.m-listen-btn',state),dislike=$('.m-rate-btn.disliked',state),like=$('.m-rate-btn.liked',state),star=$('.m-rate-btn.favorite',state);
      for(const [el,label] of [[listened,'Mark as physically listened'],[dislike,'Dislike record'],[like,'Like record'],[star,'Favorite record']]){
        if(el){el.setAttribute('aria-label',label);el.setAttribute('title',label);el.setAttribute('aria-pressed',String(el.classList.contains('on')));}
      }
    };
    new MutationObserver(decorateReactions).observe(state,{childList:true,subtree:false});
    decorateReactions();
  }
  // Convert native textual metadata to a legible catalog grid. The underlying
  // #mWiki remains untouched; this is presentation only, derived from its text.
  const details=$('#ssPaneldetails');
  if(details&&wiki){
    const facts=document.createElement('dl');facts.id='ss58Facts';facts.className='ss58-facts';facts.setAttribute('aria-label','Record release facts');
    wiki.insertAdjacentElement('afterend',facts);
    function syncFacts(){
      const raw=(wiki.textContent||'').trim();
      const parts=raw.replace(/\.$/,'').split(/\.\s+(?=(?:Released\s|Label:|Country:|Genre:|Discogs ID:))/).filter(Boolean);
      const rows=parts.map(s=>{
        const matched=s.match(/^(Label|Country|Genre|Discogs ID):\s*(.*)$/);
        if(matched)return [matched[1],matched[2]];
        const year=s.match(/^Released\s+(.+)$/);
        return year?['Released',year[1]]:['Information',s];
      }).filter(([,value])=>value);
      facts.replaceChildren();
      const hasFacts=raw!=='No extra metadata saved yet.' && rows.length>0;
      for(const [label,value] of hasFacts?rows:[]){
        const item=document.createElement('div');item.className='ss58-fact';
        const dt=document.createElement('dt');dt.textContent=label;
        const dd=document.createElement('dd');dd.textContent=value;
        item.append(dt,dd);facts.append(item);
      }
      facts.hidden=!hasFacts;
      wiki.classList.toggle('ss58-facts-source',hasFacts);
    }
    new MutationObserver(syncFacts).observe(wiki,{childList:true,subtree:true,characterData:true});
    syncFacts();
  }
  const notes=$('#ssPanelnotes'); if(notes){notes.classList.add('ss58-notes-pane');}
  const listening=$('#ssPanellistening');if(listening){
    listening.classList.add('ss58-listening-pane');
    const help=$('.ss56-diary-help',listening);
    if(help)help.textContent='Physical listening stays separate from the digital turntable. Your listened status and last-listened date are shown beneath the sleeve.';
  }
  $('#ssPanelcollections')?.classList.add('ss58-collection-pane');
  $('#ssPanelmore')?.classList.add('ss58-more-pane');
  // When the record changes, the native tab handlers and side-specific
  // [data-dw44-play-side] controls still own their original behavior.
  if(overlay){
    const syncTabAccessibility=()=>{
      for(const b of $$('.ss-v50-tabs [role="tab"]',modal)){
        b.setAttribute('aria-label',b.textContent.trim()+' tab');
      }
    };
    new MutationObserver(syncTabAccessibility).observe(overlay,{attributes:true,attributeFilter:['class']});syncTabAccessibility();
  }
})();
