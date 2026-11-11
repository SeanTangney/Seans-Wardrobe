import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const $ = id => document.getElementById(id);
const categories = ['Tops','Bottoms','Outerwear','Footwear','Accessories','Other'];
const icons = {
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 shirt:'<path d="m16 4 4 2 2 5-4 2-2-2v9H8v-9l-2 2-4-2 2-5 4-2a4 4 0 0 0 8 0Z"/>',
 bottoms:'<path d="M6 3h12l2 18h-6l-2-10-2 10H4L6 3Z"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
 shoe:'<path d="M3 16c4 0 6-2 7-8l4 4 6 3a3 3 0 0 1 1 5H3a2 2 0 0 1 0-4Z"/>',
 sparkles:'<path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"/>',
 box:'<path d="M3 7 12 3l9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10"/>',
 tag:'<path d="M20 13 13 20a2 2 0 0 1-3 0L3 13V4h9l8 7a2 2 0 0 1 0 2Z"/><circle cx="8" cy="8" r="1"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9m-10 5h6"/>',
 logout:'<path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 upload:'<path d="M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.shirt}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML=svg(el.dataset.icon));
const configured = !Object.values(firebaseConfig).some(v => String(v).includes('REPLACE_WITH'));
const app = configured ? initializeApp(firebaseConfig) : null;
const auth = app && getAuth(app);
const db = app && getFirestore(app);
const storage = app && getStorage(app);
let user = null, unsubscribe = null, items = [], view = 'all', categoryFilter = 'All', editing = null, uploads = [], existingPhotos = [], busy = false, toastTimer;
const statusLabels = {owned:'In wardrobe',sold:'Sold','no-longer-own':'No longer own'};
const safe = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500)}
function errorMessage(err){if(err?.code==='auth/invalid-credential'||err?.code==='auth/wrong-password'||err?.code==='auth/user-not-found')return 'Email or password is incorrect.';if(err?.code==='auth/too-many-requests')return 'Too many attempts. Please try later.';if(err?.code==='permission-denied'||err?.code==='storage/unauthorized')return 'Access denied. Check your Firebase security rules.';return err?.message||'Something went wrong.'}
function setBusy(value){busy=value;$('save-item').disabled=value;$('save-item').textContent=value?'Saving...':'Save piece ↗';$('delete-item').disabled=value;$('cancel-modal').disabled=value}
if(!configured){$('login-error').textContent='Setup required: add your Firebase project details to firebase-config.js first.';$('login-submit').disabled=true;}
else {
 $('login-form').addEventListener('submit', async e=>{e.preventDefault();$('login-error').textContent='';$('login-submit').disabled=true;try{await signInWithEmailAndPassword(auth,$('login-email').value.trim(),$('login-password').value)}catch(err){$('login-error').textContent=errorMessage(err)}finally{$('login-submit').disabled=false}});
 onAuthStateChanged(auth, current=>{
  if(unsubscribe){unsubscribe();unsubscribe=null} user=current; items=[];
  $('login-screen').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);
  if(!user){$('login-password').value='';closeModal(true);return}
  $('loading').classList.remove('hidden');
  unsubscribe=onSnapshot(collection(db,'users',user.uid,'items'),snapshot=>{items=snapshot.docs.map(d=>({id:d.id,...d.data()}));$('loading').classList.add('hidden');render()},err=>{$('loading').textContent='Unable to load wardrobe: '+errorMessage(err);toast('Unable to load your wardrobe')});
 });
}
$('signout').addEventListener('click',()=>{if(auth)signOut(auth).catch(err=>toast(errorMessage(err)))});
function activeItems(){return items.filter(i=>i.status==='owned')}
function render(){const active=activeItems();$('stat-total').textContent=active.length;$('stat-sold').textContent=items.filter(i=>i.status==='sold').length;$('stat-gone').textContent=items.filter(i=>i.status==='no-longer-own').length;$('stat-categories').textContent=new Set(active.map(i=>i.category)).size;
 $('count-all').textContent=active.length;for(const c of categories)$('count-'+c).textContent=active.filter(i=>i.category===c).length;for(const s of ['sold','no-longer-own'])$('count-'+s).textContent=items.filter(i=>i.status===s).length;
 const archive=view==='sold'||view==='no-longer-own';const heading= view==='all'?'My Wardrobe':view==='sold'?'Sold Items':view==='no-longer-own'?'No Longer Own':view;const subtitles={all:'Every piece, one place. A collection that’s uniquely yours.',sold:'Pieces you’ve sold, kept here for your records.','no-longer-own':'Your past wardrobe, neatly archived.'};
 $('page-title').innerHTML=safe(heading)+'<span class="heading-period">.</span>';$('page-subtitle').textContent=subtitles[view]||`Your ${view.toLowerCase()} collection.`;$('page-kicker').textContent=archive?'THE ARCHIVE':'THE COLLECTION';$('breadcrumb').textContent=heading.toUpperCase();$('collection-title').textContent=archive?'Archived pieces':'Your pieces';
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const filterRow=$('filter-row');filterRow.innerHTML='';if(view==='all'||archive){for(const cat of ['All',...categories]){const b=document.createElement('button');b.className='filter-chip'+(categoryFilter===cat?' active':'');b.textContent=cat;b.addEventListener('click',()=>{categoryFilter=cat;render()});filterRow.append(b)}}
 let visible=items.filter(i=> archive?i.status===view:i.status==='owned'&&(view==='all'||i.category===view));if((view==='all'||archive)&&categoryFilter!=='All')visible=visible.filter(i=>i.category===categoryFilter);
 const query=$('search').value.trim().toLowerCase();if(query)visible=visible.filter(i=>[i.name,i.category,i.subcategory,i.brand,i.size,i.colour,i.notes].some(x=>String(x||'').toLowerCase().includes(query)));
 const sort=$('sort').value;visible.sort((a,b)=>sort==='name'?String(a.name).localeCompare(b.name):sort==='brand'?String(a.brand||'').localeCompare(b.brand||''):sort==='oldest'?timestamp(a)-timestamp(b):timestamp(b)-timestamp(a));
 $('result-count').textContent=visible.length+(visible.length===1?' item':' items');const grid=$('items-grid');grid.innerHTML='';for(const item of visible){const card=document.createElement('button');card.className='item-card';card.type='button';const photo=item.photos?.[0];card.innerHTML=`<div class="item-media">${photo?`<img src="${safe(photo.url)}" alt="${safe(item.name)}" loading="lazy"/>`:svg('shirt')}${item.status!=='owned'?`<span class="status-tag">${safe(statusLabels[item.status]||item.status)}</span>`:''}${item.photos?.length>1?`<span class="photo-number">+${item.photos.length-1} photos</span>`:''}</div><div class="item-details"><div class="item-name">${safe(item.name)}</div><div class="item-brand">${safe(item.brand||item.subcategory||item.category)}</div><div class="item-meta"><span>${safe(item.category)}</span><span>${safe(item.size||item.colour||'View item →')}</span></div></div>`;card.addEventListener('click',()=>openModal(item));grid.append(card)}
 const empty=visible.length===0;$('empty-state').classList.toggle('hidden',!empty);$('empty-title').textContent=items.length===0?'A fresh start.':'Nothing here yet.';$('empty-description').textContent=items.length===0?'Your wardrobe is waiting. Add your first piece to get started.':query?'Try another search term.':'Add a piece or choose another category.';$('empty-add').classList.toggle('hidden',items.length>0);
}
function timestamp(item){return item.createdAt?.toMillis?.()||item.updatedAt?.toMillis?.()||0}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;categoryFilter='All';$('sidebar').classList.remove('open');render()}));
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('menu-toggle').addEventListener('click',()=>$('sidebar').classList.add('open'));$('side-close').addEventListener('click',()=>$('sidebar').classList.remove('open'));
$('add-item').addEventListener('click',()=>openModal());$('empty-add').addEventListener('click',()=>openModal());
function openModal(item=null){if(!user)return;editing=item;uploads=[];existingPhotos=[...(item?.photos||[])];$('item-form').reset();$('modal-title').textContent=item?'Edit your piece':'Add a new piece';$('item-name').value=item?.name||'';$('item-category').value=item?.category||'Tops';$('item-subcategory').value=item?.subcategory||'';$('item-brand').value=item?.brand||'';$('item-size').value=item?.size||'';$('item-colour').value=item?.colour||'';$('item-status').value=item?.status||'owned';$('item-notes').value=item?.notes||'';$('delete-item').classList.toggle('hidden',!item);$('form-error').textContent='';renderPreview();$('modal-backdrop').classList.remove('hidden');document.body.style.overflow='hidden';$('item-name').focus()}
function closeModal(force=false){if(busy&&!force)return;for(const u of uploads)URL.revokeObjectURL(u.preview);uploads=[];$('modal-backdrop').classList.add('hidden');document.body.style.overflow='';editing=null}
$('close-modal').addEventListener('click',()=>closeModal());$('cancel-modal').addEventListener('click',()=>closeModal());$('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function renderPreview(){const el=$('photo-preview');el.innerHTML='';const list=[...existingPhotos.map((p,index)=>({src:p.url,kind:'existing',index})),...uploads.map((p,index)=>({src:p.preview,kind:'upload',index}))];for(const p of list){const unit=document.createElement('div');unit.className='preview-unit';const img=document.createElement('img');img.src=p.src;img.alt='Clothing photo';const button=document.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label','Remove photo');button.addEventListener('click',()=>{if(p.kind==='existing')existingPhotos.splice(p.index,1);else{URL.revokeObjectURL(uploads[p.index].preview);uploads.splice(p.index,1)}renderPreview()});unit.append(img,button);el.append(unit)}}
$('photo-input').addEventListener('change',e=>{const files=Array.from(e.target.files||[]);$('form-error').textContent='';for(const file of files){if(existingPhotos.length+uploads.length>=5){$('form-error').textContent='You can add up to 5 photos per item.';break}if(!file.type.startsWith('image/'))continue;if(file.size>20*1024*1024){$('form-error').textContent='Photos must be under 20 MB each.';continue}uploads.push({file,preview:URL.createObjectURL(file)})}e.target.value='';renderPreview()});
async function optimise(file){const img=await createImageBitmap(file);try{const max=1600,ratio=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to process photo.')), 'image/jpeg',.84))}finally{img.close()}}
async function removePhotos(photos){for(const p of photos){if(!p.path)continue;try{await deleteObject(ref(storage,p.path))}catch(err){console.warn('Photo cleanup could not complete',err)}}}
$('item-form').addEventListener('submit',async e=>{e.preventDefault();if(!user||busy)return;const currentUser=user;const name=$('item-name').value.trim();if(!name){$('form-error').textContent='Please enter an item name.';return}setBusy(true);$('form-error').textContent='';const newlyUploaded=[];
 try{for(const uploaded of uploads){const image=await optimise(uploaded.file);const path=`wardrobe/${currentUser.uid}/${crypto.randomUUID()}.jpg`;const storageRef=ref(storage,path);await uploadBytes(storageRef,image,{contentType:'image/jpeg'});const url=await getDownloadURL(storageRef);newlyUploaded.push({path,url})}
 const photos=[...existingPhotos,...newlyUploaded];const fields={name,category:$('item-category').value,subcategory:$('item-subcategory').value.trim(),brand:$('item-brand').value.trim(),size:$('item-size').value.trim(),colour:$('item-colour').value.trim(),status:$('item-status').value,notes:$('item-notes').value.trim(),photos,updatedAt:serverTimestamp()};
 if(editing){const previous=editing.photos||[];await updateDoc(doc(db,'users',currentUser.uid,'items',editing.id),fields);await removePhotos(previous.filter(p=>!existingPhotos.some(a=>a.path===p.path)));toast('Piece updated successfully')}else{await addDoc(collection(db,'users',currentUser.uid,'items'),{...fields,createdAt:serverTimestamp()});toast('Piece added to your wardrobe')}for(const u of uploads)URL.revokeObjectURL(u.preview);uploads=[];setBusy(false);closeModal();
 }catch(err){await removePhotos(newlyUploaded);$('form-error').textContent=errorMessage(err);setBusy(false)}});
$('delete-item').addEventListener('click',async()=>{if(!editing||!user||busy)return;if(!confirm(`Permanently delete “${editing.name}” and all its photos? This cannot be undone.`))return;setBusy(true);try{const item=editing;await deleteDoc(doc(db,'users',user.uid,'items',item.id));await removePhotos(item.photos||[]);setBusy(false);closeModal();toast('Item deleted')}catch(err){$('form-error').textContent=errorMessage(err);setBusy(false)}});
