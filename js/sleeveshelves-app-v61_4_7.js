/* SleeveShelves v61.4.2 — coherent GitHub Pages full build. Original module order preserved. */

/* MODULE: deadwax-native-exact-v43.js */

(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const cfg = window.DEAD_WAX_SUPABASE || {};
  const SB = window.supabase?.createClient?.(cfg.url, cfg.anonKey);
  const DW = window.DW_NATIVE = {};

  const FIELDS = '*';
  const META_FIELDS = ['discogs_id','discogs_type','cover_url','genre','genres','styles','tracklist','discogs_url','release_year','label','country','raw_data'];
  const state = {
    user: null,
    records: [],
    collections: [],
    collectionLinks: [],
    digitalListenedIds: new Set(),
    digitalListensLoaded: false,
    digitalListensError: '',
    listenedViewMode: 'both',
    digitalListensRequest: 0,
    filtered: [],
    view: 'grid',
    group: 'shelf',
    secondary: 'artist',
    currentId: null,
    random: false,
    cfIndex: 0,
    cfActiveId: null,
    cfPos: 0,
    cfFlipId: null,
    cfTurnLock: false,
    cfWheelAccum: 0,
    cfManualQueue: 0,
    cfMomentumPower: 0,
    cfMomentumDir: 0,
    cfVelocity: 0,
    collapsed: new Set(),
    filters: {collectionId:'', global:'', code:'', artist:'', last:'', first:'', album:'', genre:'', listened:false, doubles:false, rating:'', lastListened:'', grail:false}
  };

  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function arr(v){ return Array.isArray(v) ? v : (typeof v === 'string' && v.trim().startsWith('[') ? JSON.parse(v) : []); }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  const RECORD_CABINET_ID = 'record-cabinet';
  function isRecordCabinet(v){ const n=norm(typeof v==='string'?v:(v?.name||v?.id||'')); return n==='record cabinet' || n==='record-cabinet' || n==='recordcabinet'; }
  function visibleCollections(cols){ return arr(cols).filter(c => !isRecordCabinet(c)); }
  function visibleCollectionRows(cols){ return arr(cols).filter(c => !isRecordCabinet(c)); }
  function internalCollections(cols){
    const out=[];
    for(const c of arr(cols)){
      const v = typeof c === 'string' ? c : (c?.id || c?.name || '');
      if(!v) continue;
      if(isRecordCabinet(v)){
        if(!out.includes(RECORD_CABINET_ID)) out.push(RECORD_CABINET_ID);
      }else if(!out.includes(v)){
        out.push(v);
      }
    }
    if(!out.includes(RECORD_CABINET_ID)) out.unshift(RECORD_CABINET_ID);
    return out;
  }
  function shelfParts(id){ const m=String(id||'').match(/^([A-Za-z]+)\s*0*([0-9]+)(.*)$/); return m ? [m[1].toUpperCase(), parseInt(m[2],10), m[3]||''] : [String(id||'~'), 999999, '']; }
  function shelfCompare(a,b){ const A=shelfParts(a?.shelf_id||a?.code), B=shelfParts(b?.shelf_id||b?.code); return A[0].localeCompare(B[0]) || A[1]-B[1] || A[2].localeCompare(B[2]); }
  function alphaKey(r){ return (r.last || r.artist || '#').trim().charAt(0).toUpperCase().replace(/[^A-Z0-9]/,'#'); }
  function artistSort(a,b){ return norm(a.last||a.artist).localeCompare(norm(b.last||b.artist)) || norm(a.first).localeCompare(norm(b.first)) || norm(a.album).localeCompare(norm(b.album)) || shelfCompare(a,b); }
  function displayYear(r){ return r.release_year || r.year || ''; }
  function extractTracklist(r){
    const candidates = [r?.tracklist,r?.discogsTracklist,r?.raw_data?.tracklist,r?.raw_data?.discogs?.tracklist,r?.raw_data?.entry?.tracklist,r?.raw_data?.metadata?.tracklist,r?.raw_data?.source?.tracklist,r?.raw_data?.original?.tracklist,r?.raw_data?.code_entry?.tracklist,r?.raw_data?.record?.tracklist];
    for(const c of candidates){
      const t=arr(c).filter(x => x && (x.title || x.name || x.position || typeof x === 'string'));
      if(t.length) return t.map((x,i)=> typeof x === 'string' ? {position:String(i+1), title:x, duration:''} : {position:x.position||x.pos||'', title:x.title||x.name||'', duration:x.duration||''});
    }
    return [];
  }
  function tracks(r){ return extractTracklist(r); }
  function reactionValue(r){ if(r.reaction) return r.reaction; if(Number(r.rating)===3) return 'favorite'; if(Number(r.rating)===2 || r.liked) return 'liked'; if(Number(r.rating)===1) return 'disliked'; return ''; }
  function recordCode(r){ return r.shelf_id || r.code || ''; }
  function coverUrl(r){ return r.cover_url || r.coverUrl || r.img || ''; }
  function collectionNames(r){
    const fromLinks = arr(r.collection_ids || r.collectionIds).map(id => {
      const hit = state.collections.find(c => c.id === id);
      return hit ? hit.name : id;
    }).filter(Boolean);
    const raw = visibleCollections(r.collections);
    const fromJson = raw.map(x => {
      if(typeof x === 'string'){
        const hit = state.collections.find(c => c.id === x || c.name === x);
        return hit ? hit.name : x;
      }
      return x?.name || '';
    }).filter(Boolean);
    return [...new Set([...fromLinks, ...fromJson].filter(x => !isRecordCabinet(x)))];
  }
  function collectionIdsForRecord(r){
    const ids = arr(r.collection_ids || r.collectionIds);
    if(ids.length) return ids.filter(id => !isRecordCabinet(id));
    return visibleCollections(r.collections).map(x => {
      if(typeof x !== 'string') return x?.id || x?.name || '';
      const hit = state.collections.find(c => c.id === x || c.name === x);
      return hit ? hit.id : x;
    }).filter(Boolean).filter(id => !isRecordCabinet(id));
  }
  function setSync(txt){ const n=$('#stDbStatus'); if(n) n.textContent=txt || 'Ready'; }
  // V61.4: translate common Supabase errors without exposing internal API terms to collectors.
  function explainError(error, context='save'){
    const message=String(error?.message||error||'').trim();
    const code=String(error?.code||'');
    if(/email not confirmed|email.*confirm|confirmation required/i.test(message)) return 'Confirm your email using the link from Supabase, then sign in again.';
    if(/invalid login credentials/i.test(message)) return 'That email or password was not recognized. Check both and try again.';
    if(/email rate limit|over_email_send_rate_limit|rate limit exceeded/i.test(message)) return 'Too many attempts. Try again later or check whether a confirmation email already arrived.';
    if(/jwt expired|invalid jwt|session.*expired|not authenticated/i.test(message)) return 'Your session has expired. Sign in again before saving.';
    if(code==='23505' || /duplicate key value|unique constraint/i.test(message)) return context==='collection' ? 'A collection with that name already exists. Choose a different name or use the existing collection.' : 'A record with these details already exists. Check its shelf ID, artist and album.';
    if(code==='23503') return 'This item refers to a record or collection that no longer exists. Refresh your collection and try again.';
    if(code==='23514') return 'One of the values is outside the allowed range. Check the record fields.';
    if(code==='22P02') return 'One of the selected identifiers is invalid. Refresh your collection and try again.';
    if(code==='42501' || /row.level security|permission denied/i.test(message)) return 'Your account is not authorized for this change. Confirm your email, sign in again and retry.';
    if(/fetch failed|failed to fetch|network|timed out/i.test(message)) return 'Cannot reach Supabase. Check your connection and try again. Your unsaved edits are still here.';
    return message || 'Something went wrong. Please retry.';
  }
  function showSaveError(error,context='save'){
    setSync('Save error');
    alert(explainError(error,context));
  }
  // Database generates UUIDs; collection names, never slugs, are the user-facing identity.
  async function getOrCreateCollection(name){
    const clean=String(name||'').trim();
    if(!clean || isRecordCabinet(clean)) throw new Error('Enter a collection name other than Record Cabinet.');
    const cached=state.collections.find(c=>c.name===clean);
    if(cached) return cached.id;
    const insert=await SB.from('collections').insert({name:clean,user_id:state.user.id,locked:false}).select('id,name').single();
    if(!insert.error){
      const row=insert.data;
      if(!state.collections.some(c=>c.id===row.id)) state.collections.push({...row,user_id:state.user.id});
      return row.id;
    }
    if(String(insert.error.code)==='23505'){
      // A second tab or concurrent import may have created the name first.
      const existing=await SB.from('collections').select('id,name').eq('user_id',state.user.id).eq('name',clean).single();
      if(!existing.error && existing.data){
        if(!state.collections.some(c=>c.id===existing.data.id))state.collections.push({...existing.data,user_id:state.user.id});
        return existing.data.id;
      }
    }
    throw insert.error;
  }

  // The single official Grail Record badge, shared by grid, list and cover flow.
  function grailBadge(){
    return '<img class="ss61-grail-art" src="assets/sleeveshelves-grail-edition.webp" alt="" loading="lazy" decoding="async">';
  }

  function dwLoginMark(){
    return `<svg class="dw-login-mark" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="g-body-login" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e8b840"/><stop offset="40%" stop-color="#c8901e"/><stop offset="75%" stop-color="#a87018"/><stop offset="100%" stop-color="#7a5010"/></radialGradient>
        <radialGradient id="g-dwax-login" cx="42%" cy="38%" r="60%"><stop offset="0%" stop-color="#f0cc60" stop-opacity="0.12"/><stop offset="100%" stop-color="#8a6010" stop-opacity="0.26"/></radialGradient>
        <radialGradient id="g-lbl-login" cx="36%" cy="34%" r="62%"><stop offset="0%" stop-color="#f8dc70" stop-opacity="0.45"/><stop offset="55%" stop-color="#d09a24" stop-opacity="0"/><stop offset="100%" stop-color="#7a5010" stop-opacity="0.3"/></radialGradient>
        <filter id="groove-wobble-login" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.022" numOctaves="1" seed="23" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.14" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <path id="m-arc-login" d="M140,140 m-48,0 a48,48 0 1,1 96,0 a48,48 0 1,1 -96,0"/>
      </defs>
      <circle cx="140" cy="140" r="139" fill="url(#g-body-login)" stroke="#6a4c10" stroke-width="0.8"/>
      <!-- Groove field: 163 visible rings, Border Dark on Gold. -->
      <g filter="url(#groove-wobble-login)">
      <circle cx="140" cy="140" r="134.000" fill="none" stroke="#261b0a" stroke-width="1.000" opacity="0.80"/>
      <circle cx="140" cy="140" r="133.532" fill="none" stroke="#d09a24" stroke-width="0.219" opacity="0.28"/>
      <circle cx="140" cy="140" r="133.064" fill="none" stroke="#261b0a" stroke-width="0.994" opacity="0.80"/>
      <circle cx="140" cy="140" r="132.596" fill="none" stroke="#d09a24" stroke-width="0.218" opacity="0.28"/>
      <circle cx="140" cy="140" r="132.128" fill="none" stroke="#261b0a" stroke-width="0.987" opacity="0.80"/>
      <circle cx="140" cy="140" r="131.660" fill="none" stroke="#d09a24" stroke-width="0.216" opacity="0.28"/>
      <circle cx="140" cy="140" r="131.193" fill="none" stroke="#261b0a" stroke-width="0.981" opacity="0.79"/>
      <circle cx="140" cy="140" r="130.725" fill="none" stroke="#d09a24" stroke-width="0.215" opacity="0.28"/>
      <circle cx="140" cy="140" r="130.257" fill="none" stroke="#261b0a" stroke-width="0.974" opacity="0.79"/>
      <circle cx="140" cy="140" r="129.789" fill="none" stroke="#d09a24" stroke-width="0.213" opacity="0.28"/>
      <circle cx="140" cy="140" r="129.321" fill="none" stroke="#261b0a" stroke-width="0.968" opacity="0.79"/>
      <circle cx="140" cy="140" r="128.853" fill="none" stroke="#d09a24" stroke-width="0.212" opacity="0.27"/>
      <circle cx="140" cy="140" r="128.385" fill="none" stroke="#261b0a" stroke-width="0.961" opacity="0.79"/>
      <circle cx="140" cy="140" r="127.917" fill="none" stroke="#d09a24" stroke-width="0.210" opacity="0.27"/>
      <circle cx="140" cy="140" r="127.449" fill="none" stroke="#261b0a" stroke-width="0.955" opacity="0.78"/>
      <circle cx="140" cy="140" r="126.981" fill="none" stroke="#d09a24" stroke-width="0.209" opacity="0.27"/>
      <circle cx="140" cy="140" r="126.514" fill="none" stroke="#261b0a" stroke-width="0.949" opacity="0.78"/>
      <circle cx="140" cy="140" r="126.046" fill="none" stroke="#d09a24" stroke-width="0.207" opacity="0.27"/>
      <circle cx="140" cy="140" r="125.578" fill="none" stroke="#261b0a" stroke-width="0.942" opacity="0.78"/>
      <circle cx="140" cy="140" r="125.110" fill="none" stroke="#d09a24" stroke-width="0.206" opacity="0.27"/>
      <circle cx="140" cy="140" r="124.642" fill="none" stroke="#261b0a" stroke-width="0.936" opacity="0.78"/>
      <circle cx="140" cy="140" r="124.174" fill="none" stroke="#d09a24" stroke-width="0.204" opacity="0.27"/>
      <circle cx="140" cy="140" r="123.706" fill="none" stroke="#261b0a" stroke-width="0.929" opacity="0.78"/>
      <circle cx="140" cy="140" r="123.238" fill="none" stroke="#d09a24" stroke-width="0.203" opacity="0.27"/>
      <circle cx="140" cy="140" r="122.770" fill="none" stroke="#261b0a" stroke-width="0.923" opacity="0.77"/>
      <circle cx="140" cy="140" r="122.302" fill="none" stroke="#d09a24" stroke-width="0.201" opacity="0.27"/>
      <circle cx="140" cy="140" r="121.835" fill="none" stroke="#261b0a" stroke-width="0.917" opacity="0.77"/>
      <circle cx="140" cy="140" r="121.367" fill="none" stroke="#d09a24" stroke-width="0.200" opacity="0.27"/>
      <circle cx="140" cy="140" r="120.899" fill="none" stroke="#261b0a" stroke-width="0.910" opacity="0.77"/>
      <circle cx="140" cy="140" r="120.431" fill="none" stroke="#d09a24" stroke-width="0.199" opacity="0.27"/>
      <circle cx="140" cy="140" r="119.963" fill="none" stroke="#261b0a" stroke-width="0.904" opacity="0.77"/>
      <circle cx="140" cy="140" r="119.495" fill="none" stroke="#d09a24" stroke-width="0.197" opacity="0.26"/>
      <circle cx="140" cy="140" r="119.027" fill="none" stroke="#261b0a" stroke-width="0.897" opacity="0.76"/>
      <circle cx="140" cy="140" r="118.559" fill="none" stroke="#d09a24" stroke-width="0.196" opacity="0.26"/>
      <circle cx="140" cy="140" r="118.091" fill="none" stroke="#261b0a" stroke-width="0.891" opacity="0.76"/>
      <circle cx="140" cy="140" r="117.623" fill="none" stroke="#d09a24" stroke-width="0.194" opacity="0.26"/>
      <circle cx="140" cy="140" r="117.156" fill="none" stroke="#261b0a" stroke-width="0.884" opacity="0.76"/>
      <circle cx="140" cy="140" r="116.688" fill="none" stroke="#d09a24" stroke-width="0.193" opacity="0.26"/>
      <circle cx="140" cy="140" r="116.220" fill="none" stroke="#261b0a" stroke-width="0.878" opacity="0.76"/>
      <circle cx="140" cy="140" r="115.752" fill="none" stroke="#d09a24" stroke-width="0.191" opacity="0.26"/>
      <circle cx="140" cy="140" r="115.284" fill="none" stroke="#261b0a" stroke-width="0.872" opacity="0.76"/>
      <circle cx="140" cy="140" r="114.816" fill="none" stroke="#d09a24" stroke-width="0.190" opacity="0.26"/>
      <circle cx="140" cy="140" r="114.348" fill="none" stroke="#261b0a" stroke-width="0.865" opacity="0.75"/>
      <circle cx="140" cy="140" r="113.880" fill="none" stroke="#d09a24" stroke-width="0.188" opacity="0.26"/>
      <circle cx="140" cy="140" r="113.412" fill="none" stroke="#261b0a" stroke-width="0.859" opacity="0.75"/>
      <circle cx="140" cy="140" r="112.944" fill="none" stroke="#d09a24" stroke-width="0.187" opacity="0.26"/>
      <circle cx="140" cy="140" r="112.477" fill="none" stroke="#261b0a" stroke-width="0.852" opacity="0.75"/>
      <circle cx="140" cy="140" r="112.009" fill="none" stroke="#d09a24" stroke-width="0.185" opacity="0.26"/>
      <circle cx="140" cy="140" r="111.541" fill="none" stroke="#261b0a" stroke-width="0.846" opacity="0.75"/>
      <circle cx="140" cy="140" r="111.073" fill="none" stroke="#d09a24" stroke-width="0.184" opacity="0.26"/>
      <circle cx="140" cy="140" r="110.605" fill="none" stroke="#261b0a" stroke-width="0.840" opacity="0.74"/>
      <circle cx="140" cy="140" r="110.137" fill="none" stroke="#d09a24" stroke-width="0.182" opacity="0.25"/>
      <circle cx="140" cy="140" r="109.669" fill="none" stroke="#261b0a" stroke-width="0.833" opacity="0.74"/>
      <circle cx="140" cy="140" r="109.201" fill="none" stroke="#d09a24" stroke-width="0.181" opacity="0.25"/>
      <circle cx="140" cy="140" r="108.733" fill="none" stroke="#261b0a" stroke-width="0.827" opacity="0.74"/>
      <circle cx="140" cy="140" r="108.265" fill="none" stroke="#d09a24" stroke-width="0.179" opacity="0.25"/>
      <circle cx="140" cy="140" r="107.798" fill="none" stroke="#261b0a" stroke-width="0.820" opacity="0.74"/>
      <circle cx="140" cy="140" r="107.330" fill="none" stroke="#d09a24" stroke-width="0.178" opacity="0.25"/>
      <circle cx="140" cy="140" r="106.862" fill="none" stroke="#261b0a" stroke-width="0.814" opacity="0.74"/>
      <circle cx="140" cy="140" r="106.394" fill="none" stroke="#d09a24" stroke-width="0.176" opacity="0.25"/>
      <circle cx="140" cy="140" r="105.926" fill="none" stroke="#261b0a" stroke-width="0.807" opacity="0.73"/>
      <circle cx="140" cy="140" r="105.458" fill="none" stroke="#d09a24" stroke-width="0.175" opacity="0.25"/>
      <circle cx="140" cy="140" r="104.990" fill="none" stroke="#261b0a" stroke-width="0.801" opacity="0.73"/>
      <circle cx="140" cy="140" r="104.522" fill="none" stroke="#d09a24" stroke-width="0.173" opacity="0.25"/>
      <circle cx="140" cy="140" r="104.054" fill="none" stroke="#261b0a" stroke-width="0.795" opacity="0.73"/>
      <circle cx="140" cy="140" r="103.586" fill="none" stroke="#d09a24" stroke-width="0.172" opacity="0.25"/>
      <circle cx="140" cy="140" r="103.119" fill="none" stroke="#261b0a" stroke-width="0.788" opacity="0.73"/>
      <circle cx="140" cy="140" r="102.651" fill="none" stroke="#d09a24" stroke-width="0.170" opacity="0.25"/>
      <circle cx="140" cy="140" r="102.183" fill="none" stroke="#261b0a" stroke-width="0.782" opacity="0.72"/>
      <circle cx="140" cy="140" r="101.715" fill="none" stroke="#d09a24" stroke-width="0.169" opacity="0.25"/>
      <circle cx="140" cy="140" r="101.247" fill="none" stroke="#261b0a" stroke-width="0.775" opacity="0.72"/>
      <circle cx="140" cy="140" r="100.779" fill="none" stroke="#d09a24" stroke-width="0.167" opacity="0.24"/>
      <circle cx="140" cy="140" r="100.311" fill="none" stroke="#261b0a" stroke-width="0.769" opacity="0.72"/>
      <circle cx="140" cy="140" r="99.843" fill="none" stroke="#d09a24" stroke-width="0.166" opacity="0.24"/>
      <circle cx="140" cy="140" r="99.375" fill="none" stroke="#261b0a" stroke-width="0.762" opacity="0.72"/>
      <circle cx="140" cy="140" r="98.907" fill="none" stroke="#d09a24" stroke-width="0.164" opacity="0.24"/>
      <circle cx="140" cy="140" r="98.440" fill="none" stroke="#261b0a" stroke-width="0.756" opacity="0.72"/>
      <circle cx="140" cy="140" r="97.972" fill="none" stroke="#d09a24" stroke-width="0.163" opacity="0.24"/>
      <circle cx="140" cy="140" r="97.504" fill="none" stroke="#261b0a" stroke-width="0.750" opacity="0.71"/>
      <circle cx="140" cy="140" r="97.036" fill="none" stroke="#d09a24" stroke-width="0.161" opacity="0.24"/>
      <circle cx="140" cy="140" r="96.568" fill="none" stroke="#261b0a" stroke-width="0.743" opacity="0.71"/>
      <circle cx="140" cy="140" r="96.100" fill="none" stroke="#d09a24" stroke-width="0.160" opacity="0.24"/>
      <circle cx="140" cy="140" r="95.632" fill="none" stroke="#261b0a" stroke-width="0.737" opacity="0.71"/>
      <circle cx="140" cy="140" r="95.164" fill="none" stroke="#d09a24" stroke-width="0.159" opacity="0.24"/>
      <circle cx="140" cy="140" r="94.696" fill="none" stroke="#261b0a" stroke-width="0.730" opacity="0.71"/>
      <circle cx="140" cy="140" r="94.228" fill="none" stroke="#d09a24" stroke-width="0.157" opacity="0.24"/>
      <circle cx="140" cy="140" r="93.760" fill="none" stroke="#261b0a" stroke-width="0.724" opacity="0.70"/>
      <circle cx="140" cy="140" r="93.293" fill="none" stroke="#d09a24" stroke-width="0.156" opacity="0.24"/>
      <circle cx="140" cy="140" r="92.825" fill="none" stroke="#261b0a" stroke-width="0.718" opacity="0.70"/>
      <circle cx="140" cy="140" r="92.357" fill="none" stroke="#d09a24" stroke-width="0.154" opacity="0.24"/>
      <circle cx="140" cy="140" r="91.889" fill="none" stroke="#261b0a" stroke-width="0.711" opacity="0.70"/>
      <circle cx="140" cy="140" r="91.421" fill="none" stroke="#d09a24" stroke-width="0.153" opacity="0.24"/>
      <circle cx="140" cy="140" r="90.953" fill="none" stroke="#261b0a" stroke-width="0.705" opacity="0.70"/>
      <circle cx="140" cy="140" r="90.485" fill="none" stroke="#d09a24" stroke-width="0.151" opacity="0.23"/>
      <circle cx="140" cy="140" r="90.017" fill="none" stroke="#261b0a" stroke-width="0.698" opacity="0.70"/>
      <circle cx="140" cy="140" r="89.549" fill="none" stroke="#d09a24" stroke-width="0.150" opacity="0.23"/>
      <circle cx="140" cy="140" r="89.081" fill="none" stroke="#261b0a" stroke-width="0.692" opacity="0.69"/>
      <circle cx="140" cy="140" r="88.614" fill="none" stroke="#d09a24" stroke-width="0.148" opacity="0.23"/>
      <circle cx="140" cy="140" r="88.146" fill="none" stroke="#261b0a" stroke-width="0.685" opacity="0.69"/>
      <circle cx="140" cy="140" r="87.678" fill="none" stroke="#d09a24" stroke-width="0.147" opacity="0.23"/>
      <circle cx="140" cy="140" r="87.210" fill="none" stroke="#261b0a" stroke-width="0.679" opacity="0.69"/>
      <circle cx="140" cy="140" r="86.742" fill="none" stroke="#d09a24" stroke-width="0.145" opacity="0.23"/>
      <circle cx="140" cy="140" r="86.274" fill="none" stroke="#261b0a" stroke-width="0.673" opacity="0.69"/>
      <circle cx="140" cy="140" r="85.806" fill="none" stroke="#d09a24" stroke-width="0.144" opacity="0.23"/>
      <circle cx="140" cy="140" r="85.338" fill="none" stroke="#261b0a" stroke-width="0.666" opacity="0.68"/>
      <circle cx="140" cy="140" r="84.870" fill="none" stroke="#d09a24" stroke-width="0.142" opacity="0.23"/>
      <circle cx="140" cy="140" r="84.402" fill="none" stroke="#261b0a" stroke-width="0.660" opacity="0.68"/>
      <circle cx="140" cy="140" r="83.935" fill="none" stroke="#d09a24" stroke-width="0.141" opacity="0.23"/>
      <circle cx="140" cy="140" r="83.467" fill="none" stroke="#261b0a" stroke-width="0.653" opacity="0.68"/>
      <circle cx="140" cy="140" r="82.999" fill="none" stroke="#d09a24" stroke-width="0.139" opacity="0.23"/>
      <circle cx="140" cy="140" r="82.531" fill="none" stroke="#261b0a" stroke-width="0.647" opacity="0.68"/>
      <circle cx="140" cy="140" r="82.063" fill="none" stroke="#d09a24" stroke-width="0.138" opacity="0.23"/>
      <circle cx="140" cy="140" r="81.595" fill="none" stroke="#261b0a" stroke-width="0.640" opacity="0.68"/>
      <circle cx="140" cy="140" r="81.127" fill="none" stroke="#d09a24" stroke-width="0.136" opacity="0.22"/>
      <circle cx="140" cy="140" r="80.659" fill="none" stroke="#261b0a" stroke-width="0.634" opacity="0.67"/>
      <circle cx="140" cy="140" r="80.191" fill="none" stroke="#d09a24" stroke-width="0.135" opacity="0.22"/>
      <circle cx="140" cy="140" r="79.723" fill="none" stroke="#261b0a" stroke-width="0.628" opacity="0.67"/>
      <circle cx="140" cy="140" r="79.256" fill="none" stroke="#d09a24" stroke-width="0.133" opacity="0.22"/>
      <circle cx="140" cy="140" r="78.788" fill="none" stroke="#261b0a" stroke-width="0.621" opacity="0.67"/>
      <circle cx="140" cy="140" r="78.320" fill="none" stroke="#d09a24" stroke-width="0.132" opacity="0.22"/>
      <circle cx="140" cy="140" r="77.852" fill="none" stroke="#261b0a" stroke-width="0.615" opacity="0.67"/>
      <circle cx="140" cy="140" r="77.384" fill="none" stroke="#d09a24" stroke-width="0.130" opacity="0.22"/>
      <circle cx="140" cy="140" r="76.916" fill="none" stroke="#261b0a" stroke-width="0.608" opacity="0.66"/>
      <circle cx="140" cy="140" r="76.448" fill="none" stroke="#d09a24" stroke-width="0.129" opacity="0.22"/>
      <circle cx="140" cy="140" r="75.980" fill="none" stroke="#261b0a" stroke-width="0.602" opacity="0.66"/>
      <circle cx="140" cy="140" r="75.512" fill="none" stroke="#d09a24" stroke-width="0.127" opacity="0.22"/>
      <circle cx="140" cy="140" r="75.044" fill="none" stroke="#261b0a" stroke-width="0.596" opacity="0.66"/>
      <circle cx="140" cy="140" r="74.577" fill="none" stroke="#d09a24" stroke-width="0.126" opacity="0.22"/>
      <circle cx="140" cy="140" r="74.109" fill="none" stroke="#261b0a" stroke-width="0.589" opacity="0.66"/>
      <circle cx="140" cy="140" r="73.641" fill="none" stroke="#d09a24" stroke-width="0.124" opacity="0.22"/>
      <circle cx="140" cy="140" r="73.173" fill="none" stroke="#261b0a" stroke-width="0.583" opacity="0.66"/>
      <circle cx="140" cy="140" r="72.705" fill="none" stroke="#d09a24" stroke-width="0.123" opacity="0.22"/>
      <circle cx="140" cy="140" r="72.237" fill="none" stroke="#261b0a" stroke-width="0.576" opacity="0.65"/>
      <circle cx="140" cy="140" r="71.769" fill="none" stroke="#d09a24" stroke-width="0.121" opacity="0.21"/>
      <circle cx="140" cy="140" r="71.301" fill="none" stroke="#261b0a" stroke-width="0.570" opacity="0.65"/>
      <circle cx="140" cy="140" r="70.833" fill="none" stroke="#d09a24" stroke-width="0.120" opacity="0.21"/>
      <circle cx="140" cy="140" r="70.365" fill="none" stroke="#261b0a" stroke-width="0.563" opacity="0.65"/>
      <circle cx="140" cy="140" r="69.898" fill="none" stroke="#d09a24" stroke-width="0.119" opacity="0.21"/>
      <circle cx="140" cy="140" r="69.430" fill="none" stroke="#261b0a" stroke-width="0.557" opacity="0.65"/>
      <circle cx="140" cy="140" r="68.962" fill="none" stroke="#d09a24" stroke-width="0.117" opacity="0.21"/>
      <circle cx="140" cy="140" r="68.494" fill="none" stroke="#261b0a" stroke-width="0.551" opacity="0.64"/>
      <circle cx="140" cy="140" r="68.026" fill="none" stroke="#d09a24" stroke-width="0.116" opacity="0.21"/>
      <circle cx="140" cy="140" r="67.558" fill="none" stroke="#261b0a" stroke-width="0.544" opacity="0.64"/>
      <circle cx="140" cy="140" r="67.090" fill="none" stroke="#d09a24" stroke-width="0.114" opacity="0.21"/>
      <circle cx="140" cy="140" r="66.622" fill="none" stroke="#261b0a" stroke-width="0.538" opacity="0.64"/>
      <circle cx="140" cy="140" r="66.154" fill="none" stroke="#d09a24" stroke-width="0.113" opacity="0.21"/>
      <circle cx="140" cy="140" r="65.686" fill="none" stroke="#261b0a" stroke-width="0.531" opacity="0.64"/>
      <circle cx="140" cy="140" r="65.219" fill="none" stroke="#d09a24" stroke-width="0.111" opacity="0.21"/>
      <circle cx="140" cy="140" r="64.751" fill="none" stroke="#261b0a" stroke-width="0.525" opacity="0.64"/>
      <circle cx="140" cy="140" r="64.283" fill="none" stroke="#d09a24" stroke-width="0.110" opacity="0.21"/>
      <circle cx="140" cy="140" r="63.815" fill="none" stroke="#261b0a" stroke-width="0.519" opacity="0.63"/>
      <circle cx="140" cy="140" r="63.347" fill="none" stroke="#d09a24" stroke-width="0.108" opacity="0.21"/>
      <circle cx="140" cy="140" r="62.879" fill="none" stroke="#261b0a" stroke-width="0.512" opacity="0.63"/>
      <circle cx="140" cy="140" r="62.411" fill="none" stroke="#d09a24" stroke-width="0.107" opacity="0.20"/>
      <circle cx="140" cy="140" r="61.943" fill="none" stroke="#261b0a" stroke-width="0.506" opacity="0.63"/>
      <circle cx="140" cy="140" r="61.475" fill="none" stroke="#d09a24" stroke-width="0.105" opacity="0.20"/>
      <circle cx="140" cy="140" r="61.007" fill="none" stroke="#261b0a" stroke-width="0.499" opacity="0.63"/>
      <circle cx="140" cy="140" r="60.540" fill="none" stroke="#d09a24" stroke-width="0.104" opacity="0.20"/>
      <circle cx="140" cy="140" r="60.072" fill="none" stroke="#261b0a" stroke-width="0.493" opacity="0.62"/>
      <circle cx="140" cy="140" r="59.604" fill="none" stroke="#d09a24" stroke-width="0.102" opacity="0.20"/>
      <circle cx="140" cy="140" r="59.136" fill="none" stroke="#261b0a" stroke-width="0.486" opacity="0.62"/>
      <circle cx="140" cy="140" r="58.668" fill="none" stroke="#d09a24" stroke-width="0.101" opacity="0.20"/>
      <circle cx="140" cy="140" r="58.200" fill="none" stroke="#261b0a" stroke-width="0.480" opacity="0.62"/>
      </g>
      <circle cx="140" cy="140" r="56" fill="#c8880c"/><circle cx="140" cy="140" r="56" fill="url(#g-dwax-login)"/><circle cx="140" cy="140" r="56" fill="none" stroke="#7a5a10" stroke-width="0.62"/><circle cx="140" cy="140" r="38" fill="none" stroke="#7a5a10" stroke-width="0.42"/>
      <text font-family="Jost,sans-serif" font-size="3.15" fill="#4a3509" letter-spacing=".85" font-weight="400" opacity="0.24"><textPath href="#m-arc-login" startOffset="0%">IN HONOR OF DAD · SO HIS COLLECTION MAY LIVE FOR GENERATIONS</textPath></text>
      <circle cx="141" cy="141" r="35" fill="#5a3c0a" opacity="0.46"/><circle cx="140" cy="140" r="35" fill="#d09a24"/><circle cx="140" cy="140" r="35" fill="url(#g-lbl-login)"/><circle cx="140" cy="140" r="35" fill="none" stroke="#a87218" stroke-width="0.7"/>
      <circle cx="140" cy="140" r="31" fill="none" stroke="#b8861e" stroke-width="0.34" opacity="0.42"/><circle cx="140" cy="140" r="27" fill="none" stroke="#b8861e" stroke-width="0.22" opacity="0.25"/>
      <text x="140" y="148" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="28" font-weight="600" fill="#0b0906" letter-spacing="2.1">SS</text><circle cx="140" cy="140" r="4" fill="#0b0906" stroke="#6a4c10" stroke-width="0.42"/>
    </svg>`;
  }


  function ensureAuthShell(){
    if($('#dwAuth')) return;
    const css = document.createElement('style');
    css.textContent = `
      .dw-auth{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 8%,rgba(240,195,79,.09),transparent 28%),linear-gradient(180deg,#130e08 0%,#080604 58%,#030201 100%);padding:clamp(.75rem,2vw,1.4rem);overflow:hidden;color:var(--cream)}
      .dw-auth.on{display:flex}.dw-auth::before{content:'';position:absolute;inset:-12%;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");opacity:.18;mix-blend-mode:screen}.dw-auth::after{content:'';position:absolute;left:50%;top:50%;width:min(1120px,92vw);height:min(760px,86vh);transform:translate(-50%,-50%);border-radius:36px;background:radial-gradient(ellipse at 50% 100%,rgba(0,0,0,.55),transparent 58%);filter:blur(18px);pointer-events:none}
      .dw-turntable{position:relative;z-index:1;width:min(1080px,96vw);min-height:min(700px,88vh);display:grid;grid-template-columns:minmax(360px,1.08fr) minmax(310px,.76fr);gap:clamp(1rem,3vw,2.4rem);align-items:center;padding:clamp(1rem,3vw,2rem);border:1px solid rgba(208,154,36,.22);border-radius:30px;background:linear-gradient(145deg,#24180d 0%,#110c07 42%,#070503 100%);box-shadow:0 34px 110px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.055),inset 0 -1px 0 rgba(0,0,0,.72);overflow:hidden}.dw-turntable::before{content:'';position:absolute;inset:18px;border:1px solid rgba(208,154,36,.12);border-radius:24px;pointer-events:none}.dw-turntable::after{content:'';position:absolute;left:2.8rem;right:2.8rem;bottom:1.45rem;height:8px;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(208,154,36,.16),transparent);filter:blur(4px);pointer-events:none}
      .dw-deck{position:relative;min-height:540px;display:flex;align-items:center;justify-content:center}.dw-platter{position:relative;width:min(520px,44vw);min-width:340px;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 50%,#030302 0 5%,#14110d 5.4% 8%,#070605 8.4% 16%,#1a1712 16.4% 17.1%,#090807 17.5% 31%,#1f1b15 31.4% 32.1%,#080706 32.5% 48%,#231d15 48.4% 49.1%,#090705 49.4% 62%,#272018 62.4% 63.1%,#090705 63.5% 100%);box-shadow:0 22px 60px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.025),inset 0 0 42px rgba(0,0,0,.9)}.dw-platter::before{content:'';position:absolute;inset:-18px;border-radius:50%;background:conic-gradient(from 0deg,rgba(208,154,36,.14),rgba(255,255,255,.03),rgba(208,154,36,.08),rgba(0,0,0,.18),rgba(208,154,36,.14));z-index:-1;box-shadow:inset 0 0 0 1px rgba(208,154,36,.18)}.dw-record{position:absolute;inset:7%;border-radius:50%;background:repeating-radial-gradient(circle at center,#080706 0 3px,#14110e 4px 5px,#080706 6px 9px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),inset 0 0 35px rgba(0,0,0,.75);animation:dwRecordSpin 18s linear infinite}.dw-label{position:absolute;inset:34%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,#f0c34f 0%,#d09a24 48%,#8d6815 100%);border:2px solid rgba(11,9,6,.75);box-shadow:0 0 0 5px rgba(208,154,36,.16),inset 0 2px 4px rgba(244,234,210,.3)}.dw-label .dw-mark{width:82%;height:82%;filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))}.dw-spindle{position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border-radius:50%;background:#f4ead2;box-shadow:0 0 0 3px #0b0906,0 0 20px rgba(240,195,79,.5)}
      .dw-tonearm{position:absolute;right:1.5%;top:8%;width:42%;height:42%;transform-origin:87% 18%;transform:rotate(-20deg);transition:transform .48s cubic-bezier(.18,.86,.22,1);pointer-events:none}.dw-auth.signup .dw-tonearm{transform:rotate(-8deg)}.dw-auth.signin .dw-tonearm{transform:rotate(6deg)}.dw-tonearm::before{content:'';position:absolute;right:8%;top:10%;width:72%;height:12px;border-radius:999px;background:linear-gradient(90deg,#d7c7a5,#6d5a3a 36%,#c7a75b);box-shadow:0 4px 12px rgba(0,0,0,.55);transform:rotate(32deg);transform-origin:right center}.dw-tonearm::after{content:'';position:absolute;left:8%;bottom:22%;width:34px;height:18px;border-radius:4px;background:#0b0906;border:1px solid rgba(240,195,79,.34);transform:rotate(32deg);box-shadow:0 6px 16px rgba(0,0,0,.58)}.dw-pivot{position:absolute;right:0;top:0;width:82px;height:82px;border-radius:50%;background:radial-gradient(circle,#2b2114 0 40%,#0b0906 42% 100%);border:1px solid rgba(208,154,36,.26);box-shadow:0 8px 24px rgba(0,0,0,.58)}
      .dw-auth-panel{position:relative;z-index:3;align-self:center;border-radius:24px;border:1px solid rgba(208,154,36,.22);background:linear-gradient(180deg,rgba(21,16,8,.92),rgba(9,7,4,.96));box-shadow:0 22px 70px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.045);padding:1.35rem}.dw-auth-kicker{font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gd);font-weight:700}.dw-auth-title{font-family:'Cormorant Garamond',serif;color:var(--gl);font-size:clamp(2.2rem,4vw,3.8rem);line-height:.92;margin:.3rem 0 .4rem}.dw-auth-copy{color:var(--mt);font-size:.82rem;line-height:1.55;margin:0 0 1.1rem}.dw-auth-card label{display:block;font-size:.58rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--m2);margin:.68rem 0 .24rem}.dw-auth-card input{width:100%;background:var(--s2);border:1px solid var(--b2);border-radius:9px;color:var(--cream);padding:.68rem .78rem;font-family:'Jost',sans-serif;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}.dw-auth-card input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(208,154,36,.12),inset 0 1px 0 rgba(255,255,255,.04)}.dw-deck-controls{display:grid;grid-template-columns:1fr 1fr;gap:.78rem;margin-top:1.05rem}.dw-deck-btn{position:relative;min-height:3.2rem;border-radius:999px;border:1px solid rgba(208,154,36,.42);font-family:'Jost',sans-serif;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease;box-shadow:0 8px 18px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.16)}.dw-deck-btn:active{transform:translateY(2px);box-shadow:0 4px 10px rgba(0,0,0,.44),inset 0 2px 8px rgba(0,0,0,.34)}.dw-deck-btn.signin{background:linear-gradient(180deg,var(--gl),var(--gold));color:#0b0906}.dw-deck-btn.signup{background:linear-gradient(180deg,#251a0d,#100b06);color:var(--gl);border-color:rgba(240,195,79,.28)}.dw-deck-btn:hover{filter:brightness(1.06)}.dw-deck-btn::before{content:'';position:absolute;left:1rem;top:50%;width:.48rem;height:.48rem;border-radius:50%;transform:translateY(-50%);background:currentColor;opacity:.58;box-shadow:0 0 12px currentColor}.dw-auth-error{color:#ff8a7f;font-size:.74rem;line-height:1.35;margin-top:.72rem;min-height:1rem}.dw-auth-note{display:flex;align-items:center;gap:.48rem;margin-top:.8rem;color:var(--m2);font-size:.62rem}.dw-auth-note::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px rgba(208,154,36,.6)}.dw-booting:before{content:'Loading SleeveShelves…';position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:1.4rem}@keyframes dwRecordSpin{to{transform:rotate(360deg)}}
      @media(max-width:840px){.dw-turntable{grid-template-columns:1fr;min-height:auto}.dw-deck{min-height:390px}.dw-platter{width:min(420px,82vw);min-width:260px}.dw-tonearm{right:8%;top:5%;width:36%;height:36%}.dw-auth-panel{width:100%}}
      @media(max-width:520px){.dw-auth{padding:.55rem}.dw-turntable{border-radius:22px;padding:.85rem}.dw-deck{min-height:310px}.dw-auth-title{font-size:2.25rem}.dw-deck-controls{grid-template-columns:1fr}.dw-auth-panel{padding:1rem}.dw-pivot{width:58px;height:58px}}
      @media(prefers-reduced-motion:reduce){.dw-record{animation:none}.dw-tonearm,.dw-deck-btn{transition:none}}
    `;
    document.head.appendChild(css);

    const loginFix = document.createElement('style');
    loginFix.textContent = `
      html body .dw-auth{position:fixed!important;inset:0!important;z-index:9999!important;display:none!important;padding:0!important;background:radial-gradient(circle at 62% 22%,rgba(208,154,36,.10),transparent 30%),linear-gradient(135deg,#1a1108 0%,#0b0805 44%,#050302 100%)!important;overflow:hidden!important;color:var(--cream)!important}
      html body .dw-auth.on{display:block!important}
      html body .dw-auth::before{content:''!important;position:absolute!important;inset:0!important;pointer-events:none!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.10'/%3E%3C/svg%3E")!important;opacity:.12!important;mix-blend-mode:screen!important;z-index:1!important}
      html body .dw-auth::after{content:none!important;display:none!important}
      html body .dw-turntable{position:absolute!important;inset:0!important;z-index:2!important;display:block!important;overflow:hidden!important;background:linear-gradient(145deg,rgba(244,234,210,.025),transparent 24%,rgba(0,0,0,.20)),radial-gradient(circle at 78% 74%,rgba(208,154,36,.055),transparent 30%)!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;width:auto!important;min-height:0!important;max-width:none!important;grid-template-columns:none!important}
      html body .dw-turntable::before{content:''!important;position:absolute!important;right:-8vmax!important;bottom:-12vmax!important;width:62vmax!important;height:62vmax!important;border-radius:50%!important;border:1px solid rgba(208,154,36,.08)!important;background:radial-gradient(circle,rgba(240,195,79,.045),transparent 56%)!important;filter:blur(1px)!important;pointer-events:none!important;inset:auto!important}
      html body .dw-turntable::after{content:''!important;position:absolute!important;left:46vw!important;top:0!important;bottom:0!important;width:1px!important;height:auto!important;background:linear-gradient(180deg,transparent,rgba(208,154,36,.12),transparent)!important;opacity:.9!important;pointer-events:none!important;right:auto!important;filter:none!important}
      html body .dw-deck{position:absolute!important;left:clamp(-58rem,-42vw,-20rem)!important;top:50%!important;width:clamp(720px,96vmax,1320px)!important;height:clamp(720px,96vmax,1320px)!important;min-width:0!important;min-height:0!important;transform:translateY(-50%)!important;display:block!important;z-index:2!important;pointer-events:none!important}
      html body .dw-platter{position:absolute!important;inset:0!important;border-radius:50%!important;aspect-ratio:1!important;background:radial-gradient(circle at 50% 50%,rgba(244,234,210,.15) 0 .45%,#0b0906 .7% 1.2%,transparent 1.35%),conic-gradient(from 16deg,rgba(240,195,79,.22),rgba(122,80,16,.18),rgba(240,195,79,.20),rgba(0,0,0,.05),rgba(240,195,79,.22))!important;box-shadow:0 34px 110px rgba(0,0,0,.72),inset 0 0 0 2px rgba(240,195,79,.20),inset 0 0 0 18px rgba(11,9,6,.48),inset 0 0 80px rgba(0,0,0,.58)!important;width:auto!important;min-width:0!important}
      html body .dw-platter::before{content:''!important;position:absolute!important;inset:4.5%!important;border-radius:50%!important;background:repeating-radial-gradient(circle at center,rgba(11,9,6,.28) 0 2px,rgba(244,234,210,.035) 3px 4px,rgba(11,9,6,.25) 5px 8px),radial-gradient(circle at 50% 50%,#e8b840 0,#d09a24 22%,#b07818 62%,#7a5010 100%)!important;box-shadow:inset 0 0 0 1px rgba(11,9,6,.38),inset 0 0 62px rgba(11,9,6,.38)!important;animation:dwRecordSpin 28s linear infinite!important;z-index:1!important}
      html body .dw-platter::after{content:''!important;position:absolute!important;inset:18%!important;border-radius:50%!important;border:2px solid rgba(11,9,6,.42)!important;box-shadow:0 0 0 26px rgba(11,9,6,.12),0 0 0 54px rgba(244,234,210,.035),inset 0 0 0 1px rgba(244,234,210,.10)!important;z-index:2!important;background:none!important}
      html body .dw-record{display:none!important}
      html body .dw-label{position:absolute!important;inset:36%!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;background:radial-gradient(circle at 50% 42%,#f3c951 0%,#d09a24 50%,#8d6815 100%)!important;border:2px solid rgba(11,9,6,.72)!important;box-shadow:0 0 0 8px rgba(11,9,6,.22),inset 0 2px 5px rgba(244,234,210,.35),0 8px 36px rgba(0,0,0,.34)!important;z-index:3!important;animation:dwRecordSpin 28s linear infinite!important;width:auto!important;height:auto!important}
      html body .dw-label .dw-mark{width:82%!important;height:82%!important;filter:drop-shadow(0 2px 5px rgba(0,0,0,.30))!important}
      html body .dw-spindle{position:absolute!important;left:50%!important;top:50%!important;width:12px!important;height:12px!important;transform:translate(-50%,-50%)!important;border-radius:50%!important;background:#f4ead2!important;box-shadow:0 0 0 4px rgba(11,9,6,.88),0 0 20px rgba(240,195,79,.46)!important;z-index:4!important}
      html body .dw-tonearm{position:absolute!important;left:clamp(410px,43vw,660px)!important;top:clamp(10px,2.4vh,32px)!important;width:clamp(250px,28vw,430px)!important;height:clamp(250px,28vw,430px)!important;transform-origin:82% 14%!important;transform:rotate(-19deg)!important;transition:transform .52s cubic-bezier(.18,.86,.22,1)!important;pointer-events:none!important;z-index:5!important;right:auto!important;bottom:auto!important}
      html body .dw-auth.signup .dw-tonearm{transform:rotate(-24deg)!important}
      html body .dw-auth.signin .dw-tonearm{transform:rotate(-10deg)!important}
      html body .dw-auth.playing .dw-tonearm{transform:rotate(-4deg)!important}
      html body .dw-tonearm::before{content:''!important;position:absolute!important;right:14%!important;top:14%!important;width:82%!important;height:10px!important;border-radius:999px!important;background:linear-gradient(90deg,#f0dfbd 0%,#a98d58 32%,#302418 66%,#c7a75b 100%)!important;box-shadow:0 5px 14px rgba(0,0,0,.55)!important;transform:rotate(33deg)!important;transform-origin:right center!important}
      html body .dw-tonearm::after{content:''!important;position:absolute!important;left:3%!important;top:61%!important;width:16px!important;height:28px!important;border-radius:2px 2px 8px 8px!important;background:linear-gradient(180deg,#2d2114,#0b0906)!important;border:1px solid rgba(240,195,79,.26)!important;transform:rotate(33deg)!important;box-shadow:0 7px 18px rgba(0,0,0,.5)!important;bottom:auto!important}
      html body .dw-pivot{position:absolute!important;right:0!important;top:0!important;width:88px!important;height:88px!important;border-radius:50%!important;background:radial-gradient(circle,#4a3824 0 32%,#20170d 34% 52%,#0b0906 54% 100%)!important;border:1px solid rgba(208,154,36,.30)!important;box-shadow:0 8px 26px rgba(0,0,0,.62),inset 0 1px 0 rgba(244,234,210,.08)!important}
      html body .dw-auth-intro{position:absolute!important;right:clamp(1.2rem,5.3vw,5rem)!important;top:clamp(3.4rem,12vh,8.5rem)!important;z-index:6!important;width:min(520px,calc(100vw - 2.4rem))!important;padding-left:.1rem!important}
      html body .dw-auth-intro-kicker{font-size:.58rem!important;letter-spacing:.22em!important;text-transform:uppercase!important;color:var(--gd)!important;font-weight:800!important;margin-bottom:.42rem!important}
      html body .dw-auth-intro h1{font-family:'Cormorant Garamond',serif!important;color:var(--gl)!important;font-size:clamp(3.2rem,6vw,5.9rem)!important;line-height:.88!important;margin:0 0 .68rem!important;text-shadow:0 10px 34px rgba(0,0,0,.50)!important}
      html body .dw-auth-intro p{max-width:46ch!important;color:var(--mt)!important;font-size:clamp(.84rem,1.05vw,.98rem)!important;line-height:1.65!important;font-weight:300!important}
      html body .dw-auth-panel{position:absolute!important;right:clamp(1.2rem,5.3vw,5rem)!important;top:clamp(22rem,48vh,33rem)!important;transform:translateY(-50%)!important;z-index:7!important;width:min(430px,calc(100vw - 2.4rem))!important;padding:1.08rem 1.18rem 1.08rem!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(24,17,9,.94),rgba(8,6,3,.98))!important;border:1px solid rgba(208,154,36,.30)!important;box-shadow:inset 0 1px 0 rgba(244,234,210,.08),0 22px 62px rgba(0,0,0,.48)!important;backdrop-filter:none!important;align-self:auto!important;max-width:none!important}
      html body .dw-auth-panel::before,html body .dw-auth-panel::after{content:none!important;display:none!important}
      html body .dw-auth-kicker,html body .dw-auth-title,html body .dw-auth-copy{display:none!important}
      html body .dw-auth-card label{display:block!important;font-size:.58rem!important;font-weight:800!important;letter-spacing:.15em!important;text-transform:uppercase!important;color:var(--m2)!important;margin:.68rem 0 .25rem!important}
      html body .dw-auth-card label:first-of-type{margin-top:0!important}
      html body .dw-auth-card input{width:100%!important;background:var(--s2)!important;border:1px solid var(--b2)!important;border-radius:9px!important;color:var(--cream)!important;padding:.72rem .82rem!important;font-family:'Jost',sans-serif!important;outline:none!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
      html body .dw-auth-card input:focus{border-color:var(--gold)!important;box-shadow:0 0 0 3px rgba(208,154,36,.12),inset 0 1px 0 rgba(255,255,255,.04)!important}
      html body .dw-deck-controls{display:grid!important;grid-template-columns:1fr 1fr!important;gap:.82rem!important;margin-top:1.1rem!important}
      html body .dw-deck-btn{position:relative!important;min-height:3.15rem!important;border-radius:999px!important;border:1px solid rgba(208,154,36,.42)!important;font-family:'Jost',sans-serif!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important;cursor:pointer!important;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease!important;box-shadow:0 8px 18px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.16)!important}
      html body .dw-deck-btn:active{transform:translateY(2px)!important;box-shadow:0 4px 10px rgba(0,0,0,.44),inset 0 2px 8px rgba(0,0,0,.34)!important}
      html body .dw-deck-btn.signin{background:linear-gradient(180deg,var(--gl),var(--gold))!important;color:#0b0906!important}
      html body .dw-deck-btn.signup{background:linear-gradient(180deg,#251a0d,#100b06)!important;color:var(--gl)!important;border-color:rgba(240,195,79,.28)!important}
      html body .dw-deck-btn:hover{filter:brightness(1.06)!important}
      html body .dw-deck-btn::before{content:''!important;position:absolute!important;left:1rem!important;top:50%!important;width:.72rem!important;height:.72rem!important;border-radius:50%!important;transform:translateY(-50%)!important;background:currentColor!important;opacity:.34!important;box-shadow:0 0 12px currentColor!important}
      html body .dw-auth-error{color:#ff8a7f!important;font-size:.74rem!important;line-height:1.35!important;margin-top:.72rem!important;min-height:1rem!important}
      html body .dw-auth-note{display:flex!important;align-items:center!important;gap:.48rem!important;margin-top:.78rem!important;color:var(--m2)!important;font-size:.62rem!important}
      html body .dw-auth-note::before{content:''!important;width:8px!important;height:8px!important;border-radius:50%!important;background:var(--gold)!important;box-shadow:0 0 12px rgba(208,154,36,.6)!important}
      @media(max-width:980px){html body .dw-deck{left:-520px!important;width:920px!important;height:920px!important}html body .dw-tonearm{left:48vw!important;top:1.2rem!important;width:280px!important;height:280px!important}html body .dw-auth-intro{top:2rem!important;right:1.2rem!important;width:min(420px,calc(100vw - 2.4rem))!important}html body .dw-auth-panel{right:1.2rem!important;top:auto!important;bottom:1.2rem!important;transform:none!important;width:min(430px,calc(100vw - 2.4rem))!important}html body .dw-auth-intro h1{font-size:3.4rem!important}html body .dw-auth-intro p{font-size:.82rem!important}}
      @media(max-width:640px){html body .dw-deck{left:50%!important;top:-420px!important;transform:translateX(-50%)!important;width:780px!important;height:780px!important}html body .dw-tonearm{left:auto!important;right:1rem!important;top:.7rem!important;width:210px!important;height:210px!important}html body .dw-pivot{width:62px!important;height:62px!important}html body .dw-auth-intro{left:1rem!important;right:1rem!important;top:15.5rem!important;width:auto!important}html body .dw-auth-intro h1{font-size:2.7rem!important}html body .dw-auth-intro p{font-size:.78rem!important;line-height:1.5!important}html body .dw-auth-panel{left:1rem!important;right:1rem!important;bottom:1rem!important;width:auto!important;padding:1rem!important}html body .dw-deck-controls{grid-template-columns:1fr!important}html body .dw-deck-btn{min-height:2.95rem!important}}


      /* v20 stable login patch: keep v15 vinyl, remove arm/rectangles, align right column */
      html body .dw-tonearm,
      html body .dw-tonearm::before,
      html body .dw-tonearm::after,
      html body .dw-pivot{
        display:none!important;
        content:none!important;
      }
      html body .dw-turntable::after{
        content:none!important;
        display:none!important;
      }
      html body .dw-auth-intro,
      html body .dw-auth-panel{
        right:clamp(1.5rem,6vw,5.4rem)!important;
        width:min(480px,calc(100vw - 3rem))!important;
      }
      html body .dw-auth-intro{
        top:50%!important;
        transform:translateY(calc(-50% - 10.5rem))!important;
        z-index:7!important;
      }
      html body .dw-auth-intro p{
        max-width:43ch!important;
      }
      html body .dw-auth-panel{
        top:50%!important;
        transform:translateY(calc(-50% + 5.25rem))!important;
        z-index:8!important;
      }
      @media(max-width:980px){
        html body .dw-auth-intro,
        html body .dw-auth-panel{
          right:1.2rem!important;
          width:min(430px,calc(100vw - 2.4rem))!important;
        }
        html body .dw-auth-intro{
          top:2rem!important;
          transform:none!important;
        }
        html body .dw-auth-panel{
          top:auto!important;
          bottom:1.2rem!important;
          transform:none!important;
        }
      }
      @media(max-width:640px){
        html body .dw-auth-intro{
          left:1rem!important;
          right:1rem!important;
          top:15.5rem!important;
          width:auto!important;
          transform:none!important;
        }
        html body .dw-auth-panel{
          left:1rem!important;
          right:1rem!important;
          bottom:1rem!important;
          width:auto!important;
          transform:none!important;
        }
      }



      /* v24 login styleguide pass: tagline, dead wax inscription, right-column rhythm */
      html body .dw-deadwax-etch{
        position:absolute!important;
        inset:4.6%!important;
        width:auto!important;
        height:auto!important;
        border-radius:50%!important;
        z-index:1!important;
        pointer-events:none!important;
        animation:dwRecordSpin 18s linear infinite!important;
        opacity:.18!important;
        mix-blend-mode:screen!important;
      }
      html body .dw-deadwax-etch text{
        fill:rgba(240,195,79,.52)!important;
        letter-spacing:3.4px!important;
        font-weight:400!important;
      }
      html body .dw-auth-intro-kicker,
      html body .dw-auth-kicker{
        color:var(--gd)!important;
        letter-spacing:.22em!important;
      }
      html body .dw-auth-intro p{
        max-width:44ch!important;
        line-height:1.72!important;
      }
      html body .dw-auth-intro{
        transform:translateY(calc(-50% - 12rem))!important;
      }
      html body .dw-auth-panel{
        transform:translateY(calc(-50% + 6.25rem))!important;
      }
      @media(max-width:980px){
        html body .dw-auth-intro{transform:none!important;}
        html body .dw-auth-panel{transform:none!important;}
      }

      @media(prefers-reduced-motion:reduce){html body .dw-platter::before,html body .dw-label{animation:none!important}html body .dw-tonearm,html body .dw-deck-btn{transition:none!important}}
    `;

      const loginSketchFix = document.createElement('style');
      loginSketchFix.textContent = `
        html body .dw-tonearm,
        html body .dw-deadwax-etch{display:none!important}
        html body .dw-auth-side{position:absolute!important;right:clamp(1.2rem,5vw,4.5rem)!important;top:50%!important;transform:translateY(-50%)!important;z-index:8!important;width:min(440px,calc(100vw - 2.4rem))!important;display:flex!important;flex-direction:column!important;gap:1.2rem!important;align-items:stretch!important}
        html body .dw-auth-intro,
        html body .dw-auth-panel{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;width:100%!important;max-width:none!important}
        html body .dw-auth-intro{padding-left:0!important;margin:0!important}
        html body .dw-auth-intro-kicker,
        html body .dw-auth-kicker{font-size:.64rem!important;letter-spacing:.18em!important;color:var(--gd)!important;text-transform:uppercase!important;font-weight:700!important}
        html body .dw-auth-intro h1{margin:0 0 .5rem!important;font-size:clamp(3rem,5.2vw,5.6rem)!important;line-height:.88!important}
        html body .dw-auth-intro p{margin:0!important;max-width:34ch!important;color:var(--mt)!important;font-size:clamp(.9rem,1.08vw,.98rem)!important;line-height:1.68!important}
        html body .dw-auth-panel{padding:1.18rem 1.18rem 1.05rem!important;border-radius:20px!important;background:linear-gradient(180deg,rgba(18,13,7,.94),rgba(8,6,3,.98))!important;border:1px solid rgba(208,154,36,.24)!important;box-shadow:0 20px 52px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.04)!important}
        html body .dw-auth-title,
        html body .dw-auth-copy,
        html body .dw-auth-note{display:none!important}
        html body .dw-deck-btn{min-height:3rem!important}
        html body .dw-label{inset:35.5%!important;box-shadow:0 0 0 8px rgba(11,9,6,.18),inset 0 2px 5px rgba(244,234,210,.32),0 8px 36px rgba(0,0,0,.26)!important}
        html body .dw-label .dw-login-mark{width:92%!important;height:92%!important;display:block!important;opacity:.96!important;filter:drop-shadow(0 2px 4px rgba(0,0,0,.26))!important}
        html body .dw-spindle{z-index:5!important}
        html body .dw-turntable::after{left:calc(100% - min(440px,calc(100vw - 2.4rem)) - clamp(1.2rem,5vw,4.5rem) - 1.5rem)!important;opacity:.55!important}
        @media (max-width: 980px){
          html body .dw-auth-side{right:1.1rem!important;width:min(420px,calc(100vw - 2.2rem))!important}
          html body .dw-auth-intro h1{font-size:3.6rem!important}
          html body .dw-auth-intro p{max-width:36ch!important}
        }
        @media (max-width: 720px){
          html body .dw-auth-side{left:1rem!important;right:1rem!important;top:auto!important;bottom:1rem!important;transform:none!important;width:auto!important;gap:.95rem!important}
          html body .dw-auth-intro{padding-right:0!important}
          html body .dw-auth-intro h1{font-size:2.8rem!important}
          html body .dw-auth-intro p{font-size:.82rem!important;max-width:none!important;line-height:1.56!important}
          html body .dw-deck{left:clamp(-44rem,-67vw,-28rem)!important;top:32%!important;width:clamp(620px,110vw,860px)!important;height:clamp(620px,110vw,860px)!important}
        }
      `;
      document.head.appendChild(loginSketchFix);

    document.head.appendChild(loginFix);

    const v34LoginMarkFix = document.createElement('style');
    v34LoginMarkFix.textContent = `
      html body .dw-platter{background:none!important;box-shadow:0 34px 110px rgba(0,0,0,.42)!important}
      html body .dw-platter::before,
      html body .dw-platter::after,
      html body .dw-record,
      html body .dw-deadwax-etch{display:none!important;content:none!important}
      html body .dw-label{position:absolute!important;inset:0!important;border:0!important;border-radius:50%!important;background:none!important;box-shadow:none!important;animation:dwRecordSpin 28s linear infinite!important;z-index:3!important}
      html body .dw-label .dw-login-mark{width:100%!important;height:100%!important;display:block!important;opacity:1!important;filter:drop-shadow(0 18px 46px rgba(0,0,0,.36))!important}
      html body .dw-spindle{z-index:5!important}
    `;
    document.head.appendChild(v34LoginMarkFix);

    const d=document.createElement('div');
    d.id='dwAuth';
    d.className='dw-auth signin';
    d.innerHTML=`<div class="dw-turntable" role="dialog" aria-modal="true" aria-labelledby="dwAuthTitle"><div class="dw-deck" aria-hidden="true"><div class="dw-platter"><div class="dw-record"></div><div class="dw-label">${dwLoginMark()}</div><div class="dw-spindle"></div></div></div><div class="dw-auth-side"><section class="dw-auth-intro"><div class="dw-auth-intro-kicker">Your private vinyl collection</div><h1 id="dwAuthTitle">SleeveShelves</h1><p>SleeveShelves is your private vinyl archive: shelf IDs, collection labels, listening notes, and Discogs details in one warm, searchable home.</p></section><section class="dw-auth-panel"><form class="dw-auth-card" id="dwAuthForm"><label for="dwEmail">Email</label><input id="dwEmail" type="email" autocomplete="email" required><label for="dwPassword">Password</label><input id="dwPassword" type="password" autocomplete="current-password" required><div class="dw-deck-controls"><button type="submit" class="dw-deck-btn signin" id="dwSignInBtn">Sign in</button><button type="button" class="dw-deck-btn signup" id="dwSignUp">Sign up</button></div><div class="dw-auth-error" id="dwAuthError"></div></form></section></div></div>`;
    document.body.appendChild(d);
    const setAuthMode=(mode)=>{ d.classList.toggle('signup',mode==='signup'); d.classList.toggle('signin',mode!=='signup'); };
    $('#dwSignInBtn').addEventListener('mouseenter',()=>setAuthMode('signin'));
    $('#dwSignInBtn').addEventListener('focus',()=>setAuthMode('signin'));
    $('#dwSignUp').addEventListener('mouseenter',()=>setAuthMode('signup'));
    $('#dwSignUp').addEventListener('focus',()=>setAuthMode('signup'));
    $('#dwAuthForm').addEventListener('submit', async e => { e.preventDefault(); setAuthMode('signin'); await authIn(false); });
    $('#dwSignUp').addEventListener('click', async () => { setAuthMode('signup'); await authIn(true); });
  }

  async function authIn(signup){
    const email=$('#dwEmail').value.trim(), password=$('#dwPassword').value;
    const message=$('#dwAuthError');
    const buttons=[$('#dwSignInBtn'),$('#dwSignUp')];
    message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    message.textContent='';
    if(!email || !password){message.textContent='Enter your email and password first.';return;}
    buttons.forEach(b=>b.disabled=true);
    try{
      const res=signup ? await SB.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}}) : await SB.auth.signInWithPassword({email,password});
      if(res.error){message.textContent=explainError(res.error,'auth');return;}
      // Supabase may return a user without a session when email confirmation is required.
      // A user object alone MUST NOT unlock the collection or attempt a database write.
      if(!res.data?.session?.user){
        message.textContent=signup ? 'Check your inbox to confirm your email, then return here and sign in. Your collection will stay locked until confirmation.' : 'Sign-in has not completed. Confirm your email and sign in again.';
        return;
      }
      state.user=res.data.session.user;
      const loaded=await loadAll();
      if(!loaded){state.user=null;return;}
      $('#dwAuth').classList.remove('on');
    }catch(e){message.textContent=explainError(e,'auth');}
    finally{buttons.forEach(b=>b.disabled=false);}
  }

  async function signOut(){
    await SB.auth.signOut();
    state.user=null; state.records=[]; state.filtered=[];state.digitalListenedIds.clear();state.digitalListensLoaded=false;state.digitalListensError='';++state.digitalListensRequest; render();
    $('#dwAuth').classList.add('on');
    closeUserMenu();
  }
  window.signOut=signOut;

  async function initAuth(){
    ensureAuthShell();
    if(!SB){ $('#dwAuth').classList.add('on'); $('#dwAuthError').textContent='Supabase connection is missing. Check the website configuration.'; return; }
    document.documentElement.classList.add('dw-booting');
    try{
      const {data,error}=await SB.auth.getSession();
      if(error) throw error;
      if(!data?.session?.user){ $('#dwAuth').classList.add('on'); renderEmptyShell(); return; }
      state.user=data.session.user;
      if(!(await loadAll())) $('#dwAuth').classList.add('on');
    }catch(e){ $('#dwAuth').classList.add('on'); $('#dwAuthError').textContent=explainError(e,'auth'); renderEmptyShell(); }
    finally{document.documentElement.classList.remove('dw-booting');}
  }

  async function loadAll(){
    if(!state.user) return;
    setSync('Loading');
    const [recRes, colRes, linkRes] = await Promise.all([
      SB.from('records').select(FIELDS).eq('user_id',state.user.id).order('shelf_id',{ascending:true}),
      SB.from('collections').select('*').eq('user_id',state.user.id).order('name',{ascending:true}),
      SB.from('record_collections').select('record_id,collection_id').eq('user_id',state.user.id)
    ]);
    if(recRes.error || colRes.error || linkRes.error){
      const error=recRes.error||colRes.error||linkRes.error;
      setSync('Sync error');
      const text='Could not load your collection: '+explainError(error,'load');
      if($('#dwAuth')?.classList.contains('on')) $('#dwAuthError').textContent=text;
      else alert(text);
      return false; // Never silently overwrite real data with an incomplete load.
    }
    state.collections = visibleCollectionRows(colRes.data || []);
    state.collectionLinks = linkRes.data || [];
    const linkMap = new Map();
    state.collectionLinks.forEach(l => {
      if(!linkMap.has(l.record_id)) linkMap.set(l.record_id, []);
      if(!isRecordCabinet(l.collection_id)) linkMap.get(l.record_id).push(l.collection_id);
    });
    state.records = (recRes.data || []).map(r => normalizeRecord({...r, collection_ids: linkMap.get(r.id) || []}));
    applyFilters();
    setSync('Synced');
    return true;
  }

  function normalizeRecord(r){
    r.shelf_id = r.shelf_id || r.code || '';
    r.code = r.shelf_id;
    r.artist = r.artist || '';
    r.album = r.album || '';
    r.copies_owned = Number(r.copies_owned ?? r.owned ?? 1);
    r.owned = r.copies_owned;
    r.genres = arr(r.genres);
    r.styles = arr(r.styles);
    r.tracklist = extractTracklist(r);
    r.collections = internalCollections(r.collections);
    r.release_year = r.release_year || r.year || null;
    if(!r.reaction && r.rating) r.reaction = reactionValue(r);
    return r;
  }

  function renderEmptyShell(){
    $('#gridWrap').innerHTML='<div class="no-res"><h3>Sign in to open SleeveShelves</h3><p>Your records will load from Supabase.</p></div>';
    $('#listBody').innerHTML='';
    $('#cfStage').innerHTML='';
    $('#cfMeta').innerHTML='';
    updateCounts([]);
  }

  function filtered(){
    let a=[...state.records];
    const f=state.filters;
    const q = norm(f.global);
    if(q) a=a.filter(r => {
      const hay=[r.shelf_id,r.artist,r.album,r.last,r.first,r.genre,collectionNames(r).join(' '),tracks(r).map(t=>t.title).join(' ')].join(' ');
      return norm(hay).includes(q);
    });
    if(f.collectionId) a=a.filter(r=>collectionIdsForRecord(r).includes(f.collectionId));
    if(f.code) a=a.filter(r=>norm(recordCode(r)).includes(norm(f.code)));
    if(f.artist) a=a.filter(r=>norm(r.artist).includes(norm(f.artist)));
    if(f.last) a=a.filter(r=>norm(r.last).includes(norm(f.last)));
    if(f.first) a=a.filter(r=>norm(r.first).includes(norm(f.first)));
    if(f.album) a=a.filter(r=>norm(r.album).includes(norm(f.album)));
    if(f.genre) a=a.filter(r=>(r.genre===f.genre || r.genres?.includes(f.genre)));
    if(f.listened) a=a.filter(r=>state.listenedViewMode==='vinyl' ? !!r.listened : state.listenedViewMode==='digital' ? state.digitalListenedIds.has(r.id) : (!!r.listened || state.digitalListenedIds.has(r.id)));
    if(f.doubles) a=a.filter(r=>Number(r.copies_owned||r.owned||1)>1);
    if(f.grail) a=a.filter(r=>!!r.grail);
    if(f.rating) a=a.filter(r=>reactionValue(r)===f.rating);
    if(f.lastListened){
      const now=Date.now(), day=86400000;
      a=a.filter(r=>{
        const t=Date.parse(r.listened_at||r.listenedAt||''); if(!t) return f.lastListened==='older';
        const d=(now-t)/day;
        return f.lastListened==='week'?d<=7:f.lastListened==='month'?d<=31:f.lastListened==='year'?d<=366:d>366;
      });
    }
    return a;
  }

  function applyFilters(){
    state.filtered=filtered();
    render();
  }
  window.applyFilters=applyFilters;
  DW.getNavigationData=()=>({
    collections:state.collections.map(c=>({id:c.id,name:c.name,count:state.records.filter(r=>collectionIdsForRecord(r).includes(c.id)).length})),
    total:state.records.length,shown:state.filtered.length,view:state.view,
    selectedCollection:state.filters.collectionId,grails:state.records.filter(r=>r.grail).length,
    listened:state.records.filter(r=>r.listened).length,
    favorites:state.records.filter(r=>reactionValue(r)==='favorite').length
  });
  DW.setCollectionFilter=(id)=>{ state.filters.collectionId=id||''; applyFilters(); };
  // V61.4.7: digital history is queried with the authenticated client's RLS.
  // Vinyl and digital are record-level filters, not additional playback counters.
  DW.getListenedMode=()=>state.listenedViewMode;
  DW.getDigitalListenStatus=()=>({loaded:state.digitalListensLoaded,error:state.digitalListensError,count:state.digitalListenedIds.size});
  DW.setListenedMode=mode=>{
    if(!['vinyl','digital','both'].includes(mode))return;
    state.listenedViewMode=mode;
    applyFilters();
  };
  DW.refreshDigitalListened=async()=>{
    const user=state.user; if(!user)return false;
    const request=++state.digitalListensRequest;
    state.digitalListensError='';
    state.digitalListensLoaded=false;
    const ids=new Set();
    try{
      // Pagination avoids PostgREST's default 1,000-row limit on a long diary.
      const size=1000;
      for(let offset=0;offset<100000;offset+=size){
        const res=await SB.from('digital_listening_events').select('record_id')
          .eq('user_id',user.id).range(offset,offset+size-1);
        if(res.error)throw res.error;
        if(request!==state.digitalListensRequest || state.user?.id!==user.id)return false;
        const rows=res.data||[];
        for(const row of rows)if(row.record_id)ids.add(row.record_id);
        if(rows.length<size)break;
        if(offset+size>=100000)throw new Error('Digital listening history exceeds the query limit.');
      }
      if(request!==state.digitalListensRequest || state.user?.id!==user.id)return false;
      state.digitalListenedIds=ids;
      state.digitalListensLoaded=true;
      applyFilters();
      window.dispatchEvent(new Event('sleeveshelves:digital-filter-ready'));
      return true;
    }catch(error){
      if(request!==state.digitalListensRequest)return false;
      state.digitalListensError=String(error.message||error||'Cannot load digital listening history');
      state.digitalListensLoaded=false;
      console.warn('Unable to filter digital listening history:',error);
      window.dispatchEvent(new Event('sleeveshelves:digital-filter-ready'));
      return false;
    }
  };
  window.addEventListener('sleeveshelves:digital-listen-saved',event=>{
    const id=event.detail?.recordId;
    if(id){state.digitalListenedIds.add(id);if(state.filters.listened)applyFilters();}
  });


  function groupRecords(arrIn){
    const a=[...arrIn];
    const g=state.group;
    const map=new Map();
    function add(k,r){ if(!map.has(k)) map.set(k,[]); map.get(k).push(r); }
    if(g==='genre') a.forEach(r=>add(r.genre || 'Unknown',r));
    else if(g==='artist') a.forEach(r=>add(r.artist || 'Unknown',r));
    else if(g==='decade') a.forEach(r=>{ const y=Number(displayYear(r)); add(y?`${Math.floor(y/10)*10}s`:'Unknown decade',r); });
    else if(g==='collection') a.forEach(r=>{ const names=collectionNames(r); (names.length?names:['Record Cabinet']).forEach(n=>add(n,r)); });
    else if(g==='shelf') a.forEach(r=>{ const p=shelfParts(recordCode(r)); add(p[0] && p[0] !== '~' ? p[0] : 'No Shelf ID', r); });
    else a.forEach(r=>add(alphaKey(r),r));
    let groups=[...map.entries()];
    groups.sort((x,y)=>{
      if(g==='decade') return x[0].localeCompare(y[0],undefined,{numeric:true});
      if(g==='alpha') return x[0].localeCompare(y[0]);
      if(g==='shelf') return x[0].localeCompare(y[0],undefined,{numeric:true});
      return x[0].localeCompare(y[0],undefined,{sensitivity:'base'});
    });
    groups.forEach(g=>g[1].sort(shelfCompare));
    return groups;
  }

  function updateCounts(a=state.filtered){
    const total=state.records.length, shown=a.length;
    $('#countPill strong').textContent=String(shown);
    $('#countPill').lastChild && null;
    const tip=$('#countTip');
    if(tip){
      const synced=state.records.filter(r=>tracks(r).length || r.cover_url || r.discogs_id).length;
      const grails=state.records.filter(r=>r.grail).length;
      const listened=state.records.filter(r=>r.listened).length;
      tip.innerHTML=`<div class="count-tip-title">Archive status</div>
      <div class="count-tip-row"><span>Total records</span><strong>${total}</strong></div>
      <div class="count-tip-row"><span>Currently showing</span><strong>${shown}</strong></div>
      <div class="count-tip-row"><span>Discogs enriched</span><strong>${synced}</strong></div>
      <div class="count-tip-row"><span>Listened</span><strong>${listened}</strong></div>
      <div class="count-tip-row"><span>Grail records</span><strong>${grails}</strong></div>`;
    }
    $('#resultStatus').textContent=`${shown} records shown`;
    $('#stUserRecords') && ($('#stUserRecords').textContent=total);
    $('#stUserCollections') && ($('#stUserCollections').textContent=state.collections.length);
    $('#stDbBase') && ($('#stDbBase').textContent=total);
    $('#stDbShowing') && ($('#stDbShowing').textContent=shown);
    $('#stDbDiscogs') && ($('#stDbDiscogs').textContent=state.records.filter(r=>tracks(r).length || r.cover_url || r.discogs_id).length);
    $('#stDbOverrides') && ($('#stDbOverrides').textContent=total);
    $('#stUserName') && ($('#stUserName').textContent=state.user?.email || 'Signed in');
  }

  function render(){
    updateButtons();
    updateCounts();
    updateGenres();
    renderJumpBar();
    $('#gridWrap').style.display=state.view==='grid'?'block':'none';
    $('#listWrap').style.display=state.view==='list'?'block':'none';
    $('#flowWrap').style.display=state.view==='flow'?'block':'none';
    $('#mainArea').classList.toggle('list-mode',state.view==='list');
    $('#mainArea').classList.toggle('flow-mode',state.view==='flow');
    if(state.view==='grid') renderGrid();
    if(state.view==='list') renderList();
    if(state.view==='flow') renderFlow();
    updateHdrH();
    window.dispatchEvent(new Event('sleeveshelves:render'));
  }

  function updateButtons(){
    $('#btnGrid')?.classList.toggle('on',state.view==='grid');
    $('#btnList')?.classList.toggle('on',state.view==='list');
    $('#btnFlow')?.classList.toggle('on',state.view==='flow');
    $('#groupSelect') && ($('#groupSelect').value=state.group);
    $('#secondaryGroupSelect') && ($('#secondaryGroupSelect').value=state.secondary);
    $('#secondaryGroupWrap') && ($('#secondaryGroupWrap').hidden = state.group !== 'collection');
  }

  function groupHeader(label,count,kind='letter'){
    const key=`${state.group}:${label}`;
    const collapsed=state.collapsed.has(key);
    const cls=kind==='letter'?'letter-hdr':'genre-hdr';
    const countCls=kind==='letter'?'lt-count':'genre-pill';
    const name = kind==='letter' ? `<span class="lt-char">${esc(label)}</span>` : `<span class="genre-name">${esc(label)}</span>`;
    return `<button class="grp-toggle ${collapsed?'collapsed':''}" onclick="toggleGroup('${esc(key)}')" type="button">${`<div class="${cls}"><span class="grp-icon"></span>${name}<span class="${countCls}">${count} records</span></div>`}</button>`;
  }

  function renderGrid(){
    const html=groupRecords(state.filtered).map(([label,rs])=>{
      const key=`${state.group}:${label}`;
      return `<section class="${(state.group==='alpha'||state.group==='shelf')?'letter-section':'genre-section'}" id="grp-${slug(label)}">${groupHeader(label,rs.length,(state.group==='alpha'||state.group==='shelf')?'letter':'genre')}<div class="grp-body ${state.collapsed.has(key)?'collapsed':''}"><div class="records-grid">${rs.map(renderCard).join('')}</div></div></section>`;
    }).join('');
    $('#gridWrap').innerHTML = html || `<div class="no-res"><h3>No records found</h3><p>Try clearing filters.</p></div>`;
  }

  function renderList(){
    const html=groupRecords(state.filtered).map(([label,rs])=>{
      const key=`${state.group}:${label}`;
      return `<section class="list-section" id="grp-${slug(label)}">${groupHeader(label,rs.length,'letter').replace('letter-hdr','list-sec').replace('lt-char','list-sec-c').replace('lt-count','list-sec-n')}<div class="grp-body ${state.collapsed.has(key)?'collapsed':''}">${rs.map(renderRow).join('')}</div></section>`;
    }).join('');
    $('#listBody').innerHTML = html || `<div class="no-res"><h3>No records found</h3></div>`;
  }

  function flowEntries(){
    const entries=[];
    groupRecords(state.filtered).forEach(([label,rs])=>{
      rs.forEach(record=>entries.push({label,record}));
    });
    return entries;
  }

  function cfClamp(){
    const entries=flowEntries();
    if(!entries.length){ state.cfIndex=0; state.cfPos=0; state.cfActiveId=null; return entries; }
    state.cfIndex=Math.max(0,Math.min(Math.round(state.cfIndex||0),entries.length-1));
    state.cfPos=Math.max(0,Math.min(Number(state.cfPos||state.cfIndex),entries.length-1));
    if(state.cfActiveId){
      const hit=entries.findIndex(e=>e.record.id===state.cfActiveId);
      if(hit>=0){ state.cfIndex=hit; state.cfPos=hit; }
    }
    state.cfActiveId=entries[state.cfIndex]?.record?.id || null;
    return entries;
  }

  function flowPose(offset){
    const sign=offset<0?-1:1;
    const d=Math.abs(offset);
    if(d<.001) return {x:0,y:0,z:0,rot:0,scale:1,opacity:1};
    const near=Math.min(d,1);
    const far=Math.max(0,d-1);
    return {
      x: sign*(42 + far*15),
      y: Math.min(10, far*1.4),
      z: -165 - far*82,
      rot: sign*(-58 + Math.min(18,far*3.6)),
      scale: Math.max(.56,.84 - far*.035),
      opacity: d>8 ? 0 : Math.max(.18,1 - far*.105)
    };
  }

  function flowTransform(p){
    return `translateX(calc(-50% + ${p.x}%)) translateY(calc(-50% + ${p.y}px)) translateZ(${p.z}px) rotateY(${p.rot}deg) scale(${p.scale})`;
  }

  function renderFlowDivider(label,offset){
    const pose=flowPose(offset);
    return `<div class="cf-divider" style="transform:${flowTransform(pose)};opacity:${Math.max(.2,pose.opacity*.72)};z-index:${Math.max(1,650-Math.round(Math.abs(offset)*10))}"><div class="cf-divider-main"><span class="cf-divider-letter">${esc(label)}</span><span class="cf-divider-sub">Section</span></div></div>`;
  }

  function renderFlow(){
    const stage=$('#cfStage'), meta=$('#cfMeta');
    const entries=cfClamp();
    if(!stage || !meta) return;
    if(!entries.length){
      stage.innerHTML='<div class="cf-empty-state"><h3>No records found</h3><p>Try adjusting your filters.</p></div>';
      meta.innerHTML='';
      return;
    }
    const center=state.cfPos;
    const start=Math.max(0,Math.floor(center)-10);
    const end=Math.min(entries.length-1,Math.ceil(center)+10);
    const active=entries[state.cfIndex];
    const pieces=['<div class="cf-stage-rail"></div>'];
    for(let i=Math.max(1,start);i<=end;i++){
      if(entries[i].label!==entries[i-1].label){
        pieces.push(renderFlowDivider(entries[i].label, i-center));
      }
    }
    for(let i=start;i<=end;i++) pieces.push(renderFlowCard(entries[i].record,i,i-center));
    stage.innerHTML=pieces.join('');
    updateCoverFlowMeta(active, entries.length);
  }

  function updateCoverFlowMeta(entry,total){
    const meta=$('#cfMeta');
    if(!meta || !entry) return;
    const r=entry.record;
    meta.innerHTML=`<div class="flow-meta-main"><div class="flow-meta-code">${esc(recordCode(r))}</div><div class="flow-meta-artist">${esc(r.artist)}</div><div class="flow-meta-album">${esc(r.album)}</div><div class="flow-meta-tags">${tag(r.genre,'g')}${collectionNames(r).slice(0,3).map(x=>tag(x)).join('')}</div><div class="flow-section-line"><span class="flow-section-pill">${esc(entry.label)}</span><span class="flow-section-pill">${state.cfIndex+1} / ${total}</span></div><div class="flow-hint">Hover the centered cover for the tracklist. Click the centered cover to open details.</div></div>`;
  }

  function renderFlowCard(r,idx,offset){
    const active=Math.round(offset)===0;
    const distance=Math.abs(offset);
    const pose=flowPose(offset);
    const flipped=active && state.cfFlipId===r.id;
    return `<div class="cf-card ${active?'active':''}${distance>8?' off':''} cf-ready" data-id="${esc(r.id)}" style="z-index:${Math.max(1,700-Math.round(distance*10))};opacity:${pose.opacity};transform:${flowTransform(pose)};" onclick="cfClick('${esc(r.id)}',event)"><div class="cf-scene card-scene ${flipped?'flipped':''}"><div class="card-inner"><div class="card-front"><div class="card-cover">${coverHtml(r)}${r.grail?`<span class="grail-mark" role="img" aria-label="Grail record">${grailBadge()}</span>`:''}<div class="cf-code">${esc(recordCode(r))}</div></div></div><div class="card-back">${trackBack(r)}</div></div></div><div class="cf-cover-shadow"></div></div>`;
  }

  function cfStageMoving(on){
    const stage=$('#cfStage');
    if(stage) stage.classList.toggle('moving', !!on);
    if(!on) cfSetMotionBlur(0,0);
  }

  function cfSetMotionBlur(amount=0, dir=0){
    const stage=$('#cfStage');
    if(!stage) return;
    const a=Math.max(0,Math.min(1,Math.abs(amount)));
    stage.classList.toggle('cf-motion-blur', a>.035);
    stage.style.setProperty('--cf-motion-blur', (a*1.15).toFixed(2)+'px');
    stage.style.setProperty('--cf-active-blur', (a*.42).toFixed(2)+'px');
    stage.style.setProperty('--cf-motion-smear', (a*.34).toFixed(3));
    stage.style.setProperty('--cf-motion-dir', dir<0 ? -1 : 1);
  }

  function cfStopMomentum(){
    state.cfVelocity=0;
    state.cfWheelAccum=0;
    state.cfManualQueue=0;
    state.cfMomentumPower=0;
    state.cfMomentumDir=0;
    state.cfTurnLock=false;
    cfStageMoving(false);
  }

  function cfMomentumDelay(){
    const p=Math.max(0,Math.min(1,state.cfMomentumPower/2.35));
    return Math.round(30 + (1-p)*118);
  }

  function cfAddMomentum(delta){
    const dir=delta<0?-1:1;
    const impulse=Math.min(3.25,Math.max(.14,Math.abs(delta)/86));
    if(state.cfMomentumDir && state.cfMomentumDir!==dir) state.cfMomentumPower=0;
    state.cfMomentumDir=dir;
    state.cfMomentumPower=Math.min(3.5,Math.max(state.cfMomentumPower*.94,impulse));
    state.cfVelocity=state.cfMomentumPower*dir;
    cfSetMotionBlur(Math.min(1,.34 + state.cfMomentumPower*.22),dir);
    if(!state.cfTurnLock) cfRunMomentumTurn();
  }

  function cfRunMomentumTurn(){
    if(state.view!=='flow') return;
    if(state.cfTurnLock) return;
    if(state.cfMomentumPower<.18){
      state.cfMomentumPower=0;
      state.cfMomentumDir=0;
      state.cfVelocity=0;
      cfStageMoving(false);
      return;
    }
    cfPageTurn(state.cfMomentumDir || 1,{momentum:true});
  }

  function cfCompleteTurn(dir,opts={}){
    const momentum=!!opts.momentum;
    if(momentum){
      state.cfMomentumPower*=.62;
      state.cfVelocity=state.cfMomentumPower*dir;
    }
    const hasMomentum=momentum && state.cfMomentumPower>=.18;
    const hasManual=state.cfManualQueue!==0;
    const delay=momentum ? Math.max(34, cfMomentumDelay()-18) : (hasManual?150:230);
    cfSetMotionBlur(hasMomentum?Math.min(.5,.18+state.cfMomentumPower*.24):.18,dir);
    window.setTimeout(()=>{
      state.cfTurnLock=false;
      if(hasMomentum && state.cfMomentumDir){ cfRunMomentumTurn(); return; }
      if(state.cfManualQueue!==0){
        const q=state.cfManualQueue<0?-1:1;
        state.cfManualQueue-=q;
        cfPageTurn(q,{momentum:false});
        return;
      }
      cfStageMoving(false);
    },delay);
  }

  function cfPageTurn(dir,opts={}){
    const entries=cfClamp();
    if(!entries.length) return;
    dir=dir<0?-1:1;
    if(state.cfTurnLock){
      if(opts.momentum){
        state.cfMomentumDir=dir;
        state.cfMomentumPower=Math.min(3.5,state.cfMomentumPower);
      }else{
        state.cfManualQueue+=dir;
        state.cfManualQueue=Math.max(-5,Math.min(5,state.cfManualQueue));
      }
      return;
    }
    const next=Math.max(0,Math.min(entries.length-1,state.cfIndex+dir));
    if(next===state.cfIndex){
      state.cfMomentumPower=0;
      state.cfVelocity=0;
      state.cfManualQueue=0;
      cfStageMoving(false);
      return;
    }
    state.cfTurnLock=true;
    state.cfFlipId=null;
    state.cfPos=next;
    state.cfIndex=next;
    state.cfActiveId=entries[next].record.id;
    const motionAmount=opts.momentum ? Math.min(1,.38 + state.cfMomentumPower*.20) : .58;
    cfStageMoving(true);
    cfSetMotionBlur(motionAmount,dir);
    renderFlow();
    window.setTimeout(()=>cfSetMotionBlur(opts.momentum ? Math.min(.62,.14+state.cfMomentumPower*.18) : .28,dir),70);
    cfCompleteTurn(dir,opts);
  }

  function cfClick(id,event){
    if(event?.target?.closest('.tl-dg,a,button')) return;
    const entries=flowEntries();
    const idx=entries.findIndex(e=>e.record.id===id);
    if(idx<0) return;
    if(idx!==state.cfIndex){
      const dir=idx>state.cfIndex?1:-1;
      const distance=Math.abs(idx-state.cfIndex);
      if(distance<=2){ cfPageTurn(dir,{momentum:false}); }
      else{
        cfStopMomentum();
        state.cfPos=idx; state.cfIndex=idx; state.cfActiveId=id; state.cfFlipId=null;
        cfStageMoving(true); cfSetMotionBlur(.7,dir); renderFlow(); window.setTimeout(()=>cfStageMoving(false),280);
      }
      return;
    }
    openRecordById(id);
  }
  window.cfClick=cfClick;

  function cfStep(dir){ cfPageTurn(dir,{momentum:false}); }

  function cfHandleWheel(e){
    if(state.view!=='flow') return;
    const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    if(Math.abs(delta)<3) return;
    e.preventDefault();
    state.cfWheelAccum+=delta;
    const threshold=10;
    if(Math.abs(state.cfWheelAccum)>=threshold){
      const impulse=state.cfWheelAccum;
      state.cfWheelAccum*=.08;
      cfAddMomentum(impulse);
    }
  }

  function coverHtml(r){
    const u=coverUrl(r);
    return u ? `<img src="${esc(u)}" alt="${esc(r.album)} cover" loading="lazy">` : `<div class="vph"><div class="vd" style="width:74%;height:74%"></div></div>`;
  }

  function renderCard(r){
    const idx=state.filtered.findIndex(x=>x.id===r.id);
    return `<article class="card-scene" tabindex="0" data-id="${esc(r.id)}" onclick="openModal(${idx})" onkeydown="if(event.key==='Enter')openModal(${idx})">
      <div class="card-inner">
        <div class="card-front"><div class="card-cover">${coverHtml(r)}${r.grail?`<span class="grail-mark" role="img" aria-label="Grail record">${grailBadge()}</span>`:''}</div><div class="card-info"><div class="card-code-row"><div class="card-code">${esc(recordCode(r))}</div><div class="card-cover-status">${statusIcons(r)}</div></div><div class="card-artist">${esc(r.artist)}</div><div class="card-album">${esc(r.album)}</div><div class="card-ft"><span class="card-qty">×${esc(r.copies_owned||1)}</span>${r.genre?`<span class="card-genre">${esc(r.genre)}</span>`:''}</div></div></div>
        <div class="card-back">${trackBack(r)}</div>
      </div>
    </article>`;
  }

  function renderRow(r){
    const idx=state.filtered.findIndex(x=>x.id===r.id);
    return `<div class="list-row" tabindex="0" onclick="openModal(${idx})"><div><div class="lthumb">${coverHtml(r)}${r.grail?`<span class="list-grail-mark" role="img" aria-label="Grail record">${grailBadge()}</span>`:''}</div></div><div class="c-code">${esc(recordCode(r))}</div><div class="c-art">${esc(r.artist)}</div><div class="c-alb">${esc(r.album)}</div><div class="c-nm">${esc(r.last||'')}</div><div class="c-nm">${esc(r.first||'')}</div><div class="c-gn"><span class="c-gn-txt">${esc(r.genre||'')}</span><span class="inline-status">${statusIcons(r)}</span></div><div class="c-qt">×${esc(r.copies_owned||1)}</div></div>`;
  }

  function statusIcons(r){
    const bits=[];
    if(r.listened) bits.push('<span class="csi note" title="Listened">♪</span>');
    const rv=reactionValue(r); if(rv) bits.push(`<span class="csi ${rv}" title="${esc(rv)}">${rv==='favorite'?'★':rv==='liked'?'⌃':'⌄'}</span>`);
    return bits.join('');
  }

  function trackBack(r){
    return `<div class="tl-hdr"><div class="tl-title">${esc(r.album)}</div><div class="tl-sub">${esc(recordCode(r))} · ${esc(r.artist)}</div></div><div class="tl-body">${trackHtml(r)}</div>${r.discogs_url?`<div class="tl-footer"><a class="tl-dg" href="${esc(r.discogs_url)}" target="_blank" rel="noopener">Discogs ↗</a></div>`:''}`;
  }

  function trackHtml(r){
    const t=tracks(r);
    if(!t.length) return `<div class="tl-empty">No tracklist saved.</div>`;
    let cur='', out='';
    t.forEach(tr=>{
      const pos=String(tr.position||'');
      const side=pos.match(/^[A-Z]+/)?.[0] || 'Tracks';
      if(side!==cur){ cur=side; out+=`<div class="tl-side-lbl">${esc(side)}</div>`; }
      out+=`<div class="tl-track"><span class="tl-pos">${esc(pos)}</span><span class="tl-name">${esc(tr.title||tr.name||'Untitled')}</span><span class="tl-dur">${esc(tr.duration||'')}</span></div>`;
    });
    return out;
  }

  function tag(v,cls=''){ return v?`<span class="flow-tag ${cls}">${esc(v)}</span>`:''; }
  function slug(v){ return String(v).replace(/[^a-z0-9]+/gi,'-'); }

  function renderJumpBar(){
    const groups=groupRecords(state.filtered).map(g=>g[0]);
    $('#jumpBar').innerHTML=groups.map(g=>`<a class="jb" href="#grp-${slug(g)}">${esc(String(g).slice(0,3))}</a>`).join('');
  }

  function updateGenres(){
    const sel=$('#fGenre'); if(!sel) return;
    const cur=sel.value;
    const genres=[...new Set(state.records.flatMap(r=>[r.genre,...(r.genres||[])]).filter(Boolean))].sort();
    sel.innerHTML='<option value="">All Genres</option>'+genres.map(g=>`<option ${g===cur?'selected':''}>${esc(g)}</option>`).join('');
  }

  function lockPage(){
    if(!document.body.classList.contains('ss-app-mode') || document.querySelector('.f-ov.on,.s-ov.on')) document.body.classList.add('dw-modal-open');
  }
  function unlockPage(){
    const selector=document.body.classList.contains('ss-app-mode') ? '.f-ov.on,.s-ov.on' : '.ov.on,.f-ov.on,.s-ov.on';
    if(!document.querySelector(selector)) document.body.classList.remove('dw-modal-open');
  }

  function openModal(idx){
    const r=state.filtered[idx]; if(!r) return;
    state.currentId=r.id; state.random=false;
    const modal=$('#detModal'); modal.classList.toggle('grail-detail',!!r.grail);
    $('#rBanner').style.display=state.random?'flex':'none';
    $('#mCover').innerHTML=coverHtml(r);
    $('#mCode').textContent=recordCode(r);
    $('#mArtist').textContent=r.artist;
    $('#mAlbum').textContent=r.album;
    $('#mChips').innerHTML=[
      r.copies_owned?`×${r.copies_owned} copies`:'',
      displayYear(r)?`Released ${displayYear(r)}`:'',
      r.label, r.country, r.genre
    ].filter(Boolean).map(x=>`<span class="chip ${x===r.genre?'g':''}">${esc(x)}</span>`).join('');
    $('#mActions').innerHTML=`<button type="button" class="btn-sm dl" onclick="deleteCurrent()">Remove</button><button type="button" class="btn-sm ed" onclick="openForm(${idx})">Edit Record</button>`;
    renderModalState(r);
    renderModalCollections(r);
    const metaBits = [
      displayYear(r) ? `Released ${esc(displayYear(r))}` : '',
      r.label ? `Label: ${esc(r.label)}` : '',
      r.country ? `Country: ${esc(r.country)}` : '',
      r.genre ? `Genre: ${esc(r.genre)}` : '',
      r.discogs_id ? `Discogs ID: ${esc(r.discogs_id)}` : ''
    ].filter(Boolean);
    $('#mWiki').className='wiki-txt';
    $('#mWiki').innerHTML=metaBits.length ? metaBits.join('. ') + '.' : 'No extra metadata saved yet.';
    $('#mStyles').innerHTML=(r.genres||[]).concat(r.styles||[]).filter(Boolean).map(x=>`<span class="style-pill">${esc(x)}</span>`).join('');
    $('#mLinks').innerHTML=`${r.discogs_url?`<a class="ext-link" href="${esc(r.discogs_url)}" target="_blank" rel="noopener">Release on Discogs ↗</a>`:''}<button class="btn-sec" id="mForceBtn" onclick="forceDiscogs()">Refresh Discogs</button>`;
    $('#mNote').innerHTML=r.note?esc(r.note):'';
    $('#mNote').style.display=r.note?'block':'none';
    const modalTracks=tracks(r);
    $('#mTl').style.display=modalTracks.length ? 'block' : 'none';
    $('#mTlC').innerHTML=trackHtml(r).replaceAll('tl-','m-tl-');
    renderRelated(r);
    $('#detOv').classList.add('on'); $('#detOv').setAttribute('aria-hidden','false'); lockPage(); $('#detModal').focus();
  }
  window.openModal=openModal;

  function current(){ return state.records.find(r=>r.id===state.currentId) || state.filtered.find(r=>r.id===state.currentId); }

  function renderModalState(r){
    $('#mStateBox').innerHTML=`<div class="m-state-row"><button type="button" class="m-listen-btn ${r.listened?'on':''}" onclick="toggleListened()" title="Mark as listened" aria-label="Mark record as listened">♪</button><span class="m-state-divider"></span><div class="m-rating-row"><button type="button" class="m-rate-btn disliked ${reactionValue(r)==='disliked'?'on':''}" onclick="setReaction('disliked')" title="Disliked" aria-label="Disliked"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V4H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3v-5Z"/><path d="M7 10 11 2c.6-1.3 3-1.2 3 .5V8h5a3 3 0 0 1 2.9 3.9l-2.1 7A3 3 0 0 1 17 21H7V10Z"/></svg></button><button type="button" class="m-rate-btn liked ${reactionValue(r)==='liked'?'on':''}" onclick="setReaction('liked')" title="Liked" aria-label="Liked"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V4H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3v-5Z"/><path d="M7 10 11 2c.6-1.3 3-1.2 3 .5V8h5a3 3 0 0 1 2.9 3.9l-2.1 7A3 3 0 0 1 17 21H7V10Z"/></svg></button><button type="button" class="m-rate-btn favorite ${reactionValue(r)==='favorite'?'on':''}" onclick="setReaction('favorite')" title="Favorite record" aria-label="Mark record as favorite">★</button></div></div>${r.listened_at?`<span class="listened-stamp">Last listened ${esc(new Date(r.listened_at).toLocaleDateString())}</span>`:''}`;
  }

  function renderModalCollections(r){
    const selected = new Set(collectionIdsForRecord(r));
    const names = collectionNames(r);
    const available = visibleCollectionRows(state.collections).filter(c => !selected.has(c.id));
    const chips = names.map(n=>{
      const c = state.collections.find(x=>x.name===n || x.id===n);
      const id = c?.id || n;
      return `<span class="m-collection-chip">${esc(n)} <button type="button" class="m-collection-chip-remove" title="Remove ${esc(n)}" onclick="removeCollectionFromCurrent('${esc(id)}')">×</button></span>`;
    }).join('') || '<span class="collection-hint">No extra collection labels</span>';
    $('#mCollectionBox').innerHTML=`<div class="m-collection-head">Collections</div><div class="m-collection-row">${chips}<button type="button" class="m-collection-add-btn" onclick="toggleModalCollectionPicker()" title="Add collection label">+</button></div><div class="m-collection-picker" id="modalCollectionPicker" hidden><div class="m-collection-picker-title">Add collection label</div>${available.length?available.map(c=>`<button type="button" class="m-collection-option" onclick="addCollectionToCurrent('${esc(c.id)}')"><span class="m-collection-option-check">+</span><span>${esc(c.name)}</span><small>Add</small></button>`).join(''):'<div class="collection-hint" style="padding:.5rem">All labels already assigned.</div>'}<button type="button" class="m-collection-option" onclick="createCollectionForCurrent()"><span class="m-collection-option-check">+</span><span>New label…</span><small>Create</small></button></div>`;
  }

  function renderRelated(r){
    const artist=state.records.filter(x=>x.id!==r.id && norm(x.artist)===norm(r.artist)).slice(0,4);
    const sim=state.records.filter(x=>x.id!==r.id && x.genre && x.genre===r.genre && norm(x.artist)!==norm(r.artist)).slice(0,4);
    $('#mArtistMoreWrap').style.display=artist.length?'block':'none';
    $('#mSimilarWrap').style.display=sim.length?'block':'none';
    $('#mArtistMore').innerHTML=artist.map(relCard).join('');
    $('#mSimilar').innerHTML=sim.map(relCard).join('');
  }
  function relCard(r){ const idx=state.filtered.findIndex(x=>x.id===r.id); return `<div class="m-rec-chip" onclick="openRecordById('${esc(r.id)}')"><div class="m-rec-thumb">${coverHtml(r)}</div><div class="m-rec-meta"><div class="m-rec-title">${esc(r.album)}</div><div class="m-rec-sub">${esc(r.artist)}</div><div class="m-rec-reason">${esc(recordCode(r))}</div></div></div>`; }
  function openRecordById(id){ const i=state.filtered.findIndex(r=>r.id===id); if(i>=0) openModal(i); }
  window.openRecordById=openRecordById;

  function closeModal(){ $('#detOv').classList.remove('on'); $('#detOv').setAttribute('aria-hidden','true'); state.currentId=null; unlockPage(); }
  window.closeModal=closeModal;

  // Stage 1: a failed mutation must be visible to its caller. A save is not
  // successful until the record and requested collection links are verified.
  async function saveRecord(r,patch,action='record_update', reopen=true){
    if(!r) return false;
    if(patch && Object.prototype.hasOwnProperty.call(patch,'collections')) patch.collections = internalCollections(patch.collections);
    setSync('Saving');
    const linkIds = patch && Object.prototype.hasOwnProperty.call(patch,'collection_ids') ? arr(patch.collection_ids) : null;
    const payload={...patch, updated_at:new Date().toISOString()};
    delete payload.collection_ids;
    try {
      const {data,error}=await SB.from('records').update(payload).eq('id',r.id).eq('user_id',state.user.id).select(FIELDS).single();
      if(error) throw error;
      if(linkIds !== null){
        await syncRecordCollections(data.id,linkIds);
        data.collection_ids=linkIds;
      }
      await logChange(action,r,data);
      const idx=state.records.findIndex(x=>x.id===r.id);
      if(idx>=0) state.records[idx]=normalizeRecord(data);
      applyFilters();
      setSync('Saved');
      if(reopen){const fi=state.filtered.findIndex(x=>x.id===data.id);if(fi>=0)openModal(fi);}
      return true;
    }catch(e){
      // If the record update completed before link sync failed, the metadata
      // may already be saved. Keep the editor open and report the uncertainty.
      setSync('Save incomplete');
      alert('The save did not fully complete. Check the record and its collection labels before retrying.\n'+explainError(e,'save'));
      return false;
    }
  }

  async function logChange(action,before,after){
    try{ await SB.from('change_log').insert({user_id:state.user.id,action,before_data:before||null,after_data:after||null}); }catch(e){}
  }

  // The database migration provides one authenticated transaction for links.
  // Until installed, the compatibility path only inserts additions BEFORE
  // deleting obsolete links, never a destructive delete-all/reinsert cycle.
  async function syncRecordCollections(recordId, ids){
    const clean=[...new Set(arr(ids).filter(Boolean).filter(id=>!isRecordCabinet(id)))];
    const desired=new Set(clean);
    const rpc=await SB.rpc('ss_set_record_collections',{
      p_record_id:String(recordId), p_collection_ids:clean
    });
    if(!rpc.error) return;
    const unavailable=['PGRST202','42883'].includes(rpc.error.code) ||
      /function.*ss_set_record_collections.*(not found|does not exist|schema cache)/i.test(rpc.error.message||'');
    if(!unavailable) throw rpc.error;

    const read=await SB.from('record_collections').select('collection_id')
      .eq('user_id',state.user.id).eq('record_id',recordId);
    if(read.error) throw read.error;
    const existing=new Set((read.data||[]).map(row=>row.collection_id));
    const toAdd=clean.filter(id=>!existing.has(id));
    const toRemove=[...existing].filter(id=>!desired.has(id));
    if(toAdd.length){
      const rows=toAdd.map(collection_id=>({user_id:state.user.id,record_id:recordId,collection_id}));
      const result=await SB.from('record_collections').insert(rows);
      if(result.error) throw result.error;
    }
    // Delete only redundant links; other existing assignments stay intact.
    if(toRemove.length){
      const removed=await SB.from('record_collections').delete()
        .eq('user_id',state.user.id).eq('record_id',recordId).in('collection_id',toRemove);
      if(removed.error) throw removed.error;
    }
    const check=await SB.from('record_collections').select('collection_id')
      .eq('user_id',state.user.id).eq('record_id',recordId);
    if(check.error) throw check.error;
    const actual=new Set((check.data||[]).map(row=>row.collection_id));
    if(actual.size!==desired.size || [...desired].some(id=>!actual.has(id))){
      throw new Error('Collection links were not fully synchronized. No success was reported.');
    }
  }

  function toggleModalCollectionPicker(){ const p=$('#modalCollectionPicker'); if(p) p.hidden=!p.hidden; }
  window.toggleModalCollectionPicker=toggleModalCollectionPicker;
  async function addCollectionToCurrent(collectionId){
    const r=current(); if(!r || !collectionId || isRecordCabinet(collectionId)) return;
    const ids=[...new Set([...collectionIdsForRecord(r), collectionId])];
    await saveRecord(r,{collection_ids:ids, collections:internalCollections(ids)},'collection_update');
  }
  window.addCollectionToCurrent=addCollectionToCurrent;
  async function removeCollectionFromCurrent(collectionId){
    const r=current(); if(!r || !collectionId || isRecordCabinet(collectionId)) return;
    const ids=collectionIdsForRecord(r).filter(id=>id!==collectionId);
    await saveRecord(r,{collection_ids:ids, collections:internalCollections(ids)},'collection_update');
  }
  window.removeCollectionFromCurrent=removeCollectionFromCurrent;
  async function createCollectionForCurrent(){
    const name=prompt('New collection label');
    if(!name || !name.trim()) return;
    try{
      const id=await getOrCreateCollection(name);
      await loadAll();
      await addCollectionToCurrent(id);
    }catch(e){showSaveError(e,'collection');}
  }
  window.createCollectionForCurrent=createCollectionForCurrent;

  async function toggleListened(){ const r=current(); await saveRecord(r,{listened:!r.listened,listened_at:!r.listened?new Date().toISOString():r.listened_at},'listened_update'); }
  window.toggleListened=toggleListened;
  async function setReaction(v){ const r=current(); const cur=reactionValue(r); await saveRecord(r,{reaction:cur===v?'':v, liked:cur===v?false:(v==='liked'||v==='favorite')},'reaction_update'); }
  window.setReaction=setReaction;

  function discogsIdFromUrl(url){ const m=String(url||'').match(/discogs\.com\/(release|master)\/(\d+)/i); return m?{type:m[1],id:m[2]}:null; }

  async function forceDiscogs(){
    const r=current(); if(!r) return;
    const parsed=discogsIdFromUrl(r.discogs_url);
    if(!parsed){ alert('Add a Discogs release/master URL first, then refresh.'); return; }
    $('#mForceBtn').textContent='Refreshing…';
    try{
      const token=localStorage.getItem('dw_discogs_token')||'';
      const url=`https://api.discogs.com/${parsed.type}s/${parsed.id}`;
      const res=await fetch(url,{headers:{'User-Agent':'DeadWax/1.0',...(token?{Authorization:`Discogs token=${token}`}:{})}});
      if(!res.ok) throw new Error(await res.text());
      const d=await res.json();
      const patch={
        discogs_id:String(d.id||parsed.id),
        discogs_type:parsed.type,
        discogs_url:d.uri || r.discogs_url,
        cover_url:d.images?.[0]?.uri150 || d.images?.[0]?.resource_url || r.cover_url,
        genre:d.genres?.[0] || r.genre,
        genres:d.genres || [],
        styles:d.styles || [],
        tracklist:d.tracklist || [],
        release_year:d.year || r.release_year,
        label:d.labels?.[0]?.name || r.label,
        country:d.country || r.country,
        raw_data:{...(r.raw_data||{}),discogs:d,discogs_refreshed_at:new Date().toISOString()}
      };
      await saveRecord(r,patch,'discogs_enrichment');
    }catch(e){ alert('Discogs refresh failed: '+e.message); }
  }
  window.forceDiscogs=forceDiscogs;

  function openForm(idx){
    const r = typeof idx==='number' ? state.filtered[idx] : null;
    state.currentId = r?.id || null;
    // Remember the detail tab at the moment editing begins, before other
    // components can react to form events and change their selection.
    $('#fOv').dataset.returnTab = $('#detOv')?.classList.contains('on') ? ($('#detModal .ss-detail-tabs [role="tab"][aria-selected="true"]')?.dataset.ssTab || 'tracks') : '';
    $('#fTitle').textContent = r ? 'Edit Record' : 'Add Record';
    $('#formModal .f-sub').textContent='Saved to Supabase';
    $('#fldCode').value=recordCode(r||{}) || '';
    $('#fldArtist').value=r?.artist || '';
    $('#fldLast').value=r?.last || '';
    $('#fldFirst').value=r?.first || '';
    $('#fldAlbum').value=r?.album || '';
    $('#fldOwned').value=r?.copies_owned || 1;
    $('#fldGrail').checked=!!r?.grail;
    $('#fldDg').value=r?.discogs_url || '';
    $('#fldImg').value=r?.cover_url || '';
    $('#fldNote').value=r?.note || '';
    renderCollectionSelect(r);
    renderTrackEditor(tracks(r||{}));
    prevImg();
    const ssRemove=$('#ssFormRemove'); if(ssRemove)ssRemove.hidden=!r;
    $('#fOv').classList.add('on'); lockPage(); $('#fOv').setAttribute('aria-hidden','false');
  }
  window.openForm=openForm;
  function closeForm(){ $('#fOv').classList.remove('on'); $('#fOv').setAttribute('aria-hidden','true'); unlockPage(); }
  window.closeForm=closeForm;

  function renderCollectionSelect(r){
    const selected=new Set(collectionIdsForRecord(r||{}));
    $('#fldCollections').innerHTML=state.collections.map(c=>`<option value="${esc(c.id)}" ${selected.has(c.id)?'selected':''}>${esc(c.name)}</option>`).join('');
  }

  function renderTrackEditor(ts=[]){
    const grid=$('#fTrackGrid');
    const sides={};
    arr(ts).forEach(t=>{const side=String(t.position||'A').match(/^[A-Z]+/)?.[0]||'A';(sides[side] ||= []).push(t);});
    const letters=Object.keys(sides).length?Object.keys(sides):['A','B'];
    // Textarea .value is essential here: imported titles may contain markup.
    grid.replaceChildren();
    for(const side of letters){
      const wrap=document.createElement('div');wrap.className='ff';
      const label=document.createElement('label');label.htmlFor='side_'+side;label.textContent='Side '+side;
      const input=document.createElement('textarea');input.id='side_'+side;
      input.dataset.side=side;input.placeholder='A1 | Track title | 3:21';
      input.value=(sides[side]||[]).map(t=>[t.position,t.title,t.duration].filter(Boolean).join(' | ')).join('\n');
      wrap.append(label,input);grid.append(wrap);
    }
  }

  function parseTrackEditor(){
    return $$('#fTrackGrid textarea').flatMap(t=>t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
      const p=line.split('|').map(s=>s.trim());
      return {position:p[0]||'', title:p[1]||p[0]||'', duration:p[2]||''};
    }));
  }

  function addDisc(){
    const used=$$('#fTrackGrid textarea').map(t=>t.dataset.side);
    const next = String.fromCharCode(65+used.length);
    $('#fTrackGrid').insertAdjacentHTML('beforeend',`<div class="ff"><label for="side_${next}">Side ${next}</label><textarea id="side_${next}" data-side="${next}" placeholder="${next}1 | Track title | 3:21"></textarea></div>`);
  }

  async function saveRec(){
    const r=current();
    const payload={
      shelf_id:$('#fldCode').value.trim(),
      artist:$('#fldArtist').value.trim(),
      last:$('#fldLast').value.trim(),
      first:$('#fldFirst').value.trim(),
      album:$('#fldAlbum').value.trim(),
      copies_owned:Number($('#fldOwned').value||1),
      grail:$('#fldGrail').checked,
      discogs_url:$('#fldDg').value.trim(),
      cover_url:$('#fldImg').value.trim(),
      note:$('#fldNote').value.trim(),
      tracklist:parseTrackEditor(),
      collection_ids:[...document.querySelector('#fldCollections').selectedOptions].map(o=>o.value),
      collections:internalCollections([...document.querySelector('#fldCollections').selectedOptions].map(o=>o.value)),
      user_id:state.user.id,
      updated_at:new Date().toISOString()
    };
    if(!payload.shelf_id || !payload.artist){ alert('Shelf ID and Artist are required.'); return; }
    if(r){
      const saved=await saveRecord(r,payload,'record_edit',false);
      if(!saved) return;
    }else{
      const newPayload={...payload};
      delete newPayload.collection_ids; // join-table links are not records columns
      const {data,error}=await SB.from('records').upsert(newPayload,{onConflict:'user_id,shelf_id'}).select(FIELDS).single();
      if(error){ showSaveError(error,'record'); return; }
      try{ await syncRecordCollections(data.id, payload.collection_ids); }catch(e){
        setSync('Save incomplete');
        alert('Record fields saved, but collection assignments did not finish. Keep this form open and retry.\n'+explainError(e,'collection'));
        return;
      }
      data.collection_ids = payload.collection_ids;
      await logChange('record_add',null,data);
    }
    // Refresh the open detail in place after an edit, without forcing the user
    // to close and reopen the modal. Preserve their active information tab.
    const wasEditing=!!r;
    const openDetails=wasEditing && $('#detOv')?.classList.contains('on');
    const activeTab=openDetails ? ($('#fOv').dataset.returnTab || $('#detModal .ss-detail-tabs [role="tab"][aria-selected="true"]')?.dataset.ssTab) : null;
    const savedId=r?.id;
    closeForm();
    if(!(await loadAll()))return;
    if(openDetails && savedId){
      const refreshedIndex=state.filtered.findIndex(x=>x.id===savedId);
      if(refreshedIndex>=0){
        openModal(refreshedIndex);
        if(activeTab){
          // The modal's V56 observer may reset tabs on edited title/code.
          requestAnimationFrame(()=>$('#detModal .ss-detail-tabs [data-ss-tab="'+activeTab+'"]')?.click());
        }
      }else{
        // A changed value may remove the record from the active filter.
        closeModal();
        setSync('Saved · record is outside the active filter');
      }
    }
  }
  window.saveRec=saveRec;

  function prevImg(){ const u=$('#fldImg')?.value.trim(); const p=$('#imgPrev'); if(!p) return; p.innerHTML=u?`<img src="${esc(u)}" alt="">`:'<span>Preview</span>'; }
  window.prevImg=prevImg;

  async function deleteCurrent(){
    const r=current(); if(!r) return;
    if(!confirm(`Remove ${r.artist} — ${r.album}?`)) return;
    const {error}=await SB.from('records').delete().eq('id',r.id).eq('user_id',state.user.id);
    if(error){ alert(error.message); return; }
    await logChange('record_delete',r,null);
    if($('#fOv')?.classList.contains('on'))closeForm();
    closeModal(); await loadAll();
  }
  window.deleteCurrent=deleteCurrent;

  function setView(v){ state.view=v; if(v==='flow' && state.filtered[state.cfIndex]) state.cfActiveId=state.filtered[state.cfIndex].id; render(); }
  window.setView=setView;
  function setGroup(v){ state.group=v; state.cfIndex=0; state.cfActiveId=null; render(); }
  window.setGroup=setGroup;
  function setSecondaryGroup(v){ state.secondary=v; state.cfIndex=0; state.cfActiveId=null; render(); }
  window.setSecondaryGroup=setSecondaryGroup;
  function syncGroupControls(){ updateButtons(); }
  window.syncGroupControls=syncGroupControls;

  function toggleGroup(k){ const key=k.replaceAll('&amp;','&'); state.collapsed.has(key)?state.collapsed.delete(key):state.collapsed.add(key); render(); }
  window.toggleGroup=toggleGroup;

  function randomize(){
    if(!state.filtered.length) return;
    const i=Math.floor(Math.random()*state.filtered.length);
    const disc=$('#rdisc'); disc?.classList.add('spinning'); setTimeout(()=>disc?.classList.remove('spinning'),900);
    openModal(i); $('#rBanner').style.display='flex';
  }
  window.randomize=randomize;
  function goHomeGrid(){ setView('grid'); window.scrollTo({top:0,behavior:'smooth'}); }
  window.goHomeGrid=goHomeGrid;

  function openSettingsFromMenu(){ closeUserMenu(); openSett(); }
  window.openSettingsFromMenu=openSettingsFromMenu;
  function toggleUserMenu(){ $('#userMenu').classList.toggle('on'); $('#userMenuBtn').setAttribute('aria-expanded',$('#userMenu').classList.contains('on')); }
  window.toggleUserMenu=toggleUserMenu;
  function closeUserMenu(){ $('#userMenu').classList.remove('on'); $('#userMenuBtn').setAttribute('aria-expanded','false'); }
  window.closeUserMenu=closeUserMenu;

  function openSett(){ renderUserSettings(); $('#sOv').classList.add('on'); $('#sOv').setAttribute('aria-hidden','false'); lockPage(); }
  window.openSett=openSett;
  function closeSett(){ $('#sOv').classList.remove('on'); $('#sOv').setAttribute('aria-hidden','true'); unlockPage(); }
  window.closeSett=closeSett;
  function showUserTab(name){
    $$('.user-tab').forEach(b=>b.classList.remove('on'));
    $$('.user-panel').forEach(p=>{p.classList.remove('on'); p.hidden=false;});
    $('#tab'+cap(name))?.classList.add('on');
    $('#userPanel'+cap(name))?.classList.add('on');
  }
  window.showUserTab=showUserTab;
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

  function renderUserSettings(){
    updateCounts();
    $('#stLoadedDiscogs') && ($('#stLoadedDiscogs').textContent=state.records.filter(r=>tracks(r).length||r.cover_url||r.discogs_id).length);
    $('#stToken') && ($('#stToken').value=localStorage.getItem('dw_discogs_token')||'');
    renderCollectionManager();
    const hc=$('#highContrastToggle'); if(hc) hc.checked=document.documentElement.classList.contains('dw-high-contrast');
    $('#stHighContrast') && ($('#stHighContrast').textContent=hc?.checked?'On':'Off');
    const s=localStorage.getItem('dw_type_scale')||'12';
    $$('input[name="typeScale"]').forEach(x=>x.checked=x.value===s);
    $('#stTypeScale') && ($('#stTypeScale').textContent=s==='12'?'12-inch':s==='double'?'Double Album':'Box Set');
  }

  function renderCollectionManager(){
    const list=$('#collectionList'); if(!list) return;
    const rows=visibleCollectionRows(state.collections);
    list.innerHTML=rows.map(c=>`<div class="collection-item"><div><div class="collection-name">${esc(c.name)}</div><div class="collection-meta">${esc(c.id)}</div></div><div style="display:flex;gap:.35rem"><button class="btn-sec" onclick="renameCollection('${esc(c.id)}')">Rename</button><button class="btn-sec dng" onclick="deleteCollection('${esc(c.id)}')">Remove</button></div></div>`).join('') || '<div class="tip">No collection labels yet.</div>';
  }

  async function addCollection(){
    const name=$('#newCollectionName').value.trim(); if(!name) return;
    if(isRecordCabinet(name)){ alert('Record Cabinet is the implicit base collection and is not shown as a label.'); return; }
    if(state.collections.some(c=>c.name===name)){alert('This collection already exists.');return;}
    try{
      await getOrCreateCollection(name);
      $('#newCollectionName').value='';
      if(await loadAll())renderUserSettings();
    }catch(e){showSaveError(e,'collection');}
  }
  window.addCollection=addCollection;
  async function renameCollection(id){
    if(isRecordCabinet(id)){ alert('Record Cabinet is implicit and cannot be renamed.'); return; }
    const row=state.collections.find(c=>c.id===id); if(!row) return;
    const name=prompt('Rename collection label', row.name);
    if(!name || !name.trim() || name.trim()===row.name) return;
    if(isRecordCabinet(name)){ alert('Record Cabinet is the hidden base layer, not a visible label.'); return; }
    const {error}=await SB.from('collections').update({name:name.trim()}).eq('user_id',state.user.id).eq('id',id);
    if(error){ alert(error.message); return; }
    await loadAll(); renderUserSettings(); if(state.currentId){ const r=current(); if(r) renderModalCollections(r); }
  }
  window.renameCollection=renameCollection;
  async function deleteCollection(id){
    if(isRecordCabinet(id)){ alert('Record Cabinet is implicit and cannot be removed as a visible label.'); return; }
    if(!confirm('Remove this collection label?')) return;
    const linkDel=await SB.from('record_collections').delete().eq('user_id',state.user.id).eq('collection_id',id);
    if(linkDel.error){ alert(linkDel.error.message); return; }
    const {error}=await SB.from('collections').delete().eq('user_id',state.user.id).eq('id',id);
    if(error){ alert(error.message); return; }
    await loadAll(); renderUserSettings();
  }
  window.deleteCollection=deleteCollection;

  function saveSett(){ localStorage.setItem('dw_discogs_token',$('#stToken').value.trim()); renderUserSettings(); }
  window.saveSett=saveSett;
  function fetchMissingDiscogs(){ alert('Bulk Discogs fetching is intentionally not enabled yet. Refresh per record for now.'); }
  window.fetchMissingDiscogs=fetchMissingDiscogs;
  function csvEscape(v){ const str=String(v??''); return /[",\n;]/.test(str) ? '"'+str.replace(/"/g,'""')+'"' : str; }
  function collectionExportName(r){ return collectionNames(r).join('; '); }
  function recordsForExport(){ return [...state.records].sort(shelfCompare); }
  function downloadBlob(name, type, content){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
  function exportCsv(){
    const headers=['Shelf ID','Artist','Album','First name','Last name','Copies owned','Listened','Reaction','Grail','Collections','Genre','Year','Label','Country','Discogs URL','Cover URL','Notes','Tracklist'];
    const rows=recordsForExport().map(r=>[recordCode(r),r.artist,r.album,r.first,r.last,r.copies_owned,r.listened?'yes':'no',reactionValue(r),r.grail?'yes':'no',collectionExportName(r),r.genre,displayYear(r),r.label,r.country,r.discogs_url,coverUrl(r),r.note,tracks(r).map(t=>[t.position,t.title,t.duration].filter(Boolean).join(' | ')).join('\n')]);
    downloadBlob(`sleeveshelves-collection-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8',[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\n'));
  }
  window.exportCsv=exportCsv;
  function exportExcel(){
    const headers=['Shelf ID','Artist','Album','First name','Last name','Copies owned','Listened','Reaction','Grail','Collections','Genre','Year','Label','Country','Discogs URL','Cover URL','Notes'];
    const body=recordsForExport().map(r=>`<tr>${[recordCode(r),r.artist,r.album,r.first,r.last,r.copies_owned,r.listened?'yes':'no',reactionValue(r),r.grail?'yes':'no',collectionExportName(r),r.genre,displayYear(r),r.label,r.country,r.discogs_url,coverUrl(r),r.note].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px;font-family:Arial;font-size:11pt}th{background:#eee}</style></head><body><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(`sleeveshelves-collection-${new Date().toISOString().slice(0,10)}.xls`,'application/vnd.ms-excel;charset=utf-8',html);
  }
  window.exportExcel=exportExcel;
  function exportPdf(){
    const w=window.open('','_blank');
    const rows=recordsForExport().map(r=>`<tr><td>${esc(recordCode(r))}</td><td>${esc(r.artist)}</td><td>${esc(r.album)}</td><td>${esc(collectionExportName(r))}</td><td>${esc(r.genre||'')}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>SleeveShelves Collection</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-family:Georgia,serif}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;text-align:left;padding:6px 8px;font-size:11px}th{background:#f2f2f2}.meta{color:#666;margin-bottom:18px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Save as PDF / Print</button><h1>SleeveShelves Collection</h1><div class="meta">${state.records.length} records · exported ${new Date().toLocaleString()}</div><table><thead><tr><th>Shelf ID</th><th>Artist</th><th>Album</th><th>Collections</th><th>Genre</th></tr></thead><tbody>${rows}</tbody></table><script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
  }
  window.exportPdf=exportPdf;
  function parseCsv(text){ const rows=[]; let row=[], cell='', q=false; for(let i=0;i<text.length;i++){ const ch=text[i], nx=text[i+1]; if(q){ if(ch==='"'&&nx==='"'){cell+='"';i++;} else if(ch==='"'){q=false;} else cell+=ch; } else if(ch==='"') q=true; else if(ch===','||ch===';'){ row.push(cell); cell=''; } else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; } else if(ch!=='\r') cell+=ch; } row.push(cell); rows.push(row); return rows.filter(r=>r.some(c=>String(c).trim())); }
  function getField(obj, names){ for(const n of names){ const k=Object.keys(obj).find(x=>norm(x)===norm(n)); if(k && obj[k]!==undefined) return obj[k]; } return ''; }
  async function handleImport(event){
    const file=event?.target?.files?.[0]; if(!file) return;
    if(!/\.csv$|\.txt$/i.test(file.name)){ alert('For now this native importer accepts CSV. Excel can export as CSV, and full .xlsx support can be added later.'); return; }
    const rows=parseCsv(await file.text()); if(rows.length<2){ alert('No rows found.'); return; }
    const headers=rows[0].map(h=>String(h).trim());
    const objects=rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
    const valid=objects.map((o,i)=>({o,i:i+2,artist:getField(o,['artist','artist name','artis']),album:getField(o,['album','title','record','release'])})).filter(x=>x.artist.trim() && x.album.trim());
    if(!valid.length){ alert('Import needs at least Artist and Album columns. Shelf ID, First name and Last name are optional.'); return; }
    if(!confirm(`Import ${valid.length} records from CSV? Artist and Album are required; Shelf ID is optional.`)) return;
    setSync('Importing CSV'); let ok=0, fail=0, partial=0; const failures=[];
    const importedCollections=new Map(state.collections.map(c=>[c.name,c.id]));
    for(const {o,artist,album} of valid){
      const shelf=(getField(o,['shelf id','shelf_id','code','id'])||'').trim();
      const cols=(getField(o,['collections','collection','labels'])||'').split(/[|;]/).map(x=>x.trim()).filter(Boolean).filter(x=>!isRecordCabinet(x));
      const colIds=[];
      let collectionError=null;
      for(const name of cols){
        try{
          let id=importedCollections.get(name);
          if(!id){id=await getOrCreateCollection(name);importedCollections.set(name,id);}
          colIds.push(id);
        }catch(e){collectionError=e;break;}
      }
      if(collectionError){ fail++;failures.push((shelf||album)+' (collection: '+explainError(collectionError,'collection')+')');continue; }
      const payload={user_id:state.user.id,shelf_id:shelf||null,artist:artist.trim(),album:album.trim(),first:getField(o,['first','first name']).trim(),last:getField(o,['last','last name']).trim(),copies_owned:Number(getField(o,['copies','copies owned','owned'])||1),genre:getField(o,['genre']).trim(),discogs_url:getField(o,['discogs url','discogs','url']).trim(),note:getField(o,['notes','note']).trim(),collections:internalCollections(colIds),updated_at:new Date().toISOString()};
      let res=shelf ? await SB.from('records').upsert(payload,{onConflict:'user_id,shelf_id'}).select('id').single() : await SB.from('records').insert(payload).select('id').single();
      if(res.error){ fail++; failures.push(shelf||album); continue; }
      try{ await syncRecordCollections(res.data.id,colIds); ok++; }catch(e){ partial++; failures.push((shelf||album)+' (collections)'); }
    }
    await logChange('csv_import',null,{ok,fail,partial,total:valid.length}); alert(`CSV import: ${ok} complete, ${partial} partially saved, ${fail} failed.\n${failures.length?'Review: '+failures.slice(0,12).join(', '):''}`); event.target.value=''; await loadAll();
  }
  window.handleImport=handleImport;
  function exportDiscogsDb(){ alert('Your collection is stored in Supabase. Use Download CSV to create a backup.'); }
  window.exportDiscogsDb=exportDiscogsDb;
  function clearDgCache(){ alert('No record cache is used as source of truth in this native build.'); }
  window.clearDgCache=clearDgCache;
  function openWebViewer(){ window.open('web.html','_blank'); }
  window.openWebViewer=openWebViewer;

  function setHighContrast(on){
    document.documentElement.classList.toggle('dw-high-contrast',!!on);
    localStorage.setItem('dw_high_contrast',on?'1':'0');
    renderUserSettings();
  }
  window.setHighContrast=setHighContrast;
  function setTypeScale(v){
    localStorage.setItem('dw_type_scale',v);
    document.documentElement.classList.toggle('dw-type-double-album',v==='double');
    document.documentElement.classList.toggle('dw-type-box-set',v==='box');
    document.documentElement.dataset.typeScale=v;
    renderUserSettings();
  }
  window.setTypeScale=setTypeScale;

  function updateHdrH(){
    const h=$('#hdr')?.getBoundingClientRect().height || 108;
    document.documentElement.style.setProperty('--hdr', `${Math.ceil(h)}px`);
  }
  window.updateHdrH=updateHdrH;


  function ensureDatabaseTools(){
    const panel=$('#userPanelDatabase .settings-section');
    if(panel && !$('#dwExportTools')){
      panel.insertAdjacentHTML('beforeend',`<div class="s-btns" id="dwExportTools"><button type="button" class="btn-sec" onclick="exportCsv()">Download CSV</button><button type="button" class="btn-sec" onclick="exportExcel()">Excel-compatible .xls</button><button type="button" class="btn-sec" onclick="exportPdf()">Print / Save PDF</button><button type="button" class="btn-sec" onclick="document.getElementById('importFile').click()">Upload CSV</button></div><div class="tip">CSV import requires Artist and Album. Shelf ID, First name and Last name are optional. Extra columns such as Collection, Genre, Discogs URL, Notes and Copies are used when present.</div>`);
    }
    const f=$('#importFile'); if(f) f.setAttribute('accept','.csv,.txt');
  }

  function ensureExactStaticAdditions(){
    const gs=$('#groupSelect');
    if(gs && ![...gs.options].some(o=>o.value==='shelf')){
      gs.insertAdjacentHTML('beforeend','<option value="shelf">Shelf ID</option>');
    }
    const menu=$('#userMenu');
    if(menu && !menu.querySelector('[data-dw-signout]')){
      menu.insertAdjacentHTML('beforeend','<button type="button" class="user-menu-item" role="menuitem" data-dw-signout onclick="signOut()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Sign out</span></button>');
    }
  }

  function bindEvents(){
    ensureExactStaticAdditions(); ensureDatabaseTools();
    $('#gSearch')?.addEventListener('input',e=>{ state.filters.global=e.target.value; renderSearchFlyout(e.target.value); applyFilters(); });
    [['fCode','code'],['fArtist','artist'],['fLast','last'],['fFirst','first'],['fAlbum','album']].forEach(([id,k])=>$('#'+id)?.addEventListener('input',e=>{state.filters[k]=e.target.value; applyFilters();}));
    $('#fGenre')?.addEventListener('change',e=>{state.filters.genre=e.target.value; applyFilters();});
    $('#fListened')?.addEventListener('change',e=>{state.filters.listened=e.target.checked; if(e.target.checked && $('#ss6147ListenModes')?.hidden)state.listenedViewMode='vinyl'; applyFilters();});
    $('#fDoubles')?.addEventListener('change',e=>{state.filters.doubles=e.target.checked; applyFilters();});
    $('#fRating')?.addEventListener('change',e=>{state.filters.rating=e.target.value; applyFilters();});
    $('#fLastListened')?.addEventListener('change',e=>{state.filters.lastListened=e.target.value; applyFilters();});
    $('#fGrail')?.addEventListener('change',e=>{state.filters.grail=e.target.checked; applyFilters();});
    $('#btnClr')?.addEventListener('click',()=>{ state.filters={collectionId:'', global:'', code:'', artist:'', last:'', first:'', album:'', genre:'', listened:false, doubles:false, rating:'', lastListened:'', grail:false}; ['gSearch','fCode','fArtist','fLast','fFirst','fAlbum'].forEach(id=>$('#'+id)&&( $('#'+id).value='' )); ['fGenre','fRating','fLastListened'].forEach(id=>$('#'+id)&&($('#'+id).value='')); ['fListened','fDoubles','fGrail'].forEach(id=>$('#'+id)&&($('#'+id).checked=false)); applyFilters(); });
    $('#filterToggle')?.addEventListener('click',()=>{ const d=$('#filterDrawer'), b=$('#filterToggle'); d.classList.toggle('on'); b.setAttribute('aria-expanded',String(d.classList.contains('on'))); updateHdrH(); });
    $('#groupSelect')?.addEventListener('change',e=>setGroup(e.target.value));
    $('#secondaryGroupSelect')?.addEventListener('change',e=>setSecondaryGroup(e.target.value));
    $('#userMenuBtn')?.addEventListener('click',e=>{e.stopPropagation(); toggleUserMenu();});
    document.addEventListener('click',e=>{ if(!e.target.closest?.('#userMenuWrap')) closeUserMenu(); if(!e.target.closest?.('#searchWrap')) closeSf(); });
    $('#mClose')?.addEventListener('click',closeModal);
    $('#detOv')?.addEventListener('click',e=>{ if(e.target.id==='detOv') closeModal(); });
    $('#fOv')?.addEventListener('click',e=>{ if(e.target.id==='fOv') closeForm(); });
    $('#sOv')?.addEventListener('click',e=>{ if(e.target.id==='sOv') closeSett(); });
    $('#addDiscBtn')?.addEventListener('click',addDisc);
    $('#cfStage')?.addEventListener('wheel',cfHandleWheel,{passive:false});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){ closeSf(); closeUserMenu(); }
      if(state.view==='flow' && (e.key==='ArrowRight'||e.key==='ArrowLeft')){ e.preventDefault(); cfStep(e.key==='ArrowRight'?1:-1); }
      if(state.view==='flow' && (e.key==='Enter'||e.key===' ')){ if(!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){ e.preventDefault(); const entries=cfClamp(); const active=entries[state.cfIndex]?.record; if(active) openRecordById(active.id); } }
    });
    new ResizeObserver(updateHdrH).observe($('#hdr'));
  }

  function renderSearchFlyout(q){
    const sf=$('#sf'); q=q.trim(); if(q.length<2){ closeSf(); return; }
    const res=filtered().slice(0,12);
    sf.classList.add('on');
    sf.innerHTML=res.length?`<div class="sf-grp"><div class="sf-grp-lbl">Records</div>${res.map(r=>`<div class="sf-item" onclick="openRecordById('${esc(r.id)}')"><div class="sf-code">${esc(recordCode(r))}</div><div class="sf-thumb">${coverHtml(r)}</div><div class="sf-txt"><div class="sf-name">${esc(r.artist)}</div><div class="sf-sub">${esc(r.album)}</div></div></div>`).join('')}</div>`:`<div class="sf-empty">No search results</div>`;
  }
  function closeSf(){ $('#sf')?.classList.remove('on'); }
  window.closeSf=closeSf;

  function renderFlowCardFallback(){}

  window.addEventListener('scroll',()=>document.body.classList.toggle('dw-scrolled',window.scrollY>4),{passive:true});

  bindEvents();
  initAuth();
})();



/* MODULE: deadwax-turntable-v45.js */
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
  let stageWasActive = false;
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
      cover: session.record.cover || '',
      shelfId: session.record.shelfId || '',
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
    console.warn('SleeveShelves Digital Turntable:',message);
    let node = $('#dw45PlaybackError');
    if (!node) { node=document.createElement('div'); node.id='dw45PlaybackError'; node.setAttribute('role','alert'); document.body.append(node); }
    const premium = /(?:premium|account_error|Spotify\s*403)/i.test(message);
    const needsLogin = !premium && /(?:Spotify\s*401|authorization failed|invalid.grant|token.*expired|session.*expired|unauthorized|not authenticated|connect.*spotify|authentication.error|permission.*denied)/i.test(message);
    node.replaceChildren();
    const content=document.createElement('span');
    content.textContent = needsLogin ? 'Spotify needs to be reconnected before audio playback.' :
      premium ? 'Spotify Premium is required for browser playback.' :
      'Spotify could not start playback: '+message;
    node.append(content);
    if (needsLogin) {
      const btn=document.createElement('button');btn.type='button';btn.className='ss6146-error-connect';btn.textContent='Reconnect Spotify';
      btn.addEventListener('click',()=>window.DW_SPOTIFY_V45?.connect?.().catch(showPlaybackError));
      node.append(btn);
    }
    node.hidden = false;
    const snapshot=content.textContent;
    window.setTimeout(() => { if (node.querySelector('span')?.textContent===snapshot) node.hidden = true; },16000);
  }
  // Do not silently switch from real Spotify audio to an animated silent record.
  // Demo playback is available only after the collector explicitly chooses it.
  let spotifyPromptFocus=null;
  function closeSpotifyPrompt(){
    const prompt=$('#ss6146SpotifyPrompt');if(!prompt)return;
    prompt.remove();spotifyPromptFocus?.focus?.();spotifyPromptFocus=null;
  }
  function showSpotifyPrompt(side){
    if($('#ss6146SpotifyPrompt'))return;
    spotifyPromptFocus=document.activeElement;
    const prompt=document.createElement('div');prompt.id='ss6146SpotifyPrompt';prompt.className='ss6146-spotify-backdrop';
    prompt.setAttribute('role','presentation');
    const dialog=document.createElement('div');dialog.className='ss6146-spotify-dialog';dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','ss6146SpotifyTitle');
    const header=document.createElement('div');header.className='ss6146-spotify-head';
    const status=document.createElement('span');status.className='ss6146-spotify-kicker';status.textContent='DIGITAL TURNTABLE';
    const close=document.createElement('button');close.type='button';close.className='ss6146-spotify-close';
    close.setAttribute('aria-label','Close Spotify connection prompt');close.textContent='×';
    header.append(status,close);
    const title=document.createElement('h3');title.id='ss6146SpotifyTitle';title.textContent='Spotify is not connected';
    const detail=document.createElement('p');detail.textContent='Connect Spotify to hear this record. You can also explore the spinning turntable without audio.';
    const buttons=document.createElement('div');buttons.className='ss6146-spotify-actions';
    const connect=document.createElement('button');connect.type='button';connect.className='ss6146-connect';connect.textContent='Connect Spotify';
    const preview=document.createElement('button');preview.type='button';preview.className='ss6146-preview';preview.textContent='Silent preview';
    const note=document.createElement('small');note.textContent='Spotify Premium is required for browser audio. Silent previews are never logged as digital listens.';
    buttons.append(connect,preview);dialog.append(header,title,detail,buttons,note);prompt.append(dialog);document.body.append(prompt);
    const onKey=(event)=>{if(event.key==='Escape'){event.preventDefault();closeSpotifyPrompt();}if(event.key==='Tab'){
      const items=[close,connect,preview];const idx=items.indexOf(document.activeElement);
      if(event.shiftKey&&idx<=0){event.preventDefault();preview.focus();}
      else if(!event.shiftKey&&idx===items.length-1){event.preventDefault();close.focus();}
    }};
    prompt.addEventListener('keydown',onKey);
    prompt.addEventListener('click',event=>{if(event.target===prompt)closeSpotifyPrompt();});
    close.addEventListener('click',closeSpotifyPrompt);
    connect.addEventListener('click',()=>{
      const action=window.DW_SPOTIFY_V45?.connect;
      if(typeof action!=='function'){title.textContent='Spotify is unavailable';detail.textContent='Reload SleeveShelves to initialize its Spotify integration.';return;}
      connect.disabled=true;connect.textContent='Connecting…';
      Promise.resolve().then(()=>action()).catch(error=>{connect.disabled=false;connect.textContent='Connect Spotify';showPlaybackError(error);});
    });
    preview.addEventListener('click',()=>{closeSpotifyPrompt();void startSide(side,{silentPreview:true});});
    connect.focus();
  }
  async function startSide(side,options={}) {
    const record = tracksFromDetail();
    if (!eligible() || !record || !record.sides[side]?.length) return;
    const spotify=providers.get('spotify');
    if (!options.silentPreview && !spotify?.isConnected?.()) {showSpotifyPrompt(side);return;}
    const op=++operationId, adapter=options.silentPreview ? demo : spotify;
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
      if(deck)deck.style.setProperty('--dw44-track-angle',armAngleAt(groovePosition()));
    } else if(event.kind==='finished') {
      if(session.status==='stopped'||session.status==='finished')return;
      session.status='finished';session.elapsed=0;
      Promise.resolve(providers.get(session.providerId)?.stop?.()).catch(showPlaybackError);
      render();
    } else if(event.kind==='paused') {
      if(session.status==='playing'){session.status='paused';render();}
    } else if(event.kind==='playing') {
      if(session.status==='paused' && pendingTrackIndex===null){session.status='playing';render();}
    } else if(event.kind==='error')showPlaybackError(event.error);
  }
  function tick(now) {
    if (!session || session.providerId !== 'demo' || session.status !== 'playing') { lastTick = now; return; }
    const dt = Math.max(0, Math.min((now - (lastTick || now)) / 1000, 1.5));
    lastTick = now;
    session.elapsed += dt;
    if (session.elapsed < FEATURE.demoSecondsPerTrack) {
      const deck = dock && $('.dw44-deck', dock);
      if (deck) deck.style.setProperty('--dw44-track-angle', armAngleAt(groovePosition()));
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
    // Collector-first: the tracklist already owns side selection and play.
    // The deck only needs the physical needle and stop/park controls.
    const core = [
      button('needle', primaryLabel(), session.status==='playing'?'pause':'play'),
      button('stop', 'Stop and return record to sleeve', 'stop')
    ].join('');
    return matchingDetail() ? `<div class="ss-v50-transport-left">${core}</div>` : core;
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
  function activeForSelectedRecord() {
    // The large platter replaces the sleeve only while actively cued or playing.
    // Stopped and end-of-side return to the physical sleeve, not a parked widget.
    return !!(session && ['loading','playing','paused'].includes(session.status) && matchingDetail());
  }
  function dockHost() {
    // V50: the turntable replaces the sleeve ONLY for the selected record
    // while the virtual needle session is active. Otherwise show its sleeve.
    return activeForSelectedRecord() && $('#ssTurntableStage')
      ? $('#ssTurntableStage') : document.body;
  }
  function placeDock() {
    if (!dock) return;
    const host = dockHost();
    if (dock.parentElement !== host) host.appendChild(dock);
    const embedded = host.id === 'ssTurntableStage';
    dock.classList.toggle('dw44-is-embedded', embedded);
    dock.classList.toggle('dw44-is-floating', !embedded);
    dock.setAttribute('aria-label', embedded ? 'Record turntable in detail panel' : 'Digital Turntable compact listening status');
    if (embedded) expanded = true;
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
  // Calibrated to the V52 photographed arm and its top-right pivot.
  // The stylus begins on the outer lead-in and sweeps inward as the LP plays.
  function armAngleAt(progress) {
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    return `${(-13+20*p).toFixed(3)}deg`;
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
    deck.style.setProperty('--dw44-track-angle', armAngleAt(visualProgress));
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
    return `<div class="dw44-deck ${spinning?'is-playing':'is-idle'}" role="group" tabindex="0" aria-label="Turntable. Use left and right arrow keys to lift and cue the needle to a different track groove. Drop the needle to play.">
      <div class="dw44-deck-inset">
        <div class="dw44-platter-rim"><div class="dw44-platter ${spinning?'is-spinning':''}">
          <div class="dw44-record-grooves"></div>
          ${recordGroovesMarkup()}
          <div class="dw44-center-label" aria-label="Album cover label: ${escapeHtml(session.record.album)}">${coverMarkup(session.record)}</div>
          <div class="dw44-spindle"></div>
        </div></div>
        <div class="ss53-vinyl-light" aria-hidden="true"></div>
        <div class="ss53-lamp" aria-hidden="true"><span class="ss53-lamp-lens"></span></div>
        <div class="ss53-engraving" aria-hidden="true">SLEEVESHELVES <span>33⅓ RPM</span></div>
        <div class="dw44-tonearm ${needlePosition()}">
          <div class="dw44-arm-swing">
            <img class="ss52-reference-tonearm" src="assets/sleeveshelves-reference-arm.png" alt="" draggable="false" aria-hidden="true">
            <svg class="ss52-arm-cue-layer" viewBox="0 0 212 283" preserveAspectRatio="xMidYMid meet" aria-label="Cue the tonearm">
              <circle cx="21" cy="252" r="17" fill="transparent" class="dw45-stylus-grip" tabindex="0" focusable="true" role="slider" aria-label="Drag the tonearm over a groove and release to play, or use arrow keys to cue" aria-valuemin="1" aria-valuemax="${session.tracks.length}" aria-valuenow="${session.trackIndex+1}"><title>Drag the stylus to a groove</title></circle>
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
    </div>`;
  }
  function renderStagePreview() {
    const stage=$('#ssTurntableStage');
    const preview=$('#ssTurntablePreview');
    if (!stage || !preview) return;
    const shown=$('#detOv')?.classList.contains('on');
    stage.hidden=!shown;
    if (!shown) { preview.hidden=true; stageWasActive=false; return; }
    const active=activeForSelectedRecord();
    const wasActive=stageWasActive;
    stageWasActive=active;
    stage.classList.toggle('ss-is-playing',active);
    if (active && !wasActive) {
      // Physical ritual: the existing sleeve lifts/slides away to reveal the
      // loaded LP. The album image is reused from the original preview.
      const sleeve=preview.querySelector('.ss-v50-sleeve-art');
      stage.querySelector('.ss54-sleeve-fly')?.remove();
      if (sleeve && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const fly=document.createElement('div');
        fly.className='ss54-sleeve-fly';
        fly.setAttribute('aria-hidden','true');
        fly.append(sleeve.cloneNode(true));
        stage.append(fly);
        stage.classList.add('ss54-revealing');
        const finish=()=>{fly.remove();stage.classList.remove('ss54-revealing');};
        fly.addEventListener('animationend',finish,{once:true});
        window.setTimeout(finish,850);
      }
    }
    preview.hidden=active;
    if (active) return;
    if (wasActive && !active) {
      stage.classList.remove('ss54-revealing');
      stage.querySelector('.ss54-sleeve-fly')?.remove();
      preview.classList.remove('ss54-sleeve-return');
      void preview.offsetWidth;
      preview.classList.add('ss54-sleeve-return');
    }
    // The native record detail supplies the artwork; never use a demo/stand-in
    // image in the shipped app. The sleeve remains visible without a tracklist.
    const record=tracksFromDetail();
    const cover=$('#mCover img')?.getAttribute('src') || '';
    const artist=text('#mArtist'),album=text('#mAlbum');
    const key=[artist,album,cover,(record?.key||'')].join('|');
    if (preview.dataset.recordKey===key) return;
    preview.dataset.recordKey=key;
    const sides=record?Object.keys(record.sides):[];
    const canShowCover=/^(https?:\/\/|data:image\/)/i.test(cover);
    const coverArt=canShowCover?`<img src="${escapeHtml(cover)}" alt="${escapeHtml(album)} album sleeve">`:
      `<div class="ss-v50-no-cover" aria-label="Album sleeve artwork unavailable"><span>THE RECORD SLEEVE</span><strong>${escapeHtml(album||'Record')}</strong><small>${escapeHtml(artist)}</small></div>`;
    preview.innerHTML=`<div class="ss-v50-sleeve-media" aria-label="Entire original album sleeve, before using the turntable">
        <div class="ss-v50-sleeve-art">${coverArt}</div>
      </div>`;
  }
  function sleeveTrackMarkup() {
    if (!session)return '';
    const all=Object.entries(session.record.sides).flatMap(([side,list])=>list.map(t=>({...t,side})));
    return `<div class="dw45-sleeve-list"><span class="dw45-sleeve-title">${escapeHtml(session.record.album)} · Tracklist</span>${all.map((t)=>{
      const idx=session.record.sides[t.side].findIndex(x=>x.position===t.position);
      const active=t.side===session.side && idx===session.trackIndex;
      const preview=t.side===session.side && idx===cuePreviewIndex;
      return `<div class="dw45-sleeve-track ${active?'is-current':''} ${preview?'is-cue-target':''}" aria-label="${escapeHtml(t.position)} ${escapeHtml(t.title)}"><em>${escapeHtml(t.position)}</em><span>${escapeHtml(t.title)}</span></div>`;
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
    // V54: cue selection is shown ONLY in the existing native tracklist.
    // Never create a second track preview, popover, or status content item.
    const same=matchingDetail();
    const selectedPosition=same && session?.tracks?.[cuePreviewIndex ?? session.trackIndex]?.position;
    for (const row of $$('#mTlC .m-tl-track')) {
      const isCue=cuePreviewIndex!==null && same && text('.m-tl-pos',row)===selectedPosition;
      row.classList.toggle('ss54-cue-row',isCue);
      row.classList.toggle('dw44-current-row',same && !isCue && cuePreviewIndex===null && text('.m-tl-pos',row)===selectedPosition);
      if(isCue)row.setAttribute('data-ss-cue','true');
      else row.removeAttribute('data-ss-cue');
    }
    for (const band of $$('.dw45-sleeve-track',dock || document))band.classList.remove('is-cue-target');
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
  // Controls are part of the physical deck when embedded, not a second bar
  // below it. The same native buttons/actions are moved, never duplicated.
  function positionControls() {
    if (!dock) return;
    const controlsNode=$('.dw44-controls',dock);
    if (!controlsNode) return;
    const embedded=dock.classList.contains('dw44-is-embedded');
    const deck=$('.dw44-deck-inset',dock);
    const desired=embedded && deck ? deck : dock;
    controlsNode.classList.toggle('ss53-on-deck',embedded);
    if(controlsNode.parentElement!==desired) {
      if(embedded)desired.appendChild(controlsNode);
      else {
        const foot=$('.dw44-dock-foot',dock);
        if(foot)foot.before(controlsNode);
        else desired.appendChild(controlsNode);
      }
    }
  }
  function renderDock() {
    if (!dock) return;
    placeDock();
    dock.hidden = !session || session.status === 'stopped';
    const embedded = dock.classList.contains('dw44-is-embedded');
    if (!embedded) expanded=false;
    dock.classList.toggle('dw44-is-minimized', !!session && !expanded && !embedded);
    dock.classList.toggle('dw44-is-open', !!session && (expanded || embedded));
    if (!session) { dock.replaceChildren(); return; }
    if (!expanded && !embedded) {
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
      const elsewhere = $('.dw44-premium', dock);
      if(elsewhere){elsewhere.textContent=matchingDetail()?'':`RETURN TO ${session.record.album}`;}
      dock.classList.toggle('dw44-other-record',!matchingDetail());
      const statusLine = $('.dw44-playing-label', dock);
      if (statusLine) statusLine.innerHTML = `<span class="dw44-status-light ${session.status==='playing'?'is-on':''}"></span>${escapeHtml(statusName())} <span class="dw44-side-label">· SIDE ${escapeHtml(session.side)}</span>`;
      const currentLine = $('.dw44-current-track', dock);
      if (currentLine) currentLine.textContent = session.status === 'finished' ? 'End of side · Turn the record or drop the needle' : currentTrackTitle();
      const buttons = $('.dw44-controls', dock);
      if (buttons) buttons.innerHTML = controls();
      positionControls();
      syncDeck(priorDeck);
      updateSleeve();
      const brand=$('.dw44-deck-brand',priorDeck);
      if(brand)brand.innerHTML=`<small>SHELF ID</small>${escapeHtml(session.record.shelfId||'UNASSIGNED')}`;
      const foot=$('.dw44-dock-foot',dock);
      if(foot)foot.innerHTML=session.providerId==='spotify'?'<span>33⅓ RPM · SPOTIFY</span><span>DIGITAL STREAM</span>':'<span>33⅓ RPM · SIMULATED</span><span>NO AUDIO</span>';
      return;
    }
    dock.innerHTML = `
      <div class="dw44-dock-head"><div class="dw44-dock-brand"><span class="dw44-eyebrow">SLEEVESHELVES <i>·</i> TURNTABLE</span><button type="button" class="dw44-premium" data-dw44-action="openrecord" aria-label="Return to playing record">RETURN TO ${escapeHtml(session.record.album)}</button></div>
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
    dock.classList.toggle('dw44-other-record',!matchingDetail());
    dock.dataset.dw44RecordKey = session.record.key;
    const newDeck = $('.dw44-deck', dock);
    positionControls();
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
      el.classList.toggle('is-active', same);
    }
    // No duplicate "now playing" card or cue status in the detail pane.
    $('#dw44DetailStatus')?.remove();
    for (const trackEl of $$('#mTlC .m-tl-track')) {
      const pos = text('.m-tl-pos', trackEl);
      const selected = same && pos === session.tracks[session.trackIndex]?.position;
      const cue = same && cuePreviewIndex!==null && pos === session.tracks[cuePreviewIndex]?.position;
      trackEl.classList.toggle('dw44-current-row', !!selected && cuePreviewIndex===null);
      trackEl.classList.toggle('ss54-cue-row', !!cue);
      if (selected && cuePreviewIndex===null) trackEl.setAttribute('aria-current','true');
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
    renderStagePreview();
    scheduleCollectionDecorate();
    // V57: notify the receiver-style header without coupling it to player DOM.
    document.dispatchEvent(new CustomEvent('sleeveshelves:playback', {detail:readState()}));
  }
  function decorateDetail() {
    const container = $('#mTlC');
    const parent = $('#mTl');
    if (!container || !parent || !$('#detOv')?.classList.contains('on')) return;
    const record = tracksFromDetail();
    recordView = record;
    if (!record) { modalControls(); return; }
    // The stage is a sibling of the original detail region, never a nested
    // pseudo-player inside the tracklist. Keep the native tracklist unchanged.
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
    // SleeveShelves: a tracklist is informational, never an instant digital skip.
    const track=event.target.closest('[data-dw45-track]');
    if(track){event.preventDefault();return;}
    // A click on the vinyl alone does not seek; only a deliberate pointer drag cues.
    const band=event.target.closest('[data-dw44-groove-track]');
    if(band){event.preventDefault();return;}
    const button = event.target.closest('[data-dw44-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const map = {needle, stop, turn, swap, openrecord: openPlayingRecord, minimize: () => {expanded = false; render();}, expand: () => {expanded = true; render();}};
    map[button.dataset.dw44Action]?.();
  }
  function init() {
    if (initialized || !$('#detOv') || !$('#mTlC')) return;
    initialized = true;
    mountDock();
    let needleDrag=null;
    function trackAtPointer(map,x,y) {
      // The LP spins. A rotating SVG has an expanded bounding rectangle,
      // which is NOT a reliable physical coordinate system for needle cueing.
      // Measure against the stationary platter rim instead.
      const rim=map.closest('.dw44-platter-rim');
      const rect=(rim||map).getBoundingClientRect();
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
    document.addEventListener('keydown',e=>{
      if(!session || !e.target.closest?.('.dw45-stylus-grip, .dw44-deck'))return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();void needle();return;}
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();
      const index=e.key==='Home'?0:e.key==='End'?session.tracks.length-1:
        Math.max(0,Math.min(session.tracks.length-1,session.trackIndex+(e.key==='ArrowRight'?1:-1)));
      void cueTrack(index);
    });
    document.addEventListener('pointerdown',e=>{
      const grip=e.target.closest?.('.dw45-stylus-grip');
      const map=grip ? $('#dw44Dock .dw44-groove-map') : e.target.closest?.('.dw44-groove-map');
      if(!map||!session||session.status==='loading'||e.button>0)return;
      // Pause BEFORE cueing. Store the promise so the new track is never
      // dispatched while a previous Spotify pause is still pending.
      const wasPlaying=session.status==='playing';
      const pausePromise=wasPlaying?needle():Promise.resolve();
      needleDrag={map,id:e.pointerId,x:e.clientX,y:e.clientY,grip:!!grip,moved:false,pausePromise};
      cueOriginIndex=session.trackIndex;
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
      const index=drag.moved ? cuePreviewIndex : null;
      cuePreviewIndex=null;cueOriginIndex=null;
      suppressGrooveClickUntil=performance.now()+350;
      // A physical release is a DROP, not a digital skip: lift -> cue -> lower.
      // Await each provider action to avoid Spotify pause/start races.
      void (async()=>{
        try {
          await drag.pausePromise;
          if (!session || session.status==='stopped' || session.status==='finished')return;
          if(index!==null && index!==session.trackIndex) await cueTrack(index);
          else if(index!==null && session.status==='paused' && pendingTrackIndex!==index) await cueTrack(index);
          if(session && session.status!=='playing' && session.status!=='loading')await needle();
        } catch(error) {showPlaybackError(error);}
      })();
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
      toggleNeedle: needle,
      reopenRecord: openPlayingRecord,
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



/* MODULE: deadwax-spotify-v45.js */
/* Dead Wax v45 · Spotify integration, Auth Code with PKCE (static GitHub Pages compatible).
   Spotify sessions are TAB-LOCAL; no tokens or Spotify credentials go into Supabase.
   Record metadata is read only; the physical Listening Diary is never changed.
   Spotify audio is NEVER mixed or overlapped with additional effects.
*/
(() => {
  'use strict';
  const CLIENT_ID='fc0940a0a57440c3b510d779180d1ab9';
  // Resolve the Spotify OAuth callback from this deployed script's location,
  // so GitHub Pages repo renames and preview paths do not leave a stale URL.
  const REDIRECT=new URL('../spotify-callback.html', document.currentScript?.src || location.href).href;
  const AUTH='https://accounts.spotify.com/authorize';
  const TOKEN='https://accounts.spotify.com/api/token';
  const API='https://api.spotify.com/v1';
  const SCOPES='streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state';
  const PREFIX='dw45_sp_';
  const isCallback=/spotify-callback\.html$/i.test(location.pathname);
  const $=(q,el=document)=>el.querySelector(q);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let access=null,refresh=null,expires=0,spotifyUser=null,deviceId=null,player=null;
  let sdkReady=false,active=null,activeToken=0, pollBusy=false, preparing=null, transferred=false;
  const ephemeral=new Map();
  let sb=null;
  const store=sessionStorage;
  function randomString(length=64){const bytes=crypto.getRandomValues(new Uint8Array(length));return Array.from(bytes,b=>(b%36).toString(36)).join('');}
  function base64url(bytes){let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
  async function challenge(verifier){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));}
  function saveTokens(data){
    if(!data?.access_token)throw new Error('Spotify did not return an access token');
    access=data.access_token;refresh=data.refresh_token||refresh;
    expires=Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000;
    store.setItem(PREFIX+'tokens',JSON.stringify({access,refresh,expires}));
  }
  function restoreTokens(){try{const t=JSON.parse(store.getItem(PREFIX+'tokens')||'null');if(t){access=t.access;refresh=t.refresh;expires=t.expires;}}catch{}}
  async function tokenRequest(body){
    const response=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:CLIENT_ID})});
    let json={};try{json=await response.json();}catch{}
    if(!response.ok)throw new Error(`Spotify authorization failed (${response.status}): ${json.error_description||json.error||'Unknown error'}`);
    saveTokens(json);return json;
  }
  async function getToken(){
    if(access&&Date.now()<expires-60000)return access;
    if(!refresh)throw new Error('Connect your Spotify account in SleeveShelves settings.');
    try{await tokenRequest({grant_type:'refresh_token',refresh_token:refresh});}catch(e){disconnect(false);throw e;}
    return access;
  }
  async function connect(){
    const verifier=randomString(64),state=randomString(32);
    store.setItem(PREFIX+'verifier',verifier);store.setItem(PREFIX+'state',state);
    const query=new URLSearchParams({response_type:'code',client_id:CLIENT_ID,scope:SCOPES,redirect_uri:REDIRECT,code_challenge_method:'S256',code_challenge:await challenge(verifier),state,show_dialog:'false'});
    location.assign(AUTH+'?'+query);
  }
  async function callback(){
    const params=new URLSearchParams(location.search),state=params.get('state'),code=params.get('code');
    history.replaceState({},'',location.pathname);
    const expected=store.getItem(PREFIX+'state'),verifier=store.getItem(PREFIX+'verifier');
    store.removeItem(PREFIX+'state');store.removeItem(PREFIX+'verifier');
    if(!expected||!state||expected!==state||!verifier)throw new Error('Spotify login state check failed. Please connect again.');
    if(params.has('error'))throw new Error('Spotify authorization was declined: '+params.get('error'));
    if(!code)throw new Error('No authorization code returned from Spotify.');
    await tokenRequest({grant_type:'authorization_code',code,redirect_uri:REDIRECT,code_verifier:verifier});
    location.replace('./#spotify-connected');
  }
  async function request(path,{method='GET',body=null}={}){
    const send=async()=>fetch(API+path,{method,headers:{Authorization:'Bearer '+await getToken(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    let response=await send();
    if(response.status===401&&refresh){expires=0;await getToken();response=await send();}
    if(!response.ok){let info='';try{const j=await response.json();info=j.error?.message||j.error||'';}catch{}throw new Error(`Spotify ${response.status}: ${info||'Request failed'}`);}
    if(response.status===204||response.headers.get('content-length')==='0')return null;
    try{return await response.json();}catch{return null;}
  }
  async function disconnect(reload=true){
    activeToken++;active=null;
    try{await player?.disconnect?.();}catch{}
    player=null;deviceId=null;spotifyUser=null;access=null;refresh=null;expires=0;transferred=false;ephemeral.clear();preparing=null;
    for(const key of ['tokens','state','verifier'])store.removeItem(PREFIX+key);
    if(reload)renderAccount();
  }
  function accountPanel(){
    const profile=$('#userPanelProfile');if(!profile)return null;
    let panel=$('#dw45SpotifyAccount');if(panel)return panel;
    panel=document.createElement('div');panel.id='dw45SpotifyAccount';panel.className='dw45-spotify-settings';
    panel.innerHTML='<h3>Digital Turntable · Spotify</h3><p>Premium feature · Free Preview</p><div id="dw45SpotifyStatus" role="status"></div><div id="dw45SpotifyActions"></div><p class="dw45-settings-note">Spotify Premium required for playback. Your physical Listening Diary is separate. Authorization is kept in this browser tab; no Spotify password or token is stored in SleeveShelves records.</p>';
    profile.append(panel);return panel;
  }
  function renderAccount(){
    const panel=accountPanel();if(!panel)return;
    const status=$('#dw45SpotifyStatus',panel),actions=$('#dw45SpotifyActions',panel);
    status.textContent=spotifyUser?`Connected to Spotify: ${spotifyUser.display_name||spotifyUser.id}${deviceId?' · Player ready':' · Loading player'}`:access?'Spotify connected · Initializing player':'Spotify is not connected. Playing a side will show the visual simulation until you connect.';
    actions.innerHTML=access?'<button type="button" data-dw45-spotify="disconnect">Disconnect Spotify</button>':'<button type="button" data-dw45-spotify="connect">Connect Spotify</button>';
  }
  async function ensureSdk(){
    if(player&&deviceId)return;
    if(!window.Spotify){
      if(!sdkReady){sdkReady=true;const node=document.createElement('script');node.src='https://sdk.scdn.co/spotify-player.js';node.async=true;node.onerror=()=>report(new Error('Could not load Spotify Web Playback SDK.'));document.head.append(node);}
      await new Promise((resolve,reject)=>{
        const start=Date.now();const timer=setInterval(()=>{
          if(window.Spotify){clearInterval(timer);resolve();}
          else if(Date.now()-start>15000){clearInterval(timer);reject(new Error('Spotify SDK did not load.'));}
        },100);
      });
    }
    if(player&&deviceId)return;
    player=new Spotify.Player({name:'SleeveShelves Turntable',getOAuthToken:cb=>getToken().then(cb).catch(report),volume:0.75});
    player.addListener('ready',({device_id})=>{deviceId=device_id;transferred=false;renderAccount();});
    player.addListener('not_ready',()=>{deviceId=null;transferred=false;renderAccount();});
    for(const event of ['initialization_error','authentication_error','account_error','playback_error'])player.addListener(event,e=>report(new Error(e.message||event)));
    player.addListener('player_state_changed',s=>{if(s)observe(s);});
    const connected=await player.connect();if(!connected)throw new Error('Spotify player could not connect. Try Chrome or disable extensions blocking Spotify.');
    const start=Date.now();while(!deviceId&&Date.now()-start<12000)await new Promise(r=>setTimeout(r,100));
    if(!deviceId)throw new Error('Spotify did not initialize its playback device.');
    renderAccount();
  }
  async function initialize(){
    restoreTokens();renderAccount();
    if(!access&&!refresh)return;
    try{
      spotifyUser=await request('/me');
      // Spotify removed GET /me.product in February 2026. The SDK enforces Premium eligibility.
      await ensureSdk();renderAccount();
    }catch(error){report(error);renderAccount();}
  }
  function report(error){console.warn('Dead Wax Spotify',error);window.DW_TURNTABLE_V45?.showPlaybackError(error);}
  function matchKey(record,side){return `${record.shelfId}|${side}|${record.artist}|${record.album}`;}
  function useSupabase(){
    if(sb)return sb;
    const cfg=window.DEAD_WAX_SUPABASE;
    if(cfg?.url&&cfg?.anonKey&&window.supabase?.createClient)sb=window.supabase.createClient(cfg.url,cfg.anonKey);
    return sb;
  }
  async function readSaved(record,side,tracks){
    const local=ephemeral.get(matchKey(record,side));if(local?.length===tracks.length)return local;
    const client=useSupabase();if(!client)return null;
    try{
      const {data:{user}}=await client.auth.getUser();if(!user)return null;
      const {data,error}=await client.from('digital_track_matches').select('position,physical_title,spotify_uri,spotify_name').eq('user_id',user.id).eq('shelf_id',record.shelfId).eq('side',side);
      if(error)throw error;
      const mapped=tracks.map(t=>data.find(x=>x.position===t.position));
      if(mapped.every((x,i)=>/^spotify:track:[a-zA-Z0-9]+$/.test(x?.spotify_uri||'') && (x.physical_title||'').trim().toLowerCase()===tracks[i].title.trim().toLowerCase()))return mapped.map(x=>({uri:x.spotify_uri,name:x.spotify_name}));
    }catch(error){console.info('Optional v45 mapping table unavailable:',error.message);}
    return null;
  }
  async function saveMatches(record,side,tracks,map){
    ephemeral.set(matchKey(record,side),map);
    const client=useSupabase();if(!client)return false;
    try{
      const {data:{user}}=await client.auth.getUser();if(!user)return false;
      const payload=tracks.map((t,i)=>({user_id:user.id,shelf_id:record.shelfId,side,position:t.position,physical_title:t.title,spotify_uri:map[i].uri,spotify_name:map[i].name}));
      const {error}=await client.from('digital_track_matches').upsert(payload,{onConflict:'user_id,shelf_id,side,position'});
      if(error)throw error;
      return true;
    }catch(error){console.warn('Track matches only available for this tab until migration is applied:',error.message);return false;}
  }
  function sanitizeQuery(s){return String(s||'').replace(/\([^)]*\)/g,' ').replace(/["']/g,' ').replace(/\s+/g,' ').trim();}
  async function findCandidates(record,track,query){
    const q=query||`track:${sanitizeQuery(track.title)} artist:${sanitizeQuery(record.artist)}`;
    const response=await request('/search?'+new URLSearchParams({q,type:'track',limit:'5'}));
    return (response?.tracks?.items||[]).filter(t=>t?.uri?.startsWith('spotify:track:')).map(t=>({uri:t.uri,name:t.name,artist:(t.artists||[]).map(a=>a.name).join(', '),album:t.album?.name||'',duration:t.duration_ms||0}));
  }
  function matchModal(record,side,tracks){
    return new Promise(async(resolve,reject)=>{
      const shade=document.createElement('div');shade.className='dw45-match-overlay';shade.id='dw45MatchOverlay';
      shade.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="dw45MatchHeading" class="dw45-match-modal"><header><div><small>SLEEVESHELVES · SPOTIFY</small><h2 id="dw45MatchHeading">Match Side ${esc(side)} to Spotify</h2><p>Keep the physical vinyl track order. Confirm each Spotify recording before the needle drops.</p></div><button type="button" data-dw45-match-cancel aria-label="Cancel matching">✕</button></header><div class="dw45-match-rows"></div><footer><span id="dw45MatchNotice">Finding the corresponding recordings…</span><button type="button" data-dw45-match-confirm disabled>Confirm matches & play</button></footer></section>`;
      document.body.append(shade);
      let done=false;const finish=(err,result)=>{if(done)return;done=true;shade.remove();if(err)reject(err);else resolve(result);};
      shade.addEventListener('click',e=>{if(e.target.closest('[data-dw45-match-cancel]'))finish(new Error('Spotify matching cancelled.'));});
      const rows=$('.dw45-match-rows',shade),confirm=$('[data-dw45-match-confirm]',shade),notice=$('#dw45MatchNotice',shade);
      const results=new Array(tracks.length).fill(null);
      tracks.forEach((t,i)=>{
        const row=document.createElement('div');row.className='dw45-match-row';row.dataset.row=i;
        row.innerHTML=`<div class="dw45-match-physical"><b>${esc(t.position)}</b><span>${esc(t.title)}</span></div><select aria-label="Spotify match for ${esc(t.title)}"><option value="">Searching Spotify…</option></select><div class="dw45-match-search"><input aria-label="Custom Spotify search for ${esc(t.title)}" placeholder="Search another version"><button type="button" data-search>Search</button></div>`;
        rows.append(row);
        const sel=$('select',row);
        function populate(items){results[i]=items;sel.innerHTML='<option value="">Select a Spotify track…</option>'+items.map((x,k)=>`<option value="${k}">${esc(x.name)} · ${esc(x.artist)} (${esc(x.album)})</option>`).join('');if(items.length)sel.value='0';check();}
        async function search(query){sel.innerHTML='<option value="">Searching Spotify…</option>';try{populate(await findCandidates(record,t,query));}catch(err){sel.innerHTML='<option value="">Search failed; try again</option>';console.warn(err);} }
        $('button[data-search]',row).addEventListener('click',()=>search($('input',row).value||undefined));
        $('input',row).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search(e.target.value||undefined);}});
        sel.addEventListener('change',check);
        row.runSearch=()=>search();
      });
      function check(){const ok=tracks.every((t,i)=>{const row=rows.children[i],idx=Number($('select',row)?.value);return $('select',row)?.value!==''&&results[i]?.[idx]?.uri;});confirm.disabled=!ok;notice.textContent=ok?'Check the recordings, then confirm.':'Choose a Spotify recording for every physical track.';}
      confirm.addEventListener('click',()=>{if(confirm.disabled)return;const map=tracks.map((t,i)=>results[i][Number($('select',rows.children[i]).value)]);finish(null,map);});
      // Spotify rate limits search; fetch sequentially to avoid a burst. User can cancel at any time.
      for(const row of Array.from(rows.children)) {if(done)break;await row.runSearch();}
      if(!done)check();
    });
  }
  async function prepare({record,side,tracks}){
    if(!isReady())throw new Error('Connect Spotify in Account → Profile before playing.');
    player.activateElement?.();
    const key=matchKey(record,side);
    let map=await readSaved(record,side,tracks);
    if(!map){map=await matchModal(record,side,tracks);await saveMatches(record,side,tracks,map);}
    preparing={key,map,tracks,record,side};
  }
  function isConnected(){return !!(access||refresh);}
  function isReady(){return !!(access&&deviceId&&spotifyUser);}
  function assertMap(ctx){
    if(!preparing||preparing.key!==matchKey(ctx.record,ctx.side)||preparing.map.length!==ctx.tracks.length)throw new Error('Confirm the Spotify track matching for this side first.');
    return preparing.map;
  }
  async function playAt(ctx,index=0){
    const map=assertMap(ctx);const selected=map[index];if(!selected)throw new Error('No Spotify track matched for that groove.');
    const token=++activeToken;
    active={token,map,index,side:ctx.side,record:ctx.record,tracks:ctx.tracks,sessionId:crypto.randomUUID(),startedAt:Date.now(),lastPos:0,lastDuration:0,changing:false,paused:false};
    if(!transferred){
      await request('/me/player',{method:'PUT',body:{device_ids:[deviceId],play:false}});
      transferred=true;
      // Spotify documents that ordering is not guaranteed across Player commands.
      await new Promise(r=>setTimeout(r,350));
    }
    // Queue the remainder of the physical side, not a single song. Spotify's
    // native playback transitions are reliable even when SDK end events are sparse.
    await request('/me/player/play?'+new URLSearchParams({device_id:deviceId}),{method:'PUT',body:{uris:map.slice(index).map(t=>t.uri),position_ms:0}});
    return active;
  }
  async function pause(){if(!active)return;active.paused=true;await player.pause();}
  async function resume(){if(!active)return;active.paused=false;await player.resume();}
  async function stop(){activeToken++;active=null;try{await player?.pause?.();}catch{}}
  // A full physical side is queued in track order; never the unrelated album/artist context.
  // The SDK is polled for actual playhead position and for recording verified digital listens.
  async function observe(state){
    if(!active||!state?.track_window?.current_track)return;
    const a=active,uri=state.track_window.current_track.uri;
    if(a.changing)return;
    if(uri!==a.map[a.index]?.uri){
      // Native Spotify queue advances to the next matched track on its own.
      // Restrict progression to the rest of this physical side only.
      const next=a.map.findIndex((track,i)=>i>a.index && track.uri===uri);
      if(next>=0){a.index=next;a.startedAt=Date.now();a.lastPos=0;}
      else {
        if(Date.now()-a.startedAt<2000)return; // transient transfer state
        a.changing=true;
        try{await player.pause();}catch{}
        finally{a.changing=false;}
        window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'finished'});
        return;
      }
    }
    const duration=state.duration||state.track_window.current_track.duration_ms||0;
    const position=Math.max(0,state.position||0);
    const isPlaying=!state.paused;
    a.lastPos=position;a.lastDuration=duration;
    window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'progress',index:a.index,seconds:position/1000,duration:duration/1000});
    // Only real Spotify playback events can qualify as digital listens.
    window.dispatchEvent(new CustomEvent('sleeveshelves:spotify-playback',{
      detail:{sessionId:a.sessionId,shelfId:a.record.shelfId,artist:a.record.artist,album:a.record.album,
        side:a.side,position:a.tracks[a.index]?.position||'',title:a.tracks[a.index]?.title||'',
        uri,seconds:position/1000,duration:duration/1000,playing:isPlaying}
    }));
    if(!isPlaying && !a.paused && duration>0 && position>=duration-1100 && a.index===a.map.length-1){
      await finishTrack(a);return;
    }
    if(isPlaying && !a.paused)window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'playing'});
    if(!isPlaying && !a.paused && Date.now()-a.startedAt>2000 && position<duration-1200){window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'paused'});}
    // At the end of the last physical track, stop Spotify's recommendation autoplay.
    if(isPlaying && a.index===a.map.length-1 && duration>0 && position>=duration-500 && !a.changing){await finishTrack(a);}
  }
  async function finishTrack(a){
    if(!active || active.token!==a.token || a.changing)return;
    a.changing=true;
    try{
      await player.pause();
      if(!active||active.token!==a.token)return;
      // Native Spotify queue handles transitions. Only finish at side run-out.
      if(a.index+1 >= a.map.length){active=null;window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'finished'});return;}
      // Spotify paused unexpectedly mid-side; restore queued remainder.
      const next=a.index+1;
      await playAt({record:a.record,side:a.side,tracks:a.tracks},next);
      if(active)window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'progress',index:next,seconds:0,duration:0});
    }catch(e){report(e);window.DW_TURNTABLE_V45?.reportProviderEvent({providerId:'spotify',kind:'error',error:e});}
    finally{a.changing=false;}
  }
  // Ensures end-of-side detection even when SDK player_state_changed events are sparse.
  setInterval(async()=>{
    if(!active||!player||pollBusy||active.changing)return;
    pollBusy=true;try{const state=await player.getCurrentState();if(state)await observe(state);}catch(e){console.info('Spotify poll:',e.message);}finally{pollBusy=false;}
  },300);
  const adapter=Object.freeze({id:'spotify',kind:'licensed-stream',isConnected,isReady,prepare,start:ctx=>playAt(ctx,ctx.index||0),pause,resume,stop});
  function init(){
    window.DW_TURNTABLE_V45?.registerProvider(adapter);
    // The connected Spotify identity must never leak across Dead Wax accounts.
    const oldSignOut=window.signOut;
    if(typeof oldSignOut==='function')window.signOut=async function(...args){await disconnect(false);return oldSignOut.apply(this,args);};
    renderAccount();
    document.addEventListener('click',e=>{
      const btn=e.target.closest('[data-dw45-spotify]');if(!btn)return;
      e.preventDefault();if(btn.dataset.dw45Spotify==='connect')connect().catch(report);
      else if(btn.dataset.dw45Spotify==='disconnect'){window.DW_TURNTABLE_V45?.swap();disconnect().catch(report);}
    });
    initialize().catch(report);
  }
  if(isCallback){
    const status=$('#dw45CallbackStatus');
    callback().catch(error=>{if(status)status.textContent=error.message;else document.body.textContent=error.message;});
  } else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  Object.defineProperty(window,'DW_SPOTIFY_V45',{value:Object.freeze({connect,disconnect,isReady,clientId:CLIENT_ID}),configurable:false});
})();



/* MODULE: sleeveshelves-v46.js */
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
 const listenedButton=$('.ss-nav-item[data-ss-nav="listened"]');
 const listenedModes=document.createElement('div');
 listenedModes.id='ss6147ListenModes';
 listenedModes.className='ss6147-listen-modes';
 listenedModes.hidden=true;
 listenedModes.setAttribute('role','group');
 listenedModes.setAttribute('aria-label','Show records listened to on vinyl, digitally, or either');
 for(const [mode,label] of [['vinyl','Vinyl'],['digital','Digital'],['both','Both']]){
   const b=document.createElement('button');b.type='button';b.dataset.ssListenMode=mode;b.textContent=label;
   b.setAttribute('aria-pressed',String(mode==='both'));listenedModes.append(b);
 }
 const listenedStatus=document.createElement('p');
 listenedStatus.id='ss6147ListenStatus';listenedStatus.className='ss6147-listen-status';listenedStatus.setAttribute('role','status');
 listenedModes.append(listenedStatus);
 listenedButton?.insertAdjacentElement('afterend',listenedModes);
 function updateListenModes(){
   listenedModes.hidden=lastNav!=='listened';
   const mode=api.getListenedMode?.()||'both';
   for(const b of listenedModes.querySelectorAll('[data-ss-listen-mode]')){
     const on=b.dataset.ssListenMode===mode;
     b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));
   }
   const state=api.getDigitalListenStatus?.();
   listenedStatus.textContent=lastNav!=='listened'||mode==='vinyl'?'':
     state?.error ? 'Digital history could not load. Check the Listening Diary connection.' :
     !state?.loaded ? 'Loading digital listens…' :
     state.count ? `${state.count} digitally played ${state.count===1?'record':'records'}` : 'No digital listens logged yet';
 }
 listenedModes.addEventListener('click',event=>{
   const b=event.target.closest('[data-ss-listen-mode]');if(!b)return;
   api.setListenedMode?.(b.dataset.ssListenMode);
   updateListenModes();
   if(b.dataset.ssListenMode!=='vinyl'&&!api.getDigitalListenStatus?.().loaded)void api.refreshDigitalListened?.();
 });
 window.addEventListener('sleeveshelves:digital-filter-ready',updateListenModes);
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
  if(k==='listened' && app.classList.contains('ss-nav-min'))setNavMin(false);
  resetFilters();
  if(k==='listened'){
    $('#fListened').checked=true;$('#fListened').dispatchEvent(new Event('change',{bubbles:true}));
    api.setListenedMode?.('both');
    void api.refreshDigitalListened?.();
  }
  else if(k==='favorites'){$('#fRating').value='favorite';$('#fRating').dispatchEvent(new Event('change',{bubbles:true}));}
  else if(k==='grails'){$('#fGrail').checked=true;$('#fGrail').dispatchEvent(new Event('change',{bubbles:true}));}
  else if(k.startsWith('collection:')){api.setCollectionFilter?.(k.slice(11));}
  setSelected(k);renderNav();updateListenModes();main?.scrollTo({top:0});
  // On phones, leave the listened picker open, but close the drawer for other destinations.
  if(window.innerWidth<=780 && k!=='listened' && !app.classList.contains('ss-nav-min'))setNavMin(true);
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
   heading.textContent=selected?.name||(lastNav==='favorites'?'Favorites':lastNav==='listened'?`Listened · ${(api.getListenedMode?.()||'both')==='vinyl'?'Vinyl':(api.getListenedMode?.()||'both')==='digital'?'Digital':'Both'}`:lastNav==='grails'?'Grail records':'Your collection');
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
 renderNav();updateListenModes();syncRecordPanel();
})();



/* MODULE: sleeveshelves-v50.js */
/* SleeveShelves V48: presentation-only composition of existing native controls.
   No synthetic record store, no listener/data reset, no Supabase writes. */
(() => {
 'use strict';
 const $=(sel,scope=document)=>scope.querySelector(sel);
 const $$=(sel,scope=document)=>Array.from(scope.querySelectorAll(sel));
 const app=$('#ssApp'),header=$('#hdr'),main=$('#mainArea'),detail=$('#detModal');
 if(!app||!header||!main||!detail)return;
 // The reference places navigation and grid actions ahead of search.
 const h1=$('#hdr .h1');
 if(h1){
  // V61.4.3: navigation toggle belongs to the left sidebar, not the search bar.
  // Preserve the original collapse handler/session preference via its existing button.
  const brandRow=$('#ssNav .ss-brand-row');
  if(brandRow && !$('#ssSidebarHamburger')){
    const collapse=document.createElement('button');
    collapse.type='button';collapse.id='ssSidebarHamburger';collapse.className='ss-leading-btn';
    collapse.title='Collapse or expand navigation';collapse.setAttribute('aria-label','Collapse or expand navigation');
    collapse.innerHTML='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    collapse.addEventListener('click',()=>$('#ssCollapseNav')?.click());
    brandRow.append(collapse);
  }
  // Former redundant square/Grid shortcut intentionally removed; view switcher remains.

 }

 // Reference collection shortcuts. Real group/filter engines own every state change.
 const modes=[['all','All'],['artist','Artists'],['alpha','Albums'],['genre','Genres'],['decade','Years'],['grail','Grails']];
 const group=$('#groupSelect');
 const bar=document.createElement('nav');
 bar.className='ss-browse-bar';bar.setAttribute('aria-label','Explore your collection');
 for(const [id,label] of modes){
  const button=document.createElement('button');button.type='button';button.className='ss-browse-btn';button.textContent=label;
  button.dataset.mode=id;button.setAttribute('aria-pressed',id==='all'?'true':'false');
  button.addEventListener('click',()=>{
   if(id==='grail'){
    $('#btnClr')?.click();const el=$('#fGrail');if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));}
   }else{
    if($('#fGrail')?.checked){$('#fGrail').checked=false;$('#fGrail').dispatchEvent(new Event('change',{bubbles:true}));}
    if(group){group.value=id==='all'?'shelf':id;group.dispatchEvent(new Event('change',{bubbles:true}));}
   }
   selectMode(id);
  });
  bar.append(button);
 }
 const counter=document.createElement('span');counter.className='ss-browse-count';counter.setAttribute('aria-live','polite');bar.append(counter);
 header.insertAdjacentElement('afterend',bar);
 function selectMode(id){for(const btn of $$('.ss-browse-btn',bar)){const on=btn.dataset.mode===id;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',String(on));}}
 selectMode('all');
 function updateCount(){const value=$('#countPill strong')?.textContent?.trim() || $('#ssAllCount')?.textContent?.trim();if(value)counter.textContent=value+' records';}
 const countNode=$('#countPill strong');
 if(countNode)new MutationObserver(updateCount).observe(countNode,{childList:true,characterData:true,subtree:true});
 updateCount();
 group?.addEventListener('change',()=>{if(!$('#fGrail')?.checked)selectMode(group.value==='shelf'?'all':group.value)});
 // Keep the real editor's existing handler; move the very same button node.
 const originalActions=$('#mActions');
 const editHost=document.createElement('div');editHost.className='ss-detail-edit-host';
 if(originalActions){editHost.append(originalActions);detail.append(editHost)}
 // V50: screen hierarchy is header -> sleeve/turntable hero -> tracklist
 // -> information tabs -> selected content. Re-use native nodes/handlers.
 const modalBody=$('.m-body',detail),originalMain=$('.m-main',detail),originalSide=$('.m-side',detail);
 const tl=$('#mTl'),wiki=$('#mWiki'),styles=$('#mStyles'),links=$('#mLinks'),force=$('#mForce'),note=$('#mNote'),collections=$('#mCollectionBox'),status=$('#mStateBox'),shelfCode=$('#mCode');
 const stage=$('#ssTurntableStage'),top=$('.m-top',detail),meta=$('.ss-record-meta',detail);
 if(!modalBody||!originalMain||!tl||!stage||!top)return;
 // Hero is a real media region shared between sleeve and working turntable.
 // Moving the existing stage keeps the playback code and listeners connected.
 (meta || top).insertAdjacentElement('afterend',stage);
 stage.setAttribute('aria-label','Album sleeve or active turntable');
 const trackSection=document.createElement('section');
 trackSection.id='ssV50Tracks';trackSection.className='ss-v50-track-section';
 trackSection.setAttribute('aria-label','Physical record tracklist');
 trackSection.innerHTML='<div class="ss-v50-track-heading"><strong>TRACKLIST</strong><span id="ssV50TrackSide"></span></div>';
 trackSection.append(tl);
 stage.insertAdjacentElement('afterend',trackSection);
 const tabs=document.createElement('nav');tabs.className='ss-detail-tabs ss-v50-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Record information');
 const panels={};
 const list=[['details','Details'],['notes','Notes'],['listening','Listening'],['collections','Collection'],['more','More']];
 const host=document.createElement('div');host.className='ss-tab-host';
 for(const [key,label] of list){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.ssTab=key;
   b.id='ssTab'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls','ssPanel'+key);
   b.setAttribute('aria-selected',key==='details'?'true':'false');b.tabIndex=key==='details'?0:-1;
   b.addEventListener('click',()=>activateTab(key));tabs.append(b);
   const panel=document.createElement('div');panel.className='ss-tab-section';panel.id='ssPanel'+key;
   panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);panel.hidden=key!=='details';
   panels[key]=panel;host.append(panel);
 }
 for(const node of [shelfCode,wiki,styles,links,force])if(node)panels.details.append(node);
 if(note)panels.notes.append(note);
 if(status)panels.listening.append(status);
 if(collections)panels.collections.append(collections);
 if(originalSide)panels.more.append(originalSide);
 const origHeading=originalMain.querySelector('.sec-lbl');
 if(origHeading){origHeading.classList.add('sr-only');panels.details.prepend(origHeading);}
 // Existing native controls are moved, never copied.
 originalMain.append(host);
 trackSection.insertAdjacentElement('afterend',tabs);
 tabs.insertAdjacentElement('afterend',modalBody);
 function activateTab(key){
   for(const [name] of list){
     const active=name===key,b=$('#ssTab'+name);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;panels[name].hidden=!active;
   }
   if(key==='notes'&&note)note.style.display='block';
 }
 tabs.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const bs=$$('[role="tab"]',tabs),i=bs.findIndex(b=>b.getAttribute('aria-selected')==='true');
   const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
   bs[next].click();bs[next].focus();
 });
 // Keep all details, including the physical-listened toggle, accessible.
 // V45.3 does not have a full session diary UI, so this tab is "Listening".
 const code=$('#mCode');
 function syncGrail(){
   const grail=detail.classList.contains('grail-detail');
   $('#ssDetail')?.classList.toggle('ss-v50-grail',grail);
 }
 const grailObserver=new MutationObserver(syncGrail);
 grailObserver.observe(detail,{attributes:true,attributeFilter:['class']});syncGrail();
 // Refresh the stage whenever existing record details or artwork changes,
 // without mutating database state or creating a render loop.
 const watch=$('#mCover');
 if(watch)new MutationObserver(()=>window.DW_TURNTABLE_V45?.refresh?.()).observe(watch,{childList:true,subtree:false});
 window.addEventListener('sleeveshelves:render',updateCount);
})();



/* MODULE: sleeveshelves-v56.js */
/* SleeveShelves V56: collection-first modal composition.
   Reuses the actual V45.3 record nodes and handlers. No data layer changes. */
(()=>{
 'use strict';
 const $=(s,c=document)=>c.querySelector(s);
 const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
 const app=$('#ssApp'), detail=$('#ssDetail'), overlay=$('#detOv'), modal=$('#detModal');
 const top=$('.m-top',modal), stage=$('#ssTurntableStage'), trackSection=$('#ssV50Tracks');
 const tabs=$('.ss-v50-tabs',modal), body=$('.m-body',modal), meta=$('.ss-record-meta',modal);
 if(!app||!detail||!overlay||!modal||!top||!stage||!tabs||!body||!trackSection) return;
 document.body.classList.add('ss56-modal-app');
 // Restore true dialog semantics, replaced by V46's docked-region experiment.
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','mAlbum');
 detail.setAttribute('aria-label','Record detail dialog');
 const layout=document.createElement('div');layout.className='ss56-content';
 const left=document.createElement('section');left.className='ss56-visual';left.setAttribute('aria-label','Sleeve and turntable');
 const right=document.createElement('section');right.className='ss56-information';right.setAttribute('aria-label','Record information');
 layout.append(left,right);top.insertAdjacentElement('afterend',layout);
 left.append(stage);
 const footer=document.createElement('div');footer.className='ss56-left-footer';
 if(meta)footer.append(meta);
 left.append(footer);
 right.append(tabs,trackSection,body);
 // Native current-record actions are populated by openModal(), keep original click.
 const edit=document.createElement('button');edit.type='button';edit.className='ss56-edit';
 edit.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg><span>Edit</span>';
 edit.setAttribute('aria-label','Edit selected record');
 edit.addEventListener('click',()=>$('#mActions .btn-sm.ed')?.click());
 top.append(edit);
 const favorite=document.createElement('button');favorite.type='button';favorite.className='ss56-favorite';
 favorite.setAttribute('aria-label','Toggle favorite record');favorite.setAttribute('title','Favorite record');favorite.textContent='♡';
 favorite.addEventListener('click',()=>$('#mStateBox .m-rate-btn.favorite')?.click());top.append(favorite);
 const stateBox=$('#mStateBox');
 function syncFavorite(){
  const active=!!stateBox?.querySelector('.m-rate-btn.favorite.on');
  favorite.textContent=active?'♥':'♡';favorite.setAttribute('aria-pressed',String(active));
 }
 if(stateBox)new MutationObserver(syncFavorite).observe(stateBox,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 syncFavorite();
 const close=$('#mClose');if(close) close.title='Close record and return to collection';
 // Add the missing Tracks tab, reusing the real V50 tracklist.
 const tracksTab=document.createElement('button');tracksTab.type='button';tracksTab.id='ssTabtracks';tracksTab.dataset.ssTab='tracks';
 tracksTab.textContent='Tracks';tracksTab.setAttribute('role','tab');tracksTab.setAttribute('aria-controls','ssV50Tracks');tracksTab.setAttribute('aria-selected','true');tracksTab.tabIndex=0;
 tabs.prepend(tracksTab);
 trackSection.setAttribute('role','tabpanel');trackSection.setAttribute('aria-labelledby','ssTabtracks');
 let active='tracks';
 function selectTracks(){
  active='tracks';trackSection.hidden=false;body.hidden=true;
  $$('[role="tab"]',tabs).forEach(b=>{const on=b===tracksTab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 }
 function selectOther(name){
  active=name;trackSection.hidden=true;body.hidden=false;tracksTab.setAttribute('aria-selected','false');tracksTab.tabIndex=-1;
 }
 tracksTab.addEventListener('click',selectTracks);
 tabs.addEventListener('click',e=>{
  const btn=e.target.closest('[role="tab"]');if(!btn||btn===tracksTab)return;
  // Existing V50 handler has already switched its real tab panel by bubbling here.
  selectOther(btn.dataset.ssTab||'details');
 });
 // Capture keyboard navigation so the newly inserted tab participates in the cycle.
 tabs.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.stopImmediatePropagation();e.preventDefault();
  const bs=$$('[role="tab"]',tabs);const i=Math.max(0,bs.findIndex(b=>b.getAttribute('aria-selected')==='true'));
  const next=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
  bs[next].click();bs[next].focus();
 },true);
 // User approved a functional edit state, not a second editor implementation.
 // Keep the original Supabase-native form, but visually align it with the modal.
 const notePanel=$('#ssPanelnotes'), note=$('#mNote');
 if(notePanel){
  const addNote=document.createElement('button');addNote.type='button';addNote.className='ss56-quiet-action';addNote.textContent='Edit personal note';
  addNote.addEventListener('click',()=>$('#mActions .btn-sm.ed')?.click());
  notePanel.append(addNote);
 }
 const listenPanel=$('#ssPanellistening');
 if(listenPanel){
  const note=document.createElement('p');note.className='ss56-diary-help';note.textContent='Listening status and your latest listen, saved with this record.';
  listenPanel.prepend(note);
 }
 const detailsPanel=$('#ssPaneldetails');
 if(detailsPanel){
  const heading=document.createElement('h3');heading.className='ss56-subheading';heading.textContent='Release information';detailsPanel.prepend(heading);
 }
 const colPanel=$('#ssPanelcollections');
 if(colPanel){
  const h=document.createElement('h3');h.className='ss56-subheading';h.textContent='Your collection labels';colPanel.prepend(h);
 }
 // Bring back visual album metadata beneath the subtitle using original chips.
 function sync(){
  const open=overlay.classList.contains('on');
  document.body.classList.toggle('ss56-record-open',open);
  if(open){
   app.classList.remove('ss-detail-min');
   // Reset tab on a newly opened record. Playback for another record persists.
   const key=($('#mCode')?.textContent||'')+'|'+($('#mAlbum')?.textContent||'');
   if(key!==modal.dataset.ss56Record){modal.dataset.ss56Record=key;selectTracks();}
  }
 }
 new MutationObserver(sync).observe(overlay,{attributes:true,attributeFilter:['class']});
 for(const id of ['mAlbum','mCode']){const n=$('#'+id);if(n)new MutationObserver(sync).observe(n,{childList:true});}
 overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)window.closeModal?.();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('on')&&!$('.f-ov.on,.s-ov.on'))window.closeModal?.();});
 // Keep the real native editor, but organize its existing fields into
 // focused sections rather than stacking yet another form over the record.
 const form=$('#formModal'),formBody=$('#formModal .f-body'),formOverlay=$('#fOv');
 if(form&&formBody){
   const sections=[['basic','Basic'],['tracks','Tracks'],['images','Images'],['collections','Collections'],['notes','Notes']];
   const nav=document.createElement('nav');nav.className='ss56-editor-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Edit record sections');
   const paneHost=document.createElement('div');paneHost.className='ss56-editor-pages';
   const panes={};
   sections.forEach(([key,label])=>{
     const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.dataset.section=key;
     btn.id='ss56EditTab'+key;btn.setAttribute('role','tab');btn.setAttribute('aria-controls','ss56EditPane'+key);
     nav.append(btn);
     const pane=document.createElement('section');pane.className='ss56-editor-pane';pane.id='ss56EditPane'+key;
     pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',btn.id);pane.hidden=key!=='basic';
     panes[key]=pane;paneHost.append(pane);
   });
   const original=Array.from(formBody.children);
   original.forEach(node=>{
     let key='basic';
     if(node.matches('.f-track-editor,.f-sync-warn')||node.querySelector('#fTrackGrid'))key='tracks';
     else if(node.querySelector('#fldImg'))key='images';
     else if(node.querySelector('#fldCollections'))key='collections';
     else if(node.querySelector('#fldNote'))key='notes';
     panes[key].append(node);
   });
   formBody.append(paneHost);formBody.insertAdjacentElement('beforebegin',nav);
   function selectEditorTab(name){
     for(const [key] of sections){
       const chosen=key===name,btn=$('#ss56EditTab'+key);
       panes[key].hidden=!chosen;btn.setAttribute('aria-selected',String(chosen));btn.tabIndex=chosen?0:-1;
     }
     formBody.scrollTop=0;
   }
   nav.addEventListener('click',e=>{const btn=e.target.closest('[data-section]');if(btn)selectEditorTab(btn.dataset.section)});
   nav.addEventListener('keydown',e=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
     const bs=$$('button',nav),i=Math.max(0,bs.findIndex(b=>b.getAttribute('aria-selected')==='true'));
     const j=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;
     bs[j].click();bs[j].focus();
   });
   selectEditorTab('basic');
   if(formOverlay)new MutationObserver(()=>{if(formOverlay.classList.contains('on'))selectEditorTab('basic')}).observe(formOverlay,{attributes:true,attributeFilter:['class']});
 }
 // Simple focus containment for the record modal. Editor and Settings own
 // their own dialogs and are intentionally not trapped by this handler.
 document.addEventListener('keydown',e=>{
   if(e.key!=='Tab'||!overlay.classList.contains('on')||$('.f-ov.on,.s-ov.on'))return;
   const visible=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])',modal)
     .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
   if(!visible.length)return;
   const first=visible[0],last=visible[visible.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal)){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modal)){e.preventDefault();first.focus()}
 });
 // Open/close should not affect collection scroll position.
 sync();
})();



/* MODULE: sleeveshelves-v57.js */
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
      <span class="ss57-artist"></span>
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
    $('.ss57-artist',receiver).textContent=state.artist||'';
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



/* MODULE: sleeveshelves-v58.js */
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



/* MODULE: sleeveshelves-grail-v60.js */
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



/* MODULE: sleeveshelves-accessibility-v61_3.js */
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


/* MODULE: sleeveshelves-v61.4.3.js */
/* V61.4.3: additive UI repairs and automatic Spotify Listening Diary.
 * No physical-listened record fields are ever modified by this module.
 */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const clear = $('#ssSearchClear'), search = $('#gSearch');
  if (clear && search) {
    const sync = () => { clear.hidden = !search.value; };
    search.addEventListener('input', sync);
    clear.addEventListener('click', () => {
      search.value='';
      search.dispatchEvent(new Event('input',{bubbles:true}));
      search.focus();
    });
    sync();
  }

  const panel = $('#ssPanellistening');
  if (!panel || !window.supabase?.createClient || !window.DEAD_WAX_SUPABASE) return;
  const cfg=window.DEAD_WAX_SUPABASE;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const wrap=document.createElement('section');
  wrap.className='ss-digital-diary';
  wrap.setAttribute('aria-label','Digital listening diary');
  wrap.innerHTML='<h3>Digital listens <span>SPOTIFY</span></h3><p class="ss-diary-explainer">Tracks are logged automatically after 30 seconds of confirmed playback. Vinyl listens stay separate.</p><div id="ssDigitalDiaryStatus" role="status"></div><div id="ssDigitalDiaryEntries"></div>';
  panel.append(wrap);
  const status=$('#ssDigitalDiaryStatus',wrap),entries=$('#ssDigitalDiaryEntries',wrap);
  const trackers=new Map();
  let displayedShelf='', latestRequest=0, unavailable=false;
  const escape = v=>String(v??'');
  async function who(){
    const {data,error}=await db.auth.getUser();
    if(error)throw error;
    return data?.user || null;
  }
  function message(msg){status.textContent=msg;}
  function renderEntries(rows){
    entries.replaceChildren();
    if(!rows?.length){message('No digital listens yet for this record.');return;}
    message(`${rows.length} recent digital ${rows.length===1?'listen':'listens'}`);
    for(const r of rows){
      const item=document.createElement('div');item.className='ss-diary-entry';
      const title=document.createElement('strong');title.textContent=`${r.side||''}${r.track_position?' · '+r.track_position:''}  ${r.track_title||'Untitled track'}`;
      const date=document.createElement('span');date.textContent=new Date(r.listened_at).toLocaleString();
      item.append(title,date);entries.append(item);
    }
  }
  async function refresh(shelf){
    const request=++latestRequest;
    displayedShelf=shelf;
    entries.replaceChildren();
    if(!shelf){message('Open a record to see its digital listening history.');return;}
    message('Loading digital listens…');
    try {
      const user=await who();if(request!==latestRequest)return;
      if(!user){message('Sign in to view your listening history.');return;}
      const res=await db.from('digital_listening_events').select('side,track_position,track_title,listened_at').eq('user_id',user.id).eq('shelf_id',shelf).order('listened_at',{ascending:false}).limit(30);
      if(request!==latestRequest)return;
      if(res.error)throw res.error;
      unavailable=false;renderEntries(res.data||[]);
    } catch(error) {
      if(request!==latestRequest)return;
      unavailable=true;
      console.warn('Digital listening diary unavailable:',error);
      message('Digital listening history unavailable. Apply the included Supabase V61.4.3 SQL migration to enable automatic logging.');
    }
  }
  const code=$('#mCode');
  if(code){
    let last='';
    const sync=()=>{const shelf=code.textContent.trim();if(shelf!==last){last=shelf;void refresh(shelf);}};
    new MutationObserver(sync).observe(code,{childList:true,characterData:true,subtree:true});
    sync();
  }
  window.addEventListener('sleeveshelves:spotify-playback',event=>{
    const d=event.detail||{};
    if(!d.sessionId || !d.shelfId || !d.uri || !d.position) return;
    const key=[d.sessionId,d.side,d.position,d.uri].join(':');
    let t=trackers.get(key);
    const now=performance.now();
    if(!t){
      t={earned:0,lastAt:now,lastSeconds:Number(d.seconds)||0,logged:false,saving:false};
      trackers.set(key,t);
      // No cross-session ghost listens from previous player sessions.
      if(trackers.size>400)trackers.delete(trackers.keys().next().value);
      return;
    }
    const seconds=Number(d.seconds)||0;
    const dt=(now-t.lastAt)/1000;
    const progress=seconds-t.lastSeconds;
    // Only observed, advancing, unpaused Spotify playback counts. Match the
    // playback position change to real elapsed time to reject manual seeks.
    // Large, consistent deltas are allowed when background tabs are throttled.
    if(d.playing && dt>0 && dt<900 && progress>0 && Math.abs(progress-dt)<3.5){
      t.earned+=Math.min(dt,progress);
    }
    t.lastAt=now;t.lastSeconds=seconds;
    if(t.earned>=30 && !t.logged && !t.saving){
      t.saving=true;
      void (async()=>{
        try{
          const user=await who();if(!user)throw new Error('Session expired');
          const record=await db.from('records').select('id').eq('user_id',user.id).eq('shelf_id',d.shelfId).maybeSingle();
          if(record.error)throw record.error;
          if(!record.data?.id)throw new Error('Physical record not found for digital listen');
          const row={
            user_id:user.id, record_id:record.data.id, shelf_id:d.shelfId,
            side:d.side||'',track_position:d.position,track_title:d.title||'',
            spotify_uri:d.uri, session_key:key,seconds_listened:Math.floor(t.earned)
          };
          const saved=await db.from('digital_listening_events').upsert(row,{onConflict:'user_id,session_key',ignoreDuplicates:true});
          if(saved.error)throw saved.error;
          t.logged=true;
          window.dispatchEvent(new CustomEvent('sleeveshelves:digital-listen-saved',{detail:{recordId:record.data.id}}));
          if(displayedShelf===d.shelfId)await refresh(displayedShelf);
        }catch(error){
          console.warn('Could not save digital listen:',error);
          if(displayedShelf===d.shelfId)message('Could not save this digital listen. Check the Supabase Listening Diary migration and connection.');
        }finally{t.saving=false;}
      })();
    }
  });
})();



/* MODULE: SleeveShelves V61.4.7 header controls and toolbar receiver.
 * The one V57 receiver is rendered in the browse toolbar, not in the sidebar.
 */
(()=>{
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const brandRow=$('#ssNav .ss-brand-row'),hamburger=$('#ssSidebarHamburger');
 const header=$('#hdr .h-right');
 if(brandRow&&hamburger&&$('#ssBrandHome'))brandRow.insertBefore(hamburger,$('#ssBrandHome'));
 const viewGroup=$('#hdr .vtog');
 if(viewGroup){const grid=$('#btnGrid'),flow=$('#btnFlow'),list=$('#btnList');if(grid&&flow&&list)viewGroup.append(grid,flow,list);}
 const menu=$('#userMenuWrap');
 if(menu&&header){header.append(menu);menu.classList.add('ss6144-header-profile');}
 if(header&&!$('#ss6144Settings')){
   const settings=document.createElement('button');
   settings.type='button';settings.className='ss6144-header-setting';settings.id='ss6144Settings';
   settings.title='Settings';settings.setAttribute('aria-label','Open settings');
   settings.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33A1.65 1.65 0 0 0 14 20.86V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33A1.65 1.65 0 0 0 4.6 15 1.65 1.65 0 0 0 3.09 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>';
   settings.addEventListener('click',()=>window.openSett?.());
   if(menu)header.insertBefore(settings,menu);else header.append(settings);
 }
 const count=$('#countPill');if(count)count.hidden=true;
 // Re-enable the existing receiver, including its needle pause handler.
 const receiver=$('#ss57Receiver');
 if(receiver){receiver.removeAttribute('aria-hidden');receiver.inert=false;}
})();
