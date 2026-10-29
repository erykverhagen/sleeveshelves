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
