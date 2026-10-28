"""V61.4 controlled browser regression; deliberately uses mock Supabase data only.
Usage: python tests/v614_regression.py /path/to/site
"""
from pathlib import Path
import asyncio,re,sys
from playwright.async_api import async_playwright
root=Path(sys.argv[1])
html=(root/'index.html').read_text()
html=re.sub(r'<link\s+[^>]*href="https?[^>]+>', '',html)

def css_replace(m):
    return '<style>'+ (root/m.group(1)).read_text()+'</style>'
html=re.sub(r'<link[^>]*href="((?:css)/[^"?]+\.css)(?:\?[^\"]*)?"[^>]*>',css_replace,html)
mock=r'''
<script>
const mkStore=()=>{const d={};return {getItem:k=>d[k]??null,setItem:(k,v)=>{d[k]=String(v)},removeItem:k=>{delete d[k]}}};
Object.defineProperty(window,'localStorage',{configurable:true,value:mkStore()});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:mkStore()});
const UUID='b376c5de-9168-4a14-a5c7-801d54808c39';
window.__v614={failUpdate:false,failLinks:false,notices:[],created:[],authCalls:[],requests:[],
 records:[{id:'r1',user_id:'u1',shelf_id:'A1',artist:'Animals',album:'Before Edit',last:'Animals',first:'',copies_owned:1,grail:true,cover_url:'',genre:'Rock',collections:['record-cabinet'],note:'Before Note',tracklist:[{position:'A1',title:'</textarea><img src=x onerror=alert(1)>',duration:'3:15'},{position:'C1',title:'Song C',duration:'3:15'}]}],
 collections:[],links:[]};
window.alert=(m)=>window.__v614.notices.push(String(m));window.confirm=()=>true;
window.prompt=(m)=>'New Label';
function query(table){
 let op='select',input=null,filters=[],wantsSingle=false;
 const builder={select(x){return builder},eq(k,v){filters.push([k,v]);return builder},in(k,v){filters.push([k,v]);return builder},order(){return builder},single(){wantsSingle=true;return builder},
  insert(p){op='insert';input=p;return builder},upsert(p){op='upsert';input=p;return builder},update(p){op='update';input=p;return builder},delete(){op='delete';return builder},
  then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
 const filter=(r)=>filters.every(([k,v])=>Array.isArray(v)?v.includes(r[k]):r[k]===v);
 function result(){
  const s=window.__v614;s.requests.push({table,op,input,filters});
  if(table==='records'){
    if(op==='select')return {data:s.records.filter(filter),error:null};
    if(op==='update'){
      if(s.failUpdate)return {data:null,error:{message:'row violates RLS',code:'42501'}};
      const r=s.records.find(filter);if(!r)return {data:null,error:{code:'PGRST116',message:'Record not found'}};
      Object.assign(r,input);return {data:{...r},error:null};
    }
    if(op==='insert'||op==='upsert'){
      const r={...input,id:'r'+(s.records.length+1)};s.records.push(r);return {data:r,error:null};
    }
    if(op==='delete'){s.records=s.records.filter(r=>!filter(r));return {data:null,error:null};}
  }
  if(table==='collections'){
    if(op==='select'){const matching=s.collections.filter(filter);return {data:wantsSingle?(matching[0]||null):matching,error:matching.length||!wantsSingle?null:{code:'PGRST116'}};}
    if(op==='insert'){
      if(input.id!==undefined || input.user_id!=='u1')return {data:null,error:{code:'22P02',message:'invalid UUID'}};
      if(s.collections.some(c=>c.user_id===input.user_id&&c.name===input.name))return {data:null,error:{code:'23505',message:'duplicate key'}};
      const c={...input,id:s.created.length? '9be09cf2-aeb2-44bc-badb-458de1488a44':UUID};s.created.push(c);s.collections.push(c);return {data:{...c},error:null};
    }
    if(op==='upsert')return {data:null,error:{code:'42P10',message:'there is no unique or exclusion constraint matching ON CONFLICT'}};
  }
  if(table==='record_collections'){
    if(op==='select')return {data:s.links.filter(filter),error:null};
    if(s.failLinks)return {data:null,error:{message:'Forced link failure'}};
    if(op==='insert'){s.links.push(...input);return {data:null,error:null};}
    if(op==='delete'){s.links=s.links.filter(r=>!filter(r));return {data:null,error:null};}
  }
  return {data:[],error:null};
 }
 return builder;
}
window.supabase={createClient:()=>({auth:{
  getSession:async()=>({data:{session:{user:{id:'u1'}}},error:null}),
  signUp:async args=>{window.__v614.authCalls.push({type:'signup',args});return {data:{user:{id:'pending'},session:null},error:null}},
  signInWithPassword:async args=>{window.__v614.authCalls.push({type:'signin',args});return {data:{user:{id:'u1'},session:{user:{id:'u1'}}},error:null}},
  signOut:async()=>({error:null})
 },from:query,rpc:async(name,args)=>({error:{code:'PGRST202',message:'Could not find function ss_set_record_collections in schema cache'}})})};
</script>
'''
html=html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',mock)
html=html.replace('<script src="supabase-config.js"></script>','<script>window.DEAD_WAX_SUPABASE={url:"test",anonKey:"test"};</script>')
def js_replace(m): return '<script>\n'+(root/m.group(1)).read_text()+'\n</script>'
html=re.sub(r'<script\s+src="((?:js)/[^"?]+\.js)(?:\?[^\"]*)?"\s*></script>',js_replace,html)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
  page=await browser.new_page(viewport={'width':1440,'height':900})
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  await page.set_content(html,wait_until='domcontentloaded',timeout=30000)
  await page.wait_for_timeout(350)
  # Collection creation through Settings: DB-generated UUID and no upsert.
  await page.evaluate('document.querySelector("#newCollectionName").value="Jazz"')
  await page.evaluate('window.addCollection()')
  await page.wait_for_timeout(100)
  created=await page.evaluate('window.__v614.created')
  assert len(created)==1 and created[0]['id']=='b376c5de-9168-4a14-a5c7-801d54808c39'
  assert 'id' not in await page.evaluate('window.__v614.requests.find(r=>r.table==="collections" && r.op==="insert").input')
  assert not await page.evaluate('window.__v614.requests.some(r=>r.table==="collections" && r.op==="upsert")')
  print('PASS: collection creation uses generated UUID, no onConflict')
  # Modal creation reuses saved collection without generating a second collection.
  await page.evaluate('window.openModal(0)')
  await page.evaluate('window.createCollectionForCurrent()')
  await page.wait_for_timeout(100)
  assert await page.evaluate('window.__v614.created.length')==2
  assert await page.evaluate('window.__v614.links.some(l=>l.collection_id===window.__v614.created[1].id)')
  print('PASS: modal new label assigns record through record_collections')
  # CSV import with a new collection label must also use UUIDs and reuse the
  # same saved label for multiple records, not upsert a textual slug.
  await page.evaluate(r'''async()=>{await window.handleImport({target:{files:[{name:'import.csv',text:async()=>
    'Shelf ID,Artist,Album,Collections\nB1,Artist B,Album B,Imports\nB2,Artist C,Album C,Imports'}],value:''}});}''')
  await page.wait_for_timeout(100)
  csv=await page.evaluate('''()=>({created:window.__v614.created.filter(c=>c.name==='Imports'),links:window.__v614.links.filter(l=>['r2','r3'].includes(l.record_id) && l.collection_id!=='')})''')
  assert len(csv['created'])==1 and len(csv['links'])==2,csv
  print('PASS: CSV imports reuse UUID collection labels across records')
  # Wait for prior record/collection MutationObservers before a real tab click.
  await page.wait_for_timeout(180)
  # Edit an open modal while preserving information tab.
  await page.evaluate('document.querySelector("#ssTabnotes").click()')
  await page.evaluate('window.openForm(0)')
  await page.locator('#fldAlbum').fill('After Edit')
  await page.evaluate('document.querySelector("#fldNote").value="After Note"')
  await page.evaluate('window.saveRec()')
  await page.wait_for_timeout(250)
  visible=await page.evaluate('''()=>({album:document.querySelector('#mAlbum').textContent,note:document.querySelector('#mNote').textContent,
  open:document.querySelector('#detOv').classList.contains('on'),tab:document.querySelector('#detModal .ss-detail-tabs [aria-selected="true"]')?.dataset.ssTab})''')
  assert visible=={'album':'After Edit','note':'After Note','open':True,'tab':'notes'},visible
  print('PASS: successful save refreshes open modal and preserves Notes tab')
  # Force save failure: editor remains open, human-friendly error shown.
  await page.evaluate('window.openForm(0);window.__v614.failUpdate=true')
  await page.evaluate('document.querySelector("#fldNote").value="Never Saved"')
  await page.evaluate('window.saveRec()')
  failed=await page.evaluate('''()=>({open:document.querySelector('#fOv').classList.contains('on'),note:window.__v614.records[0].note,
    latest:window.__v614.notices.at(-1)})''')
  assert failed['open'] and failed['note']=='After Note' and 'authorized' in failed['latest'],failed
  print('PASS: failed save retains editor and explains RLS failure')
  await page.evaluate('window.__v614.failUpdate=false;window.closeForm();window.signOut()')
  await page.wait_for_timeout(100)
  await page.locator('#dwEmail').fill('new-collector@example.net')
  await page.locator('#dwPassword').fill('testingpassword123')
  await page.evaluate('document.querySelector("#dwSignUp").click()')
  await page.wait_for_timeout(120)
  signup=await page.evaluate('''()=>({open:document.querySelector('#dwAuth').classList.contains('on'),msg:document.querySelector('#dwAuthError').textContent,options:window.__v614.authCalls.at(-1).args.options})''')
  assert signup['open'] and 'Check your inbox' in signup['msg'] and 'emailRedirectTo' in signup['options'],signup
  print('PASS: unconfirmed signup stays on auth screen with email redirect configuration')
  await page.evaluate('document.querySelector("#dwSignInBtn").click()')
  await page.wait_for_timeout(120)
  assert not await page.evaluate('document.querySelector("#dwAuth").classList.contains("on")')
  print('PASS: confirmed sign-in unlocks after valid session')
  assert not errors,errors
  print('PASS: no uncaught browser JavaScript errors')
  await browser.close()
asyncio.run(main())
