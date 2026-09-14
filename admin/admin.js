import { SUPABASE_URL, SUPABASE_ANON_KEY } from "/assets/config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const labels={land:"أرض",villa:"فيلا",chalet:"شاليه",investment:"استثماري",commercial:"تجاري"};
let properties=[],leads=[];

const $=s=>document.querySelector(s);
const money=v=>new Intl.NumberFormat("ar-SA").format(Number(v||0))+" ر.س";

async function init(){
  if(!configured){ $("#loginMsg").innerHTML="اللوحة جاهزة. تبقى خطوة واحدة: ضع SUPABASE_URL و SUPABASE_ANON_KEY في <b>/assets/config.js</b> ثم نفذ ملف SQL."; return; }
  const {data:{session}}=await supabase.auth.getSession();
  if(session) showAdmin(); else showLogin();
}
function showLogin(){ $("#loginView").style.display="grid"; $("#adminView").style.display="none"; }
async function showAdmin(){ $("#loginView").style.display="none"; $("#adminView").style.display="grid"; await refreshAll(); }
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!configured){$("#loginMsg").textContent="أكمل إعداد Supabase أولًا.";return;}
  const {error}=await supabase.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});
  if(error){$("#loginMsg").textContent=error.message;return;} showAdmin();
});
$("#logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();showLogin();});
document.querySelectorAll(".sidebar-menu button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".sidebar-menu button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".tab").forEach(t=>t.style.display="none"); $("#tab-"+b.dataset.tab).style.display="block";
}));
async function refreshAll(){
  const [p,l]=await Promise.all([supabase.from("properties").select("*").order("created_at",{ascending:false}),supabase.from("leads").select("*").order("created_at",{ascending:false})]);
  properties=p.data||[]; leads=l.data||[]; render();
}
function render(){
  $("#kpiPublished").textContent=properties.filter(p=>p.status==="published").length;
  $("#kpiDrafts").textContent=properties.filter(p=>p.status==="draft").length;
  $("#kpiLeads").textContent=leads.length;
  $("#kpiChalets").textContent=properties.filter(p=>p.type==="chalet").length;
  $("#recentProperties").innerHTML=properties.slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee"><span><b>${p.reference}</b> — ${p.title}</span><span>${money(p.price)}</span></div>`).join("")||"لا توجد بيانات.";
  $("#propertyRows").innerHTML=properties.map(p=>`<tr><td><b>${p.reference}</b></td><td>${p.title}</td><td>${labels[p.type]||p.type}</td><td>${money(p.price)}</td><td><span class="status status-${p.status}">${p.status}</span></td><td class="table-actions"><button data-edit="${p.id}">تعديل</button><button data-archive="${p.id}">أرشفة</button></td></tr>`).join("");
  $("#leadRows").innerHTML=leads.map(l=>`<tr><td>${l.name||""}</td><td>${l.phone||""}</td><td>${l.lead_type||""}</td><td>${l.message||""}</td><td>${new Date(l.created_at).toLocaleDateString("ar-SA")}</td></tr>`).join("");
  document.querySelectorAll("[data-edit]").forEach(x=>x.onclick=()=>openEdit(x.dataset.edit));
  document.querySelectorAll("[data-archive]").forEach(x=>x.onclick=()=>archiveProperty(x.dataset.archive));
}
function openModal(){ $("#propertyModal").classList.add("open");}
function closeModal(){ $("#propertyModal").classList.remove("open"); $("#propertyForm").reset(); $("#propertyId").value=""; $("#modalTitle").textContent="إضافة عقار"; }
$("#addPropertyBtn").onclick=openModal; $("#addPropertyBtn2").onclick=openModal; $("#closeModal").onclick=closeModal; $("#cancelModal").onclick=closeModal;
function openEdit(id){
  const p=properties.find(x=>String(x.id)===String(id)); if(!p)return;
  $("#propertyId").value=p.id;$("#pType").value=p.type;$("#pStatus").value=p.status;$("#pTitle").value=p.title;$("#pCity").value=p.city||"";$("#pDistrict").value=p.district||"";$("#pArea").value=p.area||"";$("#pPrice").value=p.price||"";$("#pStreet").value=p.street||"";$("#pMap").value=p.map_url||"";$("#pDescription").value=p.description||"";$("#pFeatured").checked=!!p.featured;$("#modalTitle").textContent="تعديل "+p.reference;openModal();
}
async function uploadImages(reference,files){
  const urls=[];
  for(const file of files){
    const safe=file.name.replace(/[^\w.\-]+/g,"-");
    const path=`${reference}/${Date.now()}-${safe}`;
    const {error}=await supabase.storage.from("property-images").upload(path,file,{upsert:false});
    if(error) continue;
    const {data}=supabase.storage.from("property-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
$("#propertyForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("#formStatus").textContent="جاري الحفظ...";
  const id=$("#propertyId").value;
  const payload={type:$("#pType").value,status:$("#pStatus").value,title:$("#pTitle").value.trim(),city:$("#pCity").value.trim(),district:$("#pDistrict").value.trim(),area:Number($("#pArea").value)||null,price:Number($("#pPrice").value)||0,street:$("#pStreet").value.trim(),map_url:$("#pMap").value.trim(),description:$("#pDescription").value.trim(),featured:$("#pFeatured").checked};
  let saved;
  if(id){
    const {data,error}=await supabase.from("properties").update(payload).eq("id",id).select().single(); if(error){$("#formStatus").textContent=error.message;return;} saved=data;
  } else {
    const {data,error}=await supabase.from("properties").insert(payload).select().single(); if(error){$("#formStatus").textContent=error.message;return;} saved=data;
  }
  const files=[...$("#pImages").files];
  if(files.length){
    const urls=await uploadImages(saved.reference,files);
    const images=[...(saved.images||[]),...urls];
    await supabase.from("properties").update({images}).eq("id",saved.id);
  }
  $("#formStatus").textContent="تم الحفظ بنجاح"; await refreshAll(); setTimeout(closeModal,500);
});
async function archiveProperty(id){ if(!confirm("أرشفة هذا العقار؟"))return; await supabase.from("properties").update({status:"archived"}).eq("id",id); refreshAll(); }
init();
