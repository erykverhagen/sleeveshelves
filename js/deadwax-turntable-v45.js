/* Dead Wax v44: Digital Turntable Foundation
 * Isolated additive adapter. Spotify provider supplies authorized audio; no physical diary mutations.
 * or write to the physical listening diary. v43 source remains unchanged.
 */
(() => {
  'use strict';

  const FEATURE = Object.freeze({
    id: 'digital_turntable',
    tier: 'premium',
    publicPreview: true,
    mode: 'provider-independent',
    demoSecondsPerTrack: 5
  });
  const ICON = {
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    turn: '<path d="M3 11a9 9 0 0 1 15.5-6.3L21 7"/><path d="M21 3v4h-4"/><path d="M21 13a9 9 0 0 1-15.5 6.3L3 17"/><path d="M3 21v-4h4"/>',
    swap: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3a9 9 0 0 1 9 9"/>',
    needle: '<path d="M4 20 17 7l3 3L7 23"/><path d="m15 9-2-2 4-4 4 4-4 4"/>',
    minimize: '<path d="m6 10 6 6 6-6"/>'
  };
  function icon(name) {
    return `<svg class="dw44-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.play}</svg>`;
  }
  const $ = (s, scope=document) => scope.querySelector(s);
  const $$ = (s, scope=document) => Array.from(scope.querySelectorAll(s));
  const text = (s, scope=document) => $(s, scope)?.textContent.trim() || '';
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const providers = new Map();
  let session = null;
  let dock = null;
  let recordView = null;
  let expanded = true;
  let collectionRefreshPending = false;
  let lastTick = 0;
  let drawPending = false;
  let busy = false;
  let initialized = false;
  let operationId = 0;
  let sleeveFlipped = false;
  let pendingTrackIndex = null;
  // Hover/drag preview is UI-only until the stylus is released. Spotify is never
  // instructed to seek while the stylus is in motion.
  let cuePreviewIndex = null;
  let cueOriginIndex = null;
  let suppressGrooveClickUntil = 0;

  // A catalog/playback adapter contract for future licensed providers.
  // Only the demo adapter is registered in this release.
  function registerProvider(adapter) {
    if (!adapter || !adapter.id || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') {
      throw new Error('Invalid Dead Wax playback adapter');
    }
    providers.set(adapter.id, adapter);
  }
  const demo = {
    id: 'demo',
    kind: 'simulation',
    capabilities: Object.freeze({ audio: false, nativePlayback: false, seek: false, skip: false }),
    start() {}, pause() {}, resume() {}, stop() {}
  };
  registerProvider(demo);
  function eligible() {
    if(FEATURE.publicPreview)return true;
    // When the preview ends, an authenticated, server-verified entitlement
    // provider must be installed. Never trust a manually supplied plan string.
    return window.DW_PREMIUM_ENTITLEMENTS?.hasFeature?.(FEATURE.id) === true;
  }
  function tracksFromDetail() {
    const container = $('#mTlC');
    if (!container) return null;
    const sides = new Map();
    let currentSide = 'Tracks';
    for (const el of Array.from(container.children)) {
      if (el.classList.contains('m-tl-side-lbl')) {
        currentSide = (el.getAttribute('data-dw44-side') || el.childNodes[0]?.textContent || '').trim() || 'Tracks';
        if (!sides.has(currentSide)) sides.set(currentSide, []);
      } else if (el.classList.contains('m-tl-track')) {
        const position = text('.m-tl-pos', el);
        const sideFromPosition = position.match(/^[A-Z]+/)?.[0];
        const side = sideFromPosition || currentSide;
        if (!sides.has(side)) sides.set(side, []);
        sides.get(side).push({
          position,
          title: text('.m-tl-name', el) || 'Untitled',
          duration: text('.m-tl-dur', el)
        });
      }
    }
    const cleanSides = Object.fromEntries([...sides.entries()].filter(([, list]) => list.length));
    if (!Object.keys(cleanSides).length) return null;
    const img = $('#mCover img');
    return {
      key: [text('#mCode'), text('#mArtist'), text('#mAlbum')].join('|'),
      shelfId: text('#mCode'),
      artist: text('#mArtist'),
      album: text('#mAlbum'),
      cover: img?.getAttribute('src') || '',
      sides: cleanSides
    };
  }
  function siblingSide(sides, side) {
    const keys = Object.keys(sides);
    if (/^[A-Z]$/.test(side)) {
      const code = side.charCodeAt(0) - 65;
      const sibling = String.fromCharCode((code % 2 === 0 ? code + 1 : code - 1) + 65);
      return keys.includes(sibling) ? sibling : null;
    }
    const idx = keys.indexOf(side);
    if (idx < 0) return null;
    return idx % 2 === 0 ? (keys[idx + 1] || null) : (keys[idx - 1] || null);
  }
  function readState() {
    if (!session) return null;
    const current = session.tracks[session.trackIndex];
    return {
      providerId: session.providerId,
      demo: session.providerId === 'demo',
      record: session.record.key,
      album: session.record.album,
      artist: session.record.artist,
      side: session.side,
      status: session.status,
      trackIndex: session.trackIndex,
      trackCount: session.tracks.length,
      currentTrack: current ? {...current} : null,
      elapsedInDemoTrack: session.elapsed,
      positionSeconds: session.elapsed,
      durationSeconds: session.providerTrackDuration,
      canTurn: !!siblingSide(session.record.sides, session.side)
    };
  }
  function activeProvider() {
    const spotify = providers.get('spotify');
    return spotify?.isConnected?.() ? spotify : demo;
  }
  function showPlaybackError(error) {
    const message = error?.message || String(error || 'Unknown playback error');
    console.warn('Dead Wax Digital Turntable:',message);
    let node = $('#dw45PlaybackError');
    if (!node) { node=document.createElement('div'); node.id='dw45PlaybackError'; node.setAttribute('role','alert'); document.body.append(node); }
    node.textContent = `Digital turntable: ${message}`;
    node.hidden = false;
    window.setTimeout(() => { if (node.textContent.endsWith(message)) node.hidden = true; },12000);
  }
  async function startSide(side) {
    const record = tracksFromDetail();
    if (!eligible() || !record || !record.sides[side]?.length) return;
    const op=++operationId, adapter=activeProvider();
    // Never silently fall back to a demo when an active Spotify session cannot play.
    try {
      if (adapter.prepare) await adapter.prepare({record,side,tracks:record.sides[side]});
      if (op!==operationId) return;
      if (session) await providers.get(session.providerId)?.stop?.();
      const next={providerId:adapter.id,record,side,tracks:record.sides[side],trackIndex:0,elapsed:0,status:'loading',providerTrackDuration:0};
      session=next; expanded=true; sleeveFlipped=false; pendingTrackIndex=null;cuePreviewIndex=null;cueOriginIndex=null;
      lastTick=performance.now(); render();
      await adapter.start({record,side,tracks:next.tracks,index:0});
      if(op!==operationId || session!==next) return;
      next.status='playing';lastTick=performance.now();render();
    } catch(error) {
      if (op!==operationId) return;
      if(session?.status==='loading') {session.status='stopped';render();}
      showPlaybackError(error);
    }
  }
  async function needle() {
    if(!session || session.status==='loading') return;
    const op=++operationId, current=session, adapter=providers.get(session.providerId);
    try {
      if(current.status==='playing') {
        await adapter.pause();if(op!==operationId || session!==current)return;
        current.status='paused';
      } else if(current.status==='paused' && pendingTrackIndex===null) {
        await adapter.resume();if(op!==operationId || session!==current)return;
        current.status='playing';
      } else {
        const idx=pendingTrackIndex ?? current.trackIndex;
        if(adapter.prepare) await adapter.prepare({record:current.record,side:current.side,tracks:current.tracks});
        if(op!==operationId || session!==current)return;
        current.status='loading';render();
        await adapter.start({record:current.record,side:current.side,tracks:current.tracks,index:idx});
        if(op!==operationId || session!==current)return;
        pendingTrackIndex=null;current.status='playing';current.trackIndex=idx;current.elapsed=0;
      }
      lastTick=performance.now();render();
    } catch(error) {if(op!==operationId || session!==current)return;current.status='paused';render();showPlaybackError(error);}
  }
  function stop() {
    if(!session)return;
    ++operationId;pendingTrackIndex=null;cuePreviewIndex=null;cueOriginIndex=null;
    Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
    session.status='stopped';session.trackIndex=0;session.elapsed=0;session.providerTrackDuration=0;render();
  }
  function turn() {
    if(!session)return;
    const opposite=siblingSide(session.record.sides,session.side);if(!opposite)return;
    ++operationId;pendingTrackIndex=null;cuePreviewIndex=null;cueOriginIndex=null;sleeveFlipped=false;
    Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
    session.side=opposite;session.tracks=session.record.sides[opposite];session.trackIndex=0;
    session.elapsed=0;session.providerTrackDuration=0;session.status='stopped';render();
  }
  function turnToSide(side) {
    if(!session || !session.record.sides[side])return;
    ++operationId; pendingTrackIndex=null;cuePreviewIndex=null;cueOriginIndex=null;
    Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
    session.side=side;session.tracks=session.record.sides[side];session.trackIndex=0;
    session.elapsed=0;session.providerTrackDuration=0;session.status='stopped';render();
  }
  function swap() {
    ++operationId;pendingTrackIndex=null;cuePreviewIndex=null;cueOriginIndex=null;sleeveFlipped=false;
    if(session)Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
    session=null;render();
    if($('#detOv')?.classList.contains('on') && typeof window.closeModal==='function')window.closeModal();
  }
  async function cueTrack(index) {
    if(!session || session.status==='loading' || index<0 || index>=session.tracks.length)return;
    cuePreviewIndex=null;cueOriginIndex=null;
    if(session.status==='paused' && pendingTrackIndex===index)return;
    ++operationId;
    const adapter=providers.get(session.providerId);
    try {await adapter.pause?.();}catch(error){showPlaybackError(error);}
    // Unlike a digital skip, selecting a band first lifts the stylus. Drop to play.
    session.trackIndex=index;session.elapsed=0;session.providerTrackDuration=0;
    session.status='paused';pendingTrackIndex=index;render();
  }
  function reportProviderEvent(event) {
    if(!session || event?.providerId!==session.providerId)return;
    if(event.kind==='progress') {
      if(session.status==='stopped' || session.status==='finished' || pendingTrackIndex!==null)return;
      if(Number.isInteger(event.index) && event.index>=0 && event.index<session.tracks.length && event.index!==session.trackIndex){session.trackIndex=event.index;render();}
      if(Number.isFinite(event.seconds))session.elapsed=Math.max(0,event.seconds);
      if(Number.isFinite(event.duration))session.providerTrackDuration=Math.max(0,event.duration);
      const deck=dock && $('.dw44-deck',dock);
      if(deck)deck.style.setProperty('--dw44-track-angle',`${(groovePosition()*12).toFixed(3)}deg`);
    } else if(event.kind==='finished') {
      if(session.status==='stopped'||session.status==='finished')return;
      session.status='finished';session.elapsed=0;
      Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
      render();
    } else if(event.kind==='paused') {
      if(session.status==='playing'){session.status='paused';render();}
    } else if(event.kind==='error')showPlaybackError(event.error);
  }
  function tick(now) {
    if (!session || session.providerId !== 'demo' || session.status !== 'playing') { lastTick = now; return; }
    const dt = Math.max(0, Math.min((now - (lastTick || now)) / 1000, 1.5));
    lastTick = now;
    session.elapsed += dt;
    if (session.elapsed < FEATURE.demoSecondsPerTrack) {
      const deck = dock && $('.dw44-deck', dock);
      if (deck) deck.style.setProperty('--dw44-track-angle', `${(groovePosition()*12).toFixed(3)}deg`);
      return;
    }
    session.elapsed = 0;
    if (session.trackIndex < session.tracks.length - 1) {
      session.trackIndex += 1;
    } else {
      session.status = 'finished';
      providers.get(session.providerId).stop();
    }
    render();
  }
  function getStatusLabel() {
    if (!session) return '';
    switch (session.status) {
      case 'playing': return `NOW SPINNING · SIDE ${session.side}`;
      case 'paused': return 'NEEDLE LIFTED';
      case 'stopped': return `READY · SIDE ${session.side}`;
      case 'finished': return `END OF SIDE ${session.side}`;
      case 'loading': return 'CUEING RECORD';
      default: return '';
    }
  }
  function primaryLabel() {
    if (!session) return 'Lift needle';
    return session.status === 'playing' ? 'Lift needle' : 'Drop needle';
  }
  function button(action, label, glyph, disabled=false) {
    return `<button type="button" class="dw44-control" data-dw44-action="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${disabled?' disabled':''}>${icon(glyph)}<span>${escapeHtml(label)}</span></button>`;
  }
  function controls() {
    if (!session) return '';
    return [
      button('needle', primaryLabel(), session.status==='playing'?'needle':'play'),
      button('stop', 'Stop / reset', 'stop'),
      button('turn', 'Turn record', 'turn', !siblingSide(session.record.sides, session.side)),
      button('swap', 'Swap record', 'swap')
    ].join('');
  }
  function coverMarkup(record) {
    if (!record?.cover || !/^(https?:\/\/|data:image\/)/i.test(record.cover)) return `<div class="dw44-cover-placeholder">DW</div>`;
    return `<img class="dw44-art" src="${escapeHtml(record.cover)}" alt="Album sleeve" loading="lazy">`;
  }
  function mountDock() {
    if (dock) return;
    dock = document.createElement('aside');
    dock.id = 'dw44Dock';
    dock.className = 'dw44-dock';
    dock.setAttribute('aria-label', 'Digital Turntable persistent player');
    dock.setAttribute('aria-live', 'off');
    dock.hidden = true;
    document.body.appendChild(dock);
  }
  function statusName() {
    if (!session) return '';
    const labels = {playing:'NOW SPINNING', paused:'NEEDLE LIFTED', stopped:'READY TO PLAY', finished:'SIDE COMPLETE', loading:'CUEING RECORD'};
    return labels[session.status] || 'ON TURNTABLE';
  }
  function currentTrackTitle() {
    const track = session?.tracks?.[session.trackIndex];
    return track ? `${track.position ? track.position + ' · ' : ''}${track.title}` : '';
  }
  // Each physical track produces ONE visibly separated radial groove band.
  // Durations gently influence band widths without hiding shorter tracks.
  function parseDuration(s) {
    const parts = String(s || '').trim().split(':');
    if (!parts.length || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return 180;
    const seconds = parts.reduce((acc,part)=>acc*60 + Number(part),0);
    return Math.min(3600,Math.max(20,seconds || 180));
  }
  function trackGrooves() {
    const list = session?.tracks || [];
    if (!list.length) return [];
    const durations = list.map(t => parseDuration(t.duration));
    const average = durations.reduce((a,b)=>a+b,0)/list.length;
    // Moderate large duration differences; preserve a recognizable band per track.
    const weights = durations.map(x => .67 + .33*(x/average));
    const total = weights.reduce((a,b)=>a+b,0);
    let accumulated = 0;
    return weights.map((weight,index) => {
      const start = accumulated/total;
      accumulated += weight;
      return { index, start, end:accumulated/total,
        // Outside to inside. Central sleeve label ends at r≈23.
        outer:46-17*start, inner:46-17*accumulated/total };
    });
  }
  function groovePosition() {
    const grooves=trackGrooves();
    if (!grooves.length) return 0;
    const i=Math.min(grooves.length-1,Math.max(0,session.trackIndex));
    let fraction=0;
    if (session.status === 'playing' || session.status === 'paused' || session.status === 'loading') {
      const trackDuration = session.providerId==='demo' ? FEATURE.demoSecondsPerTrack :
        (Number(session.providerTrackDuration) || parseDuration(session.tracks[i]?.duration));
      fraction = Math.min(1,Math.max(0,session.elapsed / trackDuration));
    }
    const band=grooves[i];
    return Math.min(1,Math.max(0,band.start + (band.end-band.start)*fraction));
  }
  function grooveSignature() {
    return `${session.side}|${session.tracks.map(t=>t.position+':'+t.duration).join('|')}`;
  }
  // Stable pseudo-random distribution: details don't flicker when the player redraws.
  function grooveHash(value) {
    let h=2166136261;
    for (let i=0;i<value.length;i++) { h=Math.imul(h^value.charCodeAt(i),16777619); }
    return h>>>0;
  }
  function recordGroovesMarkup() {
    const grooves=trackGrooves();
    const seed=grooveHash(session.record.key+'|'+session.side);
    const bands=grooves.map(({index,outer,inner})=>{
      const width=outer-inner;
      const middle=(outer+inner)/2;
      const pos=session.tracks[index]?.position || `${index+1}`;
      const title=session.tracks[index]?.title || 'Untitled';
      const label=escapeHtml(`${pos}: ${title}`);
      return `<circle class="dw44-groove-band${index===session.trackIndex?' is-current':''}" data-dw44-groove-track="${index}" cx="50" cy="50" r="${middle.toFixed(3)}" fill="none" stroke-width="${Math.max(.3,width-.5).toFixed(3)}"><title>${label}</title></circle><circle class="dw44-groove-boundary" cx="50" cy="50" r="${inner.toFixed(3)}" fill="none"/>`;
    }).join('');
    const marks=[];
    grooves.forEach((band,index)=>{
      // Minute scuffs belong to the vinyl grooves. Purely visual: no audio mixing.
      const count=Math.min(6,Math.max(2,Math.round(5/grooves.length*3)));
      for(let i=0;i<count;i++){
        const v=(seed + Math.imul(index+11,2654435761) + Math.imul(i+7,2246822519))>>>0;
        const a=((v%3600)/10)*Math.PI/180;
        const rr=band.inner+.22+(band.outer-band.inner-.44)*(((v>>>6)%1000)/1000);
        const len=.28+((v>>>17)%1000)/1000*.64;
        const x1=50+rr*Math.cos(a),y1=50+rr*Math.sin(a);
        const x2=50+(rr+len)*Math.cos(a),y2=50+(rr+len)*Math.sin(a);
        marks.push(`<path class="dw44-groove-scratch" style="--dw44-scratch-delay:-${(i+index*2)%11}s" d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`);
      }
    });
    return `<svg class="dw44-groove-map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${bands}${marks.join('')}</svg>`;
  }
  function needlePosition() {
    if (!session || session.status === 'stopped' || session.status === 'finished') return 'is-parked';
    return session.status === 'paused' ? 'is-lifted' : 'is-lowered';
  }
  function syncDeck(deck) {
    // Retain the same deck node between state changes. Replacing it would make
    // CSS transitions jump instantly and restart the spinning record animation.
    const spinning = session.status === 'playing';
    const position = cuePreviewIndex !== null ? 'is-lifted' : needlePosition();
    deck.classList.toggle('is-cueing',cuePreviewIndex !== null);
    deck.classList.toggle('is-playing', spinning);
    deck.classList.toggle('is-idle', !spinning);
    const disc = $('.dw44-groove-map', deck);
    if (disc && disc.dataset.grooveSignature !== grooveSignature()) {
      disc.innerHTML = recordGroovesMarkup().replace(/^<svg[^>]*>|<\/svg>$/g,'');
      disc.dataset.grooveSignature = grooveSignature();
    }
    if (disc) {
      for(const band of $$('.dw44-groove-band',disc)) {
        band.classList.toggle('is-current',Number(band.dataset.dw44GrooveTrack) === session.trackIndex);
        band.classList.toggle('is-cue-target',cuePreviewIndex!==null && Number(band.dataset.dw44GrooveTrack)===cuePreviewIndex);
      }
    }
    const n = $('.dw44-track-total', deck);
    if (n) n.textContent = `${session.tracks.length} TRACK${session.tracks.length===1?'':'S'} · SIDE ${session.side}`;
    // The real vinyl spiral leads inward as the track progresses. At the inner
    // Physically proportioned swing from the outer lead-in band to the inner run-out.
    const visualProgress=cuePreviewIndex===null?groovePosition():trackGrooves()[cuePreviewIndex].start+.07*(trackGrooves()[cuePreviewIndex].end-trackGrooves()[cuePreviewIndex].start);
    deck.style.setProperty('--dw44-track-angle', `${(visualProgress*12).toFixed(3)}deg`);
    const arm = $('.dw44-tonearm', deck);
    if (arm) {
      arm.classList.remove('is-lowered', 'is-lifted', 'is-parked');
      arm.classList.add(position);
    }
    $('.dw44-platter', deck)?.classList.toggle('is-spinning', spinning);
    $('.dw44-deck-led', deck)?.classList.toggle('is-on', spinning);
    updateCuePreview();
    const description = position === 'is-parked' ? 'returned to its rest' : position === 'is-lifted' ? 'raised over the groove' : 'lowered onto the groove';
    deck.setAttribute('aria-label', `Digital turntable with ${session.tracks.length} visible track groove bands on side ${session.side}, ${spinning?'spinning':'stationary'} record and needle ${description}`);
  }
  function turntableMarkup() {
    const spinning = session.status === 'playing';
    return `<div class="dw44-deck ${spinning?'is-playing':'is-idle'}" role="img" aria-label="Vintage turntable">
      <div class="dw44-deck-inset">
        <div class="dw44-platter-rim"><div class="dw44-platter ${spinning?'is-spinning':''}">
          <div class="dw44-record-grooves"></div>
          ${recordGroovesMarkup()}
          <div class="dw44-center-label">${coverMarkup(session.record)}</div>
          <div class="dw44-spindle"></div>
        </div></div>
        <div class="dw44-tonearm ${needlePosition()}">
          <div class="dw44-arm-swing">
            <svg class="dw44-arm-art" viewBox="0 0 350 140" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="dw44-arm-chrome" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#fff0ce"/><stop offset="25%" stop-color="#9b958a"/>
                  <stop offset="57%" stop-color="#ece5d6"/><stop offset="100%" stop-color="#504b43"/>
                </linearGradient>
                <linearGradient id="dw44-head-chrome" x1="0%" y1="0%" x2="100%" y2="90%">
                  <stop offset="0%" stop-color="#a9a59a"/><stop offset="60%" stop-color="#3b3834"/><stop offset="100%" stop-color="#797063"/>
                </linearGradient>
              </defs>
              <path d="M230 15 L217 25 C204 29 202 28 189 39 L142 77 L138 82" fill="none" stroke="rgba(0,0,0,.63)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 3)"/>
              <path d="M230 15 L217 25 C204 29 202 28 189 39 L142 77 L138 82" fill="none" stroke="url(#dw44-arm-chrome)" stroke-width="6.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M206 27 L143 77" fill="none" stroke="rgba(255,247,225,.5)" stroke-width="1" stroke-linecap="round"/>
              <path d="M133 77 L143 74 L150 83 L137 91 Z" fill="url(#dw44-head-chrome)" stroke="#c4b9a4" stroke-width=".9"/>
              <path d="M138 88 L132 87" stroke="#c7b69d" stroke-width="1.4" stroke-linecap="round" class="dw44-stylus"/>
              <circle cx="132" cy="87" r="1.25" fill="#f5dba4" class="dw44-stylus"/>
              <circle cx="132" cy="87" r="13" fill="transparent" class="dw45-stylus-grip"><title>Drag the needle to a groove</title></circle>
            </svg>
          </div>
          <span class="dw44-arm-pivot"></span>
          <span class="dw44-arm-cradle" aria-hidden="true"></span>
        </div>
        <div class="dw44-deck-rpm">33⅓ <span>RPM</span></div>
        <div class="dw44-deck-brand" title="Record shelf ID"><small>SHELF ID</small>${escapeHtml(session.record.shelfId || 'UNASSIGNED')}</div>
        <div class="dw44-track-total">${session.tracks.length} TRACK${session.tracks.length===1?'':'S'} · SIDE ${escapeHtml(session.side)}</div>
        <div class="dw44-deck-led ${spinning?'is-on':''}"></div>
      </div>
        <div class="dw45-cue-preview" id="dw45CuePreview" hidden aria-live="polite">
          <small class="dw45-cue-kicker">CUE <span class="dw45-cue-direction"></span></small>
          <strong class="dw45-cue-position"></strong>
          <span class="dw45-cue-title"></span>
          <small class="dw45-cue-hint">RELEASE · DROP TO PLAY</small>
        </div>
    </div>`;
  }
  function sleeveTrackMarkup() {
    if (!session)return '';
    const all=Object.entries(session.record.sides).flatMap(([side,list])=>list.map(t=>({...t,side})));
    return `<div class="dw45-sleeve-list"><span class="dw45-sleeve-title">${escapeHtml(session.record.album)} · Tracklist</span>${all.map((t)=>{
      const idx=session.record.sides[t.side].findIndex(x=>x.position===t.position);
      const active=t.side===session.side && idx===session.trackIndex;
      const preview=t.side===session.side && idx===cuePreviewIndex;
      return `<button type="button" class="dw45-sleeve-track ${active?'is-current':''} ${preview?'is-cue-target':''}" data-dw45-track="${idx}" data-dw45-side="${escapeHtml(t.side)}" aria-label="Cue ${escapeHtml(t.position)} ${escapeHtml(t.title)}"><em>${escapeHtml(t.position)}</em><span>${escapeHtml(t.title)}</span></button>`;
    }).join('')}</div>`;
  }
  function sleeveMarkup() {
    return `<div class="dw45-sleeve-row">
      <div class="dw45-sleeve ${sleeveFlipped?'is-flipped':''}" id="dw45Sleeve">
        <div class="dw45-sleeve-inner">
          <button type="button" class="dw45-sleeve-front" data-dw45-open-record title="Open record details" aria-label="Open ${escapeHtml(session.record.album)} detail page">${coverMarkup(session.record)}<span>OPEN RECORD ↗</span></button>
          <div class="dw45-sleeve-back">${sleeveTrackMarkup()}</div>
        </div>
      </div>
      <div class="dw45-sleeve-actions"><span>ORIGINAL VINYL SLEEVE</span><button type="button" data-dw45-flip aria-label="${sleeveFlipped?'Show album cover':'Flip sleeve to view tracklist'}">${sleeveFlipped?'Show cover':'Flip sleeve ↻'}</button><small>Click cover for full details. Flip for tracks.</small></div>
    </div>`;
  }
  function updateCuePreview() {
    if (!dock || !session) return;
    const panel=$('#dw45CuePreview',dock);
    if (panel) {
      panel.hidden=cuePreviewIndex===null;
      if (cuePreviewIndex!==null) {
        const track=session.tracks[cuePreviewIndex];
        const movement=cuePreviewIndex>(cueOriginIndex??session.trackIndex)?'INWARD ↓':cuePreviewIndex<(cueOriginIndex??session.trackIndex)?'OUTWARD ↑':'CURRENT GROOVE';
        $('.dw45-cue-direction',panel).textContent=movement;
        $('.dw45-cue-position',panel).textContent=track.position || `TRACK ${cuePreviewIndex+1}`;
        $('.dw45-cue-title',panel).textContent=track.title || 'Untitled';
      }
    }
    for (const button of $$('.dw45-sleeve-track',dock)) {
      const selected=cuePreviewIndex!==null && button.dataset.dw45Side===session.side && Number(button.dataset.dw45Track)===cuePreviewIndex;
      button.classList.toggle('is-cue-target',selected);
      if(selected) {
        const list=button.closest('.dw45-sleeve-list');
        if(list && sleeveFlipped) {
          const top=button.offsetTop-list.offsetTop;
          if(top<list.scrollTop)list.scrollTop=top;
          else if(top+button.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=top+button.offsetHeight-list.clientHeight;
        }
      }
    }
    const current=$('.dw44-current-track',dock);
    if(current && cuePreviewIndex!==null) current.textContent=`CUE → ${session.tracks[cuePreviewIndex]?.position||''} · ${session.tracks[cuePreviewIndex]?.title||''}`;
  }
  function updateSleeve() {
    const sleeve=$('#dw45Sleeve',dock);if(!sleeve)return;
    sleeve.classList.toggle('is-flipped',sleeveFlipped);
    const list=$('.dw45-sleeve-list',sleeve);
    if(list) { const temp=document.createElement('div'); temp.innerHTML=sleeveTrackMarkup(); list.replaceChildren(...Array.from(temp.firstElementChild?.childNodes || [])); }
    const button=$('[data-dw45-flip]',dock);
    if(button){button.textContent=sleeveFlipped?'Show cover':'Flip sleeve ↻';button.setAttribute('aria-label',sleeveFlipped?'Show album cover':'Flip sleeve to view tracklist');}
    updateCuePreview();
  }
  function openPlayingRecord() {
    if(!session)return;
    const code=session.record.shelfId;
    if($('#detOv')?.classList.contains('on') && text('#mCode')===code){$('#detModal')?.focus();return;}
    const card=Array.from($$('#gridWrap .card-scene[data-id]')).find(e=>text('.card-code',e)===code);
    const flow=Array.from($$('#cfStage .cf-card[data-id]')).find(e=>text('.cf-code',e)===code);
    const node=card||flow;
    const listRow=Array.from($$('#listBody .list-row')).find(e=>text('.c-code',e)===code);
    const listIndex=listRow?.getAttribute('onclick')?.match(/openModal\((\d+)\)/)?.[1];
    if(!node && listIndex!=null && typeof window.openModal==='function'){window.openModal(Number(listIndex));return;}
    if(node?.dataset.id && typeof window.openRecordById==='function')window.openRecordById(node.dataset.id);
    else showPlaybackError('Record is hidden in the current view. Clear filters to open its details.');
  }
  function renderDock() {
    if (!dock) return;
    dock.hidden = !session;
    dock.classList.toggle('dw44-is-minimized', !!session && !expanded);
    dock.classList.toggle('dw44-is-open', !!session && expanded);
    if (!session) { dock.replaceChildren(); return; }
    if (!expanded) {
      cuePreviewIndex=null;cueOriginIndex=null;
      dock.innerHTML = `<button type="button" class="dw44-mini" data-dw44-action="expand" aria-label="Open Digital Turntable" aria-expanded="false">
        <span class="dw44-mini-disc ${session.status==='playing'?'is-spinning':''}">${coverMarkup(session.record)}</span>
        <span class="dw44-mini-copy"><small>${escapeHtml(statusName())} · SIDE ${escapeHtml(session.side)}</small><strong>${escapeHtml(session.record.album)}</strong><span>${escapeHtml(currentTrackTitle())}</span></span>
        <span class="dw44-mini-chevron" aria-hidden="true">⌃</span>
      </button>`;
      return;
    }
    // Update controls and playback labels in place. Never detach the deck:
    // even a temporary detach/reinsert cancels browser CSS transitions.
    const priorDeck = $('.dw44-deck', dock);
    const sameRecord = dock.dataset.dw44RecordKey === session.record.key;
    if (priorDeck && sameRecord) {
      const statusLine = $('.dw44-playing-label', dock);
      if (statusLine) statusLine.innerHTML = `<span class="dw44-status-light ${session.status==='playing'?'is-on':''}"></span>${escapeHtml(statusName())} <span class="dw44-side-label">· SIDE ${escapeHtml(session.side)}</span>`;
      const currentLine = $('.dw44-current-track', dock);
      if (currentLine) currentLine.textContent = session.status === 'finished' ? 'End of side · Turn the record or drop the needle' : currentTrackTitle();
      const buttons = $('.dw44-controls', dock);
      if (buttons) buttons.innerHTML = controls();
      syncDeck(priorDeck);
      updateSleeve();
      const brand=$('.dw44-deck-brand',priorDeck);
      if(brand)brand.innerHTML=`<small>SHELF ID</small>${escapeHtml(session.record.shelfId||'UNASSIGNED')}`;
      const foot=$('.dw44-dock-foot',dock);
      if(foot)foot.innerHTML=session.providerId==='spotify'?'<span>33⅓ RPM · SPOTIFY</span><span>DIGITAL STREAM</span>':'<span>33⅓ RPM · SIMULATED</span><span>NO AUDIO</span>';
      return;
    }
    dock.innerHTML = `
      <div class="dw44-dock-head"><div class="dw44-dock-brand"><span class="dw44-eyebrow">DEAD WAX <i>·</i> TURNTABLE</span><span class="dw44-premium">PREMIUM PREVIEW</span></div>
        <button type="button" class="dw44-minimize" data-dw44-action="minimize" aria-label="Minimize turntable" title="Minimize turntable" aria-expanded="true"><span class="dw45-minimize-text">MINIMIZE</span>${icon('minimize')}</button></div>
      ${turntableMarkup()}
      ${sleeveMarkup()}
      <div class="dw44-dock-info">
        <div class="dw44-dock-titles"><span class="dw44-playing-label"><span class="dw44-status-light ${session.status==='playing'?'is-on':''}"></span>${escapeHtml(statusName())} <span class="dw44-side-label">· SIDE ${escapeHtml(session.side)}</span></span>
          <strong>${escapeHtml(session.record.album)}</strong><span>${escapeHtml(session.record.artist)}</span>
          <span class="dw44-current-track">${escapeHtml(session.status==='finished'?'End of side · Turn the record or drop the needle':currentTrackTitle())}</span>
        </div>
      </div>
      <div class="dw44-controls">${controls()}</div>
      <div class="dw44-dock-foot"><span>33⅓ RPM · ${session.providerId==='spotify'?'SPOTIFY':'SIMULATED'}</span><span>${session.providerId==='spotify'?'DIGITAL STREAM':'NO AUDIO'}</span></div>`;
    dock.dataset.dw44RecordKey = session.record.key;
    const newDeck = $('.dw44-deck', dock);
    if (newDeck) {
      syncDeck(newDeck);
      // A new playing record starts with the stylus on its rest. Cue it
      // across the deck on successive paint frames, then lower onto vinyl.
      if (session.status === 'playing') {
        const arm = $('.dw44-tonearm', newDeck);
        arm.classList.remove('is-lowered');
        arm.classList.add('is-parked');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!dock.contains(arm) || session?.record.key !== dock.dataset.dw44RecordKey || session?.status !== 'playing') return;
          arm.classList.remove('is-parked');
          arm.classList.add('is-lowered');
        }));
      }
    }
  }
  function matchingDetail() {
    return !!(session && $('#detOv')?.classList.contains('on') && tracksFromDetail()?.key === session.record.key);
  }
  function modalControls() {
    const same = matchingDetail();
    const el = $('#dw44RecordPanel');
    if (el) {
      el.hidden = !same;
      if (same) {
        const line = `${statusName()} · SIDE ${session.side}`;
        el.innerHTML = `<div class="dw44-detail-strip"><span class="dw44-status-light ${session.status==='playing'?'is-on':''}"></span><div><strong>${escapeHtml(line)}</strong><span>${escapeHtml(currentTrackTitle())}</span></div><button type="button" data-dw44-action="expand" aria-label="Open turntable">Open turntable ${icon('play')}</button></div>`;
      } else el.replaceChildren();
    }
    let top = $('#dw44DetailStatus');
    if (!top) {
      const chips = $('#mChips');
      if (chips) {
        top = document.createElement('button');
        top.type = 'button';
        top.id = 'dw44DetailStatus';
        top.className = 'dw44-detail-status';
        top.dataset.dw44Action = 'expand';
        top.setAttribute('aria-label','Show Digital Turntable');
        chips.insertAdjacentElement('afterend',top);
      }
    }
    if (top) {
      top.hidden = !same;
      if (same) top.innerHTML = `<span class="dw44-status-light ${session.status==='playing'?'is-on':''}"></span>${escapeHtml(statusName())} · SIDE ${escapeHtml(session.side)} <span class="dw44-detail-chevron">↗</span>`;
    }
    for (const trackEl of $$('#mTlC .m-tl-track')) {
      const pos = text('.m-tl-pos', trackEl);
      const selected = same && pos === session.tracks[session.trackIndex]?.position;
      trackEl.classList.toggle('dw44-current-row', !!selected);
      if (selected) trackEl.setAttribute('aria-current','true');
      else trackEl.removeAttribute('aria-current');
    }
  }
  function firstText(el) {
    if (!el) return '';
    const node = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    return (node?.textContent || el.textContent || '').trim();
  }
  function decorateCollection() {
    // Matching by the user's shelf ID preserves vinyl ownership semantics.
    // No app record objects or physical-listening data are modified.
    const targets = [
      ['#gridWrap .card-scene[data-id]', '.card-code', '.card-cover'],
      ['#listBody .list-row', '.c-code', '.c-art'],
      ['#cfStage .cf-card[data-id]', '.cf-code', '.card-cover'],
      ['#cfMeta .flow-meta-main', '.flow-meta-code', '.flow-meta-code'],
      ['#sf .sf-item', '.sf-code', '.sf-txt']
    ];
    for (const [rootSelector, codeSelector, badgeSelector] of targets) {
      for (const root of $$(rootSelector)) {
        const code = firstText($(codeSelector, root));
        const active = !!(session && session.record.shelfId && code === session.record.shelfId);
        root.classList.toggle('dw44-active-record', active);
        const holder = $(badgeSelector,root);
        if (!holder) continue;
        let marker = Array.from(holder.children).find(x => x.classList.contains('dw44-record-badge'));
        if (!active) { marker?.remove(); continue; }
        if (!marker) {
          marker = document.createElement('span');
          marker.className = 'dw44-record-badge';
          marker.setAttribute('aria-label', 'Digital turntable status');
          holder.appendChild(marker);
        }
        marker.classList.toggle('dw44-is-playing', session.status === 'playing');
        const label = session.status === 'playing' ? 'NOW SPINNING' : session.status === 'paused' ? 'NEEDLE LIFTED' : 'ON TURNTABLE';
        const caption = `${label} · ${session.side}`;
        if (marker.textContent !== caption) marker.textContent = caption;
      }
    }
  }
  function scheduleCollectionDecorate() {
    if (collectionRefreshPending) return;
    collectionRefreshPending = true;
    queueMicrotask(() => { collectionRefreshPending = false; decorateCollection(); });
  }
  function render() {
    renderDock();
    modalControls();
    scheduleCollectionDecorate();
  }
  function decorateDetail() {
    const container = $('#mTlC');
    const parent = $('#mTl');
    if (!container || !parent || !$('#detOv')?.classList.contains('on')) return;
    const record = tracksFromDetail();
    recordView = record;
    if (!record) { modalControls(); return; }
    let panel = $('#dw44RecordPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'dw44RecordPanel';
      panel.className = 'dw44-panel';
      panel.hidden = true;
      panel.setAttribute('aria-label', 'Digital Turntable Premium Preview');
      const heading = $('.sec-lbl', parent);
      if (heading) heading.insertAdjacentElement('afterend', panel);
      else parent.insertAdjacentElement('afterbegin', panel);
    }
    for (const header of $$('.m-tl-side-lbl', container)) {
      const label = (header.getAttribute('data-dw44-side') || header.textContent || '').trim();
      if (header.dataset.dw44Ready === '1' || !record.sides[label]?.length) continue;
      header.dataset.dw44Side = label;
      header.dataset.dw44Ready = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dw44-play-side';
      btn.dataset.dw44PlaySide = label;
      btn.textContent = `▶ Play side ${label}`;
      btn.setAttribute('aria-label', `Play side ${label} of ${record.album} using the connected music provider or preview the turntable`);
      header.appendChild(btn);
    }
    render();
  }
  function scheduleDecorate() {
    if (drawPending) return;
    drawPending = true;
    queueMicrotask(() => { drawPending = false; if (!busy) decorateDetail(); });
  }
  function onAction(event) {
    const sideButton = event.target.closest('[data-dw44-play-side]');
    if (sideButton) { event.preventDefault(); startSide(sideButton.dataset.dw44PlaySide); return; }
    const flip=event.target.closest('[data-dw45-flip]');
    if(flip){event.preventDefault();sleeveFlipped=!sleeveFlipped;updateSleeve();return;}
    const openCover=event.target.closest('[data-dw45-open-record]');
    if(openCover){event.preventDefault();openPlayingRecord();return;}
    const track=event.target.closest('[data-dw45-track]');
    if(track){event.preventDefault();const side=track.dataset.dw45Side;
      if(side!==session?.side){turnToSide(side);}
      cueTrack(Number(track.dataset.dw45Track));return;
    }
    const band=event.target.closest('[data-dw44-groove-track]');
    if(band){event.preventDefault();if(performance.now()<suppressGrooveClickUntil)return;cueTrack(Number(band.dataset.dw44GrooveTrack));return;}
    const button = event.target.closest('[data-dw44-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const map = {needle, stop, turn, swap, minimize: () => {expanded = false; render();}, expand: () => {expanded = true; render();}};
    map[button.dataset.dw44Action]?.();
  }
  function init() {
    if (initialized || !$('#detOv') || !$('#mTlC')) return;
    initialized = true;
    mountDock();
    let needleDrag=null;
    function trackAtPointer(map,x,y) {
      const rect=map.getBoundingClientRect();
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const r=50*Math.hypot(x-cx,y-cy)/(rect.width/2);
      const grooves=trackGrooves();
      if(!grooves.length)return null;
      // Nearest whole track. Unlike scrubbing, the needle snaps to a groove band.
      let best=grooves[0],distance=Infinity;
      for(const band of grooves){const d=Math.abs(r-(band.outer+band.inner)/2);
        if(d<distance){distance=d;best=band;}}
      return best.index;
    }
    function setCuePreview(index){
      if(index===null||!session || index<0 || index>=session.tracks.length)return;
      if(cuePreviewIndex!==index){
        cuePreviewIndex=index;
        syncDeck($('.dw44-deck',dock));
      } else updateCuePreview();
    }
    document.addEventListener('pointerdown',e=>{
      const grip=e.target.closest?.('.dw45-stylus-grip');
      const map=grip ? $('#dw44Dock .dw44-groove-map') : e.target.closest?.('.dw44-groove-map');
      if(!map||!session||session.status==='loading')return;
      needleDrag={map,id:e.pointerId,x:e.clientX,y:e.clientY,grip:!!grip,moved:false};
      cueOriginIndex=session.trackIndex;
      // Lift real audio immediately. Do not call Spotify seek until Drop needle.
      if(session.status==='playing')void needle();
      try{(grip||map).setPointerCapture(e.pointerId);}catch{}
    });
    document.addEventListener('pointermove',e=>{
      const drag=needleDrag;
      if(!drag||drag.id!==e.pointerId||!session)return;
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<1.5&&!drag.moved)return;
      drag.moved=true;
      setCuePreview(trackAtPointer(drag.map,e.clientX,e.clientY));
      e.preventDefault();
    },{passive:false});
    document.addEventListener('pointerup',e=>{
      const drag=needleDrag;needleDrag=null;
      if(!drag||drag.id!==e.pointerId||!session)return;
      const index=drag.moved ? cuePreviewIndex : (drag.grip ? null : trackAtPointer(drag.map,e.clientX,e.clientY));
      cuePreviewIndex=null;cueOriginIndex=null;
      if(index!==null){
        // Releasing the needle confirms ONE track at its beginning; user must
        // drop it to play. Never automatically restart digital audio here.
        suppressGrooveClickUntil=performance.now()+350;
        void cueTrack(index);
      } else {
        const deck=$('.dw44-deck',dock);
        if(deck)syncDeck(deck);
      }
    });
    document.addEventListener('pointercancel',e=>{
      if(!needleDrag||needleDrag.id!==e.pointerId)return;
      needleDrag=null;cuePreviewIndex=null;cueOriginIndex=null;
      const deck=$('.dw44-deck',dock);if(deck)syncDeck(deck);
    });
    document.addEventListener('click', onAction);
    const observer = new MutationObserver(() => {
      if (busy) return;
      busy = true;
      try {
        if ($('#detOv')?.classList.contains('on')) scheduleDecorate();
        else render();
      } finally { busy = false; }
    });
    observer.observe($('#detOv'), {attributes: true, attributeFilter: ['class']});
    observer.observe($('#mTlC'), {childList: true, subtree: false});
    for (const selector of ['#gridWrap','#listBody','#cfStage','#cfMeta','#sf']) {
      const node = $(selector);
      if (node) new MutationObserver(scheduleCollectionDecorate).observe(node, {childList:true, subtree:true});
    }
    // 250-ms deterministic simulation clock, with bounded elapsed-time deltas.
    window.setInterval(() => tick(performance.now()), 250);
    // Hide the player and clear its state if the application logs out.
    const originalSignOut = window.signOut;
    if (typeof originalSignOut === 'function') {
      window.signOut = async function(...args) { swap(); return originalSignOut.apply(this, args); };
    }
    render();
  }
  Object.defineProperty(window, 'DW_TURNTABLE_V45', {
    value: Object.freeze({
      feature: FEATURE,
      isEligible: eligible,
      getState: readState,
      getProviderIds: () => [...providers.keys()],
      registerProvider,
      reportProviderEvent,
      showPlaybackError,
      refresh: render,
      cueTrack,
      stop,
      swap,
      expand: () => { expanded = true; render(); },
      minimize: () => { expanded = false; render(); }
    }),
    configurable: false
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
