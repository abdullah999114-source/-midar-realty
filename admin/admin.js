import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/assets/config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const labels={land:"أرض",villa:"فيلا",chalet:"شاليه",investment:"استثماري",commercial:"تجاري"};
const dealLabels={available:"متاح",reserved:"محجوز",sold:"تم البيع",rented:"تم التأجير",inactive:"غير نشط"};
const statusLabels={published:"منشور",draft:"مسودة",archived:"مؤرشف"};
let properties=[],leads=[],privateMap={};
const $=s=>document.querySelector(s);
const money=v=>new Intl.NumberFormat("ar-SA").format(Number(v||0))+" ر.س";

async function init(){
  if(!configured){ $("#loginMsg").textContent="إعداد الاتصال غير مكتمل."; return; }
  const {data:{session}}=await supabase.auth.getSession();
  if(session) showAdmin(); else showLogin();
}
function showLogin(){ $("#loginView").style.display="grid"; $("#adminView").style.display="none"; }
async function showAdmin(){ $("#loginView").style.display="none"; $("#adminView").style.display="grid"; await refreshAll(); }

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("#loginMsg").textContent="جاري التحقق...";
  const {error}=await supabase.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});
  if(error){$("#loginMsg").textContent=error.message;return;} $("#loginMsg").textContent=""; showAdmin();
});
$("#logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();showLogin();});

function openTab(name){
  document.querySelectorAll(".sidebar-menu button").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  document.querySelectorAll(".tab").forEach(t=>t.style.display="none");
  const el=$("#tab-"+name); if(el) el.style.display="block";
}
document.querySelectorAll(".sidebar-menu button").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.go)));

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
  $("#kpiLeads").textContent=leads.filter(l=>!l.status||l.status==="new").length;
  $("#kpiAvailable").textContent=properties.filter(p=>(p.deal_status||"available")==="available").length;
  $("#recentProperties").innerHTML=properties.slice(0,5).map(p=>`<div class="recent-row"><span><b>${p.reference}</b> — ${p.title}<small>${labels[p.type]||p.type} · ${dealLabels[p.deal_status||"available"]}</small></span><strong>${money(p.price)}</strong></div>`).join("")||"لا توجد بيانات.";
  renderProperties();
  $("#leadRows").innerHTML=leads.map(l=>`<tr><td>${l.name||"—"}</td><td>${l.phone||"—"}</td><td>${l.lead_type||"—"}</td><td>${l.message||"—"}</td><td>${new Date(l.created_at).toLocaleDateString("ar-SA")}</td></tr>`).join("");
}
function renderProperties(){
  const q=($("#propertySearch")?.value||"").trim().toLowerCase();
  const type=$("#filterType")?.value||""; const deal=$("#filterDeal")?.value||"";
  const rows=properties.filter(p=>(!type||p.type===type)&&(!deal||(p.deal_status||"available")===deal)&&(!q||`${p.reference} ${p.title} ${p.city||""} ${p.district||""}`.toLowerCase().includes(q)));
  $("#propertyRows").innerHTML=rows.map(p=>`<tr><td><b>${p.reference}</b></td><td>${p.title}<small class="table-sub">${p.city||""}${p.district?" · "+p.district:""}</small></td><td>${labels[p.type]||p.type}</td><td>${money(p.price)}</td><td><span class="status status-${p.status}">${statusLabels[p.status]||p.status}</span></td><td><span class="deal deal-${p.deal_status||"available"}">${dealLabels[p.deal_status||"available"]}</span></td><td class="table-actions"><button data-edit="${p.id}">تعديل</button><button data-archive="${p.id}">أرشفة</button></td></tr>`).join("")||`<tr><td colspan="7">لا توجد نتائج مطابقة.</td></tr>`;
  document.querySelectorAll("[data-edit]").forEach(x=>x.onclick=()=>openEdit(x.dataset.edit));
  document.querySelectorAll("[data-archive]").forEach(x=>x.onclick=()=>archiveProperty(x.dataset.archive));
}
["#propertySearch","#filterType","#filterDeal"].forEach(s=>$(s)?.addEventListener("input",renderProperties));

function openModal(){ $("#propertyModal").classList.add("open"); document.body.style.overflow="hidden"; updateConditionalFields(); updatePricePerSqm(); }
function closeModal(){ $("#propertyModal").classList.remove("open"); document.body.style.overflow=""; $("#propertyForm").reset(); $("#propertyId").value=""; $("#pCity").value="بريدة"; $("#modalTitle").textContent="إضافة عرض عقاري"; $("#formStatus").textContent=""; $("#imageCount").textContent="لم يتم اختيار صور جديدة"; updateConditionalFields(); updatePricePerSqm(); }
$("#addPropertyBtn").onclick=openModal; $("#addPropertyBtn2").onclick=openModal; $("#quickAdd").onclick=openModal; $("#closeModal").onclick=closeModal; $("#cancelModal").onclick=closeModal;

function updateConditionalFields(){ const built=["villa","chalet","commercial"].includes($("#pType").value); $("#buildingFields").style.display=built?"block":"none"; }
$("#pType").addEventListener("change",updateConditionalFields);
function updatePricePerSqm(){ const area=Number($("#pArea").value), price=Number($("#pPrice").value); $("#pricePerSqm").textContent=area&&price?money(Math.round(price/area))+" / م²":"—"; }
$("#pArea").addEventListener("input",updatePricePerSqm); $("#pPrice").addEventListener("input",updatePricePerSqm);
$("#pImages").addEventListener("change",e=>$("#imageCount").textContent=e.target.files.length?`${e.target.files.length} صورة جاهزة للرفع`:"لم يتم اختيار صور جديدة");

function splitFeatures(v){ return v.split(/[،,]/).map(x=>x.trim()).filter(Boolean); }
function openEdit(id){
  const p=properties.find(x=>String(x.id)===String(id)); if(!p)return; const priv=privateMap[p.id]||{};
  $("#propertyId").value=p.id; $("#pType").value=p.type; $("#pOfferType").value=p.offer_type||"sale"; $("#pStatus").value=p.status; $("#pDealStatus").value=p.deal_status||"available";
  $("#pTitle").value=p.title; $("#pCity").value=p.city||""; $("#pDistrict").value=p.district||""; $("#pArea").value=p.area||""; $("#pPrice").value=p.price||""; $("#pFrontage").value=p.frontage||""; $("#pStreetWidth").value=p.street_width||"";
  $("#pShortDescription").value=p.short_description||""; $("#pMap").value=p.map_url||""; $("#pDescription").value=p.description||""; $("#pFeatures").value=Array.isArray(p.features)?p.features.join("، "):""; $("#pNegotiable").checked=!!p.negotiable; $("#pFeatured").checked=!!p.featured;
  $("#pBedrooms").value=p.bedrooms??""; $("#pBathrooms").value=p.bathrooms??""; $("#pPropertyAge").value=p.property_age??""; $("#pParking").value=p.parking??""; $("#pElevator").checked=!!p.elevator;
  $("#pOwnerName").value=priv.owner_name||""; $("#pOwnerPhone").value=priv.owner_phone||""; $("#pInternalNotes").value=priv.internal_notes||"";
  $("#modalTitle").textContent="تعديل "+p.reference; openModal();
}

async function uploadImages(reference,files){
  const urls=[]; for(const file of files){
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase(); const path=`${reference}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from("property-images").upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(error) continue; const {data}=supabase.storage.from("property-images").getPublicUrl(path); urls.push(data.publicUrl);
  } return urls;
}

function buildPayload(statusOverride){
  const type=$("#pType").value; const built=["villa","chalet","commercial"].includes(type);
  return {type,offer_type:$("#pOfferType").value,status:statusOverride||$("#pStatus").value,deal_status:$("#pDealStatus").value,title:$("#pTitle").value.trim(),city:$("#pCity").value.trim(),district:$("#pDistrict").value.trim(),area:Number($("#pArea").value)||null,price:Number($("#pPrice").value)||0,frontage:$("#pFrontage").value.trim(),street_width:Number($("#pStreetWidth").value)||null,street:[$("#pFrontage").value.trim(),$("#pStreetWidth").value?$("#pStreetWidth").value+" م":""].filter(Boolean).join(" "),short_description:$("#pShortDescription").value.trim(),map_url:$("#pMap").value.trim(),description:$("#pDescription").value.trim(),features:splitFeatures($("#pFeatures").value),negotiable:$("#pNegotiable").checked,featured:$("#pFeatured").checked,bedrooms:built?(Number($("#pBedrooms").value)||null):null,bathrooms:built?(Number($("#pBathrooms").value)||null):null,property_age:built?(Number($("#pPropertyAge").value)||null):null,parking:built?(Number($("#pParking").value)||null):null,elevator:built?$("#pElevator").checked:null};
}
async function saveProperty(statusOverride){
  $("#formStatus").textContent="جاري الحفظ..."; const id=$("#propertyId").value; const payload=buildPayload(statusOverride); let saved;
  if(id){ const {data,error}=await supabase.from("properties").update(payload).eq("id",id).select().single(); if(error){$("#formStatus").textContent=error.message;return;} saved=data; }
  else { const {data,error}=await supabase.from("properties").insert(payload).select().single(); if(error){$("#formStatus").textContent=error.message;return;} saved=data; }
  const privatePayload={property_id:saved.id,owner_name:$("#pOwnerName").value.trim()||null,owner_phone:$("#pOwnerPhone").value.trim()||null,internal_notes:$("#pInternalNotes").value.trim()||null};
  const {error:privErr}=await supabase.from("property_private").upsert(privatePayload,{onConflict:"property_id"}); if(privErr){$("#formStatus").textContent="حُفظ العرض، لكن تعذر حفظ البيانات الخاصة: "+privErr.message;return;}
  const files=[...$("#pImages").files]; if(files.length){ const urls=await uploadImages(saved.reference,files); const images=[...(saved.images||[]),...urls]; const primary=saved.primary_image||urls[0]||null; await supabase.from("properties").update({images,primary_image:primary}).eq("id",saved.id); }
  $("#formStatus").textContent=statusOverride==="draft"?"تم حفظ المسودة":"تم حفظ العرض بنجاح"; await refreshAll(); setTimeout(closeModal,650);
}
$("#propertyForm").addEventListener("submit",async e=>{e.preventDefault();await saveProperty("published");});
$("#saveDraftBtn").addEventListener("click",async()=>{if(!$("#pTitle").value.trim()){ $("#formStatus").textContent="اكتب عنوان العرض أولًا."; return;} await saveProperty("draft");});

async function archiveProperty(id){ if(!confirm("أرشفة هذا العرض؟"))return; await supabase.from("properties").update({status:"archived",deal_status:"inactive"}).eq("id",id); refreshAll(); }
init();
