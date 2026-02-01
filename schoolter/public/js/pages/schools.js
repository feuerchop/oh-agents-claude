/**
 * Schools page — the core browse/search/filter/analyze/compare view.
 * Migrated from the original vanilla app with SaaS plan gating.
 */
const SchoolsPage = (() => {
  const PAGE_SIZE = 24;
  let currentPage = 1;
  let filteredSchools = [];
  const COLORS = ["#1a56db","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d","#c026d3","#ea580c","#0d9488","#4338ca"];

  function render() {
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="page-container schools-page">
        <!-- Search & Filters -->
        <section class="search-section-inline">
          <div class="search-bar">
            <input type="text" id="searchInput" placeholder="Search schools by name, borough, or postcode..." autocomplete="off">
            <button id="clearSearch" class="btn-clear" title="Clear search" aria-label="Clear search">&times;</button>
          </div>
          <div class="filters">
            <div class="filter-group"><label for="filterBorough">Borough</label><select id="filterBorough"><option value="">All boroughs</option></select></div>
            <div class="filter-group"><label for="filterPhase">Phase</label><select id="filterPhase"><option value="">All phases</option></select></div>
            <div class="filter-group"><label for="filterGender">Gender</label><select id="filterGender"><option value="">All</option></select></div>
            <div class="filter-group"><label for="filterOfsted">Ofsted</label><select id="filterOfsted"><option value="">All ratings</option></select></div>
            <div class="filter-group"><label for="filterReligion">Faith</label><select id="filterReligion"><option value="">All</option></select></div>
            <div class="filter-group"><label for="filterFunding">Funding</label><select id="filterFunding"><option value="">All types</option></select></div>
            <div class="filter-group"><label for="filterSixthForm">Sixth Form</label>
              <select id="filterSixthForm"><option value="">All</option><option value="yes">Has sixth form</option><option value="no">No sixth form</option></select>
            </div>
            <div class="filter-group"><label for="sortBy">Sort by</label>
              <select id="sortBy"><option value="name">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option><option value="pupils-desc">Pupils (high-low)</option><option value="pupils-asc">Pupils (low-high)</option><option value="borough">Borough</option></select>
            </div>
          </div>
        </section>

        <!-- Tabs -->
        <nav class="tabs" role="tablist">
          <button class="tab active" data-tab="list" role="tab" aria-selected="true">School List</button>
          <button class="tab" data-tab="analytics" role="tab" aria-selected="false">Analytics</button>
          <button class="tab" data-tab="compare" role="tab" aria-selected="false">Compare</button>
        </nav>

        <p id="resultCount" class="result-count"></p>

        <!-- List Panel -->
        <div id="panel-list" class="tab-panel active">
          <div id="schoolList" class="school-grid"></div>
          <div id="pagination" class="pagination"></div>
        </div>

        <!-- Analytics Panel -->
        <div id="panel-analytics" class="tab-panel">
          <div id="analyticsGate"></div>
        </div>

        <!-- Compare Panel -->
        <div id="panel-compare" class="tab-panel">
          <div id="compareGate"></div>
        </div>
      </div>
    `;

    populateFilters();
    bindEvents();
    applyFilters();
  }

  function populateFilters() {
    const fields = {
      filterBorough: "borough", filterPhase: "phase", filterGender: "gender",
      filterOfsted: "ofstedRating", filterReligion: "religiousCharacter", filterFunding: "fundingType",
    };
    for (const [id, key] of Object.entries(fields)) {
      const sel = document.getElementById(id);
      [...new Set(LONDON_SCHOOLS.map(s => s[key]))].sort().forEach(v => {
        const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
      });
    }
  }

  function bindEvents() {
    const si = document.getElementById("searchInput");
    const cb = document.getElementById("clearSearch");
    si.addEventListener("input", () => { cb.classList.toggle("visible", si.value.length > 0); currentPage = 1; applyFilters(); });
    cb.addEventListener("click", () => { si.value = ""; cb.classList.remove("visible"); currentPage = 1; applyFilters(); });
    document.querySelectorAll(".schools-page .filters select").forEach(s => s.addEventListener("change", () => { currentPage = 1; applyFilters(); }));

    document.querySelectorAll(".schools-page .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".schools-page .tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected","false"); });
        document.querySelectorAll(".schools-page .tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active"); tab.setAttribute("aria-selected","true");
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
        if (tab.dataset.tab === "analytics") renderAnalyticsPanel();
        if (tab.dataset.tab === "compare") renderComparePanel();
      });
    });
  }

  function applyFilters() {
    const q = document.getElementById("searchInput").value.toLowerCase().trim();
    const f = {
      borough: document.getElementById("filterBorough").value,
      phase: document.getElementById("filterPhase").value,
      gender: document.getElementById("filterGender").value,
      ofsted: document.getElementById("filterOfsted").value,
      religion: document.getElementById("filterReligion").value,
      funding: document.getElementById("filterFunding").value,
      sixth: document.getElementById("filterSixthForm").value,
    };
    const sort = document.getElementById("sortBy").value;

    filteredSchools = LONDON_SCHOOLS.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.borough.toLowerCase().includes(q) && !s.postcode.toLowerCase().includes(q)) return false;
      if (f.borough && s.borough !== f.borough) return false;
      if (f.phase && s.phase !== f.phase) return false;
      if (f.gender && s.gender !== f.gender) return false;
      if (f.ofsted && s.ofstedRating !== f.ofsted) return false;
      if (f.religion && s.religiousCharacter !== f.religion) return false;
      if (f.funding && s.fundingType !== f.funding) return false;
      if (f.sixth === "yes" && !s.hassixthForm) return false;
      if (f.sixth === "no" && s.hassixthForm) return false;
      return true;
    });

    filteredSchools.sort((a,b) => {
      switch(sort){
        case "name": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "pupils-desc": return b.pupils - a.pupils;
        case "pupils-asc": return a.pupils - b.pupils;
        case "borough": return a.borough.localeCompare(b.borough) || a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    document.getElementById("resultCount").textContent = `${filteredSchools.length} school${filteredSchools.length !== 1 ? "s" : ""} found`;
    renderList();
    renderPagination();
  }

  function renderList() {
    const c = document.getElementById("schoolList");
    const start = (currentPage-1)*PAGE_SIZE;
    const page = filteredSchools.slice(start, start+PAGE_SIZE);
    if(!page.length){ c.innerHTML='<p class="empty-state">No schools match your criteria.</p>'; return; }
    c.innerHTML = page.map(s=>`
      <div class="school-card" data-id="${s.id}">
        <div class="card-header"><span class="school-name">${esc(s.name)}</span><span class="ofsted-badge ofsted-${s.ofstedRating.toLowerCase().replace(/\s+/g,"-")}">${esc(s.ofstedRating)}</span></div>
        <div class="card-meta"><span class="badge">${esc(s.phase)}</span><span class="badge">${esc(s.gender)}</span>${s.religiousCharacter!=="None"?`<span class="badge">${esc(s.religiousCharacter)}</span>`:""}<span class="badge">${esc(s.fundingType)}</span></div>
        <div class="card-details"><span>${esc(s.borough)} &middot; ${esc(s.postcode)}</span><span>${s.pupils.toLocaleString()} pupils &middot; Ages ${esc(s.ageRange)}</span></div>
      </div>`).join("");
    c.querySelectorAll(".school-card").forEach(card => card.addEventListener("click", ()=> openSchoolModal(Number(card.dataset.id))));
  }

  function renderPagination() {
    const c = document.getElementById("pagination");
    const tp = Math.ceil(filteredSchools.length/PAGE_SIZE);
    if(tp<=1){c.innerHTML="";return;}
    let h=`<button ${currentPage===1?"disabled":""} data-p="${currentPage-1}">&laquo;</button>`;
    const pgs = tp<=7?Array.from({length:tp},(_,i)=>i+1):currentPage<=3?[1,2,3,4,"...",tp]:currentPage>=tp-2?[1,"...",tp-3,tp-2,tp-1,tp]:[1,"...",currentPage-1,currentPage,currentPage+1,"...",tp];
    pgs.forEach(p=>{h+=p==="..."?`<button disabled>...</button>`:`<button class="${p===currentPage?"active":""}" data-p="${p}">${p}</button>`;});
    h+=`<button ${currentPage===tp?"disabled":""} data-p="${currentPage+1}">&raquo;</button>`;
    c.innerHTML=h;
    c.querySelectorAll("button[data-p]").forEach(b=>b.addEventListener("click",()=>{currentPage=Number(b.dataset.p);renderList();renderPagination();}));
  }

  function openSchoolModal(id) {
    const s = LONDON_SCHOOLS.find(x=>x.id===id);
    if(!s) return;
    document.getElementById("modalBody").innerHTML=`
      <div class="detail-header"><h2>${esc(s.name)}</h2><div class="detail-borough">${esc(s.borough)}</div></div>
      <div class="detail-grid">
        <div class="detail-item"><label>Phase</label><span>${esc(s.phase)}</span></div>
        <div class="detail-item"><label>Type</label><span>${esc(s.type)}</span></div>
        <div class="detail-item"><label>Gender</label><span>${esc(s.gender)}</span></div>
        <div class="detail-item"><label>Age Range</label><span>${esc(s.ageRange)}</span></div>
        <div class="detail-item"><label>Pupils</label><span>${s.pupils.toLocaleString()}</span></div>
        <div class="detail-item"><label>Ofsted</label><span class="ofsted-badge ofsted-${s.ofstedRating.toLowerCase().replace(/\s+/g,"-")}">${esc(s.ofstedRating)}</span></div>
        <div class="detail-item"><label>Faith</label><span>${esc(s.religiousCharacter)}</span></div>
        <div class="detail-item"><label>Funding</label><span>${esc(s.fundingType)}</span></div>
        <div class="detail-item"><label>Sixth Form</label><span>${s.hassixthForm?"Yes":"No"}</span></div>
        <div class="detail-item"><label>Postcode</label><span>${esc(s.postcode)}</span></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Address</label><span>${esc(s.address)}</span></div>
      </div>`;
    const m = document.getElementById("schoolModal");
    m.classList.add("open"); m.setAttribute("aria-hidden","false");
  }

  // ── Analytics (plan-gated) ───────────────────────────────
  function renderAnalyticsPanel() {
    const gate = document.getElementById("analyticsGate");
    const user = API.getUser();
    if (user && user.plan === "free") {
      gate.innerHTML = `<div class="upgrade-gate"><h3>Advanced Analytics</h3><p>Upgrade to Pro or Enterprise to access borough breakdowns, Ofsted distribution charts, and more.</p><a href="/billing" data-link class="btn btn-primary">Upgrade Now</a></div>`;
      return;
    }
    gate.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card"><h3>Schools by Borough</h3><div id="chartBorough" class="bar-chart"></div></div>
        <div class="analytics-card"><h3>Schools by Phase</h3><div id="chartPhase" class="pie-chart-container"></div></div>
        <div class="analytics-card"><h3>Ofsted Ratings</h3><div id="chartOfsted" class="bar-chart"></div></div>
        <div class="analytics-card"><h3>Gender Distribution</h3><div id="chartGender" class="pie-chart-container"></div></div>
        <div class="analytics-card"><h3>Funding Types</h3><div id="chartFunding" class="bar-chart"></div></div>
        <div class="analytics-card"><h3>Key Statistics</h3><div id="statsPanel" class="stats-panel"></div></div>
      </div>`;
    renderBarChart("chartBorough", countBy(filteredSchools,"borough"), COLORS[0]);
    renderDonut("chartPhase", countBy(filteredSchools,"phase"));
    renderBarChart("chartOfsted", countBy(filteredSchools,"ofstedRating"), COLORS[1]);
    renderDonut("chartGender", countBy(filteredSchools,"gender"));
    renderBarChart("chartFunding", countBy(filteredSchools,"fundingType"), COLORS[4]);
    renderStats();
  }

  function countBy(arr,key){const m={};arr.forEach(i=>{m[i[key]]=(m[i[key]]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}

  function renderBarChart(id,entries,color){
    const el=document.getElementById(id);if(!entries.length){el.innerHTML="<p>No data</p>";return;}
    const max=entries[0][1];
    el.innerHTML=entries.map(([l,c])=>{const p=Math.max((c/max)*100,2);const inside=p>15;
      return`<div class="bar-row"><span class="bar-label" title="${esc(l)}">${esc(l)}</span><div class="bar-track"><div class="bar-fill" style="width:${p}%;background:${color}">${inside?`<span class="bar-value">${c}</span>`:""}</div></div>${!inside?`<span class="bar-value-outside">${c}</span>`:""}</div>`;}).join("");
  }

  function renderDonut(id,entries){
    const el=document.getElementById(id);if(!entries.length){el.innerHTML="<p>No data</p>";return;}
    const total=entries.reduce((s,e)=>s+e[1],0);let cum=0;const parts=[],legend=[];
    entries.forEach(([l,c],i)=>{const col=COLORS[i%COLORS.length];const d=(c/total)*360;parts.push(`${col} ${cum}deg ${cum+d}deg`);cum+=d;legend.push(`<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:${col}"></span>${esc(l)}: ${c} (${((c/total)*100).toFixed(1)}%)</div>`);});
    el.innerHTML=`<div class="donut-chart" style="background:conic-gradient(${parts.join(",")})"><div class="donut-center">${total}</div></div><div class="pie-legend">${legend.join("")}</div>`;
  }

  function renderStats(){
    const d=filteredSchools,el=document.getElementById("statsPanel");
    const tp=d.reduce((s,x)=>s+x.pupils,0),avg=d.length?Math.round(tp/d.length):0,bor=new Set(d.map(s=>s.borough)).size,ws=d.filter(s=>s.hassixthForm).length,os=d.filter(s=>s.ofstedRating==="Outstanding").length;
    el.innerHTML=`<div class="stat-item"><div class="stat-value">${d.length}</div><div class="stat-label">Schools</div></div><div class="stat-item"><div class="stat-value">${tp.toLocaleString()}</div><div class="stat-label">Pupils</div></div><div class="stat-item"><div class="stat-value">${avg.toLocaleString()}</div><div class="stat-label">Avg Pupils</div></div><div class="stat-item"><div class="stat-value">${bor}</div><div class="stat-label">Boroughs</div></div><div class="stat-item"><div class="stat-value">${ws}</div><div class="stat-label">Sixth Form</div></div><div class="stat-item"><div class="stat-value">${os}</div><div class="stat-label">Outstanding</div></div>`;
  }

  // ── Compare (plan-gated) ─────────────────────────────────
  function renderComparePanel() {
    const gate = document.getElementById("compareGate");
    const user = API.getUser();
    if (user && user.plan === "free") {
      gate.innerHTML = `<div class="upgrade-gate"><h3>School Comparison</h3><p>Upgrade to Pro or Enterprise to compare any two schools side by side.</p><a href="/billing" data-link class="btn btn-primary">Upgrade Now</a></div>`;
      return;
    }
    const sorted = [...LONDON_SCHOOLS].sort((a,b)=>a.name.localeCompare(b.name));
    const opts = sorted.map(s=>`<option value="${s.id}">${esc(s.name)} (${esc(s.borough)})</option>`).join("");
    gate.innerHTML = `
      <div class="compare-controls">
        <div class="compare-select-group"><label for="cmpS1">School 1</label><select id="cmpS1"><option value="">Select...</option>${opts}</select></div>
        <div class="compare-select-group"><label for="cmpS2">School 2</label><select id="cmpS2"><option value="">Select...</option>${opts}</select></div>
      </div>
      <div id="compareResult" class="compare-result"><p class="text-muted">Select two schools to compare.</p></div>`;
    document.getElementById("cmpS1").addEventListener("change", doCompare);
    document.getElementById("cmpS2").addEventListener("change", doCompare);
  }

  function doCompare() {
    const id1=Number(document.getElementById("cmpS1").value), id2=Number(document.getElementById("cmpS2").value);
    const c=document.getElementById("compareResult");
    if(!id1||!id2){c.innerHTML='<p class="text-muted">Select two schools to compare.</p>';return;}
    const s1=LONDON_SCHOOLS.find(s=>s.id===id1), s2=LONDON_SCHOOLS.find(s=>s.id===id2);
    if(!s1||!s2) return;
    const rows=[["Borough",s1.borough,s2.borough],["Phase",s1.phase,s2.phase],["Gender",s1.gender,s2.gender],["Age Range",s1.ageRange,s2.ageRange],["Pupils",s1.pupils.toLocaleString(),s2.pupils.toLocaleString()],["Ofsted",s1.ofstedRating,s2.ofstedRating],["Faith",s1.religiousCharacter,s2.religiousCharacter],["Funding",s1.fundingType,s2.fundingType],["Sixth Form",s1.hassixthForm?"Yes":"No",s2.hassixthForm?"Yes":"No"],["Address",s1.address,s2.address]];
    c.innerHTML=`<table><thead><tr><th></th><td><strong>${esc(s1.name)}</strong></td><td><strong>${esc(s2.name)}</strong></td></tr></thead><tbody>${rows.map(([l,v1,v2])=>{const d=v1!==v2;return`<tr><th>${l}</th><td${d?' class="highlight"':""}>${esc(String(v1))}</td><td${d?' class="highlight"':""}>${esc(String(v2))}</td></tr>`;}).join("")}</tbody></table>`;
  }

  function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}

  return { render };
})();
