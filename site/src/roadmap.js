// Roadmap showcase renderer. `roadmap build` embeds the repo's data as JSON and this file turns
// it into the page. It builds everything with DOM methods: no HTML parsing, no inline style
// attributes, no eval. That is what lets the page run under a hash-pinned Content-Security-Policy
// with Trusted Types. Shared Mission Control classes live in site/assets. To change what the page
// says, edit the repo files and run `roadmap build`, not this file.
(() => {
  "use strict";

  /* ---------- helpers ---------- */
  const D = JSON.parse(document.getElementById("data").textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smooth = calm ? "auto" : "smooth";
  const sleep = (ms) => new Promise((r) => setTimeout(r, calm ? 0 : ms));
  const SVG = "http://www.w3.org/2000/svg";

  // Links from the data are either in-page (#token) or https. Anything else never becomes a link.
  function safeHref(u) {
    const s = String(u || "");
    if (s.startsWith("#")) return /^#[A-Za-z0-9._~-]*$/.test(s) ? s : null;
    try {
      return new URL(s).protocol === "https:" ? s : null;
    } catch {
      return null;
    }
  }

  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k === null || k === undefined || k === false || k === "") continue;
      el.append(k instanceof Node ? k : String(k));
    }
    return el;
  }

  // h("a", { class, href, on: { click }, vars: { "--n": 3 }, data: { k: "v" } }, ...children)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "href") {
        const u = safeHref(v);
        if (u) {
          el.setAttribute("href", u);
          if (u.startsWith("https:")) {
            el.target = "_blank";
            el.rel = "noopener noreferrer";
          }
        }
      } else if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === "vars") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, String(val));
      else if (k === "data") Object.assign(el.dataset, v);
      else if (/^on|^style$|^srcdoc$/i.test(k)) throw new Error("refused attribute " + k);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    return add(el, kids);
  }
  const frag = (...kids) => add(document.createDocumentFragment(), kids);

  // Text from the build arrives as tokens: ["t", text] ["c", code] ["b", bold] ["a", text, url].
  function rich(toks, noLinks) {
    return (toks || []).map((t) => {
      if (t[0] === "c") return h("code", { class: "mono" }, t[1]);
      if (t[0] === "b") return h("strong", null, t[1]);
      if (t[0] === "a" && !noLinks) return h("a", { href: t[2] }, t[1]);
      return t[1];
    });
  }
  const plain = (toks) => (toks || []).map((t) => t[1]).join("");

  const ICON = {
    shield: [["path", { d: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" }], ["path", { d: "m9 12 2 2 4-4" }]],
    key: [["circle", { cx: 8, cy: 15, r: 4 }], ["path", { d: "m11 12 9-9m-3 3 3 3m-6 0 2 2" }]],
    lock: [["rect", { x: 4, y: 10, width: 16, height: 11, rx: 2 }], ["path", { d: "M8 10V7a4 4 0 0 1 8 0v3" }]],
    bot: [["rect", { x: 4, y: 8, width: 16, height: 12, rx: 3 }], ["path", { d: "M12 4v4M9 14h.01M15 14h.01" }]],
    laptop: [["rect", { x: 4, y: 5, width: 16, height: 11, rx: 1.5 }], ["path", { d: "M2 19h20" }]],
    doc: [["path", { d: "M7 3h7l5 5v13H7z" }], ["path", { d: "M14 3v5h5M10 13h6M10 17h6" }]],
    term: [["rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ["path", { d: "m7 9 3 3-3 3M13 15h4" }]],
    spark: [["path", { d: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" }]],
    chev: [["path", { d: "m9 6 6 6-6 6" }]],
  };
  function icon(name, size = 20) {
    const s = document.createElementNS(SVG, "svg");
    const base = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": name === "chev" ? 2.4 : 1.9, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    for (const [k, v] of Object.entries(base)) s.setAttribute(k, String(v));
    for (const [tag, a] of ICON[name] || ICON.spark) {
      const e = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v));
      s.append(e);
    }
    return s;
  }

  function shuffle(n) {
    const a = [...Array(n).keys()];
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  }

  const MS = new Map(D.milestones.map((m) => [m.id, m]));
  const msOf = (tok) => (/^m\d+$/.test(tok) ? MS.get(tok.toUpperCase()) : undefined);
  const msHref = (id) => "#" + id.toLowerCase();
  const STATUS = { done: ["green", "✓ done"], active: ["amber", "● in progress"], next: ["amber", "▶ up next"], queued: ["", "queued"] };
  const CONCEPT = { reviewed: ["green", "reviewed"], written: ["teal", "written"], todo: ["", "to write"] };
  const CERT = { passed: "green", booked: "amber", studying: "amber", expired: "red" };
  const LABEL = { FACT: "teal", COMMUNITY: "amber", UNVERIFIED: "violet" };
  const ROLES = new Set(["ops", "media", "dev", "core", "sec", "net"]);
  const chip = (cls, ...kids) => h("span", { class: cls ? "chip " + cls : "chip" }, kids);
  const statusChip = (s) => chip(STATUS[s][0], STATUS[s][1]);
  const msChip = (id) => (/^M\d+$/.test(id) ? h("a", { class: "chip", href: msHref(id) }, id) : chip("", id));
  const thead = (...cols) => h("thead", null, h("tr", null, cols.map((c) => h("th", { scope: "col" }, c))));
  const card = (title, ...kids) => h("div", { class: "panel card" }, h("h3", null, title), kids);
  const evidenceLink = (e) => (e.url ? h("a", { href: e.url }, e.text) : h("code", { class: "mono" }, e.text));

  /* ---------- theme, toast, confetti, count-up ---------- */
  try {
    const t = localStorage.getItem("mc:theme");
    if (t === "dark" || t === "light") root.dataset.theme = t;
  } catch {
    /* storage blocked: follow the system theme */
  }
  function toggleTheme() {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("mc:theme", root.dataset.theme);
    } catch {
      /* not saved */
    }
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("on"), 2600);
  }

  function confetti() {
    if (calm) return;
    const c = $("#confetti"), x = c.getContext("2d");
    if (!x) return;
    c.width = innerWidth;
    c.height = innerHeight;
    const css = getComputedStyle(root);
    const cols = ["--amber", "--teal", "--green", "--violet", "--red"].map((v) => css.getPropertyValue(v).trim());
    const ps = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 4,
      s: 4 + Math.random() * 5, r: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0],
    }));
    let f = 0;
    (function tick() {
      x.clearRect(0, 0, c.width, c.height);
      for (const p of ps) {
        p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += 0.2;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); x.restore();
      }
      if (++f < 110) requestAnimationFrame(tick);
      else x.clearRect(0, 0, c.width, c.height);
    })();
  }

  function countUp(el) {
    const m = /^(\d+)(.*)$/.exec(el.dataset.v || "");
    if (!m || calm) {
      el.textContent = el.dataset.v || "";
      return;
    }
    const end = +m[1], t0 = performance.now();
    (function f(t) {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + m[2];
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- glossary hover hints ---------- */
  const TERM = new Map(D.glossary.map((g) => [g.term, g]));
  const hov = D.glossary.filter((g) => g.hover);
  const exact = new Map(hov.filter((g) => g.cs).map((g) => [g.term, g]));
  const loose = new Map(hov.filter((g) => !g.cs).map((g) => [g.term.toLowerCase(), g]));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termRe = (list, flags) => {
    if (!list.length) return null;
    const alt = list.map((g) => reEsc(g.term)).sort((a, b) => b.length - a.length).join("|");
    // Terms come from glossary.md and are escaped, so this is a plain list of literals: no nested
    // quantifiers, nothing to backtrack into. Runtime-built because the glossary is data.
    return new RegExp(`(?<![\\w-])(${alt})s?(?![\\w-])`, flags); // nosemgrep: detect-non-literal-regexp
  };
  const reExact = termRe([...exact.values()], "g");
  const reLoose = termRe([...loose.values()], "gi");
  // No hints inside controls, code, headings, labels or the glossary itself.
  const NO_HINT = "a,button,code,pre,abbr,h1,h2,h3,h4,input,label,th,.chip,.eyebrow,.badge,.proof,.console,.log," +
    ".gloss,.flip,.seg,.gw,.gn,.gs,.an,.at,.st,.sid,.rm-meta,.rm-timer,#tip,#pal";

  function findTerm(text, from) {
    let best = null;
    for (const [re, map, fold] of [[reExact, exact, false], [reLoose, loose, true]]) {
      if (!re) continue;
      re.lastIndex = from;
      const m = re.exec(text);
      if (!m || (best && m.index >= best.index)) continue;
      const g = map.get(fold ? m[1].toLowerCase() : m[1]);
      if (g) best = { index: m.index, len: m[0].length, g };
    }
    return best;
  }

  function termsIn(text) {
    const out = [];
    for (let from = 0, m; (m = findTerm(text, from)); from = m.index + m.len) if (!out.includes(m.g)) out.push(m.g);
    return out;
  }

  // Underline the first use of each term in scope; hovering or focusing it shows the definition.
  function glossify(scope, seen) {
    if (!scope || (!reExact && !reLoose)) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && !n.parentElement.closest(NO_HINT) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let node of nodes) {
      let from = 0;
      while (node && from < node.nodeValue.length) {
        const m = findTerm(node.nodeValue, from);
        if (!m) break;
        if (seen.has(m.g.term)) {
          from = m.index + m.len;
          continue;
        }
        seen.add(m.g.term);
        const hit = node.splitText(m.index);
        const rest = hit.splitText(m.len);
        hit.replaceWith(h("abbr", { class: "g", tabindex: "0", data: { k: m.g.term } }, hit.nodeValue));
        node = rest;
        from = 0;
      }
    }
  }

  function tipShow(a) {
    const g = TERM.get(a.dataset.k);
    if (!g) return;
    const tip = $("#tip");
    tip.replaceChildren(h("b", null, g.term), ...rich(g.def, true));
    const r = a.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - 310, r.left)) + "px";
    tip.style.top = (r.bottom + 8 + tip.offsetHeight < innerHeight ? r.bottom + 8 : r.top - 8 - tip.offsetHeight) + "px";
    tip.style.opacity = "1";
    a.setAttribute("aria-describedby", "tip");
  }
  function tipHide() {
    $("#tip").style.opacity = "0";
    for (const a of $$("abbr.g[aria-describedby]")) a.removeAttribute("aria-describedby");
  }

  /* ---------- router ---------- */
  const VIEWS = {
    overview: ["Overview", viewOverview],
    roadmap: ["Roadmap", viewRoadmap],
    evidence: ["Evidence", viewEvidence],
    skills: ["Skills", viewSkills],
    certs: ["Certs", viewCerts],
    concepts: ["Concepts", viewConcepts],
    glossary: ["Glossary", viewGlossary],
  };
  let gen = 0; // bumps on every view change; animations started by an old view stop
  let current = null, pending = null, after = [], simPlay = null, glossFilter = null, io = null;

  function render(key, first) {
    gen++;
    current = key;
    after = [];
    simPlay = null;
    glossFilter = null;
    const m = msOf(key);
    const [title, fn] = m ? [`${m.id} ${m.title}`, () => viewMilestone(m)] : VIEWS[key];
    const view = $("#view");
    view.replaceChildren(fn());
    document.title = key === "overview" ? D.site.title : `${title} · ${D.site.title}`;
    const navKey = m ? "#roadmap" : "#" + key;
    for (const a of $$("#nav a")) {
      if (a.getAttribute("href") === navKey) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    glossify(view, new Set());
    reveals(view);
    tipHide();
    for (const f of after) f();
    if (!first) {
      scrollTo(0, 0);
      const hd = $("h1", view);
      if (hd) {
        hd.tabIndex = -1;
        hd.focus({ preventScroll: true });
      }
    }
    const p = pending;
    pending = null;
    if (p) p();
  }

  function route(first) {
    const tok = location.hash.slice(1) || "overview";
    if (tok === "present") {
      if (!current) render("overview", true);
      openDeck();
      return;
    }
    if (deckIsOpen()) closeDeck(false);
    const rep = /^(M\d+)-R\d+$/.exec(tok);
    const key = Object.hasOwn(VIEWS, tok) || msOf(tok) ? tok : rep && MS.has(rep[1]) ? rep[1].toLowerCase() : null;
    if (!key) {
      if (!current) render("overview", true);
      return;
    }
    if (rep) pending = () => openRep(tok);
    if (key === current) {
      const p = pending;
      pending = null;
      if (p) p();
      return;
    }
    render(key, first);
  }

  function go(tok, then) {
    if (deckIsOpen()) closeDeck();
    if (tok === current) {
      if (location.hash.slice(1) !== tok) setHash(tok);
      if (then) then();
      return;
    }
    pending = then || null;
    location.hash = tok;
  }

  function setHash(tok) {
    try {
      history.replaceState(null, "", "#" + tok);
    } catch {
      /* sandboxed frame: keep the old hash */
    }
  }

  function openRep(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const btn = $(".rm-sh", el);
    el.classList.add("open");
    if (btn) btn.setAttribute("aria-expanded", "true");
    el.scrollIntoView({ behavior: smooth, block: "center" });
    if (btn) btn.focus({ preventScroll: true });
  }

  function flash(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: smooth, block: "center" });
    el.classList.remove("rm-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("rm-flash");
  }

  function reveals(scope) {
    const els = $$(".reveal", scope);
    if (io) io.disconnect();
    if (calm || !("IntersectionObserver" in window)) {
      for (const e of els) e.classList.add("in");
      return;
    }
    io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -6% 0px" });
    for (const e of els) io.observe(e);
  }

  /* ---------- shared pieces ---------- */
  const vh = (kicker, title, ...lede) =>
    h("header", { class: "rm-vh" }, h("span", { class: "eyebrow" }, kicker), h("h1", null, title), lede.length ? h("p", null, lede) : null);

  function sec(id, kicker, title, lede, ...body) {
    return h("section", { class: "sec2 reveal", id },
      h("div", { class: "head" }, h("span", { class: "eyebrow kicker" }, kicker), h("h2", { class: "big-h" }, title),
        lede ? h("p", null, Array.isArray(lede) ? rich(lede) : lede) : null),
      body);
  }

  function proofStats() {
    const s = D.stats;
    const stat = (v, k) => h("span", null, h("b", { data: { v } }, v), k);
    return h("div", { class: "proof" },
      stat(`${s.milestones[0]}/${s.milestones[1]}`, "milestones"),
      stat(`${s.reps[0]}/${s.reps[1]}`, "reps"),
      stat(String(s.proofs), "proofs"),
      stat(`${s.explainers[0]}/${s.explainers[2]}`, "explainers"),
      stat(`${s.certs[0]}/${s.certs[1]}`, "certs"));
  }

  function upNext() {
    const nx = D.next;
    if (!nx) {
      return h("div", { class: "panel continue" },
        h("div", null, h("div", { class: "eyebrow" }, "Status"), h("div", { class: "nt" }, "Every milestone is done.")),
        h("p", null, "Every claim on this page links to its proof."),
        h("a", { class: "btn pri", href: "#evidence" }, "Browse the evidence →"));
    }
    const m = MS.get(nx.milestone), isRep = nx.kind === "rep";
    return h("div", { class: "panel continue" },
      h("div", null, h("div", { class: "eyebrow" }, isRep ? `Up next · ${nx.id}` : `Up next · ${m.id} exit criteria`),
        h("div", { class: "nt" }, `${m.id} ${m.title}`)),
      h("p", null, rich(nx.text), nx.doneWhen.length ? [h("br"), h("span", { class: "rm-muted" }, "Done when: "), rich(nx.doneWhen)] : null),
      h("a", { class: "btn pri", href: isRep ? "#" + nx.id : msHref(m.id) }, `Open ${isRep ? nx.id : m.id} →`));
  }

  function agentCard(m) {
    const [k, t] = m.progress;
    const bar = h("i");
    bar.style.width = (t ? (100 * k) / t : 0) + "%";
    const cls = m.status === "done" ? " done" : m.status === "queued" ? "" : " active";
    return h("a", { class: "agent rm-agent" + cls, href: msHref(m.id), "aria-label": `${m.id} ${m.title}: ${STATUS[m.status][1]}, ${k} of ${t} ticked` },
      h("div", { class: "an" }, h("span", null, m.id), h("span", null, `${k}/${t}`)),
      h("div", { class: "at" }, m.title),
      h("div", { class: "bar" }, bar),
      h("div", { class: "st" }, STATUS[m.status][1]));
  }

  const tile = (x) => h("div", { class: x.wide ? "panel tile wide" : "panel tile" }, h("div", { class: "ico" }, icon(x.icon)),
    h("h3", null, x.title), h("p", null, rich(x.text)));

  function pathEl() {
    return h("div", { class: "path", vars: { "--n": D.phases.length } }, D.phases.map((p) => h("div", { class: "pnode" },
      h("div", { class: "n" }, String(p.num)),
      h("div", { class: "w" }, p.milestones.join(" · ")),
      h("h3", null, p.title),
      h("p", null, "Cert gate: " + p.gate))));
  }

  function labCards() {
    const lab = D.lab;
    return h("div", { class: "cards" },
      lab.nodes.map((n) => h("div", { class: "panel card rm-node", vars: ROLES.has(n.role) ? { "--role": `var(--c-${n.role})` } : null },
        h("div", { class: "sub" }, h("span", { class: "dot" }), "node"), h("h3", null, n.role), h("p", null, n.job))),
      h("div", { class: "panel card rm-node", vars: { "--role": "var(--c-net)" } },
        h("div", { class: "sub" }, h("span", { class: "dot" }), "network"), h("h3", null, "Edge and access"),
        h("ul", null, lab.network.map((x) => h("li", null, x)))));
  }

  function ledgerTable(rows) {
    return h("div", { class: "panel tbl-wrap" }, h("table", { class: "t" },
      thead("Date", "Milestone", "Rep", "Kind", "Claim", "Evidence", "How to verify"),
      h("tbody", null, rows.map((p) => h("tr", null,
        h("td", { class: "mono rm-nowrap" }, p.date),
        h("td", null, msChip(p.milestone)),
        h("td", { class: "mono rm-nowrap" }, p.rep || "·"),
        h("td", null, chip("", p.kind)),
        h("td", { class: "rm-claim" }, p.claim),
        h("td", null, evidenceLink(p.evidence)),
        h("td", { class: "rm-claim" }, p.verify))))));
  }

  function emptyLedger(full) {
    const first = D.next ? D.next.id : "the first rep";
    return h("div", { class: "panel rm-empty" },
      h("h3", null, "No proof logged yet"),
      h("p", null, `The ledger starts empty on purpose: nothing counts until it's proven. The first row lands when ${first} passes its test.`),
      full ? [
        h("p", null, "Each row is one line of ledger.csv. Here is the shape of one:"),
        h("div", { class: "rm-example" },
          h("pre", { class: "cmd" }, h("code", null,
            "date,milestone,rep,kind,claim,evidence,verify\n" +
            "2026-11-02,M0,M0-R5,lab,pre-commit hooks pass,evidence/m0-pre-commit.txt,re-run pre-commit run --all-files")),
          h("span", { class: "rm-meta" }, "Example only. Not a real row.")),
      ] : null);
  }

  const proofItem = (p) => h("li", null, h("span", { class: "rm-meta" }, `${p.date} · ${p.kind} · `), p.claim, " · ", evidenceLink(p.evidence));

  function conceptRow(c) {
    const st = CONCEPT[c.status];
    return h("li", { class: "rm-concept", id: "c-" + c.slug }, h("span", { class: "rm-ico teal" }, icon("spark", 18)),
      h("div", null, h("p", null, rich(c.q)),
        h("div", { class: "rm-row" }, h("code", { class: "mono" }, c.slug), chip(st[0], st[1]), c.url ? h("a", { href: c.url }, "Read the explainer") : null)));
  }

  function domainCard(d, compact) {
    const bar = h("i");
    bar.style.width = (d.avg === null ? 0 : (100 * d.avg) / 3) + "%";
    const skills = D.skills.filter((s) => s.domain === d.name);
    const dots = (n) => h("span", { class: "rm-dots", "aria-hidden": "true" }, [1, 2, 3].map((k) => h("i", { class: n !== null && n >= k ? "on" : null })));
    return h("div", { class: "panel rm-domain" },
      h("div", { class: "rm-row" }, h("h3", null, d.name),
        h("span", { class: "rm-meta" }, d.avg === null ? `${d.total} skills · not rated yet` : `avg ${d.avg.toFixed(1)} of 3 · ${d.rated}/${d.total} rated`)),
      h("div", { class: "bar" }, bar),
      compact ? null : h("ul", null, skills.map((s) => h("li", null,
        h("span", null, s.name, s.evidence.length ? [" · ", rich(s.evidence)] : null),
        msChip(s.milestone), dots(s.score),
        h("span", { class: "rm-score", "aria-label": s.score === null ? "not rated" : `score ${s.score} of 3` }, s.score === null ? "?" : String(s.score))))));
  }

  /* ---------- overview ---------- */
  function viewOverview() {
    const proof = proofStats();
    after.push(() => $$("b[data-v]", proof).forEach(countUp));
    const hero = h("section", { class: "hero2" },
      h("div", { class: "rm-hero-l" },
        h("span", { class: "badge" }, h("b", null, D.site.badge), D.site.eyebrow),
        h("h1", null, D.site.headline[0] + " ", h("em", null, D.site.headline[1])),
        h("p", { class: "lede" }, rich(D.site.lede)),
        h("div", { class: "cta" },
          h("a", { class: "btn lg glow", href: "#present" }, "▶ Start the walkthrough"),
          h("a", { class: "btn lg ghost", href: "#roadmap" }, `See all ${D.milestones.length} milestones`)),
        proof),
      h("div", { class: "rm-hero-r" }, heroConsole()));

    const start = D.start.length ? sec("start", `${D.start.length} ways in`, "Who this is for", null,
      h("div", { class: "cards" }, D.start.map((c) => h("a", { class: "panel card rm-start", href: c.href },
        h("span", { class: "eyebrow" }, c.kicker), h("h3", null, c.title), h("p", null, rich(c.text, true)), h("span", { class: "rm-go" }, c.cta + " →"))))) : null;
    const mission = sec("mission", "The mission", `${D.milestones.length} milestones, start to finish`,
      "Each one pairs a chapter of my homelab build with the security work that proves it. Amber is where I am now.",
      h("div", { class: "swarm" }, D.milestones.map(agentCard)));
    const gates = D.simulator ? sec("gates", "Integrity gates", D.simulator.title, D.simulator.intro, simEl()) : null;
    const loop = D.loop.length ? sec("loop", "How every milestone works", "The same loop, every time.", null,
      h("div", { class: "bento" }, D.loop.map(tile))) : null;
    const phases = sec("phases", `${D.phases.length} phases`, "Cert gates along the way",
      "A cert comes right after the milestones that teach it, so study time doubles as lab time.", pathEl(),
      h("div", { class: "rm-row rm-gap-top" }, h("a", { class: "btn", href: "#certs" }, "Prices and versions →")));
    const lab = D.lab ? sec("lab", "Hardware", D.lab.title, D.lab.summary, labCards()) : null;
    const latest = D.ledger.slice(0, 5);
    const proofSec = sec("proof", "Evidence", "Latest proof", "Newest first. Each row links to the file that proves it.",
      latest.length ? ledgerTable(latest) : emptyLedger(false),
      h("div", { class: "rm-row rm-gap-top" }, h("a", { class: "btn", href: "#evidence" }, "All evidence →")));
    const f = D.final;
    const fin = f ? h("section", { class: "panel final reveal" }, h("span", { class: "eyebrow" }, f.kicker), h("h2", null, f.title),
      h("p", null, rich(f.text)),
      h("div", { class: "cta" }, f.cta.map((c, i) => h("a", { class: "btn lg " + (i ? "ghost" : "glow"), href: c.href }, c.text)))) : null;
    return frag(hero, upNext(), start, mission, gates, loop, phases, lab, proofSec, fin);
  }

  // The hero console replays the last build's real `roadmap check` and `roadmap status` output.
  function heroConsole() {
    const body = h("div", { class: "body" });
    const name = h("span", null, "roadmap check");
    const left = h("span", null, ""), right = h("span", null, "");
    const n = D.checks.length;
    const el = h("div", { class: "console", role: "img", "aria-label": `Replay of the last build: roadmap check passed all ${n} checks.` },
      h("div", { class: "chrome" }, h("i"), h("i"), h("i"), name, h("span", { class: "live" }, h("b", { class: "dot" }), "REPLAY")),
      body,
      h("div", { class: "foot2" }, left, right));
    const g = gen;
    after.push(() => runConsole(g, body, name, left, right));
    return el;
  }

  function statusRows() {
    const s = D.stats, cur = D.current ? MS.get(D.current) : null, nx = D.next;
    if (!cur) return [["✓", "ok", "done", "Every milestone is done. Time to apply."]];
    const rows = [["●", "run", "now", `${cur.id} ${cur.title} (${cur.status}) · ${cur.progress[0]}/${cur.progress[1]} ticked`]];
    if (nx) {
      rows.push(["→", "", "next", `${nx.id} · ${plain(nx.text)}`]);
      if (nx.doneWhen.length) rows.push(["", "", "done when", plain(nx.doneWhen)]);
    }
    rows.push(["·", "", "proofs", String(s.proofs)], ["·", "", "reps", `${s.reps[0]}/${s.reps[1]}`],
      ["·", "", "explainers", `${s.explainers[0]}/${s.explainers[2]}`], ["·", "", "certs", `${s.certs[0]}/${s.certs[1]}`]);
    return rows;
  }

  async function runConsole(g, body, name, left, right) {
    const alive = () => g === gen;
    const row = (ic, cls, nm, ds, extra) => {
      const a = h("span", { class: "ic " + cls }, ic), c = h("span", { class: "ds" }, ds);
      body.append(h("div", { class: extra ? "row " + extra : "row" }, a, h("span", { class: "nm" }, nm), c));
      return { a, c };
    };
    const s = D.stats, n = D.checks.length;
    for (let loop = 0; alive(); loop++) {
      body.replaceChildren();
      const t0 = performance.now();
      const clock = () => { right.textContent = ((performance.now() - t0) / 1000).toFixed(1) + "s"; };
      left.textContent = "";
      right.textContent = "";
      if (loop % 2 === 0) {
        name.textContent = "roadmap check · replay of the last build";
        row("$", "", "uv run roadmap check", "", "cmdrow");
        let k = 0;
        for (const [nm, ds] of D.checks) {
          const x = row("◐", "run spin", nm, "checking…");
          await sleep(140 + Math.random() * 220);
          if (!alive()) return;
          x.a.className = "ic ok";
          x.a.textContent = "✓";
          x.c.textContent = ds;
          left.textContent = `${++k}/${n} checks`;
          clock();
        }
        row("→", "ok", "exit 0", `ok · ${D.milestones.length} milestones · ${s.reps[1]} reps · ${s.proofs} proofs`, "rm-gap");
      } else {
        name.textContent = "roadmap status · replay of the last build";
        row("$", "", "uv run roadmap status", "", "cmdrow");
        for (const [ic, cls, nm, ds] of statusRows()) {
          await sleep(320);
          if (!alive()) return;
          row(ic, cls, nm, ds);
          clock();
        }
        left.textContent = "exit 0";
      }
      if (calm) return;
      await sleep(4200);
    }
  }

  /* ---------- gate simulator ---------- */
  function simEl() {
    const sim = D.simulator, g = gen;
    let run = 0;
    const scn = sim.scenarios.map((s, i) => h("button", { class: "scn", type: "button", "aria-pressed": "false", on: { click: () => play(i) } },
      h("span", { class: "pl", "aria-hidden": "true" }, s.icon || "▶"),
      h("span", null, h("b", null, s.title), h("small", null, rich(s.summary, true)))));
    const pkt = h("div", { class: "pkt" });
    const gates = sim.gates.map((x) => h("div", { class: "gate" }, h("div", { class: "gw" }, x.where), h("div", { class: "gn" }, x.name),
      h("div", { class: "bar" }, h("i")), h("div", { class: "gs" }, "idle")));
    const lane = h("div", { class: "lane", vars: { "--n": sim.gates.length } }, h("div", { class: "track" }), pkt, gates);
    const local = sim.gates.filter((x) => x.zone === "local").length;
    const zone = h("div", { class: "zone", "aria-hidden": "true" },
      h("span", { vars: { "--w": local } }, "◂ my laptop (pre-commit) ▸"),
      h("span", { vars: { "--w": sim.gates.length - local } }, "◂ GitHub (CI on every push) ▸"));
    const log = h("div", { class: "log", "aria-label": "Simulated output" });
    const verdict = h("div", { class: "verdict", role: "status" });
    const stats = h("div", { class: "sim-stats" });
    const wrap = h("div", { class: "sim", id: "sim" },
      h("div", { class: "panel sim-l", role: "group", "aria-label": "Pick a change" }, scn),
      h("div", { class: "panel sim-r" }, lane, zone, log, verdict, stats));

    const barOf = (el) => $(".bar i", el), statusOf = (el) => $(".gs", el);
    const line = (cls, txt) => {
      log.append(h("div", { class: cls }, txt));
      log.scrollTop = log.scrollHeight;
    };
    function movePkt(el) {
      const lr = lane.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (lr.width) pkt.style.left = ((r.left + r.width / 2 - lr.left) / lr.width) * 100 + "%";
    }

    async function play(i, auto = false) {
      const id = ++run, s = sim.scenarios[i];
      const alive = () => id === run && g === gen;
      scn.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
      log.replaceChildren();
      verdict.replaceChildren();
      for (const el of gates) {
        el.className = "gate";
        barOf(el).style.width = "0%";
        statusOf(el).textContent = "idle";
      }
      pkt.className = "pkt on";
      pkt.style.left = "0%";
      const t0 = performance.now(), skip = new Set(s.skip || []);
      let passed = 0;
      const stat = () => stats.replaceChildren(
        h("span", null, "gates passed ", h("b", null, `${passed}/${sim.gates.length}`)),
        h("span", null, "elapsed ", h("b", null, ((performance.now() - t0) / 1000).toFixed(1) + "s")),
        h("span", null, "simulated: nothing is committed"));
      line("dim", "$ " + s.cmd);
      stat();
      for (let k = 0; k < sim.gates.length; k++) {
        if (!alive()) return;
        const gd = sim.gates[k], el = gates[k];
        movePkt(el);
        if (skip.has(gd.id)) {
          el.classList.add("skip");
          statusOf(el).textContent = "⇥ skipped";
          line("dim", `[${gd.name}] skipped: hooks bypassed with --no-verify`);
          await sleep(300);
          continue;
        }
        el.classList.add("scan");
        statusOf(el).textContent = "scanning…";
        line("warn", `[${gd.name}] ${gd.doing}…`);
        for (let p = 0; p <= 100; p += 20) {
          if (!alive()) return;
          barOf(el).style.width = p + "%";
          stat();
          await sleep(110);
        }
        el.classList.remove("scan");
        if (s.blockAt === gd.id) {
          el.classList.add("block");
          statusOf(el).textContent = "✕ blocked";
          pkt.classList.add("bad");
          line("bad", `[${gd.name}] ✕ ${s.finding}`);
          line("dim", "exit 1 · the change never reaches main");
          for (const x of gates.slice(k + 1)) {
            x.classList.add("skip");
            statusOf(x).textContent = "not reached";
          }
          verdict.replaceChildren(h("div", { class: "callout warn" }, h("b", null, `Blocked at ${gd.name}. `), rich(s.lesson)));
          glossify(verdict, new Set());
          stat();
          return;
        }
        el.classList.add("pass");
        statusOf(el).textContent = "✓ pass";
        passed++;
        line("ok", `[${gd.name}] ✓ ${(s.pass && s.pass[gd.id]) || gd.ok}`);
        stat();
        await sleep(160);
      }
      if (!alive()) return;
      pkt.classList.add("ok");
      line("ok", "✓ every gate green · ready to merge");
      verdict.replaceChildren(h("div", { class: "callout tip" }, h("b", null, "Merged. "), rich(s.lesson)));
      glossify(verdict, new Set());
      if (!auto) confetti();
    }

    simPlay = play;
    after.push(() => {
      if (!("IntersectionObserver" in window)) return;
      const seen = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        if (g === gen && run === 0) play(0, true);
      }, { threshold: 0.35 });
      seen.observe(wrap);
    });
    return wrap;
  }

  /* ---------- roadmap and milestones ---------- */
  function viewRoadmap() {
    return frag(
      vh("Roadmap", `${D.milestones.length} milestones in ${D.phases.length} phases`,
        "Each milestone pairs a chapter of my homelab build with the security work that proves it. Open one for its reps, the attacks I run against it, and the concepts I explain."),
      D.phases.map((p) => h("section", { class: "rm-phase reveal" },
        h("div", { class: "rm-phase-h" }, h("span", { class: "eyebrow" }, `Phase ${p.num}`), h("h2", null, p.title), chip("", "Cert gate · " + p.gate)),
        h("div", { class: "cards" }, p.milestones.map((id) => milestoneCard(MS.get(id)))))));
  }

  function milestoneCard(m) {
    const [k, t] = m.progress;
    const bar = h("i");
    bar.style.width = (t ? (100 * k) / t : 0) + "%";
    return h("a", { class: `panel card rm-mcard st-${m.status}`, href: msHref(m.id) },
      h("div", { class: "rm-row" }, h("span", { class: "rm-meta" }, m.id), statusChip(m.status), h("span", { class: "sp" }), h("span", { class: "rm-meta" }, `${k}/${t} ticked`)),
      h("h3", null, m.title),
      h("p", null, rich(m.plain, true)),
      h("div", { class: "bar" }, bar),
      h("div", { class: "rm-meta" }, "Proof: " + plain(m.proof)));
  }

  function viewMilestone(m) {
    const i = D.milestones.indexOf(m), prev = D.milestones[i - 1], next = D.milestones[i + 1];
    const phase = D.phases.find((p) => p.num === m.phase);
    const mine = m.proofs.map((k) => D.ledger[k]);
    const head = h("div", { class: "panel rm-mhead" },
      h("div", { class: "rm-row" }, h("span", { class: "eyebrow" }, `${m.id} · Phase ${m.phase}${phase ? " · " + phase.title : ""}`), statusChip(m.status)),
      h("h1", null, m.title),
      h("div", { class: "rm-row" }, chip("", `${m.progress[0]}/${m.progress[1]} ticked`), chip("", "Cert gate · " + plain(m.cert))),
      h("div", { class: "callout tip" }, h("b", null, "In plain words: "), rich(m.plain)),
      m.careful ? h("div", { class: "callout warn" }, h("b", null, "Careful: "), rich(m.careful)) : null);

    const main = h("div", null,
      h("section", { class: "rm-sec" }, h("h2", null, "Why (first principles)"), h("div", { class: "panel rm-prose" }, h("p", null, rich(m.why)))),
      h("section", { class: "rm-sec" }, h("h2", null, "Reps"),
        h("p", null, "Small exercises, each with a test. A rep counts only when its test passes and a ledger row points at the proof."),
        m.reps.map(repStep)),
      h("section", { class: "rm-sec" }, h("h2", null, "Break it"), h("p", null, "Attacks I run against my own work, from the lab."),
        h("ul", { class: "panel rm-list" }, m.breakIt.map((b) => h("li", null, h("span", { class: "rm-ico" }, icon("shield", 18)), h("div", null, h("p", null, rich(b))))))),
      h("section", { class: "rm-sec" }, h("h2", null, "Explain it"), h("p", null, "Interview questions I answer from first principles, in under 500 words each."),
        h("ul", { class: "panel rm-list" }, m.concepts.map(conceptRow))),
      h("section", { class: "rm-sec" }, h("h2", null, "Exit criteria"),
        h("ul", { class: "panel rm-list" }, m.exit.map((x) => h("li", null,
          h("span", { class: x.done ? "rm-tick on" : "rm-tick", role: "img", "aria-label": x.done ? "done" : "not done" }),
          h("div", null, h("p", null, rich(x.text))))))));

    const aside = h("aside", { class: "rm-aside", "aria-label": `${m.id} at a glance` },
      card("Build", h("p", null, rich(m.build)), m.chapters.length ? h("div", { class: "rm-net" }, m.chapters.map((c) => chip("", c))) : null),
      card("Proof it's done", h("p", null, rich(m.proof))),
      card("Interview story", h("p", null, rich(m.story))),
      card("Evidence", mine.length ? h("ul", { class: "rm-proofs" }, mine.map(proofItem)) : h("p", { class: "rm-muted" }, "No proof logged for this milestone yet.")),
      m.url ? h("a", { class: "btn", href: m.url }, "Open the source file ↗") : null);

    return frag(
      h("nav", { class: "rm-crumb", "aria-label": "Breadcrumb" }, h("a", { href: "#roadmap" }, "Roadmap"), "/", h("span", null, m.id)),
      head,
      h("div", { class: "rm-ms" }, main, aside),
      h("nav", { class: "rm-pn", "aria-label": "Other milestones" },
        prev ? h("a", { class: "btn", href: msHref(prev.id) }, `← ${prev.id} ${prev.title}`) : h("span"),
        next ? h("a", { class: "btn", href: msHref(next.id) }, `${next.id} ${next.title} →`) : null));
  }

  function repStep(r) {
    const body = h("div", { class: "sb", id: "b-" + r.id },
      h("h4", null, "Done when"), h("p", null, rich(r.doneWhen)),
      h("h4", null, "Proof"),
      r.proofs.length ? h("ul", { class: "rm-proofs" }, r.proofs.map((k) => proofItem(D.ledger[k])))
        : h("p", { class: "rm-muted" }, "Nothing logged yet. This rep can't be ticked until a ledger row points at its evidence."));
    const n = r.proofs.length;
    const btn = h("button", { class: "sh rm-sh", type: "button", "aria-expanded": "false", "aria-controls": "b-" + r.id },
      h("span", { class: r.done ? "rm-tick on" : "rm-tick", role: "img", "aria-label": r.done ? "done" : "not done" }),
      h("span", { class: "ti" }, h("span", { class: "sid" }, r.id), h("span", { class: "stt" }, rich(r.text, true)),
        h("span", { class: "chips" }, r.done ? chip("green", "✓ proven") : chip("", "no proof yet"), n ? chip("teal", `${n} ledger row${n > 1 ? "s" : ""}`) : null)),
      h("span", { class: "car" }, icon("chev", 14)));
    const el = h("div", { class: r.done ? "panel step done" : "panel step", id: r.id }, btn, body);
    btn.addEventListener("click", () => btn.setAttribute("aria-expanded", String(el.classList.toggle("open"))));
    return el;
  }

  /* ---------- evidence, skills, certs ---------- */
  function viewEvidence() {
    const kinds = [...new Set(D.ledger.map((p) => p.kind))].sort();
    let filter = "all";
    const box = h("div");
    const draw = () => box.replaceChildren(D.ledger.length ? ledgerTable(D.ledger.filter((p) => filter === "all" || p.kind === filter)) : emptyLedger(true));
    const seg = kinds.length > 1 ? h("div", { class: "seg", role: "group", "aria-label": "Filter by kind" }, ["all", ...kinds].map((k) =>
      h("button", { type: "button", "aria-pressed": String(k === filter), on: { click: (e) => {
        filter = k;
        for (const b of $$("button", seg)) b.setAttribute("aria-pressed", String(b === e.currentTarget));
        draw();
      } } }, k))) : null;
    draw();
    return frag(
      vh("Evidence", "Evidence ledger", "Every tick on this page points at a row here, and every row points at a file or link you can check yourself. Newest first."),
      h("div", { class: "rm-bar" }, seg, h("span", { class: "sp" }), h("a", { class: "btn", href: `${D.site.repo}/blob/${D.site.branch}/ledger.csv` }, "ledger.csv ↗")),
      box);
  }

  function viewSkills() {
    const [rated, total] = D.stats.skills;
    const scale = [["?", "not rated yet"], ["0", "never done it"], ["1", "done it with a guide open"],
      ["2", "done it alone and can explain why it works"], ["3", "could teach it, or fix it under pressure"]];
    return frag(
      vh("Skills", "Skills matrix", "Self-rated, then re-rated at the end of every milestone. A 2 or 3 needs evidence: ",
        h("code", { class: "mono" }, "roadmap check"), " fails one without it."),
      h("div", { class: "rm-legend" }, scale.map(([k, v]) => h("span", null, h("b", null, k), " " + v))),
      rated ? null : h("div", { class: "callout unv rm-gap-bottom" }, h("b", null, "Not rated yet. "), `All ${total} skills start at ?. The first ratings land in M0.`),
      h("div", { class: "rm-grid2" }, D.domains.map((d) => domainCard(d, false))));
  }

  function viewCerts() {
    const t = D.certTotal;
    const certChip = (s) => chip(CERT[s] || "", s);
    return frag(
      vh("Certs", "Certifications", "Each cert is a gate right after the milestone that teaches it, so study time doubles as lab time. Certs back up the proof; they don't replace it."),
      h("div", { class: "panel rm-total" },
        h("div", null, h("b", null, t.core), h("span", null, `core path · ${t.count} exams`)),
        h("div", null, h("b", null, `${D.stats.certs[0]}/${D.stats.certs[1]}`), h("span", null, "passed")),
        h("p", null, "Prices as read on the official pages on the Checked date. ",
          t.soft.length ? `Not confirmed on an official page: ${t.soft.join(", ")}. ` : "",
          "Re-check before booking: prices and exam versions change.")),
      h("div", { class: "panel tbl-wrap" }, h("table", { class: "t" },
        thead("Cert", "Code", "After", "Price", "Format", "Valid", "Status", "Label", "Checked", "Note"),
        h("tbody", null, D.certs.map((c) => h("tr", null,
          h("td", null, c.url ? h("a", { href: c.url }, c.name) : c.name),
          h("td", { class: "mono" }, c.code),
          h("td", null, msChip(c.after)),
          h("td", { class: "mono rm-nowrap" }, c.price),
          h("td", { class: "rm-claim" }, c.format),
          h("td", { class: "rm-nowrap" }, c.valid),
          h("td", null, certChip(c.status)),
          h("td", null, chip(LABEL[c.label] || "", c.label)),
          h("td", { class: "mono rm-nowrap" }, c.checked || "·"),
          h("td", { class: "rm-claim" }, rich(c.note))))))));
  }

  /* ---------- concept drill ---------- */
  function viewConcepts() {
    const g = gen;
    const pool = D.milestones.flatMap((m) => m.concepts.map((c) => ({ m, c })));
    const st = { mode: "cards", stories: false, order: [], i: 0, got: 0 };
    const box = h("div");
    let tick = null, left = 120;
    const clock = h("div", { class: "rm-timer", role: "timer", "aria-label": "Answer timer" }, "2:00");
    const startBtn = h("button", { class: "btn", type: "button", on: { click: () => (tick ? pause() : start()) } }, "▶ Start 2:00");
    const fmt = () => {
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      clock.classList.toggle("low", left <= 15);
    };
    function start() {
      if (left <= 0) left = 120;
      startBtn.textContent = "❚❚ Pause";
      tick = setInterval(() => {
        if (g !== gen) return pause();
        left--;
        fmt();
        if (left <= 0) {
          pause();
          toast("Time. Land it in one sentence.");
        }
      }, 1000);
    }
    function pause() {
      clearInterval(tick);
      tick = null;
      startBtn.textContent = left > 0 && left < 120 ? "▶ Resume" : "▶ Start 2:00";
    }
    function reset() {
      pause();
      left = 120;
      fmt();
      startBtn.textContent = "▶ Start 2:00";
    }

    const items = () => (st.stories ? [...pool, ...D.milestones.map((m) => ({ m, story: true }))] : pool);
    function back(it) {
      if (it.story) return plain(it.m.story);
      const parts = termsIn(plain(it.c.q)).slice(0, 2).map((t) => h("span", null, h("strong", null, t.term + ": "), plain(t.def)));
      parts.push(h("span", { class: "rm-muted" }, it.c.status === "todo"
        ? `My explainer (${it.c.slug}) isn't written yet: it's part of ${it.m.id}.`
        : `Then compare with my explainer (${it.c.status}).`));
      return h("span", { class: "rm-back" }, parts);
    }
    function nextCard(gotIt) {
      if (gotIt) st.got++;
      st.i++;
      reset();
      if (st.i >= st.order.length) {
        toast(`Deck done: ${st.got} of ${st.order.length} nailed`);
        if (st.got === st.order.length) confetti();
        st.order = [];
      }
      draw();
    }
    const modes = h("div", { class: "seg", role: "group", "aria-label": "Mode" }, [["cards", "Flashcards"], ["list", "All questions"]].map(([k, t]) =>
      h("button", { type: "button", data: { m: k }, on: { click: () => { st.mode = k; draw(); } } }, t)));
    const storyBtn = h("button", { class: "btn", type: "button", "aria-pressed": "false",
      on: { click: () => { st.stories = !st.stories; st.order = []; draw(); } } }, "+ interview stories");

    function draw() {
      for (const b of $$("button", modes)) b.setAttribute("aria-pressed", String(b.dataset.m === st.mode));
      storyBtn.setAttribute("aria-pressed", String(st.stories));
      storyBtn.hidden = st.mode !== "cards";
      if (st.mode === "list") {
        reset();
        box.replaceChildren(h("div", { class: "rm-grid2" }, D.milestones.map((m) => h("div", { class: "panel card" },
          h("div", { class: "sub" }, h("a", { href: msHref(m.id) }, `${m.id} ${m.title}`)),
          h("ul", { class: "rm-list" }, m.concepts.map(conceptRow))))));
        glossify(box, new Set());
        return;
      }
      const all = items();
      if (st.order.length !== all.length) {
        st.order = shuffle(all.length);
        st.i = 0;
        st.got = 0;
      }
      const it = all[st.order[st.i]];
      const flip = h("button", { class: "flip rm-qflip", type: "button", "aria-label": "Flip the card", on: { click: () => flip.classList.toggle("on") } },
        h("span", { class: "in" },
          h("span", { class: "f" }, h("span", { class: "rm-side" }, it.story ? `${it.m.id} · interview story` : `${it.m.id} · explain it`),
            it.story ? `Walk me through ${it.m.id}: ${it.m.title}.` : plain(it.c.q)),
          h("span", { class: "b" }, h("span", { class: "rm-side" }, it.story ? "the story" : "start from"), back(it))));
      const link = it.story ? h("a", { class: "btn", href: msHref(it.m.id) }, `Open ${it.m.id} →`)
        : it.c.url ? h("a", { class: "btn", href: it.c.url }, "Read my explainer ↗") : h("a", { class: "btn", href: msHref(it.m.id) }, `Open ${it.m.id} →`);
      box.replaceChildren(h("div", { class: "panel rm-drill" },
        h("div", { class: "eyebrow" }, `Card ${st.i + 1} of ${all.length} · nailed ${st.got}`),
        flip,
        h("div", { class: "rm-row" }, clock, startBtn, h("button", { class: "btn", type: "button", on: { click: reset } }, "↺ Reset")),
        h("div", { class: "chips" },
          h("button", { class: "btn", type: "button", on: { click: () => nextCard(false) } }, "Not yet →"),
          h("button", { class: "btn pri", type: "button", on: { click: () => nextCard(true) } }, "✓ Nailed it"),
          link)));
    }
    draw();
    return frag(
      vh("Concepts", "Concept drill", "Every concept in the roadmap as an interview question. Answer out loud before the two minutes run out, flip the card, then check against my explainer."),
      h("div", { class: "rm-bar" }, modes, storyBtn),
      box);
  }

  /* ---------- glossary ---------- */
  function viewGlossary() {
    let mode = "list", q = "";
    const qz = { order: [], i: 0, known: 0, again: 0 };
    const box = h("div");
    const count = h("span", { class: "rm-meta" });
    const input = h("input", { class: "rm-input", type: "search", placeholder: "Filter terms…", "aria-label": "Filter the glossary",
      on: { input: () => { q = input.value; draw(); } } });
    const modes = h("div", { class: "seg", role: "group", "aria-label": "Mode" }, [["list", "List"], ["quiz", "Flashcards"]].map(([k, t]) =>
      h("button", { type: "button", data: { m: k }, on: { click: () => { mode = k; draw(); } } }, t)));

    function draw() {
      for (const b of $$("button", modes)) b.setAttribute("aria-pressed", String(b.dataset.m === mode));
      input.hidden = mode !== "list";
      if (mode === "list") {
        const want = q.toLowerCase().trim();
        const rows = D.glossary.filter((g) => !want || (g.term + " " + plain(g.def)).toLowerCase().includes(want));
        count.textContent = `${rows.length} of ${D.glossary.length} terms`;
        box.replaceChildren(rows.length ? h("div", { class: "gloss" }, rows.map((g) => h("div", null, h("b", null, g.term), rich(g.def))))
          : h("div", { class: "panel rm-empty" }, h("h3", null, "No match"), h("p", null, "Try a shorter word, or search everything with ⌘K.")));
        return;
      }
      if (!qz.order.length) Object.assign(qz, { order: shuffle(D.glossary.length), i: 0, known: 0, again: 0 });
      const g = D.glossary[qz.order[qz.i]];
      const flip = h("button", { class: "flip", type: "button", "aria-label": "Flip the card", on: { click: () => flip.classList.toggle("on") } },
        h("span", { class: "in" }, h("span", { class: "f" }, g.term), h("span", { class: "b" }, plain(g.def))));
      const step = (knew) => {
        if (knew) qz.known++;
        else {
          qz.again++;
          qz.order.push(qz.order[qz.i]); // see it again at the end
        }
        qz.i++;
        if (qz.i >= qz.order.length) {
          toast(`Deck done: ${qz.known} known, ${qz.again} repeats`);
          if (!qz.again) confetti();
          qz.order = [];
        }
        draw();
      };
      count.textContent = `card ${qz.i + 1} of ${qz.order.length} · known ${qz.known}`;
      box.replaceChildren(h("div", { class: "panel quiz" }, flip, h("div", { class: "chips" },
        h("button", { class: "btn", type: "button", on: { click: () => step(false) } }, "↺ Again later"),
        h("button", { class: "btn pri", type: "button", on: { click: () => step(true) } }, "✓ I knew it"))));
    }
    glossFilter = (term) => {
      mode = "list";
      q = term;
      input.value = term;
      draw();
    };
    draw();
    return frag(
      vh("Glossary", "Every term in plain English", `${D.glossary.length} terms, written for people who didn't come from tech. Underlined words anywhere on this page explain themselves when you hover over or tap them.`),
      h("div", { class: "rm-bar" }, modes, input, count),
      box);
  }

  /* ---------- ⌘K palette ---------- */
  let palAll = null, palItems = [], palIdx = 0, palOpener = null;
  const palIsOpen = () => $("#pal").classList.contains("on");

  function palIndex() {
    const out = [];
    const pages = [["overview", "Overview"], ["roadmap", "Roadmap"], ["evidence", "Evidence ledger"], ["skills", "Skills matrix"],
      ["certs", "Certifications"], ["concepts", "Concept drill"], ["glossary", "Glossary"], ["present", "Walkthrough for interviews"]];
    for (const [k, t] of pages) out.push({ k: "page", t, x: "", go: () => go(k) });
    for (const m of D.milestones) {
      out.push({ k: m.id, t: m.title, x: plain(m.plain), go: () => go(m.id.toLowerCase()) });
      for (const r of m.reps) out.push({ k: r.id, t: plain(r.text), x: plain(r.doneWhen), go: () => go(m.id.toLowerCase(), () => openRep(r.id)) });
      for (const c of m.concepts) out.push({ k: "concept", t: plain(c.q), x: c.slug, go: () => go(m.id.toLowerCase(), () => flash("c-" + c.slug)) });
    }
    for (const g of D.glossary) out.push({ k: "term", t: g.term, x: plain(g.def), go: () => go("glossary", () => glossFilter && glossFilter(g.term)) });
    for (const c of D.certs) out.push({ k: "cert", t: c.name, x: c.code, go: () => go("certs") });
    if (D.simulator) {
      D.simulator.scenarios.forEach((s, i) => out.push({ k: "simulate", t: s.title, x: plain(s.summary), go: () => go("overview", () => {
        const el = $("#gates");
        if (el) el.scrollIntoView({ behavior: smooth });
        if (simPlay) simPlay(i);
      }) }));
    }
    return out;
  }

  function palOpen() {
    if (deckIsOpen()) return;
    palAll = palAll || palIndex();
    palOpener = document.activeElement;
    $("#pal").classList.add("on");
    const q = $("#palq");
    q.value = "";
    palSearch("");
    q.focus();
  }
  function palClose(restore = true) {
    $("#pal").classList.remove("on");
    if (restore && palOpener && palOpener.focus) palOpener.focus();
  }
  function palSearch(raw) {
    const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = [];
    for (const it of palAll) {
      const t = it.t.toLowerCase();
      if (!words.every((w) => (it.k + " " + t + " " + it.x).toLowerCase().includes(w))) continue;
      scored.push([!words.length || t.startsWith(words[0]) ? 0 : t.includes(words[0]) ? 1 : 2, it]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    palItems = scored.slice(0, 14).map((x) => x[1]);
    palIdx = 0;
    $("#palr").replaceChildren(...(palItems.length
      ? palItems.map((it, i) => h("div", { class: i ? "r" : "r on", role: "option", id: "pal-" + i, "aria-selected": String(!i),
        on: { click: () => palPick(i), mousemove: () => palMark(i) } }, h("span", { class: "k" }, it.k), h("span", null, it.t)))
      : [h("div", { class: "r" }, h("span", { class: "k" }), "No match")]));
    $("#palq").setAttribute("aria-activedescendant", palItems.length ? "pal-0" : "");
  }
  function palMark(i) {
    if (i === palIdx && document.getElementById("pal-" + i)?.classList.contains("on")) return;
    palIdx = i;
    $$("#palr .r").forEach((r, k) => {
      r.classList.toggle("on", k === i);
      r.setAttribute("aria-selected", String(k === i));
    });
    const el = document.getElementById("pal-" + i);
    if (el) el.scrollIntoView({ block: "nearest" });
    $("#palq").setAttribute("aria-activedescendant", "pal-" + i);
  }
  function palPick(i) {
    const it = palItems[i];
    if (!it) return;
    palClose(false);
    it.go();
  }

  /* ---------- walkthrough deck ---------- */
  let slides = [], slideI = 0, deckFrom = "overview", deckOpener = null, touchX = null;
  const deckIsOpen = () => !$("#deck").hidden;
  const outside = () => [$(".top"), $("#main"), $(".rm-skip")];

  function buildSlides() {
    const s = D.stats, out = [];
    const slide = (eyebrow, make) => out.push({ eyebrow, make });
    const cur = D.current ? MS.get(D.current) : null;
    slide(`Walkthrough · ${D.site.owner}`, () => [
      h("span", { class: "badge" }, h("b", null, D.site.badge), D.site.eyebrow),
      h("h2", null, D.site.headline[0] + " ", h("em", null, D.site.headline[1])),
      h("p", { class: "lede" }, rich(D.site.lede)),
      proofStats()]);
    if (D.loop.length) slide("How I work", () => [h("h2", null, "Every milestone runs the same loop."), h("div", { class: "bento" }, D.loop.map(tile))]);
    if (D.lab) slide("The lab", () => [h("h2", null, D.lab.title), h("p", { class: "lede" }, rich(D.lab.summary)), labCards()]);
    slide("Progress", () => [
      h("h2", null, `${s.percent}% done. `, h("em", null, cur ? `Now: ${cur.id} ${cur.title}.` : "Every milestone done.")),
      h("p", { class: "lede" }, `Percent of reps and exit criteria ticked, each one backed by a ledger row. ${s.proofs} proofs logged so far.`),
      h("div", { class: "swarm" }, D.milestones.map(agentCard)),
      pathEl()]);
    for (const m of D.milestones.filter((x) => x.status === "done" || x.status === "active")) slide(`${m.id} · ${STATUS[m.status][1]}`, () => milestoneSlide(m));
    if (cur && cur.status === "next") slide(`Up next · ${cur.id}`, () => upNextSlide(cur));
    slide("Integrity", () => [
      h("h2", null, "Why you can trust this page."),
      h("p", { class: "lede" }, "Every number here is computed from the files in the repo when the page is built. The build stops if any check fails, so a tick without proof never reaches this page."),
      h("ul", { class: "rm-checks" }, D.checks.map(([n, d]) => h("li", null, h("b", null, "✓"), h("span", null, h("strong", null, n), " · " + d)))),
      D.simulator ? h("div", { class: "cta" }, h("button", { class: "btn", type: "button", on: { click: () => go("overview", () => {
        const el = $("#gates");
        if (el) el.scrollIntoView({ behavior: smooth });
        if (simPlay) simPlay(Math.min(1, D.simulator.scenarios.length - 1));
      }) } }, "Try to fake progress →")) : null]);
    slide("Skills", () => [
      h("h2", null, "Skills, rated honestly."),
      s.skills[0] ? null : h("div", { class: "callout unv" }, h("b", null, "Not rated yet. "), `All ${s.skills[1]} skills start at ?. The first ratings land in M0.`),
      h("div", { class: "rm-grid2" }, D.domains.map((d) => domainCard(d, true)))]);
    slide("Certs", () => [
      h("h2", null, "Certs are checkpoints, not the goal."),
      h("p", { class: "lede" }, `Each comes right after the milestone that teaches it. Core path: ${D.certTotal.core} across ${D.certTotal.count} exams.`),
      h("div", { class: "panel tbl-wrap" }, h("table", { class: "t" }, thead("Cert", "After", "Status"),
        h("tbody", null, D.certs.map((c) => h("tr", null, h("td", null, c.name), h("td", null, c.after), h("td", null, chip(CERT[c.status] || "", c.status)))))))]);
    slide("What's next", () => [
      h("h2", null, D.final ? D.final.title : "Ask me about any of it."),
      D.final ? h("p", { class: "lede" }, rich(D.final.text)) : null,
      upNext(),
      h("div", { class: "cta" }, h("a", { class: "btn lg glow", href: "#evidence" }, "Browse the evidence"), h("a", { class: "btn lg ghost", href: D.site.repo }, "Open the repo ↗"))]);
    return out;
  }

  function milestoneSlide(m) {
    const done = m.reps.filter((r) => r.done), proofs = m.proofs.map((k) => D.ledger[k]);
    const box = (label, ...kids) => h("div", { class: "panel card" }, h("div", { class: "sub" }, label), kids);
    return [
      h("h2", null, `${m.id} ${m.title}`),
      h("p", { class: "lede" }, rich(m.plain)),
      h("div", { class: "rm-grid2" },
        box("Proof it's done", h("p", null, rich(m.proof))),
        box(`Reps · ${done.length}/${m.reps.length}`, done.length ? h("ul", null, done.map((r) => h("li", null, h("code", { class: "mono" }, r.id), " ", rich(r.text)))) : h("p", null, "None ticked yet.")),
        box("Evidence", proofs.length ? h("ul", null, proofs.map((p) => h("li", null, p.claim, " · ", evidenceLink(p.evidence)))) : h("p", null, "No proof logged yet.")),
        box("The story", h("p", null, rich(m.story)))),
      h("div", { class: "cta" }, h("a", { class: "btn", href: msHref(m.id) }, `Open ${m.id} →`))];
  }

  function upNextSlide(m) {
    const r = m.reps.find((x) => !x.done);
    const box = (label, ...kids) => h("div", { class: "panel card" }, h("div", { class: "sub" }, label), kids);
    return [
      h("h2", null, `Up next: ${m.id} ${m.title}`),
      h("p", { class: "lede" }, rich(m.plain)),
      h("div", { class: "rm-grid2" },
        box("What I'm building", h("p", null, rich(m.build))),
        box("Proof it's done", h("p", null, rich(m.proof))),
        r ? box(`First rep · ${r.id}`, h("p", null, rich(r.text)), h("p", null, h("span", { class: "rm-muted" }, "Done when: "), rich(r.doneWhen))) : null,
        m.breakIt.length ? box("Then I break it", h("p", null, rich(m.breakIt[0]))) : null),
      h("div", { class: "cta" }, h("a", { class: "btn", href: msHref(m.id) }, `Open ${m.id} →`))];
  }

  function openDeck() {
    if (deckIsOpen()) return;
    if (palIsOpen()) palClose(false);
    deckFrom = current || "overview";
    deckOpener = document.activeElement;
    slides = buildSlides();
    $("#deck").hidden = false;
    document.body.classList.add("rm-lock");
    for (const el of outside()) if (el) el.inert = true;
    $("#deckFull").hidden = !document.fullscreenEnabled;
    showSlide(0);
    $("#deckNext").focus();
  }

  function closeDeck(restoreHash = true) {
    if (!deckIsOpen()) return;
    $("#deck").hidden = true;
    document.body.classList.remove("rm-lock");
    for (const el of outside()) if (el) el.inert = false;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (restoreHash && location.hash === "#present") setHash(deckFrom);
    tipHide();
    if (deckOpener && deckOpener.isConnected && deckOpener.focus) deckOpener.focus();
  }

  function showSlide(i) {
    slideI = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[slideI], stage = $("#deckStage");
    const el = h("div", { class: "rm-slide" }, s.make());
    stage.replaceChildren(el);
    stage.scrollTop = 0;
    glossify(el, new Set());
    $$("b[data-v]", el).forEach(countUp);
    $("#deckEyebrow").textContent = s.eyebrow;
    $("#deckCount").textContent = `${slideI + 1} / ${slides.length}`;
    $("#deckProg").style.width = ((slideI + 1) / slides.length) * 100 + "%";
    $("#deckPrev").disabled = slideI === 0;
    $("#deckNext").textContent = slideI === slides.length - 1 ? "Finish ✓" : "Next →";
  }

  const step = (d) => (d > 0 && slideI === slides.length - 1 ? closeDeck() : showSlide(slideI + d));

  function deckKey(e) {
    const k = e.key, onControl = e.target.closest && e.target.closest("a,button,input");
    if (k === "Escape") {
      e.preventDefault();
      closeDeck();
    } else if (k === "ArrowRight" || k === "PageDown" || (k === " " && !onControl)) {
      e.preventDefault();
      step(1);
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      step(-1);
    } else if (k === "Home" || k === "End") {
      e.preventDefault();
      showSlide(k === "Home" ? 0 : slides.length - 1);
    } else if (k === "Tab") {
      const f = $$('a[href],button:not([disabled]),input,[tabindex="0"]', $("#deck")).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ---------- events ---------- */
  $("#theme").addEventListener("click", toggleTheme);
  $("#kbtn").addEventListener("click", palOpen);
  $("#pal").addEventListener("click", (e) => { if (e.target.id === "pal") palClose(); });
  $("#palq").addEventListener("input", (e) => palSearch(e.target.value));
  $(".rm-skip").addEventListener("click", (e) => {
    e.preventDefault();
    $("#main").focus();
  });
  $("#deckPrev").addEventListener("click", () => step(-1));
  $("#deckNext").addEventListener("click", () => step(1));
  $("#deckClose").addEventListener("click", () => closeDeck());
  $("#deckFull").addEventListener("click", () => {
    const d = $("#deck");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (d.requestFullscreen) d.requestFullscreen().catch(() => toast("Full screen isn't available here."));
  });
  $("#deckStage").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $("#deckStage").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });

  document.addEventListener("keydown", (e) => {
    const k = e.key;
    if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "k") {
      e.preventDefault();
      if (palIsOpen()) palClose();
      else palOpen();
      return;
    }
    if (palIsOpen()) {
      if (k === "Escape") {
        e.preventDefault();
        palClose();
      } else if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        if (palItems.length) palMark((palIdx + (k === "ArrowDown" ? 1 : -1) + palItems.length) % palItems.length);
      } else if (k === "Enter") {
        e.preventDefault();
        palPick(palIdx);
      } else if (k === "Tab") e.preventDefault();
      return;
    }
    if (deckIsOpen()) return deckKey(e);
    const typing = e.target.closest && e.target.closest("input,textarea,select,[contenteditable]");
    if (k === "/" && !typing) {
      e.preventDefault();
      palOpen();
    }
  });
  document.addEventListener("mouseover", (e) => {
    const a = e.target.closest && e.target.closest("abbr.g");
    if (a) tipShow(a);
  });
  document.addEventListener("mouseout", (e) => { if (e.target.closest && e.target.closest("abbr.g")) tipHide(); });
  document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches("abbr.g")) tipShow(e.target); });
  document.addEventListener("focusout", (e) => { if (e.target.matches && e.target.matches("abbr.g")) tipHide(); });
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest(".tile");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", e.clientX - r.left + "px");
    t.style.setProperty("--my", e.clientY - r.top + "px");
  });
  addEventListener("scroll", tipHide, { passive: true });
  addEventListener("hashchange", () => route(false));

  /* ---------- boot ---------- */
  const pct = D.stats.percent;
  $("#ringv").setAttribute("stroke-dasharray", `${pct} 100`);
  $("#ringt").textContent = String(pct);
  $(".ring").setAttribute("aria-label", `Overall progress: ${pct}% of reps and exit criteria`);
  $("#palq").setAttribute("role", "combobox");
  $("#palq").setAttribute("aria-controls", "palr");
  $("#palq").setAttribute("aria-expanded", "true");
  $("#foot").replaceChildren(...rich(D.site.footer), " · ", h("a", { href: D.site.repo }, "Source on GitHub"));
  route(true);
})();
