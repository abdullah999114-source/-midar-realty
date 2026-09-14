import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const demo = [
  {reference:"MIDAR-1001",type:"land",title:"أرض سكنية – حي النور، بريدة",city:"بريدة",district:"حي النور",area:448,price:336000,street:"15 م",status:"published",featured:false,description:"أرض سكنية في شمال بريدة بحي النور، مناسبة للبناء السكني.",map_url:"https://maps.app.goo.gl/79MEA7vCVWJdNhFWA",images:[]},
  {reference:"MIDAR-1002",type:"villa",title:"فيلا فندقية فاخرة – حي الرحاب، بريدة",city:"بريدة",district:"حي الرحاب",area:370,price:1900000,street:"جنوبي 25 م",status:"published",featured:true,description:"تشطيب فاخر، بناء شخصي بإشراف هندسي، مصعد، تكييف كامل وواجهة رخام ترافنتينو.",map_url:"https://maps.app.goo.gl/HjJbaTfY7QN124DE6?g_st=iw",images:["/properties/midar-1002/villa-1.jpeg"]}
];

const labels = {land:"أرض للبيع",villa:"فيلا للبيع",chalet:"شاليه للبيع",investment:"فرصة استثمارية",commercial:"عقار تجاري"};
const grid = document.querySelector("#propertiesGrid");
let properties = [];

async function loadProperties(){
  if(!configured){ properties = demo; render("all"); return; }
  const {data,error} = await supabase.from("properties").select("*").eq("status","published").order("created_at",{ascending:false});
  properties = error ? demo : (data || []);
  render("all");
}
function money(v){ return new Intl.NumberFormat("ar-SA").format(Number(v||0))+" ريال"; }
function propertyImage(p){
  const src = Array.isArray(p.images)&&p.images[0] ? p.images[0] : "";
  return src ? `<img src="${src}" alt="${p.title}">` : `<div style="height:100%;display:grid;place-items:center;color:#fff;font-size:64px">⌂</div>`;
}
function render(filter){
  const list = properties.filter(p => filter==="all" || p.type===filter);
  grid.innerHTML = list.length ? list.map(p=>`
    <article class="property-card">
      <div class="property-image">${propertyImage(p)}<span class="property-badge">${labels[p.type]||"عقار"}</span><span class="property-ref">${p.reference}</span></div>
      <div class="property-body">
        <h3>${p.title}</h3>
        <div class="property-meta">${p.city||""}${p.district?" • "+p.district:""}</div>
        <p>${p.description||""}</p>
        <div class="property-specs">${p.area?`<span>${p.area} م²</span>`:""}${p.street?`<span>شارع ${p.street}</span>`:""}</div>
        <div class="property-price">${money(p.price)}</div>
        <div class="property-actions">
          <a class="primary" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("السلام عليكم، أرغب بالاستفسار عن "+p.reference+" - "+p.title)}">استفسار واتساب</a>
          ${p.map_url?`<a class="secondary" target="_blank" rel="noopener" href="${p.map_url}">الموقع</a>`:""}
        </div>
      </div>
    </article>`).join("") : `<div class="loading-card">لا توجد عروض منشورة في هذا القسم حاليًا.</div>`;
  document.querySelector("#statPublished").textContent = properties.length;
  document.querySelector("#statCities").textContent = new Set(properties.map(p=>p.city).filter(Boolean)).size || 1;
  const f = properties.find(p=>p.featured) || properties[0];
  if(f){
    document.querySelector("#featuredTitle").textContent=f.title;
    document.querySelector("#featuredMeta").textContent=`${f.reference} • ${money(f.price)}`;
    document.querySelector("#featuredLink").href="#offers";
  }
}
document.querySelectorAll("[data-filter]").forEach(el=>el.addEventListener("click",()=>{
  const f=el.dataset.filter;
  document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x.dataset.filter===f));
  render(f);
  document.querySelector("#offers")?.scrollIntoView({behavior:"smooth"});
}));

document.querySelector("#leadForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const status=document.querySelector("#leadStatus");
  const payload={name:leadName.value.trim(),phone:leadPhone.value.trim(),lead_type:leadType.value,message:leadMessage.value.trim(),source:"website"};
  if(!configured){
    status.textContent="النظام في وضع المعاينة. بعد ربط Supabase سيتم تسجيل الطلب تلقائيًا.";
    return;
  }
  const {error}=await supabase.from("leads").insert(payload);
  status.textContent=error?"تعذر إرسال الطلب الآن. تواصل معنا عبر واتساب.":"تم تسجيل طلبك بنجاح، وسنتواصل معك.";
  if(!error)e.target.reset();
});
loadProperties();
