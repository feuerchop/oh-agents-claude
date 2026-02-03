/**
 * School Assistant — agentic chat that answers questions about London schools.
 * Uses the LONDON_SCHOOLS dataset to provide intelligent, data-driven answers.
 * Runs entirely client-side (no API needed).
 */
const SchoolChat = (() => {
  let isOpen = false;
  let messages = [];
  const SUGGESTIONS = [
    "Best schools in Camden?",
    "Which schools are oversubscribed?",
    "Compare state vs private schools",
    "Top 5 by Attainment 8",
    "Outstanding schools in Hackney",
    "Schools with sixth form near Islington",
    "What is the average Progress 8?",
    "Tell me about Westminster Academy",
  ];

  function init() {
    const fab = document.getElementById("chatFab");
    const panel = document.getElementById("chatPanel");
    if (!fab || !panel) return;

    fab.addEventListener("click", toggle);
    document.getElementById("chatSend").addEventListener("click", send);
    document.getElementById("chatInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    addBotMessage("Hello! I'm your London Schools Assistant. Ask me anything about schools — performance, Ofsted ratings, admissions, comparisons, and more.");
    renderSuggestions(SUGGESTIONS.slice(0, 4));
  }

  function toggle() {
    isOpen = !isOpen;
    document.getElementById("chatPanel").classList.toggle("open", isOpen);
    document.getElementById("chatFab").classList.toggle("open", isOpen);
    if (isOpen) document.getElementById("chatInput").focus();
  }

  function send() {
    const input = document.getElementById("chatInput");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    addUserMessage(q);
    showTyping();
    // Simulate thinking delay for natural feel
    setTimeout(() => {
      removeTyping();
      const answer = processQuery(q);
      addBotMessage(answer.text, answer.source);
      if (answer.suggestions) renderSuggestions(answer.suggestions);
    }, 400 + Math.random() * 600);
  }

  function addUserMessage(text) {
    messages.push({ role: "user", text });
    appendMsg(`<div class="chat-msg user">${esc(text)}</div>`);
  }

  function addBotMessage(text, source) {
    messages.push({ role: "bot", text });
    appendMsg(`<div class="chat-msg bot">${text}${source ? `<span class="msg-source">Source: ${esc(source)}</span>` : ""}</div>`);
  }

  function showTyping() {
    appendMsg(`<div class="chat-msg bot typing" id="typingIndicator"><span class="dot-anim">.</span><span class="dot-anim">.</span><span class="dot-anim">.</span></div>`);
  }

  function removeTyping() {
    document.getElementById("typingIndicator")?.remove();
  }

  function appendMsg(html) {
    const container = document.getElementById("chatMessages");
    container.insertAdjacentHTML("beforeend", html);
    container.scrollTop = container.scrollHeight;
  }

  function renderSuggestions(items) {
    const el = document.getElementById("chatSuggestions");
    el.innerHTML = items.map(s => `<button class="chat-suggest-btn">${esc(s)}</button>`).join("");
    el.querySelectorAll(".chat-suggest-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("chatInput").value = btn.textContent;
        send();
      });
    });
  }

  // ── Query Processing Engine ──────────────────────────
  function processQuery(q) {
    const lower = q.toLowerCase();
    const schools = typeof LONDON_SCHOOLS !== "undefined" ? LONDON_SCHOOLS : [];

    // Detect intent
    if (matchesPattern(lower, ["tell me about", "info on", "details of", "what about", "show me"])) {
      return handleSchoolLookup(q, lower, schools);
    }
    if (matchesPattern(lower, ["compare", "vs", "versus", "difference between"])) {
      return handleComparison(q, lower, schools);
    }
    if (matchesPattern(lower, ["best", "top", "highest", "ranked", "leading"])) {
      return handleRanking(q, lower, schools);
    }
    if (matchesPattern(lower, ["oversubscribed", "admissions", "places", "applications", "hard to get"])) {
      return handleAdmissions(q, lower, schools);
    }
    if (matchesPattern(lower, ["outstanding", "good", "requires improvement", "inadequate", "ofsted"])) {
      return handleOfsted(q, lower, schools);
    }
    if (matchesPattern(lower, ["average", "mean", "median", "statistics", "stats", "how many"])) {
      return handleStatistics(q, lower, schools);
    }
    if (matchesPattern(lower, ["sixth form", "a-level", "a level", "ks5", "post-16"])) {
      return handleSixthForm(q, lower, schools);
    }
    if (matchesPattern(lower, ["private", "independent", "state", "sector"])) {
      return handleSector(q, lower, schools);
    }
    if (matchesPattern(lower, ["borough", "area", "near", "in "])) {
      return handleBorough(q, lower, schools);
    }
    if (matchesPattern(lower, ["nursery", "nurseries", "primary", "secondary"])) {
      return handlePhase(q, lower, schools);
    }
    // Fallback: try school name match
    const nameMatch = findSchoolByName(q, schools);
    if (nameMatch) return formatSchoolDetail(nameMatch);

    return {
      text: `I can help you with questions about London schools. Try asking about:<br>
        - Specific schools ("Tell me about Mossbourne Academy")<br>
        - Rankings ("Top 5 schools by Attainment 8")<br>
        - Comparisons ("Compare state vs private")<br>
        - Ofsted ratings ("Outstanding schools in Camden")<br>
        - Admissions ("Which schools are oversubscribed?")<br>
        - Statistics ("Average Progress 8 score")`,
      suggestions: SUGGESTIONS.slice(0, 4)
    };
  }

  function matchesPattern(text, patterns) {
    return patterns.some(p => text.includes(p));
  }

  function findSchoolByName(q, schools) {
    const lower = q.toLowerCase().replace(/[?.,!]/g, "").trim();
    // Exact match first
    let match = schools.find(s => s.name.toLowerCase() === lower);
    if (match) return match;
    // Partial match
    const words = lower.split(/\s+/).filter(w => w.length > 2 && !["the","and","school","academy","college","what","about","tell","show","info","how","is"].includes(w));
    if (words.length) {
      match = schools.find(s => words.every(w => s.name.toLowerCase().includes(w)));
      if (match) return match;
      match = schools.find(s => words.some(w => s.name.toLowerCase().includes(w)));
    }
    return match || null;
  }

  function findBoroughSchools(q, schools) {
    const lower = q.toLowerCase();
    const borough = schools.map(s => s.borough).find(b => lower.includes(b.toLowerCase()));
    return borough ? { borough, list: schools.filter(s => s.borough === borough) } : null;
  }

  // ── Intent Handlers ──────────────────────────────────
  function handleSchoolLookup(q, lower, schools) {
    const school = findSchoolByName(q, schools);
    if (school) return formatSchoolDetail(school);
    return { text: "I couldn't find that school. Try searching with the school's full name, or check the school list.", suggestions: ["Show all schools", "Schools in Camden"] };
  }

  function handleComparison(q, lower, schools) {
    if (lower.includes("state") && lower.includes("private") || lower.includes("independent")) {
      const state = schools.filter(s => s.sector === "State");
      const priv = schools.filter(s => s.sector === "Private");
      const stateA8 = avgField(state.filter(s => s.performance?.ks4?.attainment8), s => s.performance.ks4.attainment8);
      const privA8 = avgField(priv.filter(s => s.performance?.ks4?.attainment8), s => s.performance.ks4.attainment8);
      return {
        text: `<strong>State vs Private Schools</strong><br><br>
          <strong>State schools:</strong> ${state.length} schools, avg ${Math.round(avgField(state, s => s.pupils))} pupils${stateA8 ? `, avg Att. 8: ${stateA8.toFixed(1)}` : ""}<br>
          <strong>Private schools:</strong> ${priv.length} schools, avg ${Math.round(avgField(priv, s => s.pupils))} pupils${privA8 ? `, avg Att. 8: ${privA8.toFixed(1)}` : ""}<br><br>
          Outstanding ratings: State ${state.filter(s => getR(s)==="Outstanding").length} (${pct(state.filter(s => getR(s)==="Outstanding").length, state.length)}%), Private ${priv.filter(s => getR(s)==="Outstanding").length} (${pct(priv.filter(s => getR(s)==="Outstanding").length, priv.length)}%)`,
        source: "Schoolter dataset",
        suggestions: ["Top private schools", "Top state schools", "Oversubscribed schools"]
      };
    }
    // Try to find two school names
    const names = q.replace(/compare|vs|versus|and/gi, "|").split("|").map(s => s.trim()).filter(Boolean);
    if (names.length >= 2) {
      const s1 = findSchoolByName(names[0], schools);
      const s2 = findSchoolByName(names[1], schools);
      if (s1 && s2) return formatComparison(s1, s2);
    }
    return { text: "To compare schools, try: 'Compare [School A] vs [School B]' or 'Compare state vs private'", suggestions: ["Compare state vs private", "Top 5 by Progress 8"] };
  }

  function handleRanking(q, lower, schools) {
    const n = parseInt(lower.match(/\d+/)?.[0]) || 5;
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = boroughMatch ? boroughMatch.list : schools;
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";

    if (lower.includes("progress")) {
      const ranked = pool.filter(s => s.performance?.ks4?.progress8 != null)
        .sort((a,b) => b.performance.ks4.progress8 - a.performance.ks4.progress8).slice(0, n);
      return formatRanking(`Top ${n} by Progress 8${label}`, ranked, s => `P8: <strong>${s.performance.ks4.progress8>0?"+":""}${s.performance.ks4.progress8}</strong>`);
    }
    if (lower.includes("ks2") || lower.includes("primary") || lower.includes("sats")) {
      const ranked = pool.filter(s => s.performance?.ks2?.combinedExpected != null)
        .sort((a,b) => b.performance.ks2.combinedExpected - a.performance.ks2.combinedExpected).slice(0, n);
      return formatRanking(`Top ${n} Primary Schools by KS2${label}`, ranked, s => `Combined: <strong>${s.performance.ks2.combinedExpected}%</strong>`);
    }
    // Default: Attainment 8
    const ranked = pool.filter(s => s.performance?.ks4?.attainment8 != null)
      .sort((a,b) => b.performance.ks4.attainment8 - a.performance.ks4.attainment8).slice(0, n);
    if (ranked.length) {
      return formatRanking(`Top ${n} by Attainment 8${label}`, ranked, s => `Att. 8: <strong>${s.performance.ks4.attainment8}</strong>`);
    }
    return { text: `No performance data available for ranking${label}.`, suggestions: ["Top 5 by Progress 8", "Outstanding schools"] };
  }

  function handleAdmissions(q, lower, schools) {
    const oversubscribed = schools.filter(s => s.admissions?.oversubscribed);
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = boroughMatch ? oversubscribed.filter(s => s.borough === boroughMatch.borough) : oversubscribed;
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";

    if (!pool.length) return { text: `No oversubscribed schools found${label}.`, suggestions: ["Best schools in Camden", "Top 5 by Attainment 8"] };

    const list = pool.slice(0, 8).map(s => {
      const apps = s.admissions.applications?.total || "?";
      const cap = s.admissions.capacity || "?";
      return `<strong>${esc(s.name)}</strong> (${esc(s.borough)}) — ${apps} applications for ${cap} places`;
    }).join("<br>");
    return {
      text: `<strong>${pool.length} oversubscribed schools${label}:</strong><br><br>${list}${pool.length > 8 ? `<br><em>...and ${pool.length-8} more</em>` : ""}`,
      source: "Schoolter admissions data",
      suggestions: ["Best schools by Attainment 8", "Schools with sixth form"]
    };
  }

  function handleOfsted(q, lower, schools) {
    let targetRating = "Outstanding";
    if (lower.includes("good")) targetRating = "Good";
    if (lower.includes("requires improvement")) targetRating = "Requires Improvement";
    if (lower.includes("inadequate")) targetRating = "Inadequate";

    const boroughMatch = findBoroughSchools(q, schools);
    const pool = boroughMatch ? schools.filter(s => s.borough === boroughMatch.borough) : schools;
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";
    const rated = pool.filter(s => getR(s) === targetRating);

    if (!rated.length) return { text: `No ${targetRating} schools found${label}.`, suggestions: ["Outstanding schools", "Good schools in Camden"] };

    const list = rated.slice(0, 8).map(s => `<strong>${esc(s.name)}</strong> — ${esc(s.borough)}, ${esc(s.phase)}`).join("<br>");
    return {
      text: `<strong>${rated.length} ${targetRating} schools${label}:</strong><br><br>${list}${rated.length > 8 ? `<br><em>...and ${rated.length-8} more</em>` : ""}`,
      source: "Ofsted ratings",
      suggestions: [`Top ${targetRating} by Attainment 8`, "Compare state vs private"]
    };
  }

  function handleStatistics(q, lower, schools) {
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = boroughMatch ? schools.filter(s => s.borough === boroughMatch.borough) : schools;
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";

    const total = pool.length;
    const totalPupils = pool.reduce((s,x) => s+x.pupils, 0);
    const withA8 = pool.filter(s => s.performance?.ks4?.attainment8 != null);
    const withP8 = pool.filter(s => s.performance?.ks4?.progress8 != null);
    const outstanding = pool.filter(s => getR(s) === "Outstanding").length;
    const oversubscribed = pool.filter(s => s.admissions?.oversubscribed).length;
    const stateCount = pool.filter(s => s.sector === "State").length;
    const privateCount = pool.filter(s => s.sector === "Private").length;

    return {
      text: `<strong>Statistics${label}:</strong><br><br>
        Schools: <strong>${total}</strong> (${stateCount} state, ${privateCount} private)<br>
        Total pupils: <strong>${totalPupils.toLocaleString()}</strong><br>
        Average school size: <strong>${total ? Math.round(totalPupils/total) : 0}</strong> pupils<br>
        Outstanding: <strong>${outstanding}</strong> (${pct(outstanding, total)}%)<br>
        Oversubscribed: <strong>${oversubscribed}</strong><br>
        ${withA8.length ? `Avg Attainment 8: <strong>${(withA8.reduce((s,x)=>s+x.performance.ks4.attainment8,0)/withA8.length).toFixed(1)}</strong><br>` : ""}
        ${withP8.length ? `Avg Progress 8: <strong>${(withP8.reduce((s,x)=>s+x.performance.ks4.progress8,0)/withP8.length).toFixed(2)}</strong>` : ""}`,
      source: "Schoolter dataset analysis",
      suggestions: ["Top 5 by Attainment 8", "Oversubscribed schools", "Outstanding schools"]
    };
  }

  function handleSixthForm(q, lower, schools) {
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = boroughMatch ? schools.filter(s => s.borough === boroughMatch.borough) : schools;
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";
    const withSF = pool.filter(s => s.hasSixthForm);
    const list = withSF.slice(0, 8).map(s => `<strong>${esc(s.name)}</strong> — ${esc(s.borough)}${s.performance?.ks5?.averagePointScore ? `, A-Level APS: ${s.performance.ks5.averagePointScore}` : ""}`).join("<br>");
    return {
      text: `<strong>${withSF.length} schools with sixth form${label}:</strong><br><br>${list}${withSF.length > 8 ? `<br><em>...and ${withSF.length-8} more</em>` : ""}`,
      source: "Schoolter dataset",
      suggestions: ["Top A-Level results", "Compare schools"]
    };
  }

  function handleSector(q, lower, schools) {
    const isPrivate = lower.includes("private") || lower.includes("independent");
    const sector = isPrivate ? "Private" : "State";
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = (boroughMatch ? schools.filter(s => s.borough === boroughMatch.borough) : schools).filter(s => s.sector === sector);
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";
    const list = pool.slice(0, 8).map(s => `<strong>${esc(s.name)}</strong> — ${esc(s.borough)}, ${esc(s.phase)}, Ofsted: ${getR(s)}`).join("<br>");
    return {
      text: `<strong>${pool.length} ${sector} schools${label}:</strong><br><br>${list}${pool.length > 8 ? `<br><em>...and ${pool.length-8} more</em>` : ""}`,
      source: "Schoolter dataset",
      suggestions: ["Compare state vs private", "Top 5 by Attainment 8"]
    };
  }

  function handleBorough(q, lower, schools) {
    const boroughMatch = findBoroughSchools(q, schools);
    if (!boroughMatch) return { text: "Which borough are you interested in? London boroughs include Camden, Westminster, Hackney, Tower Hamlets, Islington, and more.", suggestions: ["Schools in Camden", "Schools in Hackney", "Schools in Westminster"] };
    const pool = boroughMatch.list;
    const outstanding = pool.filter(s => getR(s)==="Outstanding").length;
    const phases = {};
    pool.forEach(s => { phases[s.phase] = (phases[s.phase]||0)+1; });
    const phaseStr = Object.entries(phases).map(([k,v]) => `${v} ${k}`).join(", ");
    return {
      text: `<strong>${boroughMatch.borough}</strong> has <strong>${pool.length}</strong> schools:<br><br>
        Phases: ${phaseStr}<br>
        Outstanding: <strong>${outstanding}</strong><br>
        Oversubscribed: <strong>${pool.filter(s=>s.admissions?.oversubscribed).length}</strong><br><br>
        Top rated: ${pool.filter(s=>getR(s)==="Outstanding").slice(0,3).map(s=>`<strong>${esc(s.name)}</strong>`).join(", ") || "None"}`,
      source: "Schoolter dataset",
      suggestions: [`Top schools in ${boroughMatch.borough}`, `Oversubscribed in ${boroughMatch.borough}`, "Compare boroughs"]
    };
  }

  function handlePhase(q, lower, schools) {
    let phase = "Secondary";
    if (lower.includes("nursery") || lower.includes("nurseries")) phase = "Nursery";
    else if (lower.includes("primary")) phase = "Primary";
    const boroughMatch = findBoroughSchools(q, schools);
    const pool = (boroughMatch ? schools.filter(s => s.borough === boroughMatch.borough) : schools).filter(s => s.phase === phase);
    const label = boroughMatch ? ` in ${boroughMatch.borough}` : "";
    const list = pool.slice(0, 8).map(s => `<strong>${esc(s.name)}</strong> — ${esc(s.borough)}, Ofsted: ${getR(s)}`).join("<br>");
    return {
      text: `<strong>${pool.length} ${phase} schools${label}:</strong><br><br>${list}${pool.length > 8 ? `<br><em>...and ${pool.length-8} more</em>` : ""}`,
      source: "Schoolter dataset",
      suggestions: [`Outstanding ${phase} schools`, `Top ${phase} by results`]
    };
  }

  // ── Formatters ────────────────────────────────────────
  function formatSchoolDetail(s) {
    const rating = getR(s);
    const a8 = s.performance?.ks4?.attainment8;
    const p8 = s.performance?.ks4?.progress8;
    const ks2 = s.performance?.ks2?.combinedExpected;
    let text = `<strong>${esc(s.name)}</strong><br>
      ${esc(s.borough)} &middot; ${esc(s.phase)} &middot; ${esc(s.gender)} &middot; ${esc(s.sector||"State")}<br>
      Ofsted: <strong>${esc(rating)}</strong>${s.ofsted?.date ? ` (${s.ofsted.date})` : ""}<br>
      Pupils: <strong>${s.pupils.toLocaleString()}</strong> &middot; Ages ${esc(s.ageRange)}<br>`;
    if (a8 != null) text += `Attainment 8: <strong>${a8}</strong><br>`;
    if (p8 != null) text += `Progress 8: <strong>${p8>0?"+":""}${p8}</strong><br>`;
    if (ks2 != null) text += `KS2 Combined: <strong>${ks2}%</strong><br>`;
    if (s.admissions) {
      text += `Admissions: ${s.admissions.oversubscribed ? '<strong style="color:var(--danger)">Oversubscribed</strong>' : 'Places available'}`;
      if (s.admissions.applications?.total) text += ` (${s.admissions.applications.total} applications)`;
      text += "<br>";
    }
    if (s.website) text += `<a href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website)}</a>`;
    return { text, source: "Schoolter dataset", suggestions: [`Schools in ${s.borough}`, "Compare schools", "Top 5 by Attainment 8"] };
  }

  function formatComparison(s1, s2) {
    const fields = [
      ["Phase", s1.phase, s2.phase],
      ["Ofsted", getR(s1), getR(s2)],
      ["Pupils", s1.pupils.toLocaleString(), s2.pupils.toLocaleString()],
      ["Attainment 8", s1.performance?.ks4?.attainment8 ?? "-", s2.performance?.ks4?.attainment8 ?? "-"],
      ["Progress 8", s1.performance?.ks4?.progress8 ?? "-", s2.performance?.ks4?.progress8 ?? "-"],
    ];
    let text = `<strong>${esc(s1.name)} vs ${esc(s2.name)}</strong><br><br>`;
    text += fields.map(([label, v1, v2]) => `${label}: <strong>${v1}</strong> vs <strong>${v2}</strong>`).join("<br>");
    return { text, source: "Schoolter comparison", suggestions: ["Top 5 by Attainment 8", "Oversubscribed schools"] };
  }

  function formatRanking(title, schools, metricFn) {
    if (!schools.length) return { text: "No data available for this ranking.", suggestions: SUGGESTIONS.slice(0, 4) };
    const list = schools.map((s, i) => `${i+1}. <strong>${esc(s.name)}</strong> (${esc(s.borough)}) — ${metricFn(s)}`).join("<br>");
    return { text: `<strong>${title}:</strong><br><br>${list}`, source: "Schoolter performance data", suggestions: ["Top 5 by Progress 8", "Outstanding schools"] };
  }

  // ── Helpers ───────────────────────────────────────────
  function getR(s) { return s.ofsted?.rating || s.ofstedRating || "N/A"; }
  function avgField(arr, fn) { return arr.length ? arr.reduce((s,x) => s + fn(x), 0) / arr.length : 0; }
  function pct(n, total) { return total ? Math.round(n/total*100) : 0; }
  function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

  return { init, toggle };
})();
