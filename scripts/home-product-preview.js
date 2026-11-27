(() => {
  const buttons = [...document.querySelectorAll("[data-tool-select]")];
  const previews = [...document.querySelectorAll("[data-tool-preview]")];
  const select = (id) => {
    if (!buttons.some(b => b.dataset.toolSelect === id)) return;
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.toolSelect === id)));
    previews.forEach(p => { p.hidden = p.dataset.toolPreview !== id; });
  };
  if (buttons.length && previews.length) {
    buttons.forEach(b => { b.hidden = false; b.addEventListener("click", () => {
      select(b.dataset.toolSelect);
      if (matchMedia("(max-width:900px)").matches) document.getElementById(b.getAttribute("aria-controls"))?.scrollIntoView({block:"nearest"});
    }); });
    select("app");
    const syncHash = () => select(location.hash.slice(1));
    addEventListener("hashchange", syncHash); syncHash();
  }

  const grid = document.querySelector("[data-home-models]");
  if (!grid) return;
  const element = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const number = v => (typeof v === "number" || (typeof v === "string" && v.trim())) && Number.isFinite(Number(v)) && Number(v)>=0 ? Number(v) : null;
  const rate = (m, key, direct) => {
    const value = number(m[direct]);
    if (value !== null) return value;
    const token = number(m.pricing?.[key]);
    return token === null ? null : token * 1e6;
  };
  const format = v => v === null ? "Not listed" : "$" + v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:8}) + "/M";
  const preferred = ["deepseek-v4.1-flash-1017","claude-sonnet-5","beam-1.0-501b-a23b","glm-5.3","gemini-4-hydrogen","gpt-6.2-sol","mistral-medium-3.5","lightning"];
  const logo = m => {
    if (typeof m.logo === "string" && /^https:\/\//i.test(m.logo)) return m.logo;
    if (m.publisher_url === "inferenceport.ai") return "https://dpixehhdbtzsbckfektd.supabase.co/storage/v1/object/public/general/inferenceport-ai-logo.png";
    if (typeof m.publisher_url !== "string" || !m.publisher_url) return "";
    return "https://cdn.brandfetch.io/" + encodeURIComponent(m.publisher_url) + "?c=1idhv9JFxNDhJr50XTx" + (document.documentElement.dataset.theme==="dark"?"&theme=dark":"");
  };
  const showError = () => {
    const p=element("p","Published rates unavailable. ","lp-catalog-status");
    const a=element("a","Open the full catalog ↗"); a.href="marketplace.html"; p.append(a); grid.replaceChildren(p);
  };
  fetch("https://api.inferenceport.ai/v1/models").then(res => {
    if (!res.ok) throw Error("Catalog unavailable"); return res.json();
  }).then(data => {
    if (!Array.isArray(data?.data)) throw Error("Invalid catalog");
    const models = new Map();
    for (const m of data.data) {
      if (!m || typeof m.id!=="string" || m.is_ready===false || m.id.startsWith("agent/")) continue;
      const output=Array.isArray(m.output_modalities)?m.output_modalities:[];
      if (m.type ? String(m.type).toLowerCase()!=="text" : !output.includes("text")) continue;
      const input=rate(m,"prompt","input_pricing_per_million_tokens"), out=rate(m,"completion","output_pricing_per_million_tokens");
      if (input===null || out===null) continue;
      if (!models.has(m.id)) models.set(m.id,{m,input,out});
    }
    const selected=[], publishers=new Set();
    for (const id of [...preferred,...models.keys()]) {
      const item=models.get(id); if(!item || selected.some(x=>x.m.id===id)) continue;
      const publisher=item.m.publisher_url || id;
      if(publishers.has(publisher)) continue;
      publishers.add(publisher); selected.push(item);
      if(selected.length===8) break;
    }
    for (const item of models.values()) {
      if(selected.length>=8) break;
      if(!selected.some(x=>x.m.id===item.m.id)) selected.push(item);
    }
    if (!selected.length) return showError();
    const fragment=document.createDocumentFragment();
    for (const {m,input,out} of selected) {
      const a=element("a",undefined,"lp-catalog-model");
      a.href="marketplace.html#"+encodeURIComponent(m.id);
      const url=logo(m);
      if(url){ const img=element("img"); img.alt=""; img.loading="lazy"; img.src=url; img.addEventListener("error",()=>img.remove(),{once:true}); a.append(img); }
      a.append(element("strong",m.name||m.id),element("code",m.id));
      const rates=element("div",undefined,"lp-catalog-rates");
      rates.append(element("span","Input: "+format(input)),element("span","Output: "+format(out))); a.append(rates); fragment.append(a);
    }
    grid.replaceChildren(fragment);
  }).catch(showError);
})();
