/**
 * Schoolter — London Schools Explorer
 * Main application logic: search, filter, pagination, analytics, compare.
 */

(function () {
  "use strict";

  const PAGE_SIZE = 24;
  let currentPage = 1;
  let filteredSchools = [];
  const COLORS = ["#1a56db","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d","#c026d3","#ea580c","#0d9488","#4338ca","#b91c1c","#0369a1","#a16207","#6d28d9"];

  // ── Init ─────────────────────────────────────────────────
  function init() {
    populateFilterOptions();
    populateCompareDropdowns();
    bindEvents();
    applyFilters();
  }

  // ── Populate filter dropdowns from data ──────────────────
  function populateFilterOptions() {
    const fields = {
      filterBorough: "borough",
      filterPhase: "phase",
      filterGender: "gender",
      filterOfsted: "ofstedRating",
      filterReligion: "religiousCharacter",
      filterFunding: "fundingType",
    };
    for (const [selectId, key] of Object.entries(fields)) {
      const sel = document.getElementById(selectId);
      const values = [...new Set(LONDON_SCHOOLS.map((s) => s[key]))].sort();
      values.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
    }
  }

  function populateCompareDropdowns() {
    const sorted = [...LONDON_SCHOOLS].sort((a, b) => a.name.localeCompare(b.name));
    ["compareSchool1", "compareSchool2"].forEach((id) => {
      const sel = document.getElementById(id);
      sorted.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.borough})`;
        sel.appendChild(opt);
      });
    });
  }

  // ── Events ───────────────────────────────────────────────
  function bindEvents() {
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearch");

    searchInput.addEventListener("input", () => {
      clearBtn.classList.toggle("visible", searchInput.value.length > 0);
      currentPage = 1;
      applyFilters();
    });
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.classList.remove("visible");
      currentPage = 1;
      applyFilters();
    });

    document.querySelectorAll(".filters select").forEach((sel) => {
      sel.addEventListener("change", () => { currentPage = 1; applyFilters(); });
    });

    // Tabs
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
        if (tab.dataset.tab === "analytics") renderAnalytics();
      });
    });

    // Compare
    document.getElementById("compareSchool1").addEventListener("change", renderCompare);
    document.getElementById("compareSchool2").addEventListener("change", renderCompare);

    // Modal close
    document.querySelector(".modal-overlay").addEventListener("click", closeModal);
    document.querySelector(".modal-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  // ── Filter + Search ──────────────────────────────────────
  function applyFilters() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const borough = document.getElementById("filterBorough").value;
    const phase = document.getElementById("filterPhase").value;
    const gender = document.getElementById("filterGender").value;
    const ofsted = document.getElementById("filterOfsted").value;
    const religion = document.getElementById("filterReligion").value;
    const funding = document.getElementById("filterFunding").value;
    const sixthForm = document.getElementById("filterSixthForm").value;
    const sortBy = document.getElementById("sortBy").value;

    filteredSchools = LONDON_SCHOOLS.filter((s) => {
      if (query && !s.name.toLowerCase().includes(query) && !s.borough.toLowerCase().includes(query) && !s.postcode.toLowerCase().includes(query)) return false;
      if (borough && s.borough !== borough) return false;
      if (phase && s.phase !== phase) return false;
      if (gender && s.gender !== gender) return false;
      if (ofsted && s.ofstedRating !== ofsted) return false;
      if (religion && s.religiousCharacter !== religion) return false;
      if (funding && s.fundingType !== funding) return false;
      if (sixthForm === "yes" && !s.hassixthForm) return false;
      if (sixthForm === "no" && s.hassixthForm) return false;
      return true;
    });

    // Sort
    filteredSchools.sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "pupils-desc": return b.pupils - a.pupils;
        case "pupils-asc": return a.pupils - b.pupils;
        case "borough": return a.borough.localeCompare(b.borough) || a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    renderResultCount();
    renderSchoolList();
    renderPagination();

    // If analytics tab is active, update it
    if (document.querySelector('.tab[data-tab="analytics"]').classList.contains("active")) {
      renderAnalytics();
    }
  }

  // ── Render school list ───────────────────────────────────
  function renderSchoolList() {
    const container = document.getElementById("schoolList");
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredSchools.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray-400);padding:40px 0;">No schools match your criteria.</p>';
      return;
    }

    container.innerHTML = page.map((s) => `
      <div class="school-card" data-id="${s.id}">
        <div class="card-header">
          <span class="school-name">${esc(s.name)}</span>
          <span class="ofsted-badge ofsted-${s.ofstedRating.toLowerCase().replace(/\s+/g, "-")}">${esc(s.ofstedRating)}</span>
        </div>
        <div class="card-meta">
          <span class="badge">${esc(s.phase)}</span>
          <span class="badge">${esc(s.gender)}</span>
          ${s.religiousCharacter !== "None" ? `<span class="badge">${esc(s.religiousCharacter)}</span>` : ""}
          <span class="badge">${esc(s.fundingType)}</span>
        </div>
        <div class="card-details">
          <span>${esc(s.borough)} &middot; ${esc(s.postcode)}</span>
          <span>${s.pupils.toLocaleString()} pupils &middot; Ages ${esc(s.ageRange)}</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".school-card").forEach((card) => {
      card.addEventListener("click", () => openModal(Number(card.dataset.id)));
    });
  }

  function renderResultCount() {
    document.getElementById("resultCount").textContent = `${filteredSchools.length} school${filteredSchools.length !== 1 ? "s" : ""} found`;
  }

  // ── Pagination ───────────────────────────────────────────
  function renderPagination() {
    const container = document.getElementById("pagination");
    const totalPages = Math.ceil(filteredSchools.length / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ""; return; }

    let html = "";
    html += `<button ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">&laquo;</button>`;

    const pages = getPageNumbers(currentPage, totalPages);
    pages.forEach((p) => {
      if (p === "...") {
        html += `<button disabled>...</button>`;
      } else {
        html += `<button class="${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
      }
    });

    html += `<button ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">&raquo;</button>`;
    container.innerHTML = html;

    container.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPage = Number(btn.dataset.page);
        renderSchoolList();
        renderPagination();
        window.scrollTo({ top: document.querySelector(".main").offsetTop, behavior: "smooth" });
      });
    });
  }

  function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, "...", total];
    if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  // ── Modal ────────────────────────────────────────────────
  function openModal(id) {
    const s = LONDON_SCHOOLS.find((x) => x.id === id);
    if (!s) return;
    document.getElementById("modalBody").innerHTML = `
      <div class="detail-header">
        <h2>${esc(s.name)}</h2>
        <div class="detail-borough">${esc(s.borough)}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><label>Phase</label><span>${esc(s.phase)}</span></div>
        <div class="detail-item"><label>Type</label><span>${esc(s.type)}</span></div>
        <div class="detail-item"><label>Gender</label><span>${esc(s.gender)}</span></div>
        <div class="detail-item"><label>Age Range</label><span>${esc(s.ageRange)}</span></div>
        <div class="detail-item"><label>Pupils</label><span>${s.pupils.toLocaleString()}</span></div>
        <div class="detail-item"><label>Ofsted Rating</label><span class="ofsted-badge ofsted-${s.ofstedRating.toLowerCase().replace(/\s+/g, "-")}">${esc(s.ofstedRating)}</span></div>
        <div class="detail-item"><label>Religious Character</label><span>${esc(s.religiousCharacter)}</span></div>
        <div class="detail-item"><label>Funding Type</label><span>${esc(s.fundingType)}</span></div>
        <div class="detail-item"><label>Sixth Form</label><span>${s.hassixthForm ? "Yes" : "No"}</span></div>
        <div class="detail-item"><label>Postcode</label><span>${esc(s.postcode)}</span></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Address</label><span>${esc(s.address)}</span></div>
      </div>
    `;
    const modal = document.getElementById("schoolModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const modal = document.getElementById("schoolModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  // ── Analytics ────────────────────────────────────────────
  function renderAnalytics() {
    const data = filteredSchools;
    renderBarChart("chartBorough", countBy(data, "borough"), COLORS[0]);
    renderDonut("chartPhase", countBy(data, "phase"));
    renderBarChart("chartOfsted", countBy(data, "ofstedRating"), COLORS[1]);
    renderDonut("chartGender", countBy(data, "gender"));
    renderBarChart("chartFunding", countBy(data, "fundingType"), COLORS[4]);
    renderStats(data);
  }

  function countBy(arr, key) {
    const map = {};
    arr.forEach((item) => { map[item[key]] = (map[item[key]] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function renderBarChart(id, entries, color) {
    const el = document.getElementById(id);
    if (!entries.length) { el.innerHTML = "<p>No data</p>"; return; }
    const max = entries[0][1];
    el.innerHTML = entries.map(([label, count]) => {
      const pct = Math.max((count / max) * 100, 2);
      const showInside = pct > 15;
      return `<div class="bar-row">
        <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}">
            ${showInside ? `<span class="bar-value">${count}</span>` : ""}
          </div>
        </div>
        ${!showInside ? `<span class="bar-value-outside">${count}</span>` : ""}
      </div>`;
    }).join("");
  }

  function renderDonut(id, entries) {
    const el = document.getElementById(id);
    if (!entries.length) { el.innerHTML = "<p>No data</p>"; return; }
    const total = entries.reduce((s, e) => s + e[1], 0);
    let cumDeg = 0;
    const gradientParts = [];
    const legendItems = [];

    entries.forEach(([label, count], i) => {
      const color = COLORS[i % COLORS.length];
      const deg = (count / total) * 360;
      gradientParts.push(`${color} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
      const pct = ((count / total) * 100).toFixed(1);
      legendItems.push(`<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:${color}"></span>${esc(label)}: ${count} (${pct}%)</div>`);
    });

    el.innerHTML = `
      <div class="donut-chart" style="background:conic-gradient(${gradientParts.join(",")})">
        <div class="donut-center">${total}</div>
      </div>
      <div class="pie-legend">${legendItems.join("")}</div>
    `;
  }

  function renderStats(data) {
    const el = document.getElementById("statsPanel");
    const totalPupils = data.reduce((s, x) => s + x.pupils, 0);
    const avgPupils = data.length ? Math.round(totalPupils / data.length) : 0;
    const boroughs = new Set(data.map((s) => s.borough)).size;
    const withSixth = data.filter((s) => s.hassixthForm).length;
    const outstanding = data.filter((s) => s.ofstedRating === "Outstanding").length;

    el.innerHTML = `
      <div class="stat-item"><div class="stat-value">${data.length}</div><div class="stat-label">Total Schools</div></div>
      <div class="stat-item"><div class="stat-value">${totalPupils.toLocaleString()}</div><div class="stat-label">Total Pupils</div></div>
      <div class="stat-item"><div class="stat-value">${avgPupils.toLocaleString()}</div><div class="stat-label">Avg Pupils/School</div></div>
      <div class="stat-item"><div class="stat-value">${boroughs}</div><div class="stat-label">Boroughs</div></div>
      <div class="stat-item"><div class="stat-value">${withSixth}</div><div class="stat-label">With Sixth Form</div></div>
      <div class="stat-item"><div class="stat-value">${outstanding}</div><div class="stat-label">Outstanding</div></div>
    `;
  }

  // ── Compare ──────────────────────────────────────────────
  function renderCompare() {
    const id1 = Number(document.getElementById("compareSchool1").value);
    const id2 = Number(document.getElementById("compareSchool2").value);
    const container = document.getElementById("compareResult");
    if (!id1 || !id2) { container.innerHTML = "<p style='color:var(--gray-400)'>Select two schools to compare.</p>"; return; }

    const s1 = LONDON_SCHOOLS.find((s) => s.id === id1);
    const s2 = LONDON_SCHOOLS.find((s) => s.id === id2);
    if (!s1 || !s2) return;

    const rows = [
      ["Borough", s1.borough, s2.borough],
      ["Phase", s1.phase, s2.phase],
      ["Type", s1.type, s2.type],
      ["Gender", s1.gender, s2.gender],
      ["Age Range", s1.ageRange, s2.ageRange],
      ["Pupils", s1.pupils.toLocaleString(), s2.pupils.toLocaleString()],
      ["Ofsted Rating", s1.ofstedRating, s2.ofstedRating],
      ["Religious Character", s1.religiousCharacter, s2.religiousCharacter],
      ["Funding Type", s1.fundingType, s2.fundingType],
      ["Sixth Form", s1.hassixthForm ? "Yes" : "No", s2.hassixthForm ? "Yes" : "No"],
      ["Address", s1.address, s2.address],
    ];

    container.innerHTML = `<table>
      <thead><tr><th></th><td><strong>${esc(s1.name)}</strong></td><td><strong>${esc(s2.name)}</strong></td></tr></thead>
      <tbody>${rows.map(([label, v1, v2]) => {
        const diff = v1 !== v2;
        return `<tr><th>${label}</th><td${diff ? ' class="highlight"' : ""}>${esc(String(v1))}</td><td${diff ? ' class="highlight"' : ""}>${esc(String(v2))}</td></tr>`;
      }).join("")}</tbody>
    </table>`;
  }

  // ── Util ─────────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Boot ─────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);
})();
