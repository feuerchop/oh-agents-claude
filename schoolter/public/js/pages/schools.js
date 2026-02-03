/**
 * Schools page — browse/search/filter/analyze/compare with locrating-style features.
 * Includes league tables, detailed Ofsted/performance/admissions data in school modal.
 */
const SchoolsPage = (() => {
  const PAGE_SIZE = 24;
  let currentPage = 1;
  let filteredSchools = [];
  let regionFilter = "all"; // "all", "london", "kent"
  const COLORS = ["#4f46e5","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d","#c026d3","#ea580c","#0d9488","#4338ca"];

  const KENT_DISTRICTS = ["Kent", "Canterbury", "Maidstone", "Ashford", "Dover", "Folkestone and Hythe", "Thanet", "Swale", "Dartford", "Gravesham", "Sevenoaks", "Tonbridge and Malling", "Tunbridge Wells", "Medway"];

  function isKentSchool(school) {
    return school.region === "Kent" || KENT_DISTRICTS.some(d => (school.borough || "").toLowerCase().includes(d.toLowerCase()));
  }

  function getRegionCounts() {
    let london = 0, kent = 0;
    LONDON_SCHOOLS.forEach(s => {
      if (isKentSchool(s)) kent++;
      else london++;
    });
    return { london, kent, total: london + kent };
  }

  function render() {
    const counts = getRegionCounts();
    const el = document.getElementById("pageContent");
    el.innerHTML = `
      <div class="page-container schools-page">
        <!-- Hero Section -->
        <section class="hero-section">
          <div class="hero-content">
            <h1 class="hero-title">Explore Schools in<br>Greater London & Kent</h1>
            <p class="hero-subtitle">Discover and compare ${counts.total} schools across Greater London and Kent. Access Ofsted ratings, exam results, admissions data, and more.</p>
            <div class="hero-stats">
              <div class="hero-stat"><div class="hero-stat-value">${counts.total}</div><div class="hero-stat-label">Total Schools</div></div>
              <div class="hero-stat"><div class="hero-stat-value">${counts.london}</div><div class="hero-stat-label">London</div></div>
              <div class="hero-stat"><div class="hero-stat-value">${counts.kent}</div><div class="hero-stat-label">Kent</div></div>
            </div>
          </div>
        </section>

        <!-- Region Filter Chips -->
        <div class="region-filters">
          <button class="region-chip active" data-region="all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            All Regions <span class="chip-count">${counts.total}</span>
          </button>
          <button class="region-chip" data-region="london">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
            Greater London <span class="chip-count">${counts.london}</span>
          </button>
          <button class="region-chip" data-region="kent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
            Kent <span class="chip-count">${counts.kent}</span>
          </button>
        </div>

        <section class="search-section-inline">
          <div class="search-bar">
            <input type="text" id="searchInput" placeholder="Search schools by name, borough, or postcode..." autocomplete="off">
            <button id="clearSearch" class="btn-clear" title="Clear search" aria-label="Clear search">&times;</button>
          </div>
          <div class="filters">
            <div class="filter-group"><label for="filterBorough">Borough/District</label><select id="filterBorough"><option value="">All areas</option></select></div>
            <div class="filter-group"><label for="filterPhase">Phase</label><select id="filterPhase"><option value="">All phases</option></select></div>
            <div class="filter-group"><label for="filterGender">Gender</label><select id="filterGender"><option value="">All</option></select></div>
            <div class="filter-group"><label for="filterOfsted">Ofsted</label><select id="filterOfsted"><option value="">All ratings</option></select></div>
            <div class="filter-group"><label for="filterReligion">Faith</label><select id="filterReligion"><option value="">All</option></select></div>
            <div class="filter-group"><label for="filterFunding">Funding</label><select id="filterFunding"><option value="">All types</option></select></div>
            <div class="filter-group"><label for="filterSector">Sector</label><select id="filterSector"><option value="">All sectors</option><option value="State">State</option><option value="Private">Private</option></select></div>
            <div class="filter-group"><label for="filterSixthForm">Sixth Form</label>
              <select id="filterSixthForm"><option value="">All</option><option value="yes">Has sixth form</option><option value="no">No sixth form</option></select>
            </div>
            <div class="filter-group"><label for="sortBy">Sort by</label>
              <select id="sortBy">
                <option value="name">Name (A-Z)</option><option value="name-desc">Name (Z-A)</option>
                <option value="pupils-desc">Pupils (high-low)</option><option value="pupils-asc">Pupils (low-high)</option>
                <option value="borough">Borough</option>
                <option value="ofsted">Ofsted Rating</option>
                <option value="attainment8-desc">Attainment 8 (high)</option>
                <option value="progress8-desc">Progress 8 (high)</option>
                <option value="ks2-desc">KS2 Combined (high)</option>
              </select>
            </div>
          </div>
        </section>

        <nav class="tabs" role="tablist">
          <button class="tab active" data-tab="list" role="tab" aria-selected="true">School List</button>
          <button class="tab" data-tab="league" role="tab" aria-selected="false">League Table</button>
          <button class="tab" data-tab="analytics" role="tab" aria-selected="false">Analytics</button>
          <button class="tab" data-tab="compare" role="tab" aria-selected="false">Compare</button>
        </nav>

        <p id="resultCount" class="result-count"></p>

        <div id="panel-list" class="tab-panel active">
          <div id="schoolList" class="school-grid"></div>
          <div id="pagination" class="pagination"></div>
        </div>

        <div id="panel-league" class="tab-panel">
          <div id="leagueContent"></div>
        </div>

        <div id="panel-analytics" class="tab-panel">
          <div id="analyticsGate"></div>
        </div>

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
      filterOfsted: "ofstedRating", filterReligion: "religiousCharacter", filterFunding: "fundingType", filterSector: "sector",
    };
    for (const [id, key] of Object.entries(fields)) {
      const sel = document.getElementById(id);
      const values = [...new Set(LONDON_SCHOOLS.map(s => key === "ofstedRating" ? getOfstedRating(s) : s[key]))].filter(Boolean).sort();
      values.forEach(v => {
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

    // Region filter chips
    document.querySelectorAll(".region-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".region-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        regionFilter = chip.dataset.region;
        currentPage = 1;
        applyFilters();
      });
    });

    document.querySelectorAll(".schools-page .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".schools-page .tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected","false"); });
        document.querySelectorAll(".schools-page .tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active"); tab.setAttribute("aria-selected","true");
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
        if (tab.dataset.tab === "league") renderLeagueTable();
        if (tab.dataset.tab === "analytics") renderAnalyticsPanel();
        if (tab.dataset.tab === "compare") renderComparePanel();
      });
    });
  }

  function getOfstedRating(s) { return s.ofsted?.rating || s.ofstedRating || "N/A"; }
  function getA8(s) { return s.performance?.ks4?.attainment8 ?? null; }
  function getP8(s) { return s.performance?.ks4?.progress8 ?? null; }
  function getKS2(s) { return s.performance?.ks2?.combinedExpected ?? null; }

  function applyFilters() {
    const q = document.getElementById("searchInput").value.toLowerCase().trim();
    const f = {
      borough: document.getElementById("filterBorough").value,
      phase: document.getElementById("filterPhase").value,
      gender: document.getElementById("filterGender").value,
      ofsted: document.getElementById("filterOfsted").value,
      religion: document.getElementById("filterReligion").value,
      funding: document.getElementById("filterFunding").value,
      sector: document.getElementById("filterSector").value,
      sixth: document.getElementById("filterSixthForm").value,
    };
    const sort = document.getElementById("sortBy").value;

    filteredSchools = LONDON_SCHOOLS.filter(s => {
      // Region filter
      if (regionFilter === "london" && isKentSchool(s)) return false;
      if (regionFilter === "kent" && !isKentSchool(s)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.borough.toLowerCase().includes(q) && !(s.postcode||"").toLowerCase().includes(q)) return false;
      if (f.borough && s.borough !== f.borough) return false;
      if (f.phase && s.phase !== f.phase) return false;
      if (f.gender && s.gender !== f.gender) return false;
      if (f.ofsted && getOfstedRating(s) !== f.ofsted) return false;
      if (f.religion && s.religiousCharacter !== f.religion) return false;
      if (f.funding && s.fundingType !== f.funding) return false;
      if (f.sector && s.sector !== f.sector) return false;
      if (f.sixth === "yes" && !s.hasSixthForm) return false;
      if (f.sixth === "no" && s.hasSixthForm) return false;
      return true;
    });

    filteredSchools.sort((a,b) => {
      switch(sort){
        case "name": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "pupils-desc": return b.pupils - a.pupils;
        case "pupils-asc": return a.pupils - b.pupils;
        case "borough": return a.borough.localeCompare(b.borough) || a.name.localeCompare(b.name);
        case "ofsted": return ofstedRank(a) - ofstedRank(b) || a.name.localeCompare(b.name);
        case "attainment8-desc": return (getA8(b)||0) - (getA8(a)||0);
        case "progress8-desc": return (getP8(b)||0) - (getP8(a)||0);
        case "ks2-desc": return (getKS2(b)||0) - (getKS2(a)||0);
        default: return 0;
      }
    });

    document.getElementById("resultCount").textContent = `${filteredSchools.length} school${filteredSchools.length !== 1 ? "s" : ""} found`;
    renderList();
    renderPagination();
  }

  function ofstedRank(s) {
    const r = getOfstedRating(s);
    return { Outstanding: 1, Good: 2, "Requires Improvement": 3, Inadequate: 4 }[r] || 5;
  }

  // ── List View ─────────────────────────────────────────
  function getPhaseIcon(phase) {
    const icons = {
      Primary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9l8-5 8 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 19v-6h6v6"/></svg>`,
      Secondary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
      Nursery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/></svg>`,
      Special: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
      "All-Through": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v8M8 12h8"/></svg>`,
      default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`
    };
    return icons[phase] || icons.default;
  }

  function renderList() {
    const c = document.getElementById("schoolList");
    const start = (currentPage-1)*PAGE_SIZE;
    const page = filteredSchools.slice(start, start+PAGE_SIZE);
    if(!page.length){ c.innerHTML='<p class="empty-state">No schools match your criteria.</p>'; return; }
    c.innerHTML = page.map(s => {
      const rating = getOfstedRating(s);
      const a8 = getA8(s);
      const ks2 = getKS2(s);
      const oversubscribed = s.admissions?.oversubscribed;
      const isKent = isKentSchool(s);
      const phaseClass = s.phase.toLowerCase().replace(/[^a-z]/g, "-") + "-phase";
      return `
      <div class="school-card hover-lift" data-id="${s.id}">
        <div class="school-card-image">
          <span class="region-badge ${isKent ? 'kent' : 'london'}">${isKent ? 'Kent' : 'London'}</span>
          <span class="sector-indicator ${(s.sector||'state').toLowerCase()}">${esc(s.sector||'State')}</span>
          <div class="school-card-icon ${phaseClass}">${getPhaseIcon(s.phase)}</div>
        </div>
        <div class="card-header">
          <span class="school-name">${esc(s.name)}</span>
          <span class="ofsted-badge ofsted-${rating.toLowerCase().replace(/\s+/g,"-")}">${esc(rating)}</span>
        </div>
        <div class="card-meta">
          <span class="badge ${s.phase==='Nursery'?'badge-nursery':''}">${esc(s.phase)}</span>
          <span class="badge">${esc(s.gender)}</span>
          ${s.religiousCharacter!=="None"?`<span class="badge">${esc(s.religiousCharacter)}</span>`:""}
          ${oversubscribed?`<span class="admissions-indicator oversubscribed">Oversubscribed</span>`:""}
        </div>
        <div class="card-details">
          <span>${esc(s.borough)} &middot; ${esc(s.postcode)}</span>
          <span>${s.pupils.toLocaleString()} pupils &middot; Ages ${esc(s.ageRange)}</span>
        </div>
        ${(a8 !== null || ks2 !== null) ? `<div class="card-metrics">
          ${a8 !== null ? `<div class="card-metric"><span class="card-metric-val">${a8}</span><span class="card-metric-lbl">Att. 8</span></div>` : ""}
          ${getP8(s) !== null ? `<div class="card-metric"><span class="card-metric-val">${getP8(s)>0?"+":""}${getP8(s)}</span><span class="card-metric-lbl">Prog. 8</span></div>` : ""}
          ${ks2 !== null ? `<div class="card-metric"><span class="card-metric-val">${ks2}%</span><span class="card-metric-lbl">KS2</span></div>` : ""}
        </div>` : ""}
      </div>`;
    }).join("");
    c.querySelectorAll(".school-card").forEach(card => card.addEventListener("click", ()=> openSchoolModal(Number(card.dataset.id))));
  }

  // ── Pagination ────────────────────────────────────────
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

  // ── League Table ──────────────────────────────────────
  function renderLeagueTable() {
    const el = document.getElementById("leagueContent");
    const hasSecondary = filteredSchools.some(s => (s.phase === "Secondary" || s.phase === "All-Through") && getA8(s) !== null);
    const hasPrimary = filteredSchools.some(s => s.phase === "Primary" && getKS2(s) !== null);

    let html = `<div style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="btn btn-sm ${hasSecondary?'btn-primary':'btn-outline'}" id="leagueSecondary">Secondary (GCSE)</button>
      <button class="btn btn-sm ${!hasSecondary&&hasPrimary?'btn-primary':'btn-outline'}" id="leaguePrimary">Primary (KS2)</button>
    </div><div id="leagueTableWrap"></div>`;
    el.innerHTML = html;

    const wrap = document.getElementById("leagueTableWrap");
    if (hasSecondary) {
      const sec = filteredSchools.filter(s => (s.phase==="Secondary"||s.phase==="All-Through") && getA8(s) !== null)
        .sort((a,b) => (getA8(b)||0) - (getA8(a)||0));
      wrap.innerHTML = renderLeagueHTML(sec, "secondary");
    } else if (hasPrimary) {
      const pri = filteredSchools.filter(s => s.phase==="Primary" && getKS2(s) !== null)
        .sort((a,b) => (getKS2(b)||0) - (getKS2(a)||0));
      wrap.innerHTML = renderLeagueHTML(pri, "primary");
    } else {
      wrap.innerHTML = '<p class="empty-state">No performance data available for current filter.</p>';
    }

    document.getElementById("leagueSecondary")?.addEventListener("click", () => {
      const sec = filteredSchools.filter(s => (s.phase==="Secondary"||s.phase==="All-Through") && getA8(s) !== null)
        .sort((a,b) => (getA8(b)||0) - (getA8(a)||0));
      wrap.innerHTML = renderLeagueHTML(sec, "secondary");
      document.getElementById("leagueSecondary").className = "btn btn-sm btn-primary";
      document.getElementById("leaguePrimary").className = "btn btn-sm btn-outline";
      bindLeagueClicks();
    });
    document.getElementById("leaguePrimary")?.addEventListener("click", () => {
      const pri = filteredSchools.filter(s => s.phase==="Primary" && getKS2(s) !== null)
        .sort((a,b) => (getKS2(b)||0) - (getKS2(a)||0));
      wrap.innerHTML = renderLeagueHTML(pri, "primary");
      document.getElementById("leaguePrimary").className = "btn btn-sm btn-primary";
      document.getElementById("leagueSecondary").className = "btn btn-sm btn-outline";
      bindLeagueClicks();
    });
    bindLeagueClicks();
  }

  function renderLeagueHTML(schools, type) {
    if (!schools.length) return '<p class="empty-state">No schools with performance data in current filter.</p>';
    if (type === "secondary") {
      return `<div class="league-table-wrapper"><table class="league-table"><thead><tr>
        <th class="rank-col">#</th><th>School</th><th>Borough</th><th>Ofsted</th>
        <th class="score-col">Att. 8</th><th class="score-col">Prog. 8</th><th class="score-col">5+ En/Ma</th><th>EBacc</th>
      </tr></thead><tbody>
      ${schools.map((s,i) => {
        const p8 = getP8(s);
        return `<tr data-id="${s.id}"><td class="rank-col">${i+1}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.borough)}</td>
          <td><span class="ofsted-badge ofsted-${getOfstedRating(s).toLowerCase().replace(/\s+/g,"-")}">${getOfstedRating(s)}</span></td>
          <td class="score-col">${getA8(s)}</td>
          <td class="score-col ${p8>0?'trend-up':p8<0?'trend-down':''}">${p8>0?"+":""}${p8}</td>
          <td class="score-col">${s.performance?.ks4?.grade5EnMa??"-"}%</td>
          <td>${s.performance?.ks4?.ebacc_entry??"-"}%</td></tr>`;
      }).join("")}</tbody></table></div>`;
    } else {
      return `<div class="league-table-wrapper"><table class="league-table"><thead><tr>
        <th class="rank-col">#</th><th>School</th><th>Borough</th><th>Ofsted</th>
        <th class="score-col">Reading</th><th class="score-col">Maths</th><th class="score-col">Writing</th><th class="score-col">Combined</th>
      </tr></thead><tbody>
      ${schools.map((s,i) => `<tr data-id="${s.id}"><td class="rank-col">${i+1}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.borough)}</td>
        <td><span class="ofsted-badge ofsted-${getOfstedRating(s).toLowerCase().replace(/\s+/g,"-")}">${getOfstedRating(s)}</span></td>
        <td class="score-col">${s.performance?.ks2?.readingExpected??"-"}%</td>
        <td class="score-col">${s.performance?.ks2?.mathsExpected??"-"}%</td>
        <td class="score-col">${s.performance?.ks2?.writingExpected??"-"}%</td>
        <td class="score-col">${getKS2(s)??"-"}%</td></tr>`
      ).join("")}</tbody></table></div>`;
    }
  }

  function bindLeagueClicks() {
    document.querySelectorAll(".league-table tbody tr[data-id]").forEach(row => {
      row.addEventListener("click", () => openSchoolModal(Number(row.dataset.id)));
    });
  }

  // ── Enhanced School Modal ─────────────────────────────
  function openSchoolModal(id) {
    const s = LONDON_SCHOOLS.find(x=>x.id===id);
    if(!s) return;
    const tabs = [{ id: "overview", label: "Overview" }];
    if (s.ofsted && s.ofsted.date) tabs.push({ id: "ofsted", label: "Ofsted" });
    if (s.performance && (s.performance.ks2 || s.performance.ks4 || s.performance.ks5)) tabs.push({ id: "results", label: "Results" });
    if (s.admissions) tabs.push({ id: "admissions", label: "Admissions" });
    if (s.demographics) tabs.push({ id: "demographics", label: "Demographics" });
    if (s.finances || s.contact) tabs.push({ id: "info", label: "Info" });

    document.getElementById("modalBody").innerHTML = `
      <div class="detail-header">
        <h2>${esc(s.name)}</h2>
        <div class="detail-borough">${esc(s.borough)} &middot; ${esc(s.postcode)}</div>
      </div>
      <div class="detail-tabs">
        ${tabs.map((t,i) => `<button class="detail-tab ${i===0?'active':''}" data-dtab="${t.id}">${t.label}</button>`).join("")}
      </div>
      <div id="modalTabContent"></div>
    `;

    renderModalTab(s, tabs[0].id);
    document.querySelectorAll(".detail-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderModalTab(s, tab.dataset.dtab);
      });
    });

    const m = document.getElementById("schoolModal");
    m.classList.add("open"); m.setAttribute("aria-hidden","false");
  }

  function renderModalTab(s, tabId) {
    const container = document.getElementById("modalTabContent");
    switch (tabId) {
      case "overview": container.innerHTML = renderOverviewTab(s); break;
      case "ofsted": container.innerHTML = renderOfstedTab(s); break;
      case "results": container.innerHTML = renderResultsTab(s); break;
      case "admissions": container.innerHTML = renderAdmissionsTab(s); break;
      case "demographics": container.innerHTML = renderDemographicsTab(s); break;
      case "info": container.innerHTML = renderInfoTab(s); break;
    }
  }

  function renderOverviewTab(s) {
    const rating = getOfstedRating(s);
    const a8 = getA8(s), p8 = getP8(s), ks2 = getKS2(s);
    return `
      <div class="detail-grid">
        <div class="detail-item"><label>Sector</label><span class="badge badge-${(s.sector||'State').toLowerCase()}">${esc(s.sector||'State')}</span></div>
        <div class="detail-item"><label>Phase</label><span>${esc(s.phase)}</span></div>
        <div class="detail-item"><label>Type</label><span>${esc(s.type)}</span></div>
        <div class="detail-item"><label>Gender</label><span>${esc(s.gender)}</span></div>
        <div class="detail-item"><label>Age Range</label><span>${esc(s.ageRange)}</span></div>
        <div class="detail-item"><label>Pupils</label><span>${s.pupils.toLocaleString()}</span></div>
        <div class="detail-item"><label>Ofsted</label><span class="ofsted-badge ofsted-${rating.toLowerCase().replace(/\s+/g,"-")}">${esc(rating)}</span></div>
        <div class="detail-item"><label>Faith</label><span>${esc(s.religiousCharacter)}</span></div>
        <div class="detail-item"><label>Funding</label><span>${esc(s.fundingType)}</span></div>
        <div class="detail-item"><label>Sixth Form</label><span>${s.hasSixthForm?"Yes":"No"}</span></div>
        ${s.website?`<div class="detail-item" style="grid-column:1/-1"><label>Website</label><a href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website)}</a></div>`:""}
        <div class="detail-item" style="grid-column:1/-1"><label>Address</label><span>${esc(s.address)}</span></div>
      </div>
      ${(a8!==null||ks2!==null)?`<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Key Metrics</h4>
      <div class="metric-grid">
        ${a8!==null?`<div class="metric-card"><div class="metric-value ${a8>=50?'good':a8>=40?'avg':'low'}">${a8}</div><div class="metric-label">Attainment 8</div></div>`:""}
        ${p8!==null?`<div class="metric-card"><div class="metric-value ${p8>0?'good':p8>-0.5?'avg':'low'}">${p8>0?"+":""}${p8}</div><div class="metric-label">Progress 8</div></div>`:""}
        ${ks2!==null?`<div class="metric-card"><div class="metric-value ${ks2>=70?'good':ks2>=55?'avg':'low'}">${ks2}%</div><div class="metric-label">KS2 Combined</div></div>`:""}
        ${s.performance?.ks4?.grade5EnMa!=null?`<div class="metric-card"><div class="metric-value ${s.performance.ks4.grade5EnMa>=50?'good':'avg'}">${s.performance.ks4.grade5EnMa}%</div><div class="metric-label">5+ En/Ma</div></div>`:""}
        ${s.performance?.ks5?.averagePointScore!=null?`<div class="metric-card"><div class="metric-value">${s.performance.ks5.averagePointScore}</div><div class="metric-label">A-Level APS</div></div>`:""}
        ${s.admissions?.oversubscribed!=null?`<div class="metric-card"><span class="admissions-indicator ${s.admissions.oversubscribed?'oversubscribed':'available'}">${s.admissions.oversubscribed?'Oversubscribed':'Available'}</span><div class="metric-label">Admissions</div></div>`:""}
      </div>`:""}`;
  }

  function renderOfstedTab(s) {
    if (!s.ofsted) return '<p class="text-muted">No Ofsted data available.</p>';
    const o = s.ofsted;
    let html = `<div class="metric-grid" style="grid-template-columns:1fr 1fr;">
      <div class="metric-card"><div class="metric-value">${esc(o.rating)}</div><div class="metric-label">Current Rating${o.date?` (${o.date})`:""}</div></div>
      ${o.previousRating?`<div class="metric-card"><div class="metric-value" style="font-size:1rem">${esc(o.previousRating)}</div><div class="metric-label">Previous${o.previousDate?` (${o.previousDate})`:""}</div></div>`:""}
    </div>`;
    if (o.report) {
      html += `<p style="margin:12px 0"><a href="${esc(o.report)}" target="_blank" rel="noopener" class="btn-link">View full Ofsted report &rarr;</a></p>`;
    }
    if (o.parentView) {
      html += `<h4 style="margin:20px 0 8px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Parent View (Ofsted)</h4>
      <div class="parent-view-grid">
        ${Object.entries(o.parentView).map(([k,v]) => `
          <div class="parent-view-item">
            <div class="pv-label">${esc(k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()))}</div>
            <div class="pv-bar"><div class="pv-fill" style="width:${v}%;background:${v>=80?'var(--success)':v>=60?'var(--warning)':'var(--danger)'}"></div></div>
            <div class="pv-value">${v}% agree</div>
          </div>
        `).join("")}
      </div>`;
    }
    return html;
  }

  function renderResultsTab(s) {
    if (!s.performance) return '<p class="text-muted">No performance data available.</p>';
    const p = s.performance;
    let html = '';

    // KS2 Results
    if (p.ks2) {
      html += `<h4 style="margin:0 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">KS2 SATs Results ${p.ks2.year?`(${p.ks2.year})`:""}</h4>`;
      const items = [["Reading", p.ks2.readingExpected], ["Maths", p.ks2.mathsExpected],
        ["Writing", p.ks2.writingExpected], ["GPS", p.ks2.gpsExpected], ["Combined", p.ks2.combinedExpected]].filter(([,v]) => v != null);
      html += items.map(([label, val]) => `<div class="progress-bar-wrap">
        <div class="progress-label"><span>${label} (expected standard)</span><span>${val}%</span></div>
        <div class="progress-track"><div class="progress-fill ${val>=70?'green':val>=55?'blue':'orange'}" style="width:${val}%"></div></div>
      </div>`).join("");

      // KS2 Progress scores
      if (p.ks2.readingProgress != null || p.ks2.mathsProgress != null) {
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Progress Scores</h5>
        <div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr;">
          ${p.ks2.readingProgress!=null?`<div class="metric-card"><div class="metric-value ${p.ks2.readingProgress>0?'good':p.ks2.readingProgress>-1?'avg':'low'}">${p.ks2.readingProgress>0?"+":""}${p.ks2.readingProgress}</div><div class="metric-label">Reading</div></div>`:""}
          ${p.ks2.mathsProgress!=null?`<div class="metric-card"><div class="metric-value ${p.ks2.mathsProgress>0?'good':p.ks2.mathsProgress>-1?'avg':'low'}">${p.ks2.mathsProgress>0?"+":""}${p.ks2.mathsProgress}</div><div class="metric-label">Maths</div></div>`:""}
          ${p.ks2.writingProgress!=null?`<div class="metric-card"><div class="metric-value ${p.ks2.writingProgress>0?'good':p.ks2.writingProgress>-1?'avg':'low'}">${p.ks2.writingProgress>0?"+":""}${p.ks2.writingProgress}</div><div class="metric-label">Writing</div></div>`:""}
        </div>`;
      }

      // KS2 Higher attaining
      if (p.ks2.readingHigher != null || p.ks2.mathsHigher != null) {
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Greater Depth (%)</h5>
        <div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr;">
          ${p.ks2.readingHigher!=null?`<div class="metric-card"><div class="metric-value">${p.ks2.readingHigher}%</div><div class="metric-label">Reading</div></div>`:""}
          ${p.ks2.mathsHigher!=null?`<div class="metric-card"><div class="metric-value">${p.ks2.mathsHigher}%</div><div class="metric-label">Maths</div></div>`:""}
          ${p.ks2.writingHigher!=null?`<div class="metric-card"><div class="metric-value">${p.ks2.writingHigher}%</div><div class="metric-label">Writing</div></div>`:""}
        </div>`;
      }
    }

    // KS4/GCSE Results
    if (p.ks4) {
      html += `<h4 style="margin:24px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">GCSE Results ${p.ks4.year?`(${p.ks4.year})`:""}</h4>
      <div class="metric-grid">
        ${p.ks4.attainment8!=null?`<div class="metric-card"><div class="metric-value ${p.ks4.attainment8>=50?'good':'avg'}">${p.ks4.attainment8}</div><div class="metric-label">Attainment 8</div></div>`:""}
        ${p.ks4.progress8!=null?`<div class="metric-card"><div class="metric-value ${p.ks4.progress8>0?'good':p.ks4.progress8>-0.5?'avg':'low'}">${p.ks4.progress8>0?"+":""}${p.ks4.progress8}</div><div class="metric-label">Progress 8</div></div>`:""}
        ${p.ks4.grade5EnMa!=null?`<div class="metric-card"><div class="metric-value">${p.ks4.grade5EnMa}%</div><div class="metric-label">Grade 5+ En/Ma</div></div>`:""}
        ${p.ks4.ebacc_entry!=null?`<div class="metric-card"><div class="metric-value">${p.ks4.ebacc_entry}%</div><div class="metric-label">EBacc Entry</div></div>`:""}
        ${p.ks4.ebacc_avg!=null?`<div class="metric-card"><div class="metric-value">${p.ks4.ebacc_avg}</div><div class="metric-label">EBacc APS</div></div>`:""}
      </div>`;

      // GCSE Subject breakdown
      if (p.ks4.subjects) {
        const subjectLabels = {
          english: "English", maths: "Maths", science: "Science", history: "History",
          geography: "Geography", modernLanguages: "Modern Languages", art: "Art",
          music: "Music", pe: "PE", computing: "Computing", drama: "Drama", dt: "D&T"
        };
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Subject Results (% Grade 5+)</h5>`;
        const subjects = Object.entries(p.ks4.subjects).sort((a,b) => b[1]-a[1]);
        html += subjects.map(([k,v]) => `<div class="progress-bar-wrap">
          <div class="progress-label"><span>${subjectLabels[k] || k}</span><span>${v}%</span></div>
          <div class="progress-track"><div class="progress-fill ${v>=60?'green':v>=45?'blue':'orange'}" style="width:${v}%"></div></div>
        </div>`).join("");
      }
    }

    // KS5/A-Level Results
    if (p.ks5) {
      html += `<h4 style="margin:24px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">A-Level Results ${p.ks5.year?`(${p.ks5.year})`:""}</h4>
      <div class="metric-grid" style="grid-template-columns:1fr 1fr;">
        ${p.ks5.averagePointScore!=null?`<div class="metric-card"><div class="metric-value">${p.ks5.averagePointScore}</div><div class="metric-label">Average Point Score</div></div>`:""}
        ${p.ks5.aabOrHigher!=null?`<div class="metric-card"><div class="metric-value">${p.ks5.aabOrHigher}%</div><div class="metric-label">AAB or higher</div></div>`:""}
      </div>`;

      // A-Level Subject breakdown
      if (p.ks5.subjects) {
        const gradeMap = {6: "A*", 5: "A", 4: "B", 3: "C", 2: "D", 1: "E"};
        const getGrade = (n) => { const r = Math.round(n); return gradeMap[r] || (n >= 5.5 ? "A*" : n >= 4.5 ? "A" : n >= 3.5 ? "B" : n >= 2.5 ? "C" : "D"); };
        const subjectLabels = {
          maths: "Maths", furtherMaths: "Further Maths", english: "English",
          physics: "Physics", chemistry: "Chemistry", biology: "Biology",
          history: "History", geography: "Geography", economics: "Economics",
          psychology: "Psychology", art: "Art", modernLanguages: "Languages", computerScience: "Computer Sci"
        };
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Subject Average Grades</h5>`;
        const subjects = Object.entries(p.ks5.subjects).sort((a,b) => b[1]-a[1]);
        html += subjects.map(([k,v]) => `<div class="progress-bar-wrap">
          <div class="progress-label"><span>${subjectLabels[k] || k}</span><span>${getGrade(v)} (${v})</span></div>
          <div class="progress-track"><div class="progress-fill ${v>=5?'green':v>=4?'blue':'orange'}" style="width:${(v/6)*100}%"></div></div>
        </div>`).join("");
      }

      // Destinations
      if (p.ks5.destinations) {
        const d = p.ks5.destinations;
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Student Destinations</h5>
        <div class="metric-grid" style="grid-template-columns:repeat(5,1fr);">
          ${d.university!=null?`<div class="metric-card"><div class="metric-value">${d.university}%</div><div class="metric-label">University</div></div>`:""}
          ${d.russellGroup!=null?`<div class="metric-card"><div class="metric-value">${d.russellGroup}%</div><div class="metric-label">Russell Group</div></div>`:""}
          ${d.oxbridge!=null?`<div class="metric-card"><div class="metric-value">${d.oxbridge}%</div><div class="metric-label">Oxbridge</div></div>`:""}
          ${d.apprenticeship!=null?`<div class="metric-card"><div class="metric-value">${d.apprenticeship}%</div><div class="metric-label">Apprenticeship</div></div>`:""}
          ${d.employment!=null?`<div class="metric-card"><div class="metric-value">${d.employment}%</div><div class="metric-label">Employment</div></div>`:""}
        </div>`;
      }
    }

    return html || '<p class="text-muted">No results data for this school type.</p>';
  }

  function renderAdmissionsTab(s) {
    if (!s.admissions) return '<p class="text-muted">No admissions data available.</p>';
    const a = s.admissions;
    let html = `<div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="metric-card"><div class="metric-value">${a.capacity||"-"}</div><div class="metric-label">Places</div></div>
      <div class="metric-card"><div class="metric-value">${a.applications?.total||"-"}</div><div class="metric-label">Applications</div></div>
      <div class="metric-card">
        <span class="admissions-indicator ${a.oversubscribed?'oversubscribed':'available'}">${a.oversubscribed?'Oversubscribed':'Places Available'}</span>
        <div class="metric-label">Status ${a.year?`(${a.year})`:""}</div>
      </div>
    </div>`;

    // Catchment Area Section
    if (a.catchment) {
      const c = a.catchment;
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Catchment Area</h4>
      <div class="metric-grid" style="grid-template-columns:1fr 1fr;">
        <div class="metric-card"><div class="metric-value">${c.officialRadius?.toFixed(1) || "-"} ${c.unit || "km"}</div><div class="metric-label">Official Catchment Radius</div></div>
        <div class="metric-card"><div class="metric-value ${c.effectiveRadius < c.officialRadius * 0.5 ? 'text-danger' : ''}">${c.effectiveRadius?.toFixed(2) || "-"} ${c.unit || "km"}</div><div class="metric-label">Last Admitted Distance</div></div>
      </div>`;
      if (c.history) {
        html += `<h5 style="margin:16px 0 8px;font-size:.8rem;font-weight:600;color:var(--gray-500)">Catchment Distance History</h5>`;
        const years = Object.keys(c.history).sort().reverse();
        const maxDist = Math.max(...Object.values(c.history), 1);
        html += years.map(year => `<div class="progress-bar-wrap">
          <div class="progress-label"><span>${year}</span><span>${c.history[year]?.toFixed(2)} ${c.unit || "km"}</span></div>
          <div class="progress-track"><div class="progress-fill orange" style="width:${(c.history[year]/maxDist)*100}%"></div></div>
        </div>`).join("");
      }
    }

    // Admission Criteria Section
    if (a.criteria && a.criteria.length) {
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Admission Criteria (Priority Order)</h4>
      <table class="info-table">
        ${a.criteria.map(cr => `<tr><td style="width:40px;text-align:center;font-weight:700;color:var(--primary)">${cr.priority}</td><td><strong>${esc(cr.criterion)}</strong><br><span style="font-size:.75rem;color:var(--gray-500)">${esc(cr.description)}</span></td></tr>`).join("")}
      </table>`;
    }

    // Application Preferences
    if (a.applications) {
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Application Preferences</h4>`;
      const prefs = [["1st Choice", a.applications.first], ["2nd Choice", a.applications.second], ["3rd Choice", a.applications.third]];
      const maxPref = Math.max(...prefs.map(p => p[1] || 0), 1);
      html += prefs.filter(([,v])=>v).map(([label, val]) => `<div class="progress-bar-wrap">
        <div class="progress-label"><span>${label}</span><span>${val}</span></div>
        <div class="progress-track"><div class="progress-fill blue" style="width:${(val/maxPref)*100}%"></div></div>
      </div>`).join("");
    }

    // Appeals
    if (a.appeals) {
      html += `<div class="metric-grid" style="grid-template-columns:1fr 1fr;margin-top:16px;">
        <div class="metric-card"><div class="metric-value">${a.appeals.lodged || 0}</div><div class="metric-label">Appeals Lodged</div></div>
        <div class="metric-card"><div class="metric-value">${a.appeals.successful || 0}</div><div class="metric-label">Appeals Successful</div></div>
      </div>`;
    }

    // Open Days
    if (a.openDays && a.openDays.length) {
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Open Days</h4>
      <ul style="margin:0;padding-left:20px;font-size:.85rem;color:var(--gray-600)">
        ${a.openDays.map(od => `<li>${esc(od.date)} at ${od.time} (${od.type})</li>`).join("")}
      </ul>`;
    }

    // Application Deadline
    if (a.applicationDeadline) {
      html += `<p style="margin-top:14px;font-size:.85rem;color:var(--warning);font-weight:600"><strong>Application Deadline:</strong> ${esc(a.applicationDeadline)}</p>`;
    }

    return html;
  }

  function renderDemographicsTab(s) {
    if (!s.demographics) return '<p class="text-muted">No demographics data available.</p>';
    const d = s.demographics;
    let html = `<div class="metric-grid" style="grid-template-columns:1fr 1fr 1fr;">
      ${d.fsmPercent!=null?`<div class="metric-card"><div class="metric-value">${d.fsmPercent}%</div><div class="metric-label">Free School Meals</div></div>`:""}
      ${d.ealPercent!=null?`<div class="metric-card"><div class="metric-value">${d.ealPercent}%</div><div class="metric-label">English 2nd Language</div></div>`:""}
      ${d.senPercent!=null?`<div class="metric-card"><div class="metric-value">${d.senPercent}%</div><div class="metric-label">SEN</div></div>`:""}
    </div>`;
    if (d.ethnicities) {
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Ethnic Composition</h4>`;
      const entries = Object.entries(d.ethnicities).sort((a,b) => b[1]-a[1]);
      html += entries.map(([k,v],i) => `<div class="progress-bar-wrap">
        <div class="progress-label"><span>${esc(k.charAt(0).toUpperCase()+k.slice(1))}</span><span>${v}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${v}%;background:${COLORS[i%COLORS.length]}"></div></div>
      </div>`).join("");
    }
    return html;
  }

  function renderInfoTab(s) {
    let html = '';
    if (s.contact) {
      const c = s.contact;
      html += `<h4 style="margin:0 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">Contact</h4>
      <table class="info-table">
        ${c.headteacher?`<tr><td>Headteacher</td><td>${esc(c.headteacher)}</td></tr>`:""}
        ${c.phone?`<tr><td>Phone</td><td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td></tr>`:""}
        ${c.email?`<tr><td>Email</td><td><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></td></tr>`:""}
      </table>`;
    }
    if (s.finances) {
      const f = s.finances;
      html += `<h4 style="margin:20px 0 12px;font-size:.85rem;font-weight:700;color:var(--gray-600)">School Finances</h4>
      <table class="info-table">
        ${f.totalIncome?`<tr><td>Total Income</td><td>&pound;${f.totalIncome.toLocaleString()}</td></tr>`:""}
        ${f.perPupilFunding?`<tr><td>Per Pupil Funding</td><td>&pound;${f.perPupilFunding.toLocaleString()}</td></tr>`:""}
        ${f.teacherCount?`<tr><td>Teachers</td><td>${f.teacherCount}</td></tr>`:""}
        ${f.pupilTeacherRatio?`<tr><td>Pupil:Teacher Ratio</td><td>${f.pupilTeacherRatio}:1</td></tr>`:""}
      </table>`;
    }
    if (s.urn) {
      html += `<p style="margin-top:16px;font-size:.8rem;color:var(--gray-400)">URN: ${s.urn}</p>`;
    }
    return html || '<p class="text-muted">No additional information available.</p>';
  }

  // ── Analytics ─────────────────────────────────────────
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
        <div class="analytics-card"><h3>Sector Split</h3><div id="chartSector" class="pie-chart-container"></div></div>
        <div class="analytics-card"><h3>Attainment 8 Distribution</h3><div id="chartA8" class="bar-chart"></div></div>
        <div class="analytics-card"><h3>Key Statistics</h3><div id="statsPanel" class="stats-panel"></div></div>
      </div>`;
    renderBarChart("chartBorough", countBy(filteredSchools,"borough"), COLORS[0]);
    renderDonut("chartPhase", countBy(filteredSchools,"phase"));
    renderBarChart("chartOfsted", countBy(filteredSchools, s => getOfstedRating(s)), COLORS[1]);
    renderDonut("chartGender", countBy(filteredSchools,"gender"));
    renderBarChart("chartFunding", countBy(filteredSchools,"fundingType"), COLORS[4]);
    renderDonut("chartSector", countBy(filteredSchools,"sector"));
    renderA8Distribution();
    renderStats();
  }

  function countBy(arr, keyOrFn) {
    const m = {};
    arr.forEach(i => {
      const v = typeof keyOrFn === "function" ? keyOrFn(i) : i[keyOrFn];
      m[v] = (m[v]||0)+1;
    });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }

  function renderA8Distribution() {
    const el = document.getElementById("chartA8");
    const sec = filteredSchools.filter(s => getA8(s) !== null);
    if (!sec.length) { el.innerHTML = "<p class='text-muted'>No Attainment 8 data</p>"; return; }
    const buckets = {"<30":0,"30-39":0,"40-49":0,"50-59":0,"60-69":0,"70+":0};
    sec.forEach(s => {
      const a = getA8(s);
      if(a<30)buckets["<30"]++;else if(a<40)buckets["30-39"]++;else if(a<50)buckets["40-49"]++;
      else if(a<60)buckets["50-59"]++;else if(a<70)buckets["60-69"]++;else buckets["70+"]++;
    });
    renderBarChart("chartA8", Object.entries(buckets).filter(([,v])=>v>0), COLORS[5]);
  }

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
    const tp=d.reduce((s,x)=>s+x.pupils,0),avg=d.length?Math.round(tp/d.length):0;
    const bor=new Set(d.map(s=>s.borough)).size;
    const ws=d.filter(s=>s.hasSixthForm).length;
    const os=d.filter(s=>getOfstedRating(s)==="Outstanding").length;
    const avgA8 = d.filter(s=>getA8(s)!==null);
    const a8Avg = avgA8.length ? (avgA8.reduce((s,x)=>s+getA8(x),0)/avgA8.length).toFixed(1) : "-";
    el.innerHTML=`
      <div class="stat-item"><div class="stat-value">${d.length}</div><div class="stat-label">Schools</div></div>
      <div class="stat-item"><div class="stat-value">${tp.toLocaleString()}</div><div class="stat-label">Pupils</div></div>
      <div class="stat-item"><div class="stat-value">${avg.toLocaleString()}</div><div class="stat-label">Avg Pupils</div></div>
      <div class="stat-item"><div class="stat-value">${bor}</div><div class="stat-label">Boroughs</div></div>
      <div class="stat-item"><div class="stat-value">${ws}</div><div class="stat-label">Sixth Form</div></div>
      <div class="stat-item"><div class="stat-value">${os}</div><div class="stat-label">Outstanding</div></div>
      <div class="stat-item"><div class="stat-value">${a8Avg}</div><div class="stat-label">Avg Att. 8</div></div>
      <div class="stat-item"><div class="stat-value">${d.filter(s=>s.admissions?.oversubscribed).length}</div><div class="stat-label">Oversubscribed</div></div>`;
  }

  // ── Compare ───────────────────────────────────────────
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
    const fmtP8 = s => { const v=getP8(s); return v!=null?(v>0?"+":"")+v:"-"; };
    const rows=[
      ["Sector",s1.sector||"State",s2.sector||"State"],
      ["Borough",s1.borough,s2.borough],["Phase",s1.phase,s2.phase],
      ["Gender",s1.gender,s2.gender],["Age Range",s1.ageRange,s2.ageRange],
      ["Pupils",s1.pupils.toLocaleString(),s2.pupils.toLocaleString()],
      ["Ofsted",getOfstedRating(s1),getOfstedRating(s2)],
      ["Faith",s1.religiousCharacter,s2.religiousCharacter],
      ["Funding",s1.fundingType,s2.fundingType],
      ["Sixth Form",s1.hasSixthForm?"Yes":"No",s2.hasSixthForm?"Yes":"No"],
      ["Attainment 8",String(getA8(s1)??"-"),String(getA8(s2)??"-")],
      ["Progress 8",fmtP8(s1),fmtP8(s2)],
      ["KS2 Combined",getKS2(s1)!=null?getKS2(s1)+"%":"-", getKS2(s2)!=null?getKS2(s2)+"%":"-"],
      ["Oversubscribed",s1.admissions?.oversubscribed?"Yes":"No", s2.admissions?.oversubscribed?"Yes":"No"],
      ["FSM %",s1.demographics?.fsmPercent!=null?s1.demographics.fsmPercent+"%":"-", s2.demographics?.fsmPercent!=null?s2.demographics.fsmPercent+"%":"-"],
      ["Website",s1.website||"\u2014",s2.website||"\u2014"],
      ["Address",s1.address,s2.address]
    ];
    c.innerHTML=`<table><thead><tr><th></th><td><strong>${esc(s1.name)}</strong></td><td><strong>${esc(s2.name)}</strong></td></tr></thead><tbody>${rows.map(([l,v1,v2])=>{const d=v1!==v2;return`<tr><th>${l}</th><td${d?' class="highlight"':""}>${esc(String(v1))}</td><td${d?' class="highlight"':""}>${esc(String(v2))}</td></tr>`;}).join("")}</tbody></table>`;
  }

  function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}

  return { render };
})();
