/* V60 collector grail overlay only. No Liquid Glass adapter. */
/* Collector grail foil: a presentational overlay mounted on the single sleeve /
   turntable stage. The native `grail-detail` state remains authoritative. */
(() => {
  'use strict';
  const stage=document.querySelector('#ssTurntableStage');
  const modal=document.querySelector('#detModal');
  if(!stage||!modal)return;
  if(!stage.querySelector('.ss60-grail-sticker')){
    const foil=document.createElement('div');
    foil.className='ss60-grail-sticker';
    foil.setAttribute('role','img');
    foil.setAttribute('aria-label','Grail record, collectible gold-foil sleeve sticker');
    foil.innerHTML='<img src="assets/sleeveshelves-grail-edition.webp" alt="" decoding="async">';
    stage.append(foil);
  }
  // A grail's foil label is visible ONLY on the sleeve: the playing state
  // substitutes golden vinyl in the very same square instead.
})();
