from pathlib import Path
import re,sys,asyncio,json
from playwright.async_api import async_playwright

root=Path(sys.argv[1])
html=(root/'index.html').read_text()
# Remove external scripts and replace local JS/CSS with inline sources to bypass local URL limitations.
html=re.sub(r'<link\s+[^>]*href="https?[^>]+>', '',html)
def css_replace(m):
 p=root/m.group(1)
 if not p.exists():raise FileNotFoundError(p)
 return '<style>\n'+p.read_text()+'\n</style>'
html=re.sub(r'<link[^>]*href="((?:css)/[^"?]+\.css)(?:\?[^\"]*)?"[^>]*>', css_replace,html)
mock=r'''
<script>
const memStorage=()=>{let d={};return {getItem:k=>d[k]??null,setItem:(k,v)=>d[k]=String(v),removeItem:k=>delete d[k]};};
Object.defineProperty(window,'sessionStorage',{configurable:true,value:memStorage()});
Object.defineProperty(window,'localStorage',{configurable:true,value:memStorage()});
window.__stageTest={failUpdate:false,failLinks:false,records:[
{id:'r1',user_id:'u1',shelf_id:'A1',artist:'Animals',album:'The Hits',last:'Animals',first:'',copies_owned:1,grail:true,cover_url:'',genre:'Rock',year:1971,collections:['record-cabinet','jazz'],note:'Sample',tracklist:[{position:'A1',title:'</textarea><img src=x onerror=alert(1)>',duration:'3:15'},{position:'C1',title:'C side',duration:'3:12'}]}
],collections:[{id:'jazz',name:'Jazz',user_id:'u1'}],links:[{user_id:'u1',record_id:'r1',collection_id:'jazz'}],notices:[]};
window.alert=(m)=>window.__stageTest.notices.push(String(m));window.confirm=()=>true;
function q(table){
 let op='select',data=null,params=[],filters=[],wantSingle=false;
 const b={select(x){if(op==='select')data=x; return b;},eq(k,v){filters.push([k,v]);return b;},in(k,v){filters.push([k,v]);return b;},order(){return b;},single(){wantSingle=true;return b;},
 update(p){op='update';data=p;return b;},delete(){op='delete';return b;},insert(p){op='insert';data=p;return b;},upsert(p){op='upsert';data=p;return b;},
 then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}}
 function result(){
 const s=window.__stageTest;
 if(table==='records'){
  if(op==='select')return {data:s.records,error:null};
  if(op==='update'){
   if(s.failUpdate)return {data:null,error:{message:'Forced save failure'}};
   const r=s.records[0];Object.assign(r,data);return {data:{...r},error:null};
  }
  if(op==='insert'||op==='upsert'){
    const row={...data,id:'r2'};if('collection_ids' in row)return {data:null,error:{message:'Unknown column collection_ids'}};
    s.records.push(row);return {data:row,error:null};
  }
  if(op==='delete')return {data:null,error:null};
 }
 if(table==='collections'){
  if(op==='select')return {data:s.collections,error:null};
  if(op==='insert'||op==='upsert'){s.collections.push(data);return {data,error:null};}
  return {data:null,error:null};
 }
 if(table==='record_collections'){
  if(op==='select')return {data:s.links.filter(row=>filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v)),error:null};
  if(s.failLinks)return {data:null,error:{message:'Forced collection failure'}};
  if(op==='delete'){
   s.links=s.links.filter(row=>!filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));return {data:null,error:null};
  }
  if(op==='insert'){s.links.push(...data);return {data:null,error:null};}
 }
 return {data:wantSingle?{}:[],error:null};
 }
 return b;
}
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}}),signOut:async()=>({})},from:q,rpc:async()=>({error:{code:'PGRST202',message:'Could not find function ss_set_record_collections in schema cache'}})})};
</script>
'''
html=html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',mock)
html=html.replace('<script src="supabase-config.js"></script>','<script>window.DEAD_WAX_SUPABASE={url:"test",anonKey:"test"};</script>')
def js_replace(m):
 p=root/m.group(1)
 if not p.exists():raise FileNotFoundError(p)
 return '<script>\n'+p.read_text()+'\n</script>'
html=re.sub(r'<script\s+src="((?:js)/[^"?]+\.js)(?:\?[^\"]*)?"\s*></script>',js_replace,html)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
  page=await browser.new_page(viewport={'width':1280,'height':850})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(html,wait_until='domcontentloaded',timeout=30000)
  await page.wait_for_timeout(800)
  print('records',await page.locator('#gridWrap').inner_text()[:150] if False else await page.evaluate('document.querySelectorAll(".card-scene").length'))
  print('init_errors',errors[:2])
  await page.evaluate('window.openForm(0)')
  # Ensure a markup payload stays text in the track textarea, never injected elements.
  await page.evaluate('window.openForm(0)')
  escaped=await page.evaluate('''()=>({value:document.querySelector('#side_A')?.value,unsafe:!!document.querySelector('#fTrackGrid img')})''')
  print('safe_track',escaped)
  assert escaped['value'] and '</textarea><img' in escaped['value'] and not escaped['unsafe']
  await page.evaluate('window.__stageTest.failUpdate=true;')
  await page.locator('#fldAlbum').fill('Changed but unsaved')
  await page.evaluate('window.saveRec()')
  await page.wait_for_timeout(150)
  retained=await page.evaluate('document.querySelector("#fOv").classList.contains("on")')
  print('failed_save_form_retained',retained)
  assert retained
  await page.evaluate('window.__stageTest.failUpdate=false;')
  await page.evaluate('window.saveRec()')
  await page.wait_for_timeout(250)
  succeeded=await page.evaluate('!document.querySelector("#fOv").classList.contains("on")')
  print('successful_save_closes',succeeded)
  assert succeeded
  # Failing link updates cannot delete existing assignment, or dismiss the editor.
  await page.evaluate("""()=>{window.openForm(0);window.__stageTest.collections.push({id:'soul',name:'Soul',user_id:'u1'});let s=document.querySelector('#fldCollections');s.innerHTML+='<option value=\"soul\" selected>Soul</option>';window.__stageTest.failLinks=true;}""")
  await page.evaluate('window.saveRec()')
  await page.wait_for_timeout(80)
  safety=await page.evaluate("""()=>({open:document.querySelector('#fOv').classList.contains('on'),links:window.__stageTest.links.map(x=>x.collection_id)})""")
  print('failed_collections_preserve_old',safety)
  assert safety['open'] and 'jazz' in safety['links']
  await page.evaluate('window.__stageTest.failLinks=false')
  print('notices',await page.evaluate('window.__stageTest.notices'))
  if (root/'js/sleeveshelves-accessibility-v61_3.js').exists():
    await page.evaluate('window.openForm(0)')
    await page.wait_for_timeout(100)
    await page.keyboard.press('Tab')
    print('focus_in_dialog',await page.evaluate('document.querySelector("#formModal").contains(document.activeElement)'))
    print('aligned_pluses',await page.evaluate('''()=>({sidebar:!!document.querySelector('#ssAddCollection svg'),add:!!document.querySelector('.btn-add svg')})'''))
  print('final_errors',errors[:4])
  await browser.close()
asyncio.run(main())
