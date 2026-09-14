import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, WHATSAPP_NUMBER } from "/assets/config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const labels={land:"أرض",villa:"فيلا",chalet:"شاليه",investment:"استثماري",commercial:"تجاري"};
const statusLabels={published:"منشور",draft:"مسودة",archived:"مؤرشف"};
const dealLabels={available:"متاح",reserved:"محجوز",sold:"تم البيع",rented:"تم التأجير",inactive:"غير نشط"};
const leadLabels={new:"جديد",contacted:"تم التواصل",interested:"مهتم",viewing:"معاينة",negotiation:"تفاوض",won:"تمت الصفقة",lost:"لم تتم"};
let properties=[],leads=[],privateMap={};
let currentImages=[];

const $=s=>document.querySelector(s);
const money=v=>new Intl.NumberFormat("ar-SA").format(Number(v||0))+" ر.س";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function init(){
  if(!configured){$("#loginMsg").textContent="تعذر الاتصال بالنظام.";return;}
  const {data:{session}}=await supabase.auth.getSession();
  session?showAdmin():showLogin();
}
function showLogin(){ $("#loginView").style.display="grid"; $("#adminView").style.display="none"; }
async function showAdmin(){ $("#loginView").style.display="none"; $("#adminView").style.display="grid"; await refreshAll(); }
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginMsg").textContent="";const {error}=await supabase.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});if(error){$("#loginMsg").textContent=error.message;return;}showAdmin();});
$("#logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();showLogin();});

document.querySelectorAll(".sidebar-menu button").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.go)));
function activateTab(tab){document.querySelectorAll(".sidebar-menu button").forEach(x=>x.classList.toggle("active",x.dataset.tab===tab));document.querySelectorAll(".tab").forEach(t=>t.style.display="none");$("#tab-"+tab).style.display="block";}

async function refreshAll(){
  const [p,l,priv]=await Promise.all([
    supabase.from("properties").select("*").order("created_at",{ascending:false}),
    supabase.from("leads").select("*").order("created_at",{ascending:false}),
    supabase.from("property_private").select("*")
  ]);
  properties=p.data||[]; leads=l.data||[]; privateMap=Object.fromEntries((priv.data||[]).map(x=>[x.property_id,x])); render();
}
function render(){
  $("#kpiPublished").textContent=properties.filter(p=>p.status==="published").length;
  $("#kpiDrafts").textContent=properties.filter(p=>p.status==="draft").length;
  $("#kpiLeads").textContent=leads.filter(l=>(l.status||"new")==="new").length;
  $("#kpiAvailable").textContent=properties.filter(p=>(p.deal_status||"available")==="available").length;
  $("#recentProperties").innerHTML=properties.slice(0,5).map(p=>`<div class="recent-row"><span><b>${esc(p.reference)}</b> — ${esc(p.title)}<small>${labels[p.type]||p.type} · ${dealLabels[p.deal_status||"available"]}</small></span><strong>${money(p.price)}</strong></div>`).join("")||"لا توجد بيانات.";
  renderProperties(); renderLeads();
}
function renderProperties(){
  const q=($("#propertySearch")?.value||"").trim().toLowerCase(); const type=$("#filterType")?.value||""; const deal=$("#filterDeal")?.value||"";
  const rows=properties.filter(p=>(!type||p.type===type)&&(!deal||(p.deal_status||"available")===deal)&&(!q||`${p.reference} ${p.title} ${p.city||""} ${p.district||""}`.toLowerCase().includes(q)));
  $("#propertyRows").innerHTML=rows.map(p=>`<tr><td><b>${esc(p.reference)}</b></td><td>${esc(p.title)}<small class="table-sub">${esc(p.city||"")}${p.district?" · "+esc(p.district):""}</small></td><td>${labels[p.type]||p.type}</td><td>${money(p.price)}</td><td><span class="status status-${p.status}">${statusLabels[p.status]||p.status}</span></td><td><span class="deal deal-${p.deal_status||"available"}">${dealLabels[p.deal_status||"available"]}</span></td><td class="table-actions action-stack"><button data-edit="${p.id}">تعديل</button><button data-duplicate="${p.id}">نسخ العرض</button><button data-link="${p.id}">نسخ الرابط</button><a target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("السلام عليكم، بخصوص العرض "+p.reference)}">واتساب</a><button data-archive="${p.id}">أرشفة</button></td></tr>`).join("")||`<tr><td colspan="7">لا توجد نتائج مطابقة.</td></tr>`;
  document.querySelectorAll("[data-edit]").forEach(x=>x.onclick=()=>openEdit(x.dataset.edit));
  document.querySelectorAll("[data-duplicate]").forEach(x=>x.onclick=()=>duplicateProperty(x.dataset.duplicate));
  document.querySelectorAll("[data-link]").forEach(x=>x.onclick=()=>copyPublicLink(x.dataset.link));
  document.querySelectorAll("[data-archive]").forEach(x=>x.onclick=()=>archiveProperty(x.dataset.archive));
}
function renderLeads(){
  $("#leadRows").innerHTML=leads.map(l=>`<tr><td>${esc(l.name||"—")}</td><td>${esc(l.phone||"—")}</td><td>${esc(l.lead_type||"—")}</td><td>${esc(l.message||"—")}</td><td><select class="lead-status" data-lead-status="${l.id}">${Object.entries(leadLabels).map(([k,v])=>`<option value="${k}" ${((l.status||"new")===k)?"selected":""}>${v}</option>`).join("")}</select></td><td>${new Date(l.created_at).toLocaleDateString("ar-SA")}</td></tr>`).join("")||`<tr><td colspan="6">لا توجد استفسارات بعد.</td></tr>`;
  document.querySelectorAll("[data-lead-status]").forEach(s=>s.onchange=async()=>{await supabase.from("leads").update({status:s.value}).eq("id",s.dataset.leadStatus);});
}
["#propertySearch","#filterType","#filterDeal"].forEach(s=>$(s)?.addEventListener("input",renderProperties));

function openModal(){ $("#propertyModal").classList.add("open"); document.body.style.overflow="hidden"; updateConditionalFields(); updatePricePerSqm(); renderExistingImages(); }
function closeModal(){ $("#propertyModal").classList.remove("open"); document.body.style.overflow=""; $("#propertyForm").reset(); $("#propertyId").value=""; $("#pCity").value="بريدة"; $("#modalTitle").textContent="إضافة عرض عقاري"; $("#formStatus").textContent=""; $("#imageCount").textContent="لم يتم اختيار صور جديدة"; $("#validationBox").style.display="none"; currentImages=[]; updateConditionalFields(); updatePricePerSqm(); renderExistingImages(); }
$("#addPropertyBtn").onclick=openModal; $("#addPropertyBtn2").onclick=openModal; $("#quickAdd").onclick=openModal; $("#closeModal").onclick=closeModal; $("#cancelModal").onclick=closeModal;

function updateConditionalFields(){ const type=$("#pType").value; $("#landFields").style.display=type==="land"?"block":"none"; $("#buildingFields").style.display=["villa","chalet","commercial"].includes(type)?"block":"none"; }
$("#pType").addEventListener("change",updateConditionalFields);
function updatePricePerSqm(){ const area=Number($("#pArea").value),price=Number($("#pPrice").value); $("#pricePerSqm").textContent=area&&price?money(Math.round(price/area))+" / م²":"—"; }
$("#pArea").addEventListener("input",updatePricePerSqm); $("#pPrice").addEventListener("input",updatePricePerSqm);
$("#pImages").addEventListener("change",e=>$("#imageCount").textContent=e.target.files.length?`${e.target.files.length} صورة جاهزة للرفع`:"لم يتم اختيار صور جديدة");
function splitFeatures(v){ return v.split(/[،,]/).map(x=>x.trim()).filter(Boolean); }

function openEdit(id){
  const p=properties.find(x=>String(x.id)===String(id)); if(!p)return; const priv=privateMap[p.id]||{};
  fillForm(p,priv); $("#propertyId").value=p.id; $("#modalTitle").textContent="تعديل "+p.reference; currentImages=[...(p.images||[])]; openModal();
}
function fillForm(p,priv={}){
  $("#pType").value=p.type||"land"; $("#pOfferType").value=p.offer_type||"sale"; $("#pStatus").value=p.status||"draft"; $("#pDealStatus").value=p.deal_status||"available";
  $("#pTitle").value=p.title||""; $("#pCity").value=p.city||""; $("#pDistrict").value=p.district||""; $("#pArea").value=p.area||""; $("#pPrice").value=p.price||""; $("#pFrontage").value=p.frontage||""; $("#pStreetWidth").value=p.street_width||""; $("#pShortDescription").value=p.short_description||""; $("#pMap").value=p.map_url||""; $("#pDescription").value=p.description||""; $("#pFeatures").value=Array.isArray(p.features)?p.features.join("، "):""; $("#pNegotiable").checked=!!p.negotiable; $("#pFeatured").checked=!!p.featured;
  $("#pLandLength").value=p.land_length??""; $("#pLandWidth").value=p.land_width??""; $("#pDeedType").value=p.deed_type||""; $("#pDeedMasked").value=p.deed_number_masked||"";
  $("#pBedrooms").value=p.bedrooms??""; $("#pBathrooms").value=p.bathrooms??""; $("#pPropertyAge").value=p.property_age??""; $("#pParking").value=p.parking??""; $("#pElevator").checked=!!p.elevator;
  $("#pOwnerName").value=priv.owner_name||""; $("#pOwnerPhone").value=priv.owner_phone||""; $("#pOwnerAccount").value=priv.owner_account||""; $("#pSource").value=priv.source||""; $("#pCommissionNote").value=priv.commission_note||""; $("#pMortgageStatus").value=priv.mortgage_status||""; $("#pLegalNotes").value=priv.legal_notes||""; $("#pInternalNotes").value=priv.internal_notes||"";
}
function duplicateProperty(id){ const p=properties.find(x=>String(x.id)===String(id)); if(!p)return; const priv=privateMap[p.id]||{}; closeModal(); fillForm({...p,status:"draft",title:(p.title||"")+" — نسخة"},priv); $("#propertyId").value=""; $("#modalTitle").textContent="نسخ "+p.reference; currentImages=[...(p.images||[])]; openModal(); }
function publicLink(p){ return `${SITE_URL}/?property=${encodeURIComponent(p.reference)}`; }
async function copyPublicLink(id){ const p=properties.find(x=>String(x.id)===String(id)); if(!p)return; await navigator.clipboard.writeText(publicLink(p)); alert("تم نسخ رابط العرض"); }

function renderExistingImages(){
  const box=$("#existingImages"); if(!currentImages.length){box.innerHTML='<div class="muted tiny">لا توجد صور محفوظة لهذا العرض.</div>';return;}
  const p=properties.find(x=>String(x.id)===String($("#propertyId").value)); const primary=p?.primary_image||currentImages[0];
  box.innerHTML=currentImages.map((url,i)=>`<div class="image-item"><img src="${esc(url)}" alt="صورة"><div class="image-actions"><button type="button" data-primary="${i}" class="${url===primary?'is-primary':''}">${url===primary?'الرئيسية':'اجعلها رئيسية'}</button><button type="button" data-up="${i}">↑</button><button type="button" data-down="${i}">↓</button><button type="button" data-remove="${i}" class="danger-mini">حذف</button></div></div>`).join("");
  document.querySelectorAll("[data-primary]").forEach(b=>b.onclick=()=>setPrimary(Number(b.dataset.primary)));
  document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>moveImage(Number(b.dataset.up),-1));
  document.querySelectorAll("[data-down]").forEach(b=>b.onclick=()=>moveImage(Number(b.dataset.down),1));
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeImage(Number(b.dataset.remove)));
}
let forcedPrimary=null;
function setPrimary(i){ forcedPrimary=currentImages[i]; renderExistingImages(); }
function moveImage(i,delta){ const j=i+delta;if(j<0||j>=currentImages.length)return;[currentImages[i],currentImages[j]]=[currentImages[j],currentImages[i]];renderExistingImages(); }
function removeImage(i){ currentImages.splice(i,1); if(forcedPrimary&&!currentImages.includes(forcedPrimary))forcedPrimary=null; renderExistingImages(); }

async function uploadImages(reference,files){
  const urls=[]; for(const file of files){ const ext=(file.name.split('.').pop()||'jpg').toLowerCase(); const path=`${reference}/${Date.now()}-${crypto.randomUUID()}.${ext}`; const {error}=await supabase.storage.from("property-images").upload(path,file,{upsert:false,contentType:file.type||undefined}); if(error)continue; const {data}=supabase.storage.from("property-images").getPublicUrl(path); urls.push(data.publicUrl); } return urls;
}
function buildPayload(statusOverride){
  const type=$("#pType").value,built=["villa","chalet","commercial"].includes(type),land=type==="land";
  return {type,offer_type:$("#pOfferType").value,status:statusOverride||$("#pStatus").value,deal_status:$("#pDealStatus").value,title:$("#pTitle").value.trim(),city:$("#pCity").value.trim(),district:$("#pDistrict").value.trim(),area:Number($("#pArea").value)||null,price:Number($("#pPrice").value)||0,frontage:$("#pFrontage").value.trim(),street_width:Number($("#pStreetWidth").value)||null,street:[$("#pFrontage").value.trim(),$("#pStreetWidth").value?$("#pStreetWidth").value+" م":""].filter(Boolean).join(" "),short_description:$("#pShortDescription").value.trim(),map_url:$("#pMap").value.trim(),description:$("#pDescription").value.trim(),features:splitFeatures($("#pFeatures").value),negotiable:$("#pNegotiable").checked,featured:$("#pFeatured").checked,land_length:land?(Number($("#pLandLength").value)||null):null,land_width:land?(Number($("#pLandWidth").value)||null):null,deed_type:land?$("#pDeedType").value.trim():null,deed_number_masked:land?$("#pDeedMasked").value.trim():null,bedrooms:built?(Number($("#pBedrooms").value)||null):null,bathrooms:built?(Number($("#pBathrooms").value)||null):null,property_age:built?(Number($("#pPropertyAge").value)||null):null,parking:built?(Number($("#pParking").value)||null):null,elevator:built?$("#pElevator").checked:null};
}
function privatePayload(propertyId){ return {property_id:propertyId,owner_name:$("#pOwnerName").value.trim()||null,owner_phone:$("#pOwnerPhone").value.trim()||null,owner_account:$("#pOwnerAccount").value.trim()||null,source:$("#pSource").value.trim()||null,commission_note:$("#pCommissionNote").value.trim()||null,mortgage_status:$("#pMortgageStatus").value.trim()||null,legal_notes:$("#pLegalNotes").value.trim()||null,internal_notes:$("#pInternalNotes").value.trim()||null}; }
function validateForPublish(){
  const missing=[]; if(!$("#pTitle").value.trim())missing.push("عنوان العرض"); if(!$("#pCity").value.trim())missing.push("المدينة"); if(!$("#pPrice").value)missing.push("السعر"); if(!$("#pArea").value)missing.push("المساحة"); if(!$("#pShortDescription").value.trim())missing.push("الوصف المختصر"); if(!$("#pDescription").value.trim())missing.push("الوصف التفصيلي");
  const box=$("#validationBox"); if(missing.length){box.style.display="block";box.innerHTML=`قبل النشر أكمل: <b>${missing.join("، ")}</b>`;return false;} box.style.display="none";return true;
}
async function saveProperty(statusOverride){
  if(statusOverride==="published"&&!validateForPublish())return;
  $("#formStatus").textContent="جاري الحفظ..."; const id=$("#propertyId").value; const payload=buildPayload(statusOverride); let saved;
  if(id){const {data,error}=await supabase.from("properties").update(payload).eq("id",id).select().single();if(error){$("#formStatus").textContent=error.message;return;}saved=data;} else {const {data,error}=await supabase.from("properties").insert(payload).select().single();if(error){$("#formStatus").textContent=error.message;return;}saved=data;}
  const {error:privErr}=await supabase.from("property_private").upsert(privatePayload(saved.id),{onConflict:"property_id"}); if(privErr){$("#formStatus").textContent="حُفظ العرض، لكن تعذر حفظ البيانات الخاصة: "+privErr.message;return;}
  const files=[...$("#pImages").files]; let images=[...currentImages]; if(files.length){const urls=await uploadImages(saved.reference,files);images=[...images,...urls];}
  const primary=(forcedPrimary&&images.includes(forcedPrimary))?forcedPrimary:(saved.primary_image&&images.includes(saved.primary_image)?saved.primary_image:(images[0]||null));
  const {error:imageErr}=await supabase.from("properties").update({images,primary_image:primary}).eq("id",saved.id); if(imageErr){$("#formStatus").textContent="حُفظ العرض لكن تعذر تحديث الصور: "+imageErr.message;return;}
  $("#formStatus").textContent=statusOverride==="draft"?"تم حفظ المسودة":"تم حفظ ونشر العرض بنجاح"; await refreshAll(); setTimeout(closeModal,650);
}
$("#propertyForm").addEventListener("submit",async e=>{e.preventDefault();await saveProperty("published");});
$("#saveDraftBtn").addEventListener("click",async()=>{if(!$("#pTitle").value.trim()){$("#formStatus").textContent="اكتب عنوان العرض أولًا.";return;}await saveProperty("draft");});
async function archiveProperty(id){if(!confirm("أرشفة هذا العرض؟"))return;await supabase.from("properties").update({status:"archived",deal_status:"inactive"}).eq("id",id);refreshAll();}
init();
