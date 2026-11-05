/* The roadmap page. Reads site/roadmap.json, which `roadmap build` writes from the repo's markdown
   and CSV files, and draws it with the Dukecodes Design System (site/ds/bundle.js). No build step:
   plain React.createElement.

   The page runs under a strict Content-Security-Policy with Trusted Types, so nothing here turns a
   string into HTML or code, and every style lives in app.css. Where the design system needs help,
   the fix is marked "DS fix" and listed in docs/design-system-fixes.md. To change what the page
   says, edit the repo files and run `make build`, not this file. */
(function () {
  'use strict';

  const mount = document.getElementById('root');

  // Shown when React or the design system did not load, so the page never stays blank.
  function bootFailure(message) {
    mount.textContent = '';
    const box = document.createElement('div');
    box.className = 'rm-boot';
    const title = document.createElement('p');
    title.className = 'rm-boot-title';
    title.textContent = 'The page could not start.';
    const body = document.createElement('p');
    body.textContent = message;
    box.append(title, body);
    mount.append(box);
  }

  if (!window.React || !window.ReactDOM || !window.Dukecodes) {
    bootFailure('Its scripts did not load. Everything on it is also in the repository, starting with README.md and roadmap.md.');
    return;
  }

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const DS = window.Dukecodes;
  const h = React.createElement;
  const { Fragment, useState, useEffect, useRef, useMemo } = React;

  // ---------------------------------------------------------------- fixed vocabulary

  const VIEWS = {
    overview: 'Overview',
    roadmap: 'Roadmap',
    labs: 'Labs',
    evidence: 'Evidence',
    skills: 'Skills',
    certs: 'Certs',
    concepts: 'Concepts',
    glossary: 'Glossary',
  };
  const SECTIONS = ['start', 'mission', 'gates', 'loop', 'phases', 'security', 'lab', 'proof'];
  const STATUS = {
    done: ['green', '✓ done'],
    active: ['amber', '● in progress'],
    next: ['amber', '▶ up next'],
    queued: ['neutral', 'queued'],
  };
  const CONCEPT = { reviewed: ['green', 'reviewed'], written: ['teal', 'written'], todo: ['neutral', 'to write'] };
  const CERT = { passed: 'green', booked: 'amber', studying: 'amber', expired: 'red' };
  const LAB = { done: ['green', '✓ done'], active: ['amber', '● in progress'], planned: ['neutral', 'planned'] };
  const PROJECT = { shipped: ['green', '✓ shipped'], building: ['amber', '● building'], planned: ['neutral', 'planned'] };
  const LABEL = { FACT: 'teal', COMMUNITY: 'amber', UNVERIFIED: 'violet' };
  const AREA = { foundations: 'Foundations', identity: 'Identity', appsec: 'AppSec', detection: 'Detection', containers: 'Containers', cloud: 'Cloud', ctf: 'CTF' };
  // Parts of the Labs and Certs views a link can land on (#labs-practice).
  const LAB_PARTS = ['labs-start', 'labs-list', 'labs-practice', 'labs-capstones', 'labs-projects', 'labs-clocks', 'labs-choices'];
  const CERT_PARTS = ['certs-ladder', 'certs-skipped', 'certs-choices'];
  const ROLES = ['ops', 'media', 'dev', 'core', 'sec', 'net'];
  const SCALE = [
    ['?', 'not rated yet'],
    ['0', 'never done it'],
    ['1', 'done it with a guide open'],
    ['2', 'done it alone and can explain why it works'],
    ['3', 'could teach it, or fix it when it breaks under pressure'],
  ];
  const THEME_KEY = 'dc-theme';
  const DRILL_SECONDS = 120;

  // ---------------------------------------------------------------- helpers

  const cx = (...names) => names.filter(Boolean).join(' ');
  const pad2 = (n) => String(n).padStart(2, '0');
  const plain = (toks) => (toks || []).map((t) => t[1]).join('');
  const pct = (k, t) => (t ? Math.round((100 * k) / t) : 0);
  // Wraps only between words, never at a hyphen inside one, so SY0-701 stays whole.
  const unbroken = (text) => String(text).split(' ').flatMap((w, i) => [i ? ' ' : null, h('span', { key: i, className: 'rm-nowrap' }, w)]);

  function reducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  // Storage can be blocked (private windows, strict settings). The page still works; it just forgets.
  const store = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        /* not saved */
      }
    },
  };

  function shuffle(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let k = n - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    return a;
  }

  // Links from the data are in-page (#token) or https. Anything else never becomes a link.
  function safeUrl(u) {
    const s = String(u == null ? '' : u);
    if (s === '' || /[\u0000- \u007F]/.test(s)) return null;
    if (s[0] === '#') return /^#[A-Za-z0-9._~-]*$/.test(s) ? { href: s, ext: false } : null;
    try {
      const url = new URL(s);
      return url.protocol === 'https:' && url.hostname ? { href: url.href, ext: true } : null;
    } catch (e) {
      return null;
    }
  }

  function toast(message) {
    window.dispatchEvent(new CustomEvent('rm:toast', { detail: String(message) }));
  }

  // ---------------------------------------------------------------- data, set once at boot

  let D = null; // roadmap.json
  let X = null; // lookups built from it

  function indexData(data) {
    const ms = new Map(data.milestones.map((m) => [m.id, m]));
    const reps = new Map();
    const concepts = new Map();
    const labs = new Map(); // rep id -> the labs it belongs to
    const practice = new Map(); // rep id -> the practice resources that teach it
    data.milestones.forEach((m) => {
      m.reps.forEach((r) => reps.set(r.id, m));
      m.concepts.forEach((c) => concepts.set(c.slug, m));
    });
    const add = (map, id, x) => {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(x);
    };
    (data.labs || []).forEach((l) => l.reps.forEach((id) => add(labs, id, l)));
    (data.practice || []).forEach((p) => p.reps.forEach((id) => add(practice, id, p)));
    return { ms, reps, concepts, labs, practice, gloss: buildGlossary(data.glossary) };
  }

  // ---------------------------------------------------------------- glossary and rich text

  // Hover terms grouped by first letter, longest first. Terms marked cs (CI, IAM) match only with the
  // same capitals. Plain string comparison, never a pattern built from data, so no term can make it slow.
  function buildGlossary(list) {
    const byFirst = new Map();
    list
      .filter((g) => g.hover && g.term)
      .forEach((g) => {
        const key = g.term[0].toLowerCase();
        if (!byFirst.has(key)) byFirst.set(key, []);
        byFirst.get(key).push({ w: g.term, low: g.term.toLowerCase(), exact: !!g.cs, g });
      });
    byFirst.forEach((words) => words.sort((a, b) => b.w.length - a.w.length));
    return byFirst;
  }

  // Letters, digits, _ and - belong to a word: "ci" in "circle" or "hook" in "pre-hook" never match.
  const isWordChar = (ch) => ch !== undefined && /[A-Za-z0-9_-]/.test(ch);

  // The longest term starting at text[i] and ending at a word edge, plural "s" allowed, or null.
  function termAt(text, i, gloss) {
    const words = gloss.get(text[i].toLowerCase());
    if (!words) return null;
    for (const t of words) {
      let end = i + t.w.length;
      if (end > text.length) continue;
      const piece = text.slice(i, end);
      if (t.exact ? piece !== t.w : piece.toLowerCase() !== t.low) continue;
      const s = text[end];
      if ((s === 's' || (!t.exact && s === 'S')) && !isWordChar(text[end + 1])) end += 1;
      if (isWordChar(text[end])) continue;
      return { t, end };
    }
    return null;
  }

  // A scope underlines each term once: the first time it appears in that section.
  const scope = () => (X && X.gloss.size ? { gloss: X.gloss, seen: new Set() } : null);

  function linkTerms(text, sc, keyBase) {
    const out = [];
    let last = 0;
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      if (isWordChar(text[i - 1])) continue; // terms start only at a word edge
      const hit = termAt(text, i, sc.gloss);
      if (!hit) continue;
      if (!sc.seen.has(hit.t.g.term)) {
        sc.seen.add(hit.t.g.term);
        if (i > last) out.push(text.slice(last, i));
        out.push(h(DS.GlossaryTerm, { key: keyBase + '-' + n++, term: hit.t.g.term, def: plain(hit.t.g.def) }, text.slice(i, hit.end)));
        last = hit.end;
      }
      i = hit.end - 1; // skip the rest of the term, linked or not
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  // The distinct hover terms in a text, in order of first use.
  function termsIn(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      if (isWordChar(text[i - 1])) continue;
      const hit = termAt(text, i, X.gloss);
      if (!hit) continue;
      if (!out.includes(hit.t.g)) out.push(hit.t.g);
      i = hit.end - 1;
    }
    return out;
  }

  // Text from the build arrives as tokens: ["t", text] ["c", code] ["b", bold] ["a", text, url].
  function rich(toks, sc, noLinks) {
    const out = [];
    (toks || []).forEach((tok, i) => {
      const kind = tok[0];
      const text = tok[1];
      const key = 'k' + i;
      if (kind === 'c') out.push(h('code', { key, className: 'rm-code' }, text));
      else if (kind === 'a') out.push(noLinks ? text : h(Link, { key, href: tok[2] }, text));
      else if (kind === 'b') out.push(h('strong', { key }, sc ? linkTerms(text, sc, key) : text));
      else if (sc) out.push(...linkTerms(text, sc, key));
      else out.push(text);
    });
    return out;
  }

  // ---------------------------------------------------------------- routing

  // Views live in plain hash tokens (#roadmap, #m3, #M3-R2): links into an Artifact keep only those.
  function parseToken(tok) {
    if (!tok || tok === 'overview') return { view: 'overview', id: null };
    if (Object.prototype.hasOwnProperty.call(VIEWS, tok)) return { view: tok, id: null };
    if (SECTIONS.includes(tok)) return { view: 'overview', id: tok };
    if (LAB_PARTS.includes(tok)) return { view: 'labs', id: tok };
    if (CERT_PARTS.includes(tok)) return { view: 'certs', id: tok };
    if (/^m\d{1,2}$/.test(tok) && X.ms.has(tok.toUpperCase())) return { view: tok, id: null };
    if (X.reps.has(tok)) return { view: X.reps.get(tok).id.toLowerCase(), id: tok };
    if (tok.startsWith('c-') && X.concepts.has(tok.slice(2))) return { view: X.concepts.get(tok.slice(2)).id.toLowerCase(), id: tok };
    return null; // not one of ours: leave the page as it is
  }

  let pendingIntent = null; // what the next navigation should do on arrival, like play a scenario

  function go(tok, intent) {
    pendingIntent = intent || null;
    if (location.hash === '#' + tok) window.dispatchEvent(new Event('rm:renav'));
    else location.hash = tok;
  }

  function replaceHash(tok) {
    try {
      history.replaceState(null, '', '#' + tok);
    } catch (e) {
      /* sandboxed frame: keep the old hash */
    }
  }

  function focusQuietly(el) {
    if (el && el.focus) el.focus({ preventScroll: true });
  }

  // Scroll to a navigation target, move focus there and flash it, so keyboard users land where the link said.
  // A rep lands on its card's header, the one button that opens and closes it.
  function focusTarget(el) {
    const f = el.matches('[data-focus]') ? el : el.querySelector('[data-focus], .dk-step > button.h') || el;
    if (f.tabIndex < 0 && !f.hasAttribute('tabindex')) f.tabIndex = -1;
    el.scrollIntoView({ block: el.tagName === 'SECTION' ? 'start' : 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    focusQuietly(f);
    f.classList.remove('rm-flash');
    void f.offsetWidth; // restart the animation
    f.classList.add('rm-flash');
    setTimeout(() => f.classList.remove('rm-flash'), 1900);
  }

  // ---------------------------------------------------------------- theme

  function useTheme() {
    const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
    useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    useEffect(() => {
      // Follow the system setting until the reader picks a theme on this page.
      let mq = null;
      try {
        mq = window.matchMedia('(prefers-color-scheme: dark)');
      } catch (e) {
        return undefined;
      }
      if (!mq || !mq.addEventListener) return undefined;
      const onChange = (e) => {
        const saved = store.get(THEME_KEY);
        if (saved !== 'light' && saved !== 'dark') setTheme(e.matches ? 'dark' : 'light');
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }, []);
    const toggle = () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      store.set(THEME_KEY, next);
      setTheme(next);
    };
    return [theme, toggle];
  }

  // ---------------------------------------------------------------- small parts

  function Link({ href, className, current, children }) {
    const u = safeUrl(href);
    if (!u) return h('span', { className }, children);
    if (u.ext) {
      return h(
        'a',
        { href: u.href, className, target: '_blank', rel: 'noopener noreferrer' },
        children,
        h('span', { className: 'rm-ext', 'aria-hidden': 'true' }, ' ↗'),
        h('span', { className: 'dk-sr' }, ' (opens in a new tab)'),
      );
    }
    const onClick = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (location.hash === u.href) {
        e.preventDefault();
        go(u.href.slice(1));
      }
    };
    return h('a', { href: u.href, className, 'aria-current': current || undefined, onClick }, children);
  }

  function Svg({ size, className, sw, children }) {
    return h(
      'svg',
      {
        className,
        width: size || 16,
        height: size || 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: sw || 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      children,
    );
  }

  const MoonIcon = () => h(Svg, null, h('path', { d: 'M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.6 6.6 0 0 0 10.7 10.7z' }));
  const SunIcon = () =>
    h(
      Svg,
      null,
      h('circle', { cx: 12, cy: 12, r: 4 }),
      h('path', { d: 'M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4' }),
    );
  const Chevron = () => h(Svg, { size: 16, sw: 2.4 }, h('path', { d: 'M9 6l6 6-6 6' }));
  const ShieldIcon = () =>
    h(Svg, { size: 18, sw: 1.9 }, h('path', { d: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z' }), h('path', { d: 'm9 12 2 2 4-4' }));
  const SparkIcon = () =>
    h(Svg, { size: 18, sw: 1.9 }, h('path', { d: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6' }));

  // Three rack units in a frame: amber, teal, grey. The same mark as every dukecodes page.
  function BrandMark() {
    return h(
      'svg',
      { className: 'rm-mark', width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      h('rect', { className: 'f', x: 1.5, y: 1.5, width: 21, height: 21, rx: 4 }),
      h('rect', { className: 'u1', x: 5, y: 5.2, width: 14, height: 3.4, rx: 1.2 }),
      h('rect', { className: 'u2', x: 5, y: 10.3, width: 14, height: 3.4, rx: 1.2 }),
      h('rect', { className: 'u3', x: 5, y: 15.4, width: 14, height: 3.4, rx: 1.2 }),
    );
  }

  function Tick({ on }) {
    return h('span', { className: cx('rm-tick', on && 'on'), role: 'img', 'aria-label': on ? 'done' : 'not done' });
  }

  function Bar({ value, className }) {
    return h('span', { className: cx('dk-bar', className), 'aria-hidden': 'true' }, h('i', { style: { width: value + '%' } }));
  }

  function StatusChip({ status }) {
    const s = STATUS[status] || STATUS.queued;
    return h(DS.Chip, { tone: s[0] }, s[1]);
  }

  function MsChip({ id }) {
    if (!X.ms.has(id)) return h(DS.Chip, null, id);
    return h(Link, { href: '#' + id.toLowerCase(), className: 'dk-chip rm-chiplink' }, id);
  }

  function RepChip({ id }) {
    if (!X.reps.has(id)) return h(DS.Chip, null, id);
    return h(Link, { href: '#' + id, className: 'dk-chip rm-chiplink' }, id);
  }

  function EvidenceLink({ e }) {
    return e.url ? h(Link, { href: e.url }, e.text) : h('code', { className: 'rm-code' }, e.text);
  }

  // Wide tables scroll inside their own box, never the page. The box takes focus so keys can scroll it.
  function Table({ caption, cols, rows, className }) {
    return h(
      'div',
      { className: cx('rm-tbl', className), tabIndex: 0, role: 'region', 'aria-label': caption },
      h(
        'table',
        null,
        h('caption', { className: 'dk-sr' }, caption),
        h('thead', null, h('tr', null, cols.map((c) => h('th', { key: c, scope: 'col' }, c)))),
        h('tbody', null, rows),
      ),
    );
  }

  function ViewHead({ eyebrow, title, children }) {
    return h(
      'header',
      { className: 'rm-vh' },
      h('p', { className: 'dk-eyebrow' }, eyebrow),
      h('h1', { className: 'rm-h1v', id: 'view-title', tabIndex: -1 }, title),
      children ? h('p', { className: 'rm-lede' }, children) : null,
    );
  }

  function Sec({ id, kicker, title, lede, children }) {
    return h(
      'section',
      { className: 'rm-sec', id, 'aria-labelledby': id + '-h' },
      h(
        'div',
        { className: 'rm-sechead' },
        h('p', { className: 'dk-eyebrow' }, kicker),
        h('h2', { className: 'rm-h2', id: id + '-h', tabIndex: -1, 'data-focus': '' }, title),
        lede ? h('p', { className: 'rm-sub' }, lede) : null,
      ),
      children,
    );
  }

  function Toast() {
    const [msg, setMsg] = useState('');
    const timer = useRef(0);
    useEffect(() => {
      const on = (e) => {
        clearTimeout(timer.current);
        setMsg(e.detail);
        timer.current = setTimeout(() => setMsg(''), 2800);
      };
      window.addEventListener('rm:toast', on);
      return () => {
        window.removeEventListener('rm:toast', on);
        clearTimeout(timer.current);
      };
    }, []);
    return h(
      Fragment,
      null,
      h('div', { className: 'dk-sr', role: 'status' }, msg),
      msg ? h('div', { className: 'dk-toast', 'aria-hidden': 'true' }, msg) : null,
    );
  }

  // ---------------------------------------------------------------- header and footer

  function paletteItems() {
    const items = [];
    [
      ['overview', 'Overview'],
      ['roadmap', 'Roadmap'],
      ['labs', 'Security labs and projects'],
      ['evidence', 'Evidence ledger'],
      ['skills', 'Skills matrix'],
      ['certs', 'Certifications'],
      ['concepts', 'Concept drill'],
      ['glossary', 'Glossary'],
      ['present', 'Walkthrough for interviews'],
    ].forEach(([to, title]) => items.push({ id: 'p:' + to, kind: 'page', title, sub: '', to }));
    D.milestones.forEach((m) => {
      items.push({ id: 'm:' + m.id, kind: m.id, title: m.title, sub: m.id + ' · ' + plain(m.plain), to: m.id.toLowerCase() });
      m.reps.forEach((r) => items.push({ id: 'r:' + r.id, kind: 'rep', title: plain(r.text), sub: r.id + ' · done when ' + plain(r.doneWhen), to: r.id }));
      m.concepts.forEach((c) => items.push({ id: 'c:' + c.slug, kind: 'concept', title: plain(c.q), sub: m.id + ' · ' + c.slug, to: 'c-' + c.slug }));
    });
    D.glossary.forEach((g) => items.push({ id: 't:' + g.term, kind: 'term', title: g.term, sub: plain(g.def), to: 'glossary', intent: { term: g.term } }));
    D.certs.forEach((c) => items.push({ id: 'x:' + c.name, kind: 'cert', title: c.name, sub: c.code + ' · ' + c.price, to: 'certs' }));
    (D.labs || []).forEach((l) =>
      items.push({ id: 'l:' + l.name, kind: 'lab', title: l.name, sub: l.reps.join(', ') + (l.resource ? ' · ' + l.resource.text : '') + ' · ' + l.tools, to: 'labs-list' }),
    );
    (D.practice || []).forEach((p) =>
      items.push({ id: 'q:' + p.name, kind: 'practice', title: p.name, sub: [AREA[p.area], p.cost, p.time, plain(p.note)].join(' · '), to: 'labs-practice' }),
    );
    (D.capstones || []).forEach((cp) => items.push({ id: 'k:' + cp.name, kind: 'capstone', title: cp.name, sub: cp.question + ' · ' + plain(cp.ship), to: 'labs-capstones' }));
    (D.projects || []).forEach((pj) => items.push({ id: 'j:' + pj.name, kind: 'project', title: pj.name, sub: pj.status + ' · ' + plain(pj.what), to: 'labs-projects' }));
    (D.clocks || []).forEach((c, i) => items.push({ id: 'w:' + i, kind: 'clock', title: plain(c.what), sub: c.when + ' · ' + plain(c.todo), to: 'labs-clocks' }));
    if (D.simulator) {
      D.simulator.scenarios.forEach((s, i) =>
        items.push({ id: 's:' + i, kind: 'try', title: s.title, sub: 'Simulate: ' + plain(s.summary), to: 'gates', intent: { sim: i } }),
      );
    }
    return items;
  }

  // Search: Ctrl+K, ⌘K or "/", as on GitHub. On a phone the button shrinks to its icon. The walkthrough
  // deck owns the keyboard while it is open, so the shortcuts are off then.
  function Palette({ items, hotkey }) {
    return h(
      'div',
      { className: 'rm-palette' },
      h(DS.CommandPalette, {
        items,
        hotkey,
        hotkeys: hotkey ? ['/'] : [],
        compact: 'auto',
        max: 12,
        label: 'Search the roadmap',
        placeholder: 'Search',
        emptyHint: 'No match. Try a milestone like M3, a rep like M0-R5, or a word like firewall.',
        onSelect: (it) => go(it.to, it.intent),
      }),
    );
  }

  function Header({ route, theme, toggleTheme, items, deckOpen, innerRef }) {
    const s = D.stats;
    const active = VIEWS[route.view] ? route.view : 'roadmap';
    const navRef = useRef(null);
    // On a phone the links scroll sideways: keep the current one in view.
    useEffect(() => {
      const ul = navRef.current;
      const a = ul && ul.querySelector('[aria-current="page"]');
      if (!a || ul.scrollWidth <= ul.clientWidth + 1) return;
      const box = ul.getBoundingClientRect();
      const link = a.getBoundingClientRect();
      if (link.left < box.left || link.right > box.right - 32) ul.scrollLeft += link.left - box.left - 8;
    }, [active]);
    const ticked = s.reps[0] + s.exit[0];
    const total = s.reps[1] + s.exit[1];
    return h(
      'header',
      { className: 'rm-header', ref: innerRef },
      h(
        'div',
        { className: 'rm-header-in' },
        h(
          Link,
          { href: '#overview', className: 'rm-brand' },
          h(BrandMark),
          h(
            'span',
            null,
            'DUKECODES',
            h('span', { className: 'rm-brand-rest' }, h('span', { className: 'rm-brand-sep', 'aria-hidden': 'true' }, ' // '), h('span', { className: 'dk-sr' }, ' '), 'ROADMAP'),
          ),
        ),
        h(
          'nav',
          { className: 'rm-nav', 'aria-label': 'Sections' },
          h(
            'ul',
            { ref: navRef },
            Object.keys(VIEWS).map((v) => h('li', { key: v }, h(Link, { href: '#' + v, current: active === v ? 'page' : null }, VIEWS[v]))),
          ),
        ),
        h(
          'div',
          { className: 'rm-tools' },
          h(Palette, { items, hotkey: !deckOpen }),
          h(
            'div',
            { className: 'rm-hring', title: `${ticked} of ${total} reps and exit criteria ticked` },
            h(DS.ProgressRing, { value: s.percent, size: 34, stroke: 4, hideLabel: true, label: 'Overall progress', sub: `${ticked} of ${total} reps and exit criteria ticked` }),
          ),
          h(
            Link,
            { href: '#present', className: 'dk-btn rm-present' },
            h('span', { 'aria-hidden': 'true' }, '▶'),
            h('span', { className: 'rm-hide-sm' }, ' Present'),
          ),
          h(
            DS.Button,
            { className: 'rm-theme', onClick: toggleTheme, ariaLabel: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme' },
            theme === 'dark' ? h(SunIcon) : h(MoonIcon),
          ),
        ),
      ),
    );
  }

  function Footer({ innerRef }) {
    return h(
      'footer',
      { className: 'rm-footer', ref: innerRef },
      h(
        'div',
        { className: 'rm-wrap rm-footer-in' },
        h('p', { className: 'rm-footer-brand' }, h(BrandMark), h('span', null, 'DUKECODES // ROADMAP')),
        h('p', null, rich(D.site.footer)),
        h('p', null, h(Link, { href: D.site.repo }, 'Source on GitHub')),
      ),
    );
  }

  // ---------------------------------------------------------------- shared roadmap parts

  function checkLine() {
    return `roadmap check: ok · ${D.milestones.length} milestones · ${D.stats.reps[1]} reps · ${D.stats.proofs} proofs`;
  }

  // The hero console replays the real `roadmap check --verbose` output of the build that made this page.
  function HeroConsole() {
    const scenarios = useMemo(
      () => [
        {
          name: 'roadmap check',
          stages: D.checks.map((c) => c[0]),
          lines: ['$ uv run roadmap check --verbose', ...D.checks.map(([name, desc]) => name.padEnd(11) + ' ' + desc)],
          fail: null,
          pass: checkLine(),
        },
      ],
      [],
    );
    return h(
      'div',
      { className: 'rm-console' },
      h(DS.LiveConsole, { scenarios, demo: false }),
      h('p', { className: 'rm-console-note' }, 'A replay of the build that made this page. Run it yourself: ', h('code', { className: 'rm-code' }, 'uv run roadmap check --verbose')),
    );
  }

  function ProofStats() {
    const s = D.stats;
    return h(
      'div',
      { className: 'rm-stats' },
      h(DS.StatTile, { value: `${s.milestones[0]}/${s.milestones[1]}`, label: 'milestones' }),
      h(DS.StatTile, { value: `${s.reps[0]}/${s.reps[1]}`, label: 'reps' }),
      h(DS.StatTile, { value: String(s.proofs), label: 'proofs' }),
      h(DS.StatTile, { value: `${s.explainers[0]}/${s.explainers[2]}`, label: 'explainers' }),
      h(DS.StatTile, { value: `${s.certs[0]}/${s.certs[1]}`, label: 'certs' }),
    );
  }

  function NextUp() {
    const sc = scope();
    const nx = D.next;
    if (!nx) {
      return h(
        DS.Panel,
        { className: 'rm-next' },
        h('div', { className: 'rm-next-body' }, h('p', { className: 'dk-eyebrow' }, 'Status'), h('p', { className: 'rm-next-t' }, 'Every milestone is done. Every claim on this page links to its proof.')),
        h(Link, { href: '#evidence', className: 'dk-btn primary' }, 'Browse the evidence →'),
      );
    }
    const m = X.ms.get(nx.milestone);
    const isRep = nx.kind === 'rep';
    const [k, t] = m.progress;
    return h(
      DS.Panel,
      { className: 'rm-next' },
      h(DS.ProgressRing, { value: pct(k, t), size: 76, stroke: 8, label: `${m.id} ${m.title}`, sub: `${k} of ${t} ticked` }),
      h(
        'div',
        { className: 'rm-next-body' },
        h('p', { className: 'dk-eyebrow' }, isRep ? `Up next · ${nx.id}` : `Up next · ${m.id} exit criteria`),
        h('p', { className: 'rm-next-t' }, rich(nx.text, sc)),
        nx.doneWhen.length ? h('p', { className: 'rm-next-dw' }, h('span', { className: 'rm-muted' }, 'Done when: '), rich(nx.doneWhen, sc)) : null,
      ),
      h(Link, { href: '#' + (isRep ? nx.id : m.id.toLowerCase()), className: 'dk-btn primary rm-next-go' }, `Open ${isRep ? nx.id : m.id} →`),
    );
  }

  // A milestone card. The title is the link; it covers the whole card, so the card reads as one link
  // whose name is short, and the rest stays readable text.
  function MCard({ m, compact }) {
    const [k, t] = m.progress;
    return h(
      'div',
      { className: cx('rm-mcard', 'st-' + m.status, compact && 'compact') },
      h('div', { className: 'rm-mcard-top' }, h('span', { className: 'rm-mid' }, m.id), h(StatusChip, { status: m.status }), h('span', { className: 'rm-sp' }), h('span', { className: 'dk-meta' }, `${k}/${t}`)),
      h('h3', { className: 'rm-mcard-t' }, h(Link, { href: '#' + m.id.toLowerCase(), className: 'rm-cover' }, m.title)),
      compact ? null : h('p', { className: 'rm-mcard-p' }, rich(m.plain, null, true)),
      h(Bar, { value: pct(k, t) }),
      compact ? null : h('p', { className: 'dk-meta' }, 'Proof: ' + plain(m.proof)),
    );
  }

  function PhasePath() {
    return h(
      'ol',
      { className: 'rm-path' },
      D.phases.map((p) =>
        h(
          'li',
          { key: p.num, className: 'rm-pnode' },
          h('span', { className: 'rm-pnum', 'aria-hidden': 'true' }, String(p.num)),
          h('span', { className: 'dk-meta' }, p.milestones.join(' · ')),
          h('h3', null, h('span', { className: 'dk-sr' }, `Phase ${p.num}: `), p.title),
          h('p', null, 'Cert gate: ' + p.gate),
        ),
      ),
    );
  }

  function LabCards() {
    const lab = D.lab;
    const sc = scope();
    return h(
      'div',
      { className: 'rm-cards' },
      lab.nodes.map((n) =>
        h(
          'div',
          { key: n.role, className: 'rm-node', 'data-role': ROLES.includes(n.role) ? n.role : undefined },
          h('p', { className: 'dk-eyebrow' }, h('i', { className: 'rm-dot', 'aria-hidden': 'true' }), 'node'),
          h('h3', null, n.role),
          h('p', null, linkTerms(n.job, sc || { gloss: new Map(), seen: new Set() }, n.role)),
        ),
      ),
      h(
        'div',
        { className: 'rm-node', 'data-role': 'net' },
        h('p', { className: 'dk-eyebrow' }, h('i', { className: 'rm-dot', 'aria-hidden': 'true' }), 'network'),
        h('h3', null, 'Edge and access'),
        h('ul', null, lab.network.map((x) => h('li', { key: x }, x))),
      ),
    );
  }

  function LedgerTable({ rows }) {
    return h(Table, {
      caption: 'Evidence ledger, newest first',
      cols: ['Date', 'Milestone', 'Rep', 'Kind', 'Claim', 'Evidence', 'How to verify'],
      rows: rows.map((p, i) =>
        h(
          'tr',
          { key: i },
          h('td', { className: 'rm-mono rm-nowrap' }, p.date),
          h('td', null, h(MsChip, { id: p.milestone })),
          h('td', { className: 'rm-mono rm-nowrap' }, p.rep || '·'),
          h('td', null, h(DS.Chip, null, p.kind)),
          h('td', { className: 'rm-claim' }, p.claim),
          h('td', null, h(EvidenceLink, { e: p.evidence })),
          h('td', { className: 'rm-claim' }, p.verify),
        ),
      ),
    });
  }

  function EmptyLedger({ full }) {
    const first = D.next ? D.next.id : 'the first rep';
    return h(
      DS.Panel,
      { className: 'rm-empty' },
      h('h3', null, 'No proof logged yet'),
      h('p', null, `The ledger starts empty on purpose: nothing counts until it's proven. The first row lands when ${first} passes its test.`),
      full
        ? h(
            Fragment,
            null,
            h('p', null, 'Each row is one line of ', h('code', { className: 'rm-code' }, 'ledger.csv'), '. Here is the shape of one:'),
            h(DS.CodeBlock, {
              where: 'Example only. Not a real row.',
              code: 'date,milestone,rep,kind,claim,evidence,verify\n2026-11-02,M0,M0-R5,lab,pre-commit hooks pass,evidence/m0-pre-commit.txt,re-run pre-commit run --all-files',
            }),
          )
        : null,
    );
  }

  function ProofItem({ p }) {
    return h('li', null, h('span', { className: 'dk-meta' }, `${p.date} · ${p.kind} · `), p.claim, ' · ', h(EvidenceLink, { e: p.evidence }));
  }

  function ConceptRow({ c, sc }) {
    const st = CONCEPT[c.status] || CONCEPT.todo;
    return h(
      'li',
      { className: 'rm-concept', id: 'c-' + c.slug },
      h('span', { className: 'rm-ico teal' }, h(SparkIcon)),
      h(
        'div',
        null,
        h('p', null, rich(c.q, sc)),
        h(
          'div',
          { className: 'rm-row' },
          h('code', { className: 'rm-code' }, c.slug),
          h(DS.Chip, { tone: st[0] }, st[1]),
          c.url ? h(Link, { href: c.url }, 'Read the explainer') : null,
        ),
      ),
    );
  }

  function DomainCard({ d, compact }) {
    const skills = D.skills.filter((s) => s.domain === d.name);
    const dots = (n) => h('span', { className: 'rm-dots', 'aria-hidden': 'true' }, [1, 2, 3].map((k) => h('i', { key: k, className: n !== null && n >= k ? 'on' : undefined })));
    return h(
      DS.Panel,
      { className: 'rm-domain' },
      h(
        'div',
        { className: 'rm-row rm-between' },
        h('h3', null, d.name),
        h('span', { className: 'dk-meta' }, d.avg === null ? `${d.total} skills · not rated yet` : `avg ${d.avg.toFixed(1)} of 3 · ${d.rated}/${d.total} rated`),
      ),
      h(Bar, { value: d.avg === null ? 0 : (100 * d.avg) / 3 }),
      compact
        ? null
        : h(
            'ul',
            null,
            skills.map((s) =>
              h(
                'li',
                { key: s.name },
                h('span', { className: 'rm-skill' }, s.name, s.evidence.length ? h(Fragment, null, ' · ', rich(s.evidence)) : null),
                h(MsChip, { id: s.milestone }),
                dots(s.score),
                h('span', { className: 'rm-score' }, s.score === null ? '?' : String(s.score), h('span', { className: 'dk-sr' }, s.score === null ? ' (not rated)' : ' of 3')),
              ),
            ),
          ),
    );
  }

  // ---------------------------------------------------------------- gate simulator

  // The design system's GateSimulator, fed from showcase.toml. Gates are named by their tool; the
  // labels above the track say where each group runs.
  const ZONES = { local: 'my laptop · every commit', ci: 'GitHub · every push' };

  function simProps(sim) {
    return {
      gates: sim.gates.map((g) => ({ id: g.id, l: g.name, t: g.where, zone: ZONES[g.zone], doing: g.doing, ok: g.ok })),
      attacks: sim.scenarios.map((s, i) => ({
        id: 's' + i,
        l: s.title,
        g: s.blockAt || null,
        why: plain(s.lesson),
        skip: s.skip,
        skipWhy: s.skipWhy,
        cmd: s.cmd,
        finding: s.finding,
        pass: s.pass,
      })),
    };
  }

  // The first scenario plays once, when the simulator scrolls into view. Arriving from search or the
  // walkthrough plays the one asked for.
  function Simulator({ sim, route }) {
    const data = useMemo(() => simProps(sim), [sim]);
    const want = route.intent && route.intent.sim;
    return h(
      DS.Panel,
      null,
      h(DS.GateSimulator, {
        gates: data.gates,
        attacks: data.attacks,
        log: true,
        autoplay: true,
        play: typeof want === 'number' && data.attacks[want] ? data.attacks[want].id : undefined,
        playKey: route.n,
        passLabel: 'Merged',
        passLine: '✓ every gate green · ready to merge',
        blockLine: 'exit 1 · the change never reaches main',
      }),
    );
  }

  // ---------------------------------------------------------------- overview

  function OverviewView({ route }) {
    const site = D.site;
    const sc = scope();
    const latest = D.ledger.slice(0, 5);
    const f = D.final;
    return h(
      Fragment,
      null,
      h(
        'section',
        { className: 'rm-hero', 'aria-labelledby': 'view-title' },
        h(
          'div',
          { className: 'rm-hero-l' },
          h('p', { className: 'rm-badge' }, h('span', { className: 'dk-live' }, site.badge), h('span', { className: 'dk-eyebrow' }, site.eyebrow)),
          h('h1', { className: 'rm-h1', id: 'view-title', tabIndex: -1 }, site.headline[0] + ' ', h('em', null, site.headline[1])),
          h('p', { className: 'rm-lede' }, rich(site.lede, sc)),
          h(
            'div',
            { className: 'rm-ctas' },
            h(Link, { href: '#present', className: 'dk-btn amber rm-cta' }, '▶ Start the walkthrough'),
            h(Link, { href: '#roadmap', className: 'dk-btn rm-cta' }, `See all ${D.milestones.length} milestones`),
          ),
          h(ProofStats),
        ),
        h('div', { className: 'rm-hero-r' }, h(HeroConsole)),
      ),
      h('div', { className: 'rm-gap' }, h(NextUp)),
      D.start.length
        ? h(
            Sec,
            { id: 'start', kicker: `${D.start.length} ways in`, title: 'Who this is for' },
            h(
              'div',
              { className: 'dk-bento' },
              D.start.map((c) =>
                h(
                  DS.BentoCard,
                  { key: c.title, span: 2, eyebrow: c.kicker, title: c.title, href: c.href, newTab: /^https:/.test(c.href) },
                  rich(c.text, null, true),
                  ' ',
                  h('span', { className: 'rm-go' }, c.cta + ' →'),
                ),
              ),
            ),
          )
        : null,
      h(
        Sec,
        {
          id: 'mission',
          kicker: 'The mission',
          title: `${D.milestones.length} milestones, start to finish`,
          lede: 'Each one pairs a chapter of my homelab build with the security work that proves it. Amber is where I am now.',
        },
        h('div', { className: 'rm-mgrid' }, D.milestones.map((m) => h(MCard, { key: m.id, m, compact: true }))),
      ),
      D.simulator ? h(Sec, { id: 'gates', kicker: 'Integrity gates', title: D.simulator.title, lede: rich(D.simulator.intro, sc) }, h(Simulator, { sim: D.simulator, route })) : null,
      D.loop.length
        ? h(
            Sec,
            { id: 'loop', kicker: 'How every milestone works', title: 'The same loop, every time.' },
            h(
              'div',
              { className: 'dk-bento' },
              D.loop.map((x, i) => h(DS.BentoCard, { key: x.title, span: x.wide ? 3 : 2, stat: pad2(i + 1), title: x.title, tone: i === 4 ? 'green' : undefined }, rich(x.text, sc))),
            ),
          )
        : null,
      h(
        Sec,
        {
          id: 'phases',
          kicker: `${D.phases.length} phases`,
          title: 'Cert gates along the way',
          lede: 'A cert comes right after the milestones that teach it, so study time doubles as lab time.',
        },
        h(PhasePath),
        h('div', { className: 'rm-row rm-gap-top' }, h(Link, { href: '#certs', className: 'dk-btn' }, 'Prices and versions →')),
      ),
      (D.projects || []).length
        ? h(
            Sec,
            {
              id: 'security',
              kicker: `${D.labs.length} labs · ${(D.capstones || []).length} capstones · ${D.projects.length} projects`,
              title: 'Security labs and projects',
              lede: 'Each lab is a set of reps with a test, so it counts only once those reps are proven. The projects are where the labs ship.',
            },
            h(ProjectCards),
            h('div', { className: 'rm-row rm-gap-top' }, h(Link, { href: '#labs', className: 'dk-btn' }, 'All labs and projects →')),
          )
        : null,
      D.lab ? h(Sec, { id: 'lab', kicker: 'Hardware', title: D.lab.title, lede: rich(D.lab.summary, sc) }, h(LabCards)) : null,
      h(
        Sec,
        { id: 'proof', kicker: 'Evidence', title: 'Latest proof', lede: 'Newest first. Each row links to the file that proves it.' },
        latest.length ? h(LedgerTable, { rows: latest }) : h(EmptyLedger, { full: false }),
        h('div', { className: 'rm-row rm-gap-top' }, h(Link, { href: '#evidence', className: 'dk-btn' }, 'All evidence →')),
      ),
      f
        ? h(
            'section',
            { className: 'rm-final', 'aria-labelledby': 'final-h' },
            h('p', { className: 'dk-eyebrow' }, f.kicker),
            h('h2', { className: 'rm-h2', id: 'final-h' }, f.title),
            h('p', { className: 'rm-sub' }, rich(f.text, sc)),
            h('div', { className: 'rm-ctas' }, f.cta.map((c, i) => h(Link, { key: c.href, href: c.href, className: cx('dk-btn rm-cta', i ? '' : 'amber') }, c.text))),
          )
        : null,
    );
  }

  // ---------------------------------------------------------------- roadmap and milestones

  function RoadmapView() {
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Roadmap', title: `${D.milestones.length} milestones in ${D.phases.length} phases` },
        'Each milestone pairs a chapter of my homelab build with the security work that proves it. Open one for its reps, the attacks I run against it, and the concepts I explain.',
      ),
      D.phases.map((p) =>
        h(
          'section',
          { key: p.num, className: 'rm-phase', 'aria-labelledby': 'phase-' + p.num },
          h(
            'div',
            { className: 'rm-phase-h' },
            h('p', { className: 'dk-eyebrow' }, `Phase ${p.num}`),
            h('h2', { className: 'rm-h2', id: 'phase-' + p.num }, p.title),
            h(DS.Chip, null, 'Cert gate · ' + p.gate),
          ),
          h('div', { className: 'rm-cards' }, p.milestones.map((id) => h(MCard, { key: id, m: X.ms.get(id) }))),
        ),
      ),
    );
  }

  // A rep is read-only: the tick comes from the repo, never from this page, so its card shows a status
  // mark and no checkbox. defaultOpen: the route points at this rep. It opens the card; after that the
  // reader decides.
  function RepCard({ r, defaultOpen, n }) {
    const [open, setOpen] = useState(!!defaultOpen);
    useEffect(() => {
      if (defaultOpen) setOpen(true);
    }, [defaultOpen, n]);
    const sc = scope();
    const rows = r.proofs.map((k) => D.ledger[k]);
    const labs = X.labs.get(r.id) || [];
    const practice = X.practice.get(r.id) || [];
    const chips = h(
      Fragment,
      null,
      r.done ? h(DS.Chip, { tone: 'green' }, '✓ proven') : h(DS.Chip, null, 'no proof yet'),
      rows.length ? h(DS.Chip, { tone: 'teal' }, `${rows.length} ledger row${rows.length > 1 ? 's' : ''}`) : null,
    );
    return h(
      'div',
      { className: 'rm-rep', id: r.id },
      h(
        DS.StepCard,
        { id: r.id, title: plain(r.text), chips, readOnly: true, done: r.done, open, onOpenChange: setOpen },
        h('h4', null, 'Rep'),
        h('p', null, rich(r.text, sc)),
        h('h4', null, 'Done when'),
        h('p', null, rich(r.doneWhen, sc)),
        labs.length ? h('h4', null, labs.length > 1 ? 'Labs' : 'Lab') : null,
        labs.length
          ? h(
              'ul',
              { className: 'rm-proofs' },
              labs.map((l) =>
                h(
                  'li',
                  { key: l.name },
                  h(Link, { href: '#labs' }, l.name),
                  l.resource ? h(Fragment, null, h('span', { className: 'dk-meta' }, ' · follows '), h(Link, { href: l.resource.url }, l.resource.text), h('span', { className: 'dk-meta' }, ` · ${l.cost}`)) : null,
                ),
              ),
            )
          : null,
        practice.length ? h('h4', null, 'Practice') : null,
        practice.length
          ? h(
              'ul',
              { className: 'rm-proofs' },
              practice.map((p) => h('li', { key: p.name }, h(Link, { href: p.url }, p.name), h('span', { className: 'dk-meta' }, ` · ${p.cost} · ${p.time}`))),
            )
          : null,
        h('h4', null, 'Proof'),
        rows.length
          ? h('ul', { className: 'rm-proofs' }, rows.map((p, i) => h(ProofItem, { key: i, p })))
          : h('p', { className: 'rm-muted' }, "Nothing logged yet. This rep can't be ticked until a ledger row points at its evidence."),
      ),
    );
  }

  function AsideCard({ title, children }) {
    return h(DS.Panel, { className: 'rm-acard' }, h('h3', { className: 'dk-eyebrow' }, title), children);
  }

  function MilestoneView({ m, route }) {
    const i = D.milestones.indexOf(m);
    const prev = D.milestones[i - 1];
    const next = D.milestones[i + 1];
    const phase = D.phases.find((p) => p.num === m.phase);
    const mine = m.proofs.map((k) => D.ledger[k]);
    const scHead = scope();
    const scWhy = scope();
    const scBreak = scope();
    const scExplain = scope();
    const scExit = scope();
    const scAside = scope();
    return h(
      Fragment,
      null,
      h('nav', { className: 'rm-crumb', 'aria-label': 'Breadcrumb' }, h(Link, { href: '#roadmap' }, 'Roadmap'), h('span', { 'aria-hidden': 'true' }, '/'), h('span', { 'aria-current': 'page' }, m.id)),
      h(
        DS.Panel,
        { className: 'rm-mhead' },
        h('div', { className: 'rm-row' }, h('p', { className: 'dk-eyebrow' }, `${m.id} · Phase ${m.phase}${phase ? ' · ' + phase.title : ''}`), h(StatusChip, { status: m.status })),
        h('h1', { className: 'rm-h1v', id: 'view-title', tabIndex: -1 }, m.title),
        h('div', { className: 'rm-row' }, h(DS.Chip, null, `${m.progress[0]}/${m.progress[1]} ticked`), h(DS.Chip, null, 'Cert gate · ' + plain(m.cert))),
        h(DS.Callout, { kind: 'adapt', label: 'In plain words' }, rich(m.plain, scHead)),
        m.careful ? h(DS.Callout, { kind: 'warn', label: 'Careful' }, rich(m.careful, scHead)) : null,
      ),
      h(
        'div',
        { className: 'rm-ms' },
        h(
          'div',
          { className: 'rm-ms-main' },
          h('section', { className: 'rm-msec' }, h('h2', null, 'Why (first principles)'), h(DS.Panel, { className: 'rm-prose' }, h('p', null, rich(m.why, scWhy)))),
          h(
            'section',
            { className: 'rm-msec' },
            h('h2', null, 'Reps'),
            h('p', null, 'Small exercises, each with a test. A rep counts only when its test passes and a ledger row points at the proof.'),
            h('div', { className: 'rm-reps' }, m.reps.map((r) => h(RepCard, { key: r.id, r, defaultOpen: route.id === r.id, n: route.n }))),
          ),
          h(
            'section',
            { className: 'rm-msec' },
            h('h2', null, 'Break it'),
            h('p', null, 'Attacks I run against my own work, from the lab.'),
            h(
              'ul',
              { className: 'rm-list dk-panel' },
              m.breakIt.map((b, k) => h('li', { key: k }, h('span', { className: 'rm-ico red' }, h(ShieldIcon)), h('div', null, h('p', null, rich(b, scBreak))))),
            ),
          ),
          h(
            'section',
            { className: 'rm-msec' },
            h('h2', null, 'Explain it'),
            h('p', null, 'Interview questions I answer from first principles, in under 500 words each.'),
            h('ul', { className: 'rm-list dk-panel' }, m.concepts.map((c) => h(ConceptRow, { key: c.slug, c, sc: scExplain }))),
          ),
          h(
            'section',
            { className: 'rm-msec' },
            h('h2', null, 'Exit criteria'),
            h('ul', { className: 'rm-list dk-panel' }, m.exit.map((x, k) => h('li', { key: k }, h(Tick, { on: x.done }), h('div', null, h('p', null, rich(x.text, scExit)))))),
          ),
        ),
        h(
          'aside',
          { className: 'rm-aside', 'aria-label': `${m.id} at a glance` },
          h(
            AsideCard,
            { title: 'Build' },
            h('p', null, rich(m.build, scAside)),
            m.chapters.length ? h('div', { className: 'rm-row' }, m.chapters.map((c) => h(DS.Chip, { key: c }, c))) : null,
          ),
          h(AsideCard, { title: "Proof it's done" }, h('p', null, rich(m.proof, scAside))),
          h(AsideCard, { title: 'Interview story' }, h('p', null, rich(m.story, scAside))),
          h(
            AsideCard,
            { title: 'Evidence' },
            mine.length ? h('ul', { className: 'rm-proofs' }, mine.map((p, k) => h(ProofItem, { key: k, p }))) : h('p', { className: 'rm-muted' }, 'No proof logged for this milestone yet.'),
          ),
          m.url ? h(Link, { href: m.url, className: 'dk-btn' }, 'Open the source file') : null,
        ),
      ),
      h(
        'nav',
        { className: 'rm-pn', 'aria-label': 'Other milestones' },
        prev ? h(Link, { href: '#' + prev.id.toLowerCase(), className: 'dk-btn' }, `← ${prev.id} ${prev.title}`) : h('span'),
        next ? h(Link, { href: '#' + next.id.toLowerCase(), className: 'dk-btn' }, `${next.id} ${next.title} →`) : null,
      ),
    );
  }

  // ---------------------------------------------------------------- evidence, skills, certs

  function EvidenceView() {
    const kinds = Array.from(new Set(D.ledger.map((p) => p.kind))).sort();
    const [filter, setFilter] = useState('all');
    const rows = D.ledger.filter((p) => filter === 'all' || p.kind === filter);
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Evidence', title: 'Evidence ledger' },
        'Every tick on this page points at a row here, and every row points at a file or link you can check yourself. Newest first.',
      ),
      h(
        'div',
        { className: 'rm-bar' },
        kinds.length > 1
          ? h(DS.Segmented, { label: 'Filter by kind', value: filter, onChange: setFilter, options: ['all', ...kinds].map((k) => ({ value: k, label: k })) })
          : null,
        h('span', { className: 'rm-sp' }),
        h(Link, { href: `${D.site.repo}/blob/${D.site.branch}/ledger.csv`, className: 'dk-btn' }, 'ledger.csv'),
      ),
      D.ledger.length ? h(LedgerTable, { rows }) : h(EmptyLedger, { full: true }),
    );
  }

  function SkillsView() {
    const [rated, total] = D.stats.skills;
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Skills', title: 'Skills matrix' },
        'Self-rated, then re-rated at the end of every milestone. A 2 or 3 needs evidence: ',
        h('code', { className: 'rm-code' }, 'roadmap check'),
        ' fails one without it.',
      ),
      h('ul', { className: 'rm-legend', 'aria-label': 'Rating scale' }, SCALE.map(([k, v]) => h('li', { key: k }, h('b', null, k), ' ' + v))),
      rated ? null : h('div', { className: 'rm-gap-bottom' }, h(DS.Callout, { kind: 'unverified', label: 'Not rated yet' }, `All ${total} skills start at ?. The first ratings land in M0.`)),
      h('div', { className: 'rm-grid2' }, D.domains.map((d) => h(DomainCard, { key: d.name, d }))),
    );
  }

  function CertsTable() {
    const sc = scope();
    return h(Table, {
      caption: 'Certifications, in the order I plan to take them',
      cols: ['Cert', 'Code', 'After', 'Price', 'Format', 'Valid', 'Status', 'Label', 'Checked', 'Note'],
      rows: D.certs.map((c) =>
        h(
          'tr',
          { key: c.name },
          h('td', { className: 'rm-name' }, c.url ? h(Link, { href: c.url }, c.name) : c.name),
          h('td', { className: 'rm-mono' }, unbroken(c.code)),
          h('td', null, h(MsChip, { id: c.after })),
          h('td', { className: 'rm-mono rm-nowrap' }, c.price),
          h('td', { className: 'rm-claim' }, c.format),
          h('td', { className: 'rm-valid' }, c.valid),
          h('td', null, h(DS.Chip, { tone: CERT[c.status] }, c.status)),
          h('td', null, h(DS.Chip, { tone: LABEL[c.label] }, c.label)),
          h('td', { className: 'rm-mono rm-nowrap' }, c.checked || '·'),
          h('td', { className: 'rm-claim' }, rich(c.note, sc)),
        ),
      ),
    });
  }

  function CertsView() {
    const t = D.certTotal;
    const skipped = D.certSkipped || [];
    const choices = D.certChoices || [];
    const parts = [
      ['certs-ladder', 'Ladder', D.certs.length, 'Each cert right after the milestone that teaches it. Optional ones are for a track I may lean into.', h(CertsTable)],
      ['certs-skipped', 'Skipped for now', skipped.length, 'Checked and left out, with the reason. Each can come back if a job asks for it.', h(Bullets, { items: skipped, sc: scope() })],
      ['certs-choices', 'Choices to make', choices.length, 'Open decisions, each with the option I lean to.', h(Bullets, { items: choices, sc: scope() })],
    ].filter((p) => p[2]);
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Certs', title: 'Certifications' },
        "Each cert is a gate right after the milestone that teaches it, so study time doubles as lab time. Certs back up the proof; they don't replace it.",
      ),
      h(
        DS.Panel,
        { className: 'rm-total' },
        h('div', null, h('b', null, t.core), h('span', null, `core path · ${t.count} exams`)),
        h('div', null, h('b', null, `${D.stats.certs[0]}/${D.stats.certs[1]}`), h('span', null, 'passed')),
        h(
          'p',
          null,
          'Prices as read on the official pages on the Checked date. ',
          t.soft.length ? `Not confirmed on an official page: ${t.soft.join(', ')}. ` : '',
          'Re-check before booking: prices and exam versions change.',
        ),
      ),
      parts.length > 1 ? h(OnThisPage, { parts: parts.map((p) => [p[0], p[1]]) }) : null,
      h('div', { className: 'rm-parts' }, parts.map(([id, title, , lede, body]) => h(Part, { key: id, id, title, lede }, body))),
    );
  }

  // ---------------------------------------------------------------- security labs and projects

  function ProjectCards() {
    return h(
      'div',
      { className: 'dk-bento' },
      D.projects.map((pj) => {
        const st = PROJECT[pj.status] || PROJECT.planned;
        return h(
          DS.BentoCard,
          {
            key: pj.name,
            span: 2,
            eyebrow: st[1] + ' · ' + (pj.all ? 'all milestones' : pj.milestones.join(' ')),
            title: pj.name,
            tone: pj.status === 'shipped' ? 'green' : pj.status === 'building' ? 'amber' : undefined,
            href: pj.url || undefined,
            newTab: !!pj.url,
          },
          rich(pj.what, null, true),
        );
      }),
    );
  }

  // The status of a set of reps: done when all are ticked, in progress when some are.
  function RepsStatus({ x }) {
    const st = LAB[x.status] || LAB.planned;
    return h('span', { className: 'rm-nowrap' }, h(DS.Chip, { tone: st[0] }, st[1]), h('span', { className: 'dk-meta' }, ` ${x.progress[0]}/${x.progress[1]}`));
  }

  function RepChips({ reps }) {
    return reps.length ? h('div', { className: 'rm-row' }, reps.map((id) => h(RepChip, { key: id, id }))) : h('span', { className: 'rm-muted' }, '·');
  }

  // Job value from 1 to 5, as dots and a number a screen reader reads out.
  function Value({ n }) {
    if (n === null) return h('span', { className: 'rm-muted' }, '·');
    return h(
      'span',
      { className: 'rm-val' },
      h('span', { className: 'rm-dots', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map((k) => h('i', { key: k, className: n >= k ? 'on' : undefined }))),
      h('span', { className: 'rm-score' }, String(n), h('span', { className: 'dk-sr' }, ' of 5')),
    );
  }

  // Whole days from the reader's today to an ISO date. Counted here, not in the build, so the page
  // never goes stale and the JSON stays the same from one day to the next.
  function daysUntil(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }

  function ClockWhen({ c }) {
    if (!c.on) return h('span', { className: 'rm-clock' }, h('span', { className: 'rm-mono rm-nowrap' }, c.when), h('span', { className: 'dk-meta rm-nowrap' }, 'from the start'));
    const n = daysUntil(c.on);
    const left = n === 1 ? 'tomorrow' : `in ${n} days`;
    const [tone, text] = n < 0 ? ['neutral', 'passed'] : n === 0 ? ['red', 'today'] : n <= 30 ? ['red', left] : n <= 90 ? ['amber', left] : ['neutral', left];
    return h('span', { className: 'rm-clock' }, h('span', { className: 'rm-mono rm-nowrap' }, c.on), h(DS.Chip, { tone }, text));
  }

  // One part of a long view. The route can land on it (#labs-practice), and its heading takes the focus.
  function Part({ id, title, lede, children }) {
    return h(
      'section',
      { className: 'rm-msec', id, 'aria-labelledby': id + '-h' },
      h('h2', { id: id + '-h', tabIndex: -1, 'data-focus': '' }, title),
      lede ? h('p', null, lede) : null,
      children,
    );
  }

  // Plain hash links, so they also work inside an Artifact.
  function OnThisPage({ parts }) {
    return h(
      'nav',
      { className: 'rm-toc', 'aria-label': 'On this page' },
      h('span', { className: 'dk-eyebrow' }, 'On this page'),
      h('ul', null, parts.map(([id, title]) => h('li', { key: id }, h(Link, { href: '#' + id }, title)))),
    );
  }

  function Bullets({ items, sc }) {
    return h('ul', { className: 'rm-choices dk-panel' }, items.map((b, i) => h('li', { key: i }, rich(b, sc))));
  }

  function StartHere() {
    const sc = scope();
    return h(
      'ol',
      { className: 'rm-list rm-start dk-panel', role: 'list' },
      D.labPath.map((s, i) =>
        h(
          'li',
          { key: i },
          h('span', { className: 'rm-num', 'aria-hidden': 'true' }, String(i + 1)),
          h(
            'div',
            null,
            h('p', null, rich(s.text, sc)),
            h('p', null, h('span', { className: 'dk-meta' }, 'Evidence it leaves: '), rich(s.evidence, sc)),
            h('div', { className: 'rm-row' }, h(RepChips, { reps: s.reps }), h(RepsStatus, { x: s })),
          ),
        ),
      ),
    );
  }

  function LabsTable() {
    const sc = scope();
    return h(Table, {
      caption: 'Security labs, in milestone order',
      cols: ['Lab', 'Reps', 'Tools', 'Course or guide', 'Cost', 'Checked', 'Status'],
      rows: D.labs.map((l, i) =>
        h(
          'tr',
          { key: l.name },
          h('td', { className: 'rm-name' }, l.name),
          h('td', null, h(RepChips, { reps: l.reps })),
          h('td', { className: 'rm-claim' }, sc ? linkTerms(l.tools, sc, 'l' + i) : l.tools),
          h('td', { className: 'rm-claim' }, l.resource ? h(Link, { href: l.resource.url }, l.resource.text) : h('span', { className: 'rm-muted' }, 'the reps')),
          h('td', { className: 'rm-mono rm-nowrap' }, l.cost || '·'),
          h('td', { className: 'rm-mono rm-nowrap' }, l.checked || '·'),
          h('td', null, h(RepsStatus, { x: l })),
        ),
      ),
    });
  }

  function PracticeTable() {
    const [area, setArea] = useState('all');
    const sc = scope();
    const areas = Object.keys(AREA).filter((a) => D.practice.some((p) => p.area === a));
    const rows = D.practice.filter((p) => area === 'all' || p.area === area);
    return h(
      Fragment,
      null,
      h(
        'div',
        { className: 'rm-bar' },
        h(DS.Segmented, { label: 'Filter by area', value: area, onChange: setArea, options: [{ value: 'all', label: 'All' }, ...areas.map((a) => ({ value: a, label: AREA[a] }))] }),
        h('span', { className: 'dk-meta', role: 'status' }, `${rows.length} of ${D.practice.length}`),
      ),
      h(Table, {
        caption: 'Practice resources: courses, ranges and tools, by area',
        cols: ['Resource', 'Area', 'Reps', 'Cost', 'Time', 'Value', 'Label', 'Checked', 'Note'],
        rows: rows.map((p) =>
          h(
            'tr',
            { key: p.name },
            h('td', { className: 'rm-name' }, h(Link, { href: p.url }, p.name)),
            h('td', { className: 'rm-nowrap' }, AREA[p.area] || p.area),
            h('td', null, h(RepChips, { reps: p.reps })),
            h('td', { className: 'rm-mono rm-nowrap' }, p.cost),
            h('td', { className: 'rm-time' }, p.time),
            h('td', null, h(Value, { n: p.value })),
            h('td', null, h(DS.Chip, { tone: LABEL[p.label] }, p.label)),
            h('td', { className: 'rm-mono rm-nowrap' }, p.checked || '·'),
            h('td', { className: 'rm-claim rm-note' }, rich(p.note, sc)),
          ),
        ),
      }),
    );
  }

  function Capstones() {
    const sc = scope();
    return h(
      'div',
      { className: 'rm-grid2' },
      D.capstones.map((cp) =>
        h(
          DS.Panel,
          { key: cp.name, className: 'rm-cap' },
          h('div', { className: 'rm-row rm-between' }, h('h3', null, cp.name), h(RepsStatus, { x: cp })),
          h('p', null, rich(cp.ship, sc)),
          h('p', { className: 'rm-cap-q' }, h('span', { className: 'dk-eyebrow' }, 'Interview question'), cp.question),
          h('p', { className: 'dk-meta' }, 'Ships in ', h(Link, { href: '#labs-projects' }, cp.shipsIn)),
          h(RepChips, { reps: cp.reps }),
        ),
      ),
    );
  }

  function ProjectsTable() {
    const sc = scope();
    return h(Table, {
      caption: 'Projects and the security built into each',
      cols: ['Project', 'Milestones', 'What it is', 'Security built in', 'Status', 'Proof'],
      rows: D.projects.map((pj) => {
        const st = PROJECT[pj.status] || PROJECT.planned;
        return h(
          'tr',
          { key: pj.name },
          h('td', { className: 'rm-name' }, pj.url ? h(Link, { href: pj.url }, pj.name) : pj.name),
          h('td', null, pj.all ? 'all' : h('div', { className: 'rm-row' }, pj.milestones.map((id) => h(MsChip, { key: id, id })))),
          h('td', { className: 'rm-claim' }, rich(pj.what, sc)),
          h('td', { className: 'rm-claim' }, rich(pj.security, sc)),
          h('td', { className: 'rm-nowrap' }, h(DS.Chip, { tone: st[0] }, st[1])),
          h('td', null, pj.proofs.length ? h('ul', { className: 'rm-proofs' }, pj.proofs.map((k) => h(ProofItem, { key: k, p: D.ledger[k] }))) : '·'),
        );
      }),
    });
  }

  function ClocksTable() {
    const sc = scope();
    return h(Table, {
      caption: 'Deadlines and trial lengths',
      cols: ['When', 'What', 'Reps', 'Do this', 'Label', 'Checked'],
      rows: D.clocks.map((c, i) =>
        h(
          'tr',
          { key: i },
          h('td', null, h(ClockWhen, { c })),
          h('td', { className: 'rm-claim' }, rich(c.what, sc)),
          h('td', null, h(RepChips, { reps: c.reps })),
          h('td', { className: 'rm-claim' }, rich(c.todo, sc)),
          h('td', null, h(DS.Chip, { tone: LABEL[c.label] }, c.label)),
          h('td', { className: 'rm-mono rm-nowrap' }, c.checked || '·'),
        ),
      ),
    });
  }

  function LabsView() {
    const s = D.stats;
    const parts = [
      ['labs-start', 'Start here', D.labPath.length, 'The top picks, in milestone order, since each milestone builds on the one before. All of them are free, and each leaves evidence an interviewer can open.', h(StartHere)],
      ['labs-list', 'Labs', D.labs.length, 'Grouped from the milestone reps. Open a rep for its test.', h(LabsTable)],
      [
        'labs-practice',
        'Practice',
        D.practice.length,
        'More ways to learn each rep: courses, practice ranges and the tools themselves. Value is job value from 1 to 5, an inference from job ads. Time is a guess unless it says stated. Subscriptions renew on their own, so I buy one month when a lab needs it.',
        h(PracticeTable),
      ],
      ['labs-capstones', 'Capstones', D.capstones.length, 'Each joins several labs into one piece of work an interviewer can open. Its status comes from its reps.', h(Capstones)],
      ['labs-projects', 'Projects', D.projects.length, 'Where the labs ship. A private repo has no link. A project counts as shipped only with a ledger row that names it.', h(ProjectsTable)],
      ['labs-clocks', 'Clocks', D.clocks.length, 'Deadlines and trial lengths that decide when I do a lab. A length counts from the day it starts, so I build and snapshot the VM before I sign up.', h(ClocksTable)],
      ['labs-choices', 'Choices to make', D.labChoices.length, 'Open decisions, each with the option I lean to.', h(Bullets, { items: D.labChoices, sc: scope() })],
    ].filter((p) => p[2]);
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Labs', title: 'Security labs and projects' },
        "Every security lab on the roadmap, the practice that teaches it, and the projects that ship it. A lab is a set of reps, so its status comes from their ticks, never from this page. A skill I don't have yet becomes a lab here, never a resume line.",
      ),
      h(
        DS.Panel,
        { className: 'rm-total' },
        h('div', null, h('b', null, `${s.labs[0]}/${s.labs[1]}`), h('span', null, 'labs done')),
        h('div', null, h('b', null, `${s.capstones[0]}/${s.capstones[1]}`), h('span', null, 'capstones done')),
        h('div', null, h('b', null, `${s.projects[0]}/${s.projects[1]}`), h('span', null, 'projects shipped')),
        h('div', null, h('b', null, String(s.practice)), h('span', null, 'practice resources')),
        h('p', null, 'Links and prices as read on the Checked date. ', h('code', { className: 'rm-code' }, 'roadmap check'), " fails a rep that doesn't exist, a date in the future, and a shipped project with no ledger row."),
      ),
      h(OnThisPage, { parts: parts.map((p) => [p[0], p[1]]) }),
      h('div', { className: 'rm-parts' }, parts.map(([id, title, , lede, body]) => h(Part, { key: id, id, title, lede }, body))),
    );
  }

  // ---------------------------------------------------------------- concept drill

  function DrillTimer({ resetKey }) {
    const [left, setLeft] = useState(DRILL_SECONDS);
    const [on, setOn] = useState(false);
    useEffect(() => {
      setOn(false);
      setLeft(DRILL_SECONDS);
    }, [resetKey]);
    useEffect(() => {
      if (!on) return undefined;
      const id = setInterval(() => setLeft((s) => s - 1), 1000);
      return () => clearInterval(id);
    }, [on]);
    useEffect(() => {
      if (on && left <= 0) {
        setOn(false);
        toast('Time. Land it in one sentence.');
      }
    }, [left, on]);
    const s = Math.max(0, left);
    const label = on ? '❚❚ Pause' : s > 0 && s < DRILL_SECONDS ? '▶ Resume' : '▶ Start 2:00';
    return h(
      'div',
      { className: 'rm-timer-row' },
      h('div', { className: cx('rm-timer', s <= 15 && 'low'), role: 'timer', 'aria-label': 'Answer timer' }, `${Math.floor(s / 60)}:${pad2(s % 60)}`),
      h(
        DS.Button,
        {
          onClick: () => {
            if (s <= 0) setLeft(DRILL_SECONDS);
            setOn(!on);
          },
        },
        label,
      ),
      h(
        DS.Button,
        {
          onClick: () => {
            setOn(false);
            setLeft(DRILL_SECONDS);
          },
        },
        '↺ Reset',
      ),
    );
  }

  function conceptBack(m, c) {
    const parts = termsIn(plain(c.q))
      .slice(0, 2)
      .map((g) => `${g.term}: ${plain(g.def)}`);
    parts.push(c.status === 'todo' ? `My explainer (${c.slug}) isn't written yet: it's part of ${m.id}.` : `Then compare with my explainer (${c.status}).`);
    return parts.join(' ');
  }

  function ConceptsView() {
    const [mode, setMode] = useState('cards');
    const [stories, setStories] = useState(false);
    const [round, setRound] = useState(0);
    const cards = useMemo(() => {
      const all = [];
      D.milestones.forEach((m) => m.concepts.forEach((c) => all.push({ q: plain(c.q), a: conceptBack(m, c), tag: `${m.id} · explain it` })));
      if (stories) D.milestones.forEach((m) => all.push({ q: `Walk me through ${m.id}: ${m.title}.`, a: plain(m.story), tag: `${m.id} · interview story` }));
      return shuffle(all.length).map((k) => all[k]);
    }, [stories]);
    // The timer starts over on every new card: grading a card, by button or arrow key, moves on.
    const nextCard = () => setRound((r) => r + 1);
    const onClickCapture = (e) => {
      if (e.target.closest && e.target.closest('.dk-row .dk-btn:not([aria-disabled="true"])')) nextCard();
    };
    const onKeyDownCapture = (e) => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest && e.target.closest('.dk-flip.on')) nextCard();
    };
    const sc = scope();
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Concepts', title: 'Concept drill' },
        'Every concept in the roadmap as an interview question. Answer out loud before the two minutes run out, flip the card, then check against my explainer.',
      ),
      h(
        'div',
        { className: 'rm-bar' },
        h(DS.Segmented, {
          label: 'Mode',
          value: mode,
          onChange: setMode,
          options: [
            { value: 'cards', label: 'Flashcards' },
            { value: 'list', label: 'All questions' },
          ],
        }),
        mode === 'cards' ? h(DS.Button, { pressed: stories, onClick: () => setStories(!stories) }, '+ interview stories') : null,
      ),
      mode === 'cards'
        ? h(
            DS.Panel,
            { className: 'rm-drill' },
            h(DrillTimer, { resetKey: round + (stories ? 's' : '') }),
            h(
              'div',
              { className: 'rm-flashwrap', onClickCapture, onKeyDownCapture },
              h(DS.Flashcards, { key: stories ? 's' : 'c', cards, title: `${cards.length} questions · answer out loud first` }),
            ),
          )
        : h(
            'div',
            { className: 'rm-grid2' },
            D.milestones.map((m) =>
              h(
                DS.Panel,
                { key: m.id, className: 'rm-qlist' },
                h('h3', null, h(Link, { href: '#' + m.id.toLowerCase() }, `${m.id} ${m.title}`)),
                h('ul', { className: 'rm-list' }, m.concepts.map((c) => h(ConceptRow, { key: c.slug, c, sc }))),
              ),
            ),
          ),
    );
  }

  // ---------------------------------------------------------------- glossary

  function GlossaryView({ route }) {
    const [mode, setMode] = useState('list');
    const [q, setQ] = useState('');
    useEffect(() => {
      const t = route.intent && route.intent.term;
      if (t) {
        setMode('list');
        setQ(t);
      }
    }, [route.n]); // eslint-disable-line react-hooks/exhaustive-deps
    const cards = useMemo(() => shuffle(D.glossary.length).map((k) => ({ q: D.glossary[k].term, a: plain(D.glossary[k].def), tag: 'Term' })), []);
    const want = q.toLowerCase().trim();
    const rows = D.glossary.filter((g) => !want || (g.term + ' ' + plain(g.def)).toLowerCase().includes(want));
    return h(
      Fragment,
      null,
      h(
        ViewHead,
        { eyebrow: 'Glossary', title: 'Every term in plain English' },
        `${D.glossary.length} terms, written for people who didn't come from tech. Underlined words anywhere on this page explain themselves when you hover over or tap them.`,
      ),
      h(
        'div',
        { className: 'rm-bar' },
        h(DS.Segmented, {
          label: 'Mode',
          value: mode,
          onChange: setMode,
          options: [
            { value: 'list', label: 'List' },
            { value: 'cards', label: 'Flashcards' },
          ],
        }),
        mode === 'list'
          ? h('input', { className: 'rm-input', type: 'search', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Filter terms…', 'aria-label': 'Filter the glossary' })
          : null,
        mode === 'list' ? h('span', { className: 'dk-meta', role: 'status' }, `${rows.length} of ${D.glossary.length} terms`) : null,
      ),
      mode === 'cards'
        ? h(DS.Panel, { className: 'rm-drill' }, h('div', { className: 'rm-flashwrap' }, h(DS.Flashcards, { cards, title: `${cards.length} terms` })))
        : rows.length
          ? h(
              'dl',
              { className: 'rm-gloss' },
              rows.map((g) => h('div', { key: g.term }, h('dt', null, g.term), h('dd', null, rich(g.def)))),
            )
          : h(DS.Panel, { className: 'rm-empty' }, h('h3', null, 'No match'), h('p', null, 'Try a shorter word, or search everything with ⌘K or /.')),
    );
  }

  // ---------------------------------------------------------------- walkthrough deck

  function Box({ label, children }) {
    return h(DS.Panel, { className: 'rm-acard' }, h('p', { className: 'dk-eyebrow' }, label), children);
  }

  function MilestoneSlide({ m }) {
    const done = m.reps.filter((r) => r.done);
    const proofs = m.proofs.map((k) => D.ledger[k]);
    const sc = scope();
    return h(
      Fragment,
      null,
      h('h2', null, `${m.id} ${m.title}`),
      h('p', { className: 'rm-lede' }, rich(m.plain, sc)),
      h(
        'div',
        { className: 'rm-grid2' },
        h(Box, { label: "Proof it's done" }, h('p', null, rich(m.proof, sc))),
        h(
          Box,
          { label: `Reps · ${done.length}/${m.reps.length}` },
          done.length ? h('ul', null, done.map((r) => h('li', { key: r.id }, h('code', { className: 'rm-code' }, r.id), ' ', rich(r.text)))) : h('p', null, 'None ticked yet.'),
        ),
        h(Box, { label: 'Evidence' }, proofs.length ? h('ul', null, proofs.map((p, k) => h('li', { key: k }, p.claim, ' · ', h(EvidenceLink, { e: p.evidence })))) : h('p', null, 'No proof logged yet.')),
        h(Box, { label: 'The story' }, h('p', null, rich(m.story, sc))),
      ),
      h('div', { className: 'rm-ctas' }, h(Link, { href: '#' + m.id.toLowerCase(), className: 'dk-btn' }, `Open ${m.id} →`)),
    );
  }

  function UpNextSlide({ m }) {
    const r = m.reps.find((x) => !x.done);
    const sc = scope();
    return h(
      Fragment,
      null,
      h('h2', null, `Up next: ${m.id} ${m.title}`),
      h('p', { className: 'rm-lede' }, rich(m.plain, sc)),
      h(
        'div',
        { className: 'rm-grid2' },
        h(Box, { label: "What I'm building" }, h('p', null, rich(m.build, sc))),
        h(Box, { label: "Proof it's done" }, h('p', null, rich(m.proof, sc))),
        r ? h(Box, { label: `First rep · ${r.id}` }, h('p', null, rich(r.text, sc)), h('p', null, h('span', { className: 'rm-muted' }, 'Done when: '), rich(r.doneWhen, sc))) : null,
        m.breakIt.length ? h(Box, { label: 'Then I break it' }, h('p', null, rich(m.breakIt[0], sc))) : null,
      ),
      h('div', { className: 'rm-ctas' }, h(Link, { href: '#' + m.id.toLowerCase(), className: 'dk-btn' }, `Open ${m.id} →`)),
    );
  }

  function buildSlides() {
    const s = D.stats;
    const site = D.site;
    const cur = D.current ? X.ms.get(D.current) : null;
    const out = [];
    const slide = (eyebrow, title, render) => out.push({ eyebrow, title, render });
    slide(`Walkthrough · ${site.owner}`, 'Introduction', () =>
      h(
        Fragment,
        null,
        h('p', { className: 'rm-badge' }, h('span', { className: 'dk-live' }, site.badge), h('span', { className: 'dk-eyebrow' }, site.eyebrow)),
        h('h2', null, site.headline[0] + ' ', h('em', null, site.headline[1])),
        h('p', { className: 'rm-lede' }, rich(site.lede, scope())),
        h(ProofStats),
      ),
    );
    if (D.loop.length) {
      slide('How I work', 'How I work', () =>
        h(
          Fragment,
          null,
          h('h2', null, 'Every milestone runs the same loop.'),
          h('div', { className: 'dk-bento' }, D.loop.map((x, i) => h(DS.BentoCard, { key: x.title, stat: pad2(i + 1), title: x.title }, rich(x.text)))),
        ),
      );
    }
    if (D.lab) slide('The lab', D.lab.title, () => h(Fragment, null, h('h2', null, D.lab.title), h('p', { className: 'rm-lede' }, rich(D.lab.summary, scope())), h(LabCards)));
    slide('Progress', 'Progress', () =>
      h(
        Fragment,
        null,
        h('h2', null, `${s.percent}% done. `, h('em', null, cur ? `Now: ${cur.id} ${cur.title}.` : 'Every milestone done.')),
        h('p', { className: 'rm-lede' }, `Percent of reps and exit criteria ticked, each one backed by a ledger row. ${s.proofs} proofs logged so far.`),
        h('div', { className: 'rm-mgrid' }, D.milestones.map((m) => h(MCard, { key: m.id, m, compact: true }))),
        h(PhasePath),
      ),
    );
    D.milestones.filter((m) => m.status === 'done' || m.status === 'active').forEach((m) => slide(`${m.id} · ${STATUS[m.status][1]}`, `${m.id} ${m.title}`, () => h(MilestoneSlide, { m })));
    if (cur && cur.status === 'next') slide(`Up next · ${cur.id}`, `Up next: ${cur.id}`, () => h(UpNextSlide, { m: cur }));
    slide('Integrity', 'Why you can trust this page', () =>
      h(
        Fragment,
        null,
        h('h2', null, 'Why you can trust this page.'),
        h(
          'p',
          { className: 'rm-lede' },
          'Every number here is computed from the files in the repo when the page is built. The build stops if any check fails, so a tick without proof never reaches this page.',
        ),
        h('ul', { className: 'rm-checks' }, D.checks.map(([name, desc]) => h('li', { key: name }, h('b', { 'aria-hidden': 'true' }, '✓'), h('span', null, h('strong', null, name), ' · ' + desc)))),
        D.simulator
          ? h('div', { className: 'rm-ctas' }, h(DS.Button, { onClick: () => go('gates', { sim: Math.min(1, D.simulator.scenarios.length - 1) }) }, 'Try to fake progress →'))
          : null,
      ),
    );
    slide('Skills', 'Skills', () =>
      h(
        Fragment,
        null,
        h('h2', null, 'Skills, rated honestly.'),
        s.skills[0] ? null : h(DS.Callout, { kind: 'unverified', label: 'Not rated yet' }, `All ${s.skills[1]} skills start at ?. The first ratings land in M0.`),
        h('div', { className: 'rm-grid2' }, D.domains.map((d) => h(DomainCard, { key: d.name, d, compact: true }))),
      ),
    );
    slide('Certs', 'Certs', () =>
      h(
        Fragment,
        null,
        h('h2', null, 'Certs are checkpoints, not the goal.'),
        h('p', { className: 'rm-lede' }, `Each comes right after the milestone that teaches it. Core path: ${D.certTotal.core} across ${D.certTotal.count} exams.`),
        h(Table, {
          caption: 'Certifications',
          cols: ['Cert', 'After', 'Status'],
          rows: D.certs.map((c) => h('tr', { key: c.name }, h('td', null, c.name), h('td', null, c.after), h('td', null, h(DS.Chip, { tone: CERT[c.status] }, c.status)))),
        }),
      ),
    );
    slide("What's next", "What's next", () =>
      h(
        Fragment,
        null,
        h('h2', null, D.final ? D.final.title : 'Ask me about any of it.'),
        D.final ? h('p', { className: 'rm-lede' }, rich(D.final.text, scope())) : null,
        h(NextUp),
        h(
          'div',
          { className: 'rm-ctas' },
          h(Link, { href: '#evidence', className: 'dk-btn amber rm-cta' }, 'Browse the evidence'),
          h(Link, { href: site.repo, className: 'dk-btn rm-cta' }, 'Open the repo'),
        ),
      ),
    );
    return out;
  }

  function Deck({ onClose }) {
    const slides = useMemo(buildSlides, []);
    const [i, setI] = useState(0);
    const [say, setSay] = useState('');
    const box = useRef(null);
    const stage = useRef(null);
    const nextBtn = useRef(null);
    const touchX = useRef(null);
    const last = slides.length - 1;
    const show = (k) => {
      const j = Math.max(0, Math.min(last, k));
      setI(j);
      setSay(`Slide ${j + 1} of ${slides.length}: ${slides[j].title}`);
    };
    const step = (d) => (d > 0 && i === last ? onClose() : show(i + d));
    const keys = useRef(null);
    keys.current = (e) => {
      const k = e.key;
      const onControl = e.target.closest && e.target.closest('a,button,input,[tabindex]');
      if (k === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !onControl)) {
        e.preventDefault();
        step(1);
      } else if (k === 'ArrowLeft' || k === 'PageUp') {
        e.preventDefault();
        step(-1);
      } else if (k === 'Home' || k === 'End') {
        e.preventDefault();
        show(k === 'Home' ? 0 : last);
      } else if (k === 'Tab' && box.current) {
        // Keep Tab inside the walkthrough; the page behind it is inert.
        const f = Array.from(box.current.querySelectorAll('a[href],button:not([disabled]),input,[tabindex="0"]')).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const end = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          end.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    useEffect(() => {
      const on = (e) => keys.current(e);
      document.addEventListener('keydown', on);
      focusQuietly(nextBtn.current);
      return () => {
        document.removeEventListener('keydown', on);
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      };
    }, []);
    useEffect(() => {
      if (stage.current) stage.current.scrollTop = 0;
    }, [i]);
    const canFull = !!document.fullscreenEnabled;
    const full = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      const el = box.current;
      if (!el || !el.requestFullscreen) {
        toast("Full screen isn't available here.");
        return;
      }
      el.requestFullscreen().catch(() => toast("Full screen isn't available here."));
    };
    const s = slides[i];
    return h(
      'div',
      { className: 'rm-deck', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Walkthrough', ref: box },
      h(
        'div',
        { className: 'rm-deck-top' },
        h('span', { className: 'dk-eyebrow' }, s.eyebrow),
        h('span', { className: 'rm-sp' }),
        canFull ? h(DS.Button, { size: 'sm', onClick: full }, '⛶ Full screen') : null,
        h(DS.Button, { size: 'sm', onClick: onClose, ariaLabel: 'Close the walkthrough' }, '✕ Close'),
      ),
      h('div', { className: 'rm-deck-prog', 'aria-hidden': 'true' }, h('i', { style: { width: ((i + 1) / slides.length) * 100 + '%' } })),
      h(
        'div',
        {
          className: 'rm-stage',
          ref: stage,
          onTouchStart: (e) => {
            touchX.current = e.touches[0].clientX;
          },
          onTouchEnd: (e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
          },
        },
        h('div', { className: 'rm-slide', key: i }, s.render()),
      ),
      h(
        'div',
        { className: 'rm-deck-nav' },
        h('button', { type: 'button', className: 'dk-btn', onClick: () => step(-1), disabled: i === 0, 'aria-label': 'Previous slide' }, '← Back'),
        h('span', { className: 'rm-count', 'aria-hidden': 'true' }, `${i + 1} / ${slides.length}`),
        h(
          'button',
          { type: 'button', className: 'dk-btn primary', ref: nextBtn, onClick: () => step(1), 'aria-label': i === last ? 'Finish the walkthrough' : 'Next slide' },
          i === last ? 'Finish ✓' : 'Next →',
        ),
      ),
      h('div', { className: 'dk-sr', role: 'status' }, say),
    );
  }

  // ---------------------------------------------------------------- app

  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error) {
      if (window.console) window.console.error(error);
    }
    render() {
      if (!this.state.error) return this.props.children;
      return h(
        DS.Panel,
        { className: 'rm-empty rm-gap' },
        h('h1', { className: 'rm-h1v', id: 'view-title', tabIndex: -1 }, 'This view broke.'),
        h('p', null, 'Something in the page data did not draw. The rest of the page still works: pick another section above.'),
        h('p', null, h(Link, { href: '#overview', className: 'dk-btn' }, 'Back to the overview')),
      );
    }
  }

  function viewTitle(route) {
    if (VIEWS[route.view]) return route.view === 'overview' ? D.site.title : `${VIEWS[route.view]} · ${D.site.title}`;
    const m = X.ms.get(route.view.toUpperCase());
    return m ? `${m.id} ${m.title} · ${D.site.title}` : D.site.title;
  }

  function View({ route }) {
    if (route.view === 'overview') return h(OverviewView, { route });
    if (route.view === 'roadmap') return h(RoadmapView);
    if (route.view === 'labs') return h(LabsView);
    if (route.view === 'evidence') return h(EvidenceView);
    if (route.view === 'skills') return h(SkillsView);
    if (route.view === 'certs') return h(CertsView);
    if (route.view === 'concepts') return h(ConceptsView);
    if (route.view === 'glossary') return h(GlossaryView, { route });
    return h(MilestoneView, { m: X.ms.get(route.view.toUpperCase()), route });
  }

  function App() {
    const [theme, toggleTheme] = useTheme();
    const items = useMemo(paletteItems, []);
    const start = location.hash.slice(1);
    const [route, setRoute] = useState(() => Object.assign({}, parseToken(start === 'present' ? '' : start) || { view: 'overview', id: null }, { n: 0, intent: null }));
    const [deck, setDeck] = useState(start === 'present');
    const deckRef = useRef(deck);
    deckRef.current = deck;
    const routeRef = useRef(route);
    routeRef.current = route;
    const opener = useRef(null);
    const skipRef = useRef(null);
    const headRef = useRef(null);
    const mainRef = useRef(null);
    const footRef = useRef(null);

    // Every navigation is a hash change (or a re-click of the current link).
    useEffect(() => {
      const apply = () => {
        const tok = location.hash.slice(1);
        const intent = pendingIntent;
        pendingIntent = null;
        if (tok === 'present') {
          if (!deckRef.current) opener.current = document.activeElement;
          setDeck(true);
          return;
        }
        if (deckRef.current) setDeck(false);
        const r = parseToken(tok);
        if (r) setRoute((prev) => Object.assign({}, r, { n: prev.n + 1, intent }));
      };
      window.addEventListener('hashchange', apply);
      window.addEventListener('rm:renav', apply);
      return () => {
        window.removeEventListener('hashchange', apply);
        window.removeEventListener('rm:renav', apply);
      };
    }, []);

    const closeDeck = () => {
      setDeck(false);
      if (location.hash === '#present') replaceHash(routeRef.current.view);
    };

    // While the walkthrough is open the page behind it is inert: no focus, no clicks, no reading.
    const firstDeck = useRef(true);
    useEffect(() => {
      [skipRef, headRef, mainRef, footRef].forEach((r) => {
        if (r.current) r.current.inert = deck;
      });
      document.body.classList.toggle('rm-lock', deck);
      if (firstDeck.current) {
        firstDeck.current = false;
        return;
      }
      if (!deck) {
        const back = opener.current;
        opener.current = null;
        const active = document.activeElement;
        if (back && back.isConnected && (!active || active === document.body)) focusQuietly(back);
      }
    }, [deck]);

    useEffect(() => {
      document.title = viewTitle(route);
    }, [route.view]);

    // After each navigation: scroll to the target and move focus there. A first visit starts at the top.
    const firstNav = useRef(true);
    useEffect(() => {
      const isFirst = firstNav.current;
      firstNav.current = false;
      if (route.id) {
        const el = document.getElementById(route.id);
        if (el) {
          focusTarget(el);
          return;
        }
      }
      if (isFirst) return;
      window.scrollTo(0, 0);
      focusQuietly(document.getElementById('view-title'));
    }, [route.n]); // eslint-disable-line react-hooks/exhaustive-deps

    const skip = (e) => {
      e.preventDefault();
      window.scrollTo(0, 0);
      focusQuietly(mainRef.current);
    };

    return h(
      Fragment,
      null,
      h('a', { className: 'rm-skip', href: '#main', onClick: skip, ref: skipRef }, 'Skip to content'),
      h(Header, { route, theme, toggleTheme, items, deckOpen: deck, innerRef: headRef }),
      h('main', { className: 'rm-wrap rm-main', id: 'main', tabIndex: -1, ref: mainRef }, h(Boundary, { key: route.view }, h(View, { route }))),
      h(Footer, { innerRef: footRef }),
      deck ? h(Deck, { onClose: closeDeck }) : null,
      h(Toast),
    );
  }

  function LoadError({ error }) {
    const local = location.protocol === 'file:';
    return h(
      'div',
      { className: 'rm-boot', role: 'alert' },
      h('p', { className: 'rm-boot-title' }, "The roadmap data didn't load."),
      h(
        'p',
        null,
        local
          ? 'Browsers block a page opened from a file from reading its data. Run make preview in the repository, then open http://127.0.0.1:8000.'
          : 'Reload the page. If it keeps failing, everything on it is also in the repository, starting with README.md and roadmap.md.',
      ),
      h('p', { className: 'rm-boot-err' }, String((error && error.message) || error)),
    );
  }

  // ---------------------------------------------------------------- boot

  const root = ReactDOM.createRoot(mount);
  fetch('roadmap.json', { cache: 'no-cache', credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error('roadmap.json: HTTP ' + r.status);
      return r.json();
    })
    .then((data) => {
      if (!data || !data.site || !Array.isArray(data.milestones) || !data.milestones.length) throw new Error('roadmap.json: not roadmap data');
      D = data;
      X = indexData(data);
      root.render(h(App));
    })
    .catch((err) => root.render(h(LoadError, { error: err })));
})();
