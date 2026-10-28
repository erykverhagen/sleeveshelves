/* SleeveShelves V57: the 1970s receiver mini-player and modal polish.
 * Adapter-only. Keeps Supabase, physical listening status and needle engine intact.
 */
(() => {
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const shell=$('#hdr .h1'), right=$('#hdr .h-right'), overlay=$('#detOv');
  const modal=$('#detModal'), visual=$('.ss56-visual',modal), top=$('.m-top',modal);
  const api=window.DW_TURNTABLE_V45;
  if(!shell||!right||!overlay||!modal||!api||!visual||!top)return;

  // Real receiver display, never an independent player/session.
  const receiver=document.createElement('section');
  receiver.id='ss57Receiver';
  receiver.className='ss57-receiver';
  receiver.hidden=true;
  receiver.setAttribute('aria-label','SleeveShelves miniature record receiver');
  receiver.innerHTML=`
    <span class="ss57-wood ss57-wood-left" aria-hidden="true"></span>
    <button type="button" class="ss57-sleeve" data-ss57="reopen" aria-label="Reopen record details"><img alt="" loading="lazy"><span class="ss57-empty-cover" aria-hidden="true">SS</span></button>
    <div class="ss57-tuner" aria-live="polite" aria-atomic="true">
      <div class="ss57-tuner-top"><span class="ss57-diode" aria-hidden="true"></span><span class="ss57-tuner-caption">NOW SPINNING</span><span class="ss57-side">SIDE A</span></div>
      <strong class="ss57-album"></strong>
      <div class="ss57-track-line"><span class="ss57-track"></span><span class="ss57-track-vu" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>
    </div>
    <div class="ss57-hardware" aria-label="Mini receiver controls">
      <button type="button" class="ss57-switch" data-ss57="needle" aria-label="Pause or resume playback" title="Pause or resume"><svg class="ss57-icon ss57-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="ss57-icon ss57-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg></button>
      <button type="button" class="ss57-switch ss57-stop" data-ss57="stop" aria-label="Stop playback" title="Stop playback"><svg class="ss57-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
      <button type="button" class="ss57-reopen" data-ss57="reopen" aria-label="Reopen record" title="Open record"><svg class="ss57-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></button>
    </div>
    <span class="ss57-wood ss57-wood-right" aria-hidden="true"></span>`;
  shell.insertBefore(receiver,right);
  const img=$('.ss57-sleeve img',receiver),empty=$('.ss57-empty-cover',receiver);
  let lastCover='';
  function updateReceiver(){
    const state=api.getState?.();
    const open=overlay.classList.contains('on');
    const active=!!(state && !['stopped','finished'].includes(state.status));
    receiver.hidden=!active||open;
    document.body.classList.toggle('ss57-mini-active',active&&!open);
    if(!active)return;
    receiver.classList.toggle('ss57-is-playing',state.status==='playing');
    receiver.classList.toggle('ss57-is-paused',state.status!=='playing');
    $('.ss57-tuner-caption',receiver).textContent=state.status==='playing'?'NOW SPINNING':state.status==='loading'?'CUEING RECORD':'NEEDLE LIFTED';
    $('.ss57-side',receiver).textContent='SIDE '+(state.side||'A');
    $('.ss57-album',receiver).textContent=state.album||'Untitled record';
    $('.ss57-track',receiver).textContent=state.currentTrack?.title||state.artist||'Ready';
    const cover=state.cover||'';
    if(cover!==lastCover){
      lastCover=cover;
      const safe=/^(https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(cover);
      img.hidden=!safe; empty.hidden=safe;
      if(safe)img.src=cover;
      else img.removeAttribute('src');
    }
    $('[data-ss57="needle"]',receiver).setAttribute('aria-label',state.status==='playing'?'Lift needle and pause playback':'Drop needle and resume playback');
  }
  receiver.addEventListener('click',event=>{
    const action=event.target.closest('[data-ss57]')?.dataset.ss57;
    if(action==='needle')void api.toggleNeedle?.();
    else if(action==='stop')api.stop?.();
    else if(action==='reopen')api.reopenRecord?.();
  });
  document.addEventListener('sleeveshelves:playback',updateReceiver);
  new MutationObserver(updateReceiver).observe(overlay,{attributes:true,attributeFilter:['class']});

  // Minimize: leave the selected side and needle session running.
  const nativeClose=window.closeModal?.bind(window);
  const minimize=document.createElement('button');
  minimize.type='button';minimize.id='ss57Minimize';minimize.className='ss57-modal-minimize';
  minimize.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14"/></svg>';
  minimize.title='Minimize record, keep playing';minimize.setAttribute('aria-label','Minimize record and keep playback running');
  minimize.addEventListener('click',()=>{
    api.minimize?.();
    nativeClose?.(); // Bypasses the stop-on-close wrapper deliberately.
    updateReceiver();
  });
  top.append(minimize);

  // Close means stop, including the native cross and backdrop interactions.
  const closeWithStop=()=>{if(api.getState?.()&&!['stopped','finished'].includes(api.getState().status))api.stop?.();};
  if(nativeClose)window.closeModal=function(...args){closeWithStop();return nativeClose(...args)};
  $('#mClose')?.addEventListener('click',event=>{
    // Centralize close behavior so native and keyboard paths always agree.
    event.preventDefault();event.stopImmediatePropagation();
    window.closeModal?.();
  },true);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeWithStop()},true);

  // The physical owner status belongs beneath the sleeve, not inside Diary.
  const state=$('#mStateBox');
  const footer=$('.ss56-left-footer',modal);
  if(state&&footer){state.classList.add('ss57-collector-actions');visual.insertBefore(state,footer)}
  // The native star already expresses Favorite; the second heart is duplicate.
  $('.ss56-favorite',modal)?.remove();


  updateReceiver();
})();
