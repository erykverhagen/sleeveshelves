/* SleeveShelves V61.4.8 + Shelf Affinity UI v1.0
 * Feature flag: window.SS_AFFINITY_ENABLED = false before this file disables it.
 * Additive to V61.4.8: authentic record state via DW_NATIVE readonly getter.
 * Everything stays private by default. Discovery uses the server RLS-gated RPC.
 * No paid AI calls, no database writes except explicit owner privacy settings.
 */
(function(){
  'use strict';
  if (window.SS_AFFINITY_ENABLED === false) return;
  const E=window.SleeveShelvesAffinity, DW=window.DW_NATIVE;
  if(!E || typeof DW?.getAffinitySnapshot!=='function'){
    console.warn('Shelf Affinity is disabled: missing engine or native state bridge.');return;
  }
  const $=s=>document.querySelector(s);
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeCover=v=>{try{const u=new URL(String(v||''),window.location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const cover=rec=>safeCover(rec?.cover_url||rec?.img||rec?.coverUrl);
  const snap=()=>DW.getAffinitySnapshot();
  const nativeClient=()=>DW.getAffinityClient?.();
  const panel=$('#ssPanelmore');
  if(!panel)return;
  const block=document.createElement('section');
  block.className='ss-affinity';block.id='ssAffinityMore';
  block.innerHTML=`<div class="ss-affinity-title"><span>MORE LIKE THIS</span><small>Music that leads somewhere</small></div>
    <div class="ss-affinity-switch" role="group" aria-label="Recommendation source">
       <button type="button" data-ss-affinity-scope="mine" aria-pressed="true">My Shelf</button>
       <button type="button" data-ss-affinity-scope="beyond" aria-pressed="false">Other Shelves</button>
    </div>
    <div id="ssAffinityResults" class="ss-affinity-results" role="status" aria-live="polite"></div>`;
  panel.prepend(block);
  // Only the old simple genre-equality suggestions are superseded.
  // The existing More from this artist section remains untouched.
  document.documentElement.classList.add('ss-affinity-ready');
  const resultBox=$('#ssAffinityResults');
  let activeScope='mine', renderedRecord='', updateQueued=false, pendingRequest=0, cache=new Map();
  function selected(){const data=snap();return {data, record:data.records.find(x=>x.id===data.currentRecordId)};}
  function identity(record){return [record?.id,record?.artist,record?.album].join('|');}
  function recordTile(item,type){
    const rec=item.record || {}, url=cover(rec);
    const source=type==='beyond' ? `<div class="ss-affinity-origin">In ${escapeHtml(item.collectionName||'a public collection')}</div>` : '';
    const desc=type==='beyond' ? item.reason : (item.reason||'Related to this record');
    const thumb=url?`<img src="${escapeHtml(url)}" loading="lazy" alt="">`:'<span aria-hidden="true">♫</span>';
    const id=String(rec.id||'');
    return `<button class="ss-affinity-card" type="button" data-affinity-action="${type==='mine'?'open':'explore'}"
       data-affinity-id="${escapeHtml(id)}" data-affinity-collection="${escapeHtml(item.collectionId||'')}"
       aria-label="${type==='mine'?'Open record':'Explore collection containing'} ${escapeHtml(rec.album||'record')} by ${escapeHtml(rec.artist||'unknown artist')}">
       <span class="ss-affinity-thumb">${thumb}</span>
       <span class="ss-affinity-meta"><strong>${escapeHtml(rec.album||'Untitled')}</strong><span>${escapeHtml(rec.artist||'Unknown artist')}</span>
       ${source}<small>${escapeHtml(desc)}</small></span><span class="ss-affinity-chevron" aria-hidden="true">›</span></button>`;
  }
  function displayLocal(record,data){
    const rows=E.recommendMyShelf({anchorRecord:record,myRecords:data.records,limit:6}).recommendations;
    resultBox.innerHTML=rows.length?rows.map(x=>recordTile(x,'mine')).join(''):
      '<p class="ss-affinity-empty">No strong matches yet. Enrich your records with genres or styles to improve recommendations.</p>';
  }
  async function displayBeyond(record,data){
    const token=++pendingRequest;
    const client=nativeClient();
    if(!client || !data.userId){resultBox.innerHTML='<p class="ss-affinity-empty">Sign in to explore public shelves.</p>';return;}
    if(!cache.has(record.id)){
      resultBox.innerHTML='<p class="ss-affinity-empty">Finding musical journeys in public collections…</p>';
      try{
        const result=await window.SleeveShelvesDiscoveryAdapter.discover({
          supabase:client,anchorRecord:record,myRecords:data.records,userId:data.userId,limit:7
        });
        cache.set(record.id,result.recommendations);
      }catch(error){
        if(token!==pendingRequest || activeScope!=='beyond')return;
        const unavailable= /ss_discovery_candidates|PGRST202|42883|function.*does not exist|schema cache/i.test(String(error?.message||''));
        resultBox.innerHTML=`<p class="ss-affinity-empty">${unavailable
          ? 'Other Shelves is not enabled on this database yet. Your records remain private.'
          : 'Public discovery could not load. Your collection is unaffected; try again later.'}</p>`;
        console.warn('SleeveShelves public discovery unavailable:',error?.code||error?.message||error);
        return;
      }
    }
    if(token!==pendingRequest || activeScope!=='beyond'||identity(selected().record)!==identity(record))return;
    const rows=cache.get(record.id)||[];
    resultBox.innerHTML=rows.length?rows.map(x=>recordTile(x,'beyond')).join(''):
      '<p class="ss-affinity-empty">No relevant public shelves found yet. Other collectors must explicitly publish a collection and open their record room.</p>';
  }
  function refresh(force=false){
    const {data,record}=selected();
    if(!record || !data.userId){resultBox.innerHTML='<p class="ss-affinity-empty">Open one of your records to see recommendations.</p>';return;}
    if(!force && identity(record)===renderedRecord && activeScope==='mine')return;
    renderedRecord=identity(record);
    if(activeScope==='mine') {++pendingRequest;displayLocal(record,data);}
    else void displayBeyond(record,data);
  }
  function scheduleRefresh(){
    if(updateQueued)return;
    updateQueued=true;
    queueMicrotask(()=>{updateQueued=false;activeScope='mine';renderedRecord='';setActive('mine');refresh(true);});
  }
  function setActive(scope){
    activeScope=scope;
    for(const btn of block.querySelectorAll('[data-ss-affinity-scope]'))btn.setAttribute('aria-pressed',String(btn.dataset.ssAffinityScope===scope));
  }
  block.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    const nextScope=btn.dataset.ssAffinityScope;
    if(nextScope){setActive(nextScope);refresh(true);return;}
    if(btn.dataset.affinityAction==='open'){
      const id=btn.dataset.affinityId;
      if(!snap().filteredRecordIds.includes(id))$('#ssBrandHome')?.click();
      window.openRecordById?.(id);
      return;
    }
    if(btn.dataset.affinityAction==='explore'){
      const id=btn.dataset.affinityId,collectionId=btn.dataset.affinityCollection;
      const result=(cache.get(selected().record?.id)||[]).find(x=>x.record.id===id && x.collectionId===collectionId);
      if(result)openPreview(result);
    }
  });
  // Existing code updates these exact native text fields on every openModal().
  for(const id of ['mAlbum','mArtist','mCode']){
    const el=$('#'+id);if(el)new MutationObserver(scheduleRefresh).observe(el,{childList:true,characterData:true,subtree:true});
  }
  $('#ssTabmore')?.addEventListener('click',()=>refresh(true));
  window.addEventListener('sleeveshelves:render',()=>{cache.clear();refreshCollectionDNA();});
  const viewer=document.createElement('div');viewer.id='ssAffinityViewer';viewer.className='ss-affinity-viewer';viewer.hidden=true;
  viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-labelledby','ssAffinityViewerTitle');
  viewer.innerHTML='<div class="ss-affinity-viewer-backdrop" data-affinity-dismiss></div><div class="ss-affinity-viewer-card" tabindex="-1"><div class="ss-affinity-viewer-heading"><div><span class="ss-affinity-kicker">A PUBLIC COLLECTION</span><h2 id="ssAffinityViewerTitle"></h2></div><button type="button" class="ss-affinity-close" aria-label="Close collection preview" data-affinity-dismiss>×</button></div><p class="ss-affinity-viewer-note"></p><div class="ss-affinity-viewer-list"></div><p class="ss-affinity-footnote">A preview of matching public records, not the collection’s complete inventory. Full collection browsing and subscriptions require the next sharing phase.</p></div>';
  document.body.append(viewer);
  let lastFocused=null;
  function openPreview(item){
    lastFocused=document.activeElement;
    viewer.querySelector('h2').textContent=item.collectionName||'Public collection';
    viewer.querySelector('.ss-affinity-viewer-note').textContent=item.reason||'';
    const records=[item.record,...item.nextRecords.map(x=>x.record)];
    viewer.querySelector('.ss-affinity-viewer-list').innerHTML=records.map((r,i)=>{
      const url=cover(r);
      return `<div class="ss-affinity-preview-item"><div class="ss-affinity-preview-cover">${url?`<img src="${escapeHtml(url)}" alt="" loading="lazy">`:'♫'}</div><div><strong>${escapeHtml(r.album||'Untitled')}</strong><span>${escapeHtml(r.artist||'Unknown artist')}</span></div>${i===0?'<small>ENTRY RECORD</small>':''}</div>`;
    }).join('');
    viewer.hidden=false;
    viewer.querySelector('.ss-affinity-viewer-card').focus();
  }
  function closePreview(){viewer.hidden=true;lastFocused?.focus?.();}
  viewer.addEventListener('click',event=>{if(event.target.closest('[data-affinity-dismiss]'))closePreview();});
  document.addEventListener('keydown',event=>{
    if(viewer.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closePreview();}
    if(event.key==='Tab'){
      // Preview has one tabbable close button; keep the dialog's focus contained.
      event.preventDefault();viewer.querySelector('[data-affinity-dismiss].ss-affinity-close')?.focus();
    }
  });
  // Collection DNA is based on all owned records assigned to the selected collection.
  // The legacy .ss-section-heading is deliberately hidden by V61 design.
  // Place collection intelligence above the actual visible grid instead.
  const mainArea=$('#mainArea');
  const intro=document.createElement('section');intro.id='ssAffinityCollectionDNA';intro.className='ss-affinity-collection-dna';intro.hidden=true;
  intro.setAttribute('aria-label','Smart collection identity');
  mainArea?.insertAdjacentElement('beforebegin',intro);
  function refreshCollectionDNA(){
    const data=snap(), id=data.selectedCollectionId;
    const found=data.collections.find(c=>c.id===id);
    if(!found || !id){intro.hidden=true;return;}
    const membership=new Set(data.links.filter(l=>l.collection_id===id).map(l=>l.record_id));
    const records=data.records.filter(r=>membership.has(r.id) || (Array.isArray(r.collection_ids)&&r.collection_ids.includes(id)));
    const dna=E.dna({records});
    const desc=E.describeCollection({name:found.name,records});
    const tags=[...dna.styles.slice(0,3),...dna.genres.slice(0,2)].filter(x=>x.share>=0.07).slice(0,4);
    intro.innerHTML=`<div class="ss-affinity-dna-caption">SMART COLLECTION IDENTITY · ${dna.recordCount} ${dna.recordCount===1?'RECORD':'RECORDS'}</div><p>${escapeHtml(desc)}</p>${tags.length?`<div class="ss-affinity-dna-tags">${tags.map(t=>`<span>${escapeHtml(t.name)}</span>`).join('')}</div>`:''}`;
    intro.hidden=false;
  }
  refreshCollectionDNA();
  // Privacy controls only appear when the owner explicitly opens Collection Settings.
  // When the migration is missing, the section is read-only. Every write is user-initiated.
  const settings=$('#userPanelCollections');
  if(settings){
    const sharing=document.createElement('section');sharing.className='ss-affinity-settings';sharing.id='ssAffinitySharing';
    sharing.innerHTML='<h3>Record Room Privacy</h3><p>Everything is private by default. Open your room and individually publish collections to let More Like This introduce your music to other collectors.</p><div id="ssAffinitySharingState" role="status">Checking sharing availability…</div>';
    settings.append(sharing);
    let settingsRequest=0;
    async function loadPrivacy(){
      const {userId,collections}=snap(), sb=nativeClient(),target=$('#ssAffinitySharingState'),token=++settingsRequest;
      if(!userId||!sb){target.textContent='Sign in to manage your record room.';return;}
      const [room,check]=await Promise.all([
        sb.from('ss_record_room_settings').select('discoverable').eq('user_id',userId).maybeSingle(),
        sb.from('collections').select('id,visibility').eq('user_id',userId)
      ]);
      if(token!==settingsRequest)return;
      if(room.error||check.error){target.textContent='Sharing is not installed on this database. Collections remain private. Enable it in staging before using these controls.';return;}
      const visibility=new Map((check.data||[]).map(c=>[c.id,c.visibility]));
      const roomOpen=room.data?.discoverable===true;
      target.innerHTML=`<label class="ss-affinity-room-switch"><input type="checkbox" data-affinity-room ${roomOpen?'checked':''}><span>Open my record room</span></label>
        <div class="ss-affinity-privacy-hint">${roomOpen?'Only collections marked Public are eligible for discovery.':'Your room is closed. No collections can be discovered.'}</div>
        <div class="ss-affinity-privacy-rows">${collections.map(c=>`<label><span>${escapeHtml(c.name)}</span><select data-affinity-visibility="${escapeHtml(c.id)}"><option value="private" ${visibility.get(c.id)==='private'?'selected':''}>Private</option><option value="public" ${visibility.get(c.id)==='public'?'selected':''}>Public</option>${visibility.get(c.id)==='link'?'<option value="link" selected>Unlisted (legacy)</option>':''}</select></label>`).join('')}</div>
        <p class="ss-affinity-privacy-hint">Unlisted sharing links and subscriptions are not active in this release. Publishing never exposes your private notes, reactions, listening diary or valuations through discovery.</p>`;
    }
    $('#tabCollections')?.addEventListener('click',()=>void loadPrivacy());
    // The sidebar's Manage Collections button opens this tab programmatically.
    $('#ssAddCollection')?.addEventListener('click',()=>void loadPrivacy());
    sharing.addEventListener('change',async event=>{
      const data=snap(),client=nativeClient();if(!data.userId||!client)return;
      const roomControl=event.target.matches('[data-affinity-room]');
      const id=event.target.dataset.affinityVisibility;
      const next=roomControl?event.target.checked:event.target.value;
      event.target.disabled=true;
      const change=roomControl?await client.from('ss_record_room_settings').upsert({user_id:data.userId,discoverable:next,updated_at:new Date().toISOString()}):
        await client.from('collections').update({visibility:next}).eq('id',id).eq('user_id',data.userId);
      if(change.error){alert('Could not save this privacy setting. Nothing was published: '+String(change.error.message||change.error));}
      cache.clear();await loadPrivacy();
    });
  }
  window.SleeveShelvesAffinityUI=Object.freeze({version:'1.0.0',refresh:()=>{cache.clear();refresh(true);refreshCollectionDNA();}});
})();
