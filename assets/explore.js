/* Explore: collections -> meetings -> one meeting with video and transcript.
   Routes live in the URL hash: #/            all collections
                                #/<slug>      one collection's meetings
                                #/<slug>/<id> one meeting                      */
(() => {
  "use strict";
  const app = document.getElementById("app");
  const cache = new Map();
  const load = async (path) => {
    if (!cache.has(path)) {
      cache.set(path, fetch(path).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json();
      }));
    }
    return cache.get(path);
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const clock = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
  };
  const niceDate = (d) => {
    if (!d) return "";
    const t = new Date(d + "T12:00:00");
    return isNaN(t) ? d : t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };
  const yt = (id, t = 0) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${t ? "&t=" + Math.floor(t) + "s" : ""}`;
  const route = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const OTHER = new Set(["Other", "unknown", "Unknown"]);
  const whoLabel = (t) => (OTHER.has(t.speaker) ? "Other" : t.speaker_name || t.speaker);

  let teardown = null;
  async function render() {
    if (teardown) { teardown(); teardown = null; }
    const [slug, id] = route();
    app.innerHTML = '<p class="loading">Loading…</p>';
    try {
      if (!slug) await renderCollections();
      else if (!id) await renderCollection(slug);
      else await renderMeeting(slug, id);
    } catch (e) {
      app.innerHTML = `<p class="loading">Could not load this page (${esc(e.message)}). <a href="explore.html">Back to all collections</a>.</p>`;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);

  // ------------------------------------------------------------ collections
  async function renderCollections() {
    const cols = await load("data/collections.json");
    document.title = "Explore · Zoom Meeting Transcripts";
    const cats = [...new Set(cols.map((c) => c.category).filter(Boolean))].sort();
    const countries = [...new Set(cols.map((c) => c.country).filter(Boolean))].sort();
    app.innerHTML = `
      <div class="crumbs"><span>All collections</span></div>
      <div class="pagehead"><h1>Collections</h1><span class="sub">${cols.length} public bodies · pick one to see its meetings</span></div>
      <div class="tools">
        <input type="search" id="q" placeholder="Search by name or place" aria-label="Search collections">
        <select id="cat" aria-label="Category"><option value="">All kinds</option>${cats.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
        <select id="country" aria-label="Country"><option value="">All countries</option>${countries.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
      </div>
      <div class="grid" id="cards"></div>`;
    const draw = () => {
      const q = document.getElementById("q").value.trim().toLowerCase();
      const cat = document.getElementById("cat").value, country = document.getElementById("country").value;
      const shown = cols.filter((c) => (!cat || c.category === cat) && (!country || c.country === country) &&
        (!q || `${c.name} ${c.region} ${c.type}`.toLowerCase().includes(q)));
      document.getElementById("cards").innerHTML = shown.map((c) => `
        <a class="card" href="#/${encodeURIComponent(c.slug)}">
          <span class="kind">${esc(c.type || c.category || "")}</span>
          <h3>${esc(c.name)}</h3>
          <span class="where">${esc([c.region, c.country].filter(Boolean).join(", "))}</span>
          <span class="stats"><span><b>${fmt(c.meetings)}</b> meetings</span><span><b>${fmt(Math.round(c.hours))}</b> hours</span><span><b>${fmt(c.speakers)}</b> speakers</span></span>
        </a>`).join("") || '<p class="muted">No collections match.</p>';
    };
    ["q", "cat", "country"].forEach((i) => document.getElementById(i).addEventListener("input", draw));
    draw();
  }

  // ------------------------------------------------------------ one collection
  async function renderCollection(slug) {
    const [cols, meetings] = await Promise.all([load("data/collections.json"), load(`data/${slug}/meetings.json`)]);
    const c = cols.find((x) => x.slug === slug) || { slug, name: slug };
    document.title = `${c.name} · Zoom Meeting Transcripts`;
    app.innerHTML = `
      <div class="crumbs"><a href="#/">All collections</a><span>›</span><span>${esc(c.name)}</span></div>
      <div class="pagehead"><h1>${esc(c.name)}</h1><span class="sub">${esc([c.type, c.region].filter(Boolean).join(" · "))}</span></div>
      ${c.description ? `<p class="desc">${esc(c.description)}</p>` : ""}
      ${c.meetings_about || c.participants || c.decisions ? `<dl class="facts">
        ${c.meetings_about ? `<div><dt>The meetings</dt><dd>${esc(c.meetings_about)}</dd></div>` : ""}
        ${c.participants ? `<div><dt>Who takes part</dt><dd>${esc(c.participants)}</dd></div>` : ""}
        ${c.decisions ? `<div><dt>What they decide</dt><dd>${esc(c.decisions)}</dd></div>` : ""}
      </dl>` : ""}
      ${c.notes ? `<p class="collnotes"><b>Notes.</b> ${esc(c.notes)}</p>` : ""}
      <div class="chips">
        <span class="chip">${fmt(c.meetings)} meetings</span><span class="chip">${fmt(Math.round(c.hours))} hours</span>
        <span class="chip">${fmt(c.speakers)} speakers</span>
        ${c.first ? `<span class="chip">${esc(niceDate(c.first))} – ${esc(niceDate(c.last))}</span>` : ""}
        ${c.linked ? `<a class="chip" href="data/${encodeURIComponent(slug)}/registry.json">registry.json: who is who</a>` : `<span class="chip">original speaker labels (no OCR record)</span>`}
        ${(c.sensitivity || []).map((s) => `<span class="chip warn">${esc(s)}</span>`).join("")}
      </div>
      <div class="tools" style="margin-top:22px">
        <input type="search" id="q" placeholder="Search meeting titles or dates" aria-label="Search meetings">
        <select id="sort" aria-label="Sort"><option value="date">Oldest first</option><option value="-date">Newest first</option><option value="-minutes">Longest first</option></select>
      </div>
      <div class="tablewrap"><table class="list">
        <thead><tr><th>Date</th><th>Meeting</th><th class="num">Minutes</th><th class="num">Speakers</th><th class="num">Turns</th></tr></thead>
        <tbody id="rows"></tbody></table></div>
      <div style="height:40px"></div>`;
    const draw = () => {
      const q = document.getElementById("q").value.trim().toLowerCase();
      const sort = document.getElementById("sort").value;
      let rows = meetings.filter((m) => !q || `${m.title || ""} ${m.date || ""} ${niceDate(m.date)} ${m.id}`.toLowerCase().includes(q));
      rows = [...rows].sort((a, b) => sort === "-minutes" ? b.minutes - a.minutes
        : sort === "-date" ? String(b.date || "").localeCompare(String(a.date || "")) : String(a.date || "").localeCompare(String(b.date || "")));
      document.getElementById("rows").innerHTML = rows.map((m) => `<tr>
        <td>${esc(niceDate(m.date)) || '<span class="muted">—</span>'}</td>
        <td><a href="#/${encodeURIComponent(slug)}/${encodeURIComponent(m.id)}">${esc(m.title || m.id)}</a></td>
        <td class="num">${fmt(m.minutes)}</td><td class="num">${fmt(m.speakers)}</td><td class="num">${fmt(m.turns)}</td></tr>`).join("")
        || '<tr><td colspan="5" class="muted">No meetings match.</td></tr>';
    };
    ["q", "sort"].forEach((i) => document.getElementById(i).addEventListener("input", draw));
    draw();
  }

  // ------------------------------------------------------------ one meeting
  let ytReady = null;
  const youtubeApi = () => ytReady || (ytReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }));

  async function renderMeeting(slug, id) {
    const [cols, meetings, turns] = await Promise.all([
      load("data/collections.json"), load(`data/${slug}/meetings.json`), load(`data/${slug}/${id}.json`)]);
    const c = cols.find((x) => x.slug === slug) || { slug, name: slug };
    const idx = meetings.findIndex((m) => m.id === id);
    const m = meetings[idx] || { id };
    const prev = meetings[idx - 1], next = meetings[idx + 1];
    document.title = `${m.title || id} · ${c.name}`;

    const people = new Map();
    for (const t of turns) {
      const key = OTHER.has(t.speaker) ? "Other" : t.speaker;
      const p = people.get(key) || { key, name: whoLabel(t), turns: 0, seconds: 0 };
      p.turns += 1; p.seconds += t.end - t.start; people.set(key, p);
    }
    const roster = [...people.values()].sort((a, b) => b.seconds - a.seconds);
    const hasOcr = turns.some((t) => t.ocr_label);

    app.innerHTML = `
      <div class="crumbs"><a href="#/">All collections</a><span>›</span><a href="#/${encodeURIComponent(slug)}">${esc(c.name)}</a><span>›</span><span>${esc(niceDate(m.date) || id)}</span></div>
      <div class="pagehead"><h1>${esc(m.title || id)}</h1>
        <span class="sub">${esc(niceDate(m.date))}${m.minutes ? ` · ${fmt(m.minutes)} min` : ""} · ${fmt(turns.length)} turns · ${fmt(roster.filter((p) => p.key !== "Other").length)} speakers ·
        <a href="${yt(id)}" target="_blank" rel="noopener">YouTube ↗</a> · <a href="data/${encodeURIComponent(slug)}/${encodeURIComponent(id)}.json">transcript JSON</a></span></div>
      <div class="meeting">
        <div class="stick">
          <div class="player" id="player">${m.embeddable === false
            ? `<div class="noembed"><div>The publisher has turned off embedding for this video.<br><a href="${yt(id)}" target="_blank" rel="noopener">Watch it on YouTube ↗</a><br><span style="font-size:13px">Timestamps in the transcript open YouTube at that moment.</span></div></div>`
            : '<div id="yt"></div>'}</div>
          <div class="nowbox" aria-live="polite"><div class="muted" style="font-size:13px">Speaking now</div><div class="who" id="nowWho">—</div><div class="raw" id="nowRaw"></div></div>
          <div class="people"><h3>Speakers</h3><ul id="people">${roster.map((p) => `<li><button data-k="${esc(p.key)}" aria-pressed="false"><span>${esc(p.name)}</span><span class="count">${p.turns} turns · ${clock(p.seconds)}</span></button></li>`).join("")}</ul></div>
          <div class="meetnav">
            ${prev ? `<a class="btn" href="#/${encodeURIComponent(slug)}/${encodeURIComponent(prev.id)}">‹ Previous meeting</a>` : ""}
            ${next ? `<a class="btn" href="#/${encodeURIComponent(slug)}/${encodeURIComponent(next.id)}">Next meeting ›</a>` : ""}
          </div>
        </div>
        <div class="transcript ${hasOcr ? "" : "hide-ocr"}" id="tx">
          <div class="bar">
            <input type="search" id="find" placeholder="Search this transcript" aria-label="Search this transcript">
            ${hasOcr ? '<label><input type="checkbox" id="showOcr" checked> OCR labels</label>' : ""}
            <label><input type="checkbox" id="follow" checked> Follow video</label>
            <span id="count"></span>
          </div>
          <div id="turns"></div>
        </div>
      </div>`;

    // transcript
    let filterSpeaker = null;
    const turnsEl = document.getElementById("turns");
    const drawTurns = () => {
      const q = document.getElementById("find").value.trim();
      const ql = q.toLowerCase();
      const re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
      let shown = 0;
      turnsEl.innerHTML = turns.map((t, i) => {
        const key = OTHER.has(t.speaker) ? "Other" : t.speaker;
        if (filterSpeaker && key !== filterSpeaker) return "";
        if (ql && !t.text.toLowerCase().includes(ql)) return "";
        shown += 1;
        const text = re ? esc(t.text).replace(re, (x) => `<mark>${x}</mark>`) : esc(t.text);
        const name = key === "Other" ? '<span class="other" title="No name, or a room, device or organisation tile">Other</span>' : esc(whoLabel(t));
        const raw = t.ocr_label && t.ocr_label !== t.speaker_name ? `<span class="ocr" title="The name as OCR read it">${esc(t.ocr_label)}</span>` : "";
        return `<div class="turn" data-i="${i}"><span class="t">${clock(t.start)}</span><div class="name">${name}${raw}</div><p class="txt">${text}</p></div>`;
      }).join("") || '<p class="empty">No turns match.</p>';
      document.getElementById("count").textContent = shown === turns.length ? `${turns.length} turns` : `${shown} of ${turns.length} turns`;
      markNow(true);
    };
    document.getElementById("find").addEventListener("input", drawTurns);
    const ocrBox = document.getElementById("showOcr");
    if (ocrBox) ocrBox.addEventListener("change", () => document.getElementById("tx").classList.toggle("hide-ocr", !ocrBox.checked));
    document.getElementById("people").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      filterSpeaker = filterSpeaker === b.dataset.k ? null : b.dataset.k;
      document.querySelectorAll("#people button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.k === filterSpeaker)));
      drawTurns();
    });

    // player
    let player = null, timer = null, current = -1, lastUserScroll = 0;
    const starts = turns.map((t) => t.start);
    const at = (time) => {
      let lo = 0, hi = starts.length - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      return ans >= 0 && time <= turns[ans].end + 1.5 ? ans : -1;
    };
    function showNow(i) {
      const t = turns[i];
      document.getElementById("nowWho").textContent = t ? whoLabel(t) : "—";
      document.getElementById("nowRaw").innerHTML = t && t.ocr_label ? `Read on screen as <span class="mono">${esc(t.ocr_label)}</span>` : "";
    }
    function markNow(force) {
      const time = player && player.getCurrentTime ? player.getCurrentTime() : -1;
      const i = time >= 0 ? at(time) : -1;
      if (i === current && !force) return;
      current = i;
      turnsEl.querySelectorAll(".turn.now").forEach((el) => el.classList.remove("now"));
      if (i < 0) return;
      showNow(i);
      const el = turnsEl.querySelector(`.turn[data-i="${i}"]`);
      if (!el) return;
      el.classList.add("now");
      if (!force && document.getElementById("follow").checked && Date.now() - lastUserScroll > 4000) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    const onWheel = () => { lastUserScroll = Date.now(); };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onWheel, { passive: true });

    turnsEl.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const row = e.target.closest(".turn"); if (!row) return;
      const t = turns[+row.dataset.i];
      if (player && player.seekTo) {
        player.seekTo(Math.max(0, t.start - 0.5), true); player.playVideo();
        lastUserScroll = 0;
      } else {
        window.open(yt(id, t.start - 1), "_blank", "noopener");
      }
    });

    drawTurns();
    if (turns[0]) showNow(0);

    if (m.embeddable !== false) {
      youtubeApi().then((YT) => {
        if (!document.getElementById("yt")) return;
        player = new YT.Player("yt", {
          videoId: id, host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (ev) => {
              document.getElementById("player").classList.toggle("live", ev.data === YT.PlayerState.PLAYING);
              clearInterval(timer);
              if (ev.data === YT.PlayerState.PLAYING) timer = setInterval(() => markNow(false), 300);
              markNow(false);
            },
            onError: () => {
              document.getElementById("player").innerHTML = `<div class="noembed"><div>This video can't be played here.<br><a href="${yt(id)}" target="_blank" rel="noopener">Watch it on YouTube ↗</a></div></div>`;
              player = null;
            },
          },
        });
      });
    }
    teardown = () => {
      clearInterval(timer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onWheel);
      if (player && player.destroy) player.destroy();
    };
  }

  render();
})();
