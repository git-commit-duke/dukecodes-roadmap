/* @ds-bundle: {"format":4,"namespace":"Dukecodes","components":[{"name":"Button"},{"name":"Chip"},{"name":"Panel"},{"name":"Callout"},{"name":"CodeBlock"},{"name":"StatTile"},{"name":"StageCard"},{"name":"Segmented"},{"name":"StepCard"},{"name":"LiveConsole"},{"name":"SwarmBoard"},{"name":"TopologyTrace"},{"name":"GateSimulator"},{"name":"TerminalReplay"},{"name":"Flashcards"},{"name":"CommandPalette"},{"name":"GlossaryTerm"},{"name":"ProgressRing"},{"name":"BentoCard"}]} */
(function(){
  'use strict';
  var React = window.React, h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useLayoutEffect = React.useLayoutEffect;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- shared helpers ---------- */
  function cx(){ return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  var uidSeq = 0;
  function useUid(prefix){ var r = useRef(null); if (r.current === null) r.current = (prefix || 'dk') + '-' + (++uidSeq); return r.current; }
  function reduced(){ try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function stamp(sec){ return pad2(Math.floor(sec / 60)) + ':' + pad2(Math.floor(sec % 60)); }
  function clamp(v){ v = Number(v) || 0; return Math.max(0, Math.min(100, v)); }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  /* Allow only http(s), mailto and relative links. Drop any link holding a control character, tab or line break: browsers skip some of
     them while parsing, so a cleaned-up copy can hide a script link. The string checked is exactly the string returned. */
  function safeHref(u){
    if (u == null) return null;
    var raw = String(u).trim();
    if (raw === '' || /[\u0000-\u001F\u007F]/.test(raw)) return null;
    try {
      var url = new URL(raw, 'https://dk.invalid/');   /* fixed base: only used to learn the scheme, works in about:blank/srcdoc frames */
      if (!/^(https?|mailto):$/.test(url.protocol)) return null;
      return url.origin === 'https://dk.invalid' ? raw : url.href;
    } catch (e) { return null; }
  }
  /* Copy text; resolves true/false and never rejects (clipboard API, then execCommand fallback). */
  function copyText(text){
    function fallback(){
      var prev = document.activeElement;
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.pointerEvents = 'none';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (prev && prev.focus) prev.focus({preventScroll: true});
        return !!ok;
      } catch (e) { return false; }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText){
        return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return fallback(); });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }
  function useFlash(ms){
    var s = useState(null), t = useRef(0);
    useEffect(function(){ return function(){ clearTimeout(t.current); }; }, []);
    return [s[0], function(v){ clearTimeout(t.current); s[1](v); t.current = setTimeout(function(){ s[1](null); }, ms || 1400); }];
  }
  /* True while the element is on screen and the tab is visible: live components only run then. */
  function useActive(ref){
    var hasIO = typeof window.IntersectionObserver === 'function';
    var s = useState(!hasIO), set = s[1];
    useEffect(function(){
      var el = ref.current, inView = !hasIO, io = null;
      function upd(){ set(inView && document.visibilityState !== 'hidden'); }
      if (el && hasIO){ io = new IntersectionObserver(function(es){ inView = es[es.length - 1].isIntersecting; upd(); }, {threshold: 0.1}); io.observe(el); }
      document.addEventListener('visibilitychange', upd);
      upd();
      return function(){ if (io) io.disconnect(); document.removeEventListener('visibilitychange', upd); };
    }, []);
    return s[0];
  }
  /* Follows prefers-reduced-motion live, so a change in OS settings applies without a reload. */
  function useReduced(){
    var s = useState(reduced()), set = s[1];
    useEffect(function(){
      var mq; try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return undefined; }
      function on(){ set(mq.matches); }
      if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
      return function(){ if (mq.removeEventListener) mq.removeEventListener('change', on); else if (mq.removeListener) mq.removeListener(on); };
    }, []);
    return s[0];
  }
  /* True while el is narrower than its content (horizontal scroll); such regions get a tab stop and a swipe hint. */
  function useScrollable(ref){
    var s = useState(false), set = s[1];
    useEffect(function(){
      var el = ref.current; if (!el) return undefined;
      function upd(){ set(el.scrollWidth > el.clientWidth + 1); }
      upd();
      var ro = typeof window.ResizeObserver === 'function' ? new ResizeObserver(upd) : null;
      if (ro){ ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild); } else window.addEventListener('resize', upd);
      return function(){ if (ro) ro.disconnect(); else window.removeEventListener('resize', upd); };
    }, []);
    return s[0];
  }
  function useCount(target, ms){
    var s = useState(reduced() ? target : 0), v = s[0], set = s[1], cur = useRef(v);
    cur.current = v;
    useEffect(function(){
      if (reduced()) { set(target); return; }
      var from = cur.current, t0 = performance.now(), raf;
      function step(t){ var k = Math.min(1, Math.max(0, (t - t0) / ms)), e = 1 - Math.pow(1 - k, 3); set(from + (target - from) * e); if (k < 1) raf = requestAnimationFrame(step); }
      raf = requestAnimationFrame(step);
      return function(){ cancelAnimationFrame(raf); };
    }, [target]);
    return v;
  }
  /* Confetti burst inside el in the system colours; no-op under reduced motion. */
  function celebrate(el){
    if (!el || reduced()) return;
    var layer = document.createElement('div'); layer.className = 'dk-confetti'; layer.setAttribute('aria-hidden', 'true');
    var cols = ['--amber', '--teal', '--green', '--violet', '--node-core', '--node-sec'];
    for (var i = 0; i < 46; i++){
      var b = document.createElement('i');
      b.style.setProperty('--x', ((Math.random() * 2 - 1) * 220).toFixed(0) + 'px');
      b.style.setProperty('--y', (-(70 + Math.random() * 170)).toFixed(0) + 'px');
      b.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      b.style.background = 'var(' + cols[i % cols.length] + ')';
      b.style.animationDelay = (Math.random() * 90).toFixed(0) + 'ms';
      layer.appendChild(b);
    }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(layer);
    setTimeout(function(){ if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1600);
  }

  /* ---------- Button ---------- */
  function Button(p){
    var v = p.variant && p.variant !== 'default' ? p.variant : '';
    return h('button', {type: p.type || 'button', className: cx('dk-btn', v, p.size === 'sm' && 'sm', p.className), disabled: p.disabled, onClick: p.ariaDisabled ? undefined : p.onClick,
      'aria-pressed': p.pressed == null ? undefined : String(!!p.pressed), 'aria-label': p.ariaLabel, 'aria-disabled': p.ariaDisabled ? 'true' : undefined, title: p.title}, p.children);
  }
  /* ---------- Chip ---------- */
  function Chip(p){
    var t = p.tone && p.tone !== 'neutral' ? p.tone : '';
    return h('span', {className: cx('dk-chip', t, p.className), title: p.title}, p.dot ? h('i', {className: 'd', 'aria-hidden': 'true'}) : null, p.children);
  }
  /* ---------- Panel ---------- */
  function Panel(p){
    return h(p.as || 'div', {className: cx('dk-panel', p.padded === false ? '' : 'p', p.className)},
      p.eyebrow ? h('div', {className: 'dk-eyebrow'}, p.eyebrow) : null, p.children);
  }
  /* ---------- Callout ---------- */
  var CALLOUT = {warn: 'Danger', gate: 'Gate', adapt: 'Adapted', unverified: 'Unconfirmed'};
  function Callout(p){
    var k = CALLOUT[p.kind] ? p.kind : 'adapt';
    return h('div', {className: cx('dk-callout', k), role: p.live ? (k === 'warn' ? 'alert' : 'status') : undefined},
      h('b', null, (p.label || CALLOUT[k]) + ':'), h('span', null, p.children));
  }
  /* ---------- CodeBlock ---------- */
  function CodeBlock(p){
    var f = useFlash(1400), st = f[0], flash = f[1];
    function copy(){ copyText(p.code).then(function(ok){ flash(ok ? 'ok' : 'fail'); }); }
    return h('div', {className: 'dk-cmd-block'},
      p.where ? h('span', {className: 'dk-where'}, p.where) : null,
      h('div', {className: 'dk-cmd-wrap'},
        h('pre', {className: 'dk-cmd'}, h('code', null, p.code)),
        h('button', {type: 'button', className: cx('dk-cmd-copy', st), onClick: copy, 'aria-label': st === 'ok' ? 'Copied' : st === 'fail' ? 'Copy failed: select the text and copy it' : 'Copy command'}, st === 'ok' ? 'copied' : st === 'fail' ? 'failed' : 'copy')),
      h('span', {className: 'dk-sr', role: 'status'}, st === 'ok' ? 'Copied to clipboard' : st === 'fail' ? 'Copy failed' : ''));
  }
  /* ---------- StatTile ---------- */
  function StatTile(p){ return h('div', {className: 'dk-stat'}, h('b', null, p.value), h('span', null, p.label)); }
  /* ---------- StageCard ---------- */
  var STAGE = {idle: 'queued', active: 'in progress', done: 'done'};
  function StageCard(p){
    var st = STAGE[p.state] ? p.state : 'idle', pct = Math.round(clamp(p.progress));
    var btn = typeof p.onClick === 'function';
    return h(btn ? 'button' : 'div', {type: btn ? 'button' : undefined, className: cx('dk-stage', st !== 'idle' && st, btn && 'is-btn'), onClick: p.onClick},
      h('span', {className: 'n'}, pad2(p.n)),
      h('span', {className: 't'}, p.title),
      h('span', {className: 'dk-bar', 'aria-hidden': 'true'}, h('i', {style: {width: pct + '%'}})),
      h('span', {className: 's'}, (p.status || STAGE[st]) + ' · ' + pct + '%'));
  }
  /* ---------- Segmented ---------- */
  function Segmented(p){
    return h('div', {className: 'dk-seg', role: 'group', 'aria-label': p.label},
      (p.options || []).map(function(o){
        return h('button', {key: o.value, type: 'button', 'aria-pressed': String(o.value === p.value), onClick: function(){ if (p.onChange) p.onChange(o.value); }}, o.label);
      }));
  }
  /* ---------- StepCard ---------- */
  function chevron(){ return h('svg', {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true'}, h('path', {d: 'M9 6l6 6-6 6'})); }
  /* open and done are controlled when passed, uncontrolled (defaultOpen, defaultDone) otherwise. readOnly swaps the checkbox
     for a status mark and makes the whole header one disclosure button, so chips there must be static (no links or GlossaryTerms). */
  function StepCard(p){
    var o = useState(!!p.defaultOpen), openS = o[0], setOpenS = o[1];
    var d = useState(!!p.defaultDone), doneS = d[0], setDoneS = d[1];
    var open = p.open != null ? !!p.open : openS, done = p.done != null ? !!p.done : doneS;
    var ro = !!p.readOnly, id = useUid('step'), T = ro ? 'span' : 'div';
    function setOpen(v){ if (p.open == null) setOpenS(v); if (p.onOpenChange) p.onOpenChange(v); }
    function setDone(v){ if (p.done == null) setDoneS(v); if (p.onDone) p.onDone(v); }
    var ti = h(T, {className: 'ti'},
      h(T, {className: 'id', id: id + '-i'}, p.id),
      h(T, {className: 'tt', id: id + '-t'}, p.title),
      p.chips ? h(T, {className: 'chips', id: id + '-c'}, p.chips) : null);
    var head = ro
      ? h('button', {type: 'button', className: 'h', 'aria-expanded': String(open), 'aria-controls': id + '-b', 'aria-labelledby': id + '-i ' + id + '-t',
          'aria-describedby': id + '-s' + (p.chips ? ' ' + id + '-c' : ''), onClick: function(){ setOpen(!open); }},
          h('span', {className: 'mark', 'aria-hidden': 'true'}),
          h('span', {className: 'dk-sr', id: id + '-s'}, done ? 'Done.' : 'Not done.'),
          ti,
          h('span', {className: 'car', 'aria-hidden': 'true'}, chevron()))
      : h('div', {className: 'h', onClick: function(e){
            var t = e.target && e.target.closest ? e.target.closest('a,button,input,label,select,textarea,[tabindex]') : null;
            if (t && e.currentTarget.contains(t)) return;   /* a control inside the header handles its own click */
            setOpen(!open); }},
          h('input', {type: 'checkbox', className: 'dk-ck', checked: done, 'aria-label': 'Mark ' + p.id + ' done', onChange: function(e){ setDone(e.target.checked); }}),
          ti,
          h('button', {type: 'button', className: 'car', 'aria-expanded': String(open), 'aria-controls': id + '-b', 'aria-label': 'Details: ' + p.title, onClick: function(){ setOpen(!open); }}, chevron()));
    return h('div', {className: cx('dk-step', done && 'done', open && 'open', ro && 'ro')}, head,
      h('div', {className: 'b', id: id + '-b', hidden: !open}, p.children));
  }

  /* ---------- ProgressRing ---------- */
  /* Width of "100%" in el's font at px, from a canvas: works while hidden and before layout. 0 when it cannot measure. */
  function ringTextW(el, px){
    try {
      var c = ringTextW.c || (ringTextW.c = document.createElement('canvas').getContext('2d')), cs = getComputedStyle(el);
      if (!c) return 0;
      c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + px + 'px ' + cs.fontFamily;
      return c.measureText('100%').width;
    } catch (e){ return 0; }
  }
  function ProgressRing(p){
    var val = clamp(p.value), size = p.size || 104, sw = p.stroke || 9, r = (size - sw) / 2;
    var v = useCount(val, 900), ref = useRef(null), prev = useRef(val), numRef = useRef(null);
    var ft = useState(0), fit = ft[0], setFit = ft[1];
    var custom = size !== 104 || sw !== 9, hole = size - 2 * sw;
    /* other sizes: a quarter of the ring (at least 9.5px), capped by the hole */
    var px = custom ? Math.min(hole * 0.365, Math.max(size * 0.25, 9.5)) : 0;
    useEffect(function(){ if (val >= 100 && prev.current < 100) celebrate(ref.current); prev.current = val; }, [val]);
    /* then shrink to the font really on screen, so "100%" never touches the ring; again when web fonts arrive */
    useLayoutEffect(function(){
      if (!custom) return undefined;
      var dead = false, fonts = document.fonts;
      function measure(){
        if (dead || !numRef.current) return;
        var w = ringTextW(numRef.current, px), room = hole * 0.94;
        setFit(w > room ? px * room / w : 0);
      }
      measure();
      if (fonts && fonts.ready) fonts.ready.then(measure, function(){});
      if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', measure);
      return function(){ dead = true; if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', measure); };
    }, [size, sw]);
    var numStyle = {width: size, height: size};
    if (custom){
      numStyle.fontSize = Math.floor((fit || px) * 100) / 100 + 'px';
      if (size < 64) numStyle.letterSpacing = 0;
    }
    return h('div', {ref: ref, className: cx('dk-ring', val >= 100 && 'full'), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(val),
      'aria-label': p.label || 'Progress', 'aria-valuetext': Math.round(val) + '%' + (p.sub ? ', ' + p.sub : '')},
      h('svg', {width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true'},
        h('circle', {className: 'trk', cx: size / 2, cy: size / 2, r: r, strokeWidth: sw}),
        h('circle', {className: 'val', cx: size / 2, cy: size / 2, r: r, strokeWidth: sw, pathLength: 100, strokeDasharray: v.toFixed(2) + ' 100'})),
      h('div', {ref: numRef, className: 'num', style: numStyle, 'aria-hidden': 'true'}, Math.round(v) + '%'),
      p.label && !p.hideLabel ? h('div', {className: 'lb'}, h('b', null, p.label), p.sub ? h('span', null, p.sub) : null) : null);
  }

  /* ---------- SwarmBoard ---------- */
  var SWARM_STAGES = [{"t":"Start here: reality check","steps":["rc-01 Pick your path: fresh build or check what's already runn…","rc-02 Read ops's hardware facts (read-only commands)","rc-03 Find where the NAS data lives (risk D1)"]},{"t":"Before you start","steps":["start-01 Make your laptop a clean admin device","start-03 Pick your second factors: passkeys first, SMS last","start-04 Secure your email account first"]},{"t":"Rack & power","steps":["rack-01 Plan where each device goes in the rack before you build","rack-02 Assemble the rack and mount the patch panel, shelves and…","rack-04 Place the PCs, router and switch with clear air paths"]},{"t":"Network edge","steps":["net-01 Fill in your LAN plan worksheet before touching anything","net-02 Unbox the router and connect your computer to it","net-03 Set a strong admin password on first login"]},{"t":"Prepare the mini PCs","steps":["prep-01 Record each PC's model, CPU, RAM, drives and BIOS version","prep-03 Install or check memory (RAM) modules","prep-04 Fit the drives that each PC will use"]},{"t":"Install Proxmox","steps":["pve-01 Check today's Proxmox versions and known issues","pve-02 Download the Proxmox VE 9.2 installer ISO","pve-03 Verify the ISO's SHA-256 checksum"]},{"t":"Secure the nodes","steps":["lock-01 Give root@pam a long, unique password on every node","lock-02 Turn on TOTP two-factor login and recovery keys for root","lock-07 Update by hand every week; skip unattended-upgrades"]},{"t":"Remote access","steps":["ts-01 Create your tailnet on the free Personal plan","ts-02 Install Tailscale on your admin laptop","ts-03 Install Tailscale on your phone"]},{"t":"Backups","steps":["bak-01 Decide where PBS runs: a VM on ops","bak-02 Create the PBS virtual machine on ops (ID 116)","bak-03 Install Proxmox Backup Server 4.2 in the VM"]},{"t":"Monitoring & power","steps":["mon-01 Connect the UPS to core and confirm NUT supports it","mon-02 Install NUT on the core node","mon-03 Describe the UPS and your shutdown thresholds (ups.conf)"]},{"t":"Upgrade: 10G core switch","steps":["tg-01 Identify the SFP+ card and its Linux driver","tg-02 Buy two SFP+ DAC cables your card will accept","tg-03 First boot of the 10G switch, offline, from your laptop"]},{"t":"Services","steps":["agh-02 Create the AdGuard #2 container (CT 115) on core","agh-03 Install AdGuard Home with the official install script","agh-04 Finish AdGuard's first-run setup on port 3000 with a str…"]},{"t":"Learning lab","steps":["lab-01 Understand the learning lab and its safety rules","lab-11 Create the isolated lab bridge (vmbr1, no ports)","lab-12 Download OPNsense and create its VM (VM 130)"]},{"t":"Phase 2: OPNsense router + VLANs","steps":["p2-01 Choose the OPNsense box","p2-02 Build OPNsense offline with VLANs 10 to 99","p2-03 Run Suricata in IDS mode for a week, then IPS"]},{"t":"Maintenance & incidents","steps":["ops-01 Monthly patch day: Proxmox nodes and PBS","ops-02 Monthly patch day: router, switch, AdGuard and apps","ops-03 Check each month that backup verification still passes"]},{"t":"Appendix","steps":["sub-01 If your router is different: check it can do the router'…","sub-02 If your switch is different: check gigabit, VLANs and it…","sub-03 If your rack, shelves, fan or display differ: check fit…"]}];
  function swarmInit(list){ return {agents: list.map(function(s, i){ return {n: i + 1, title: s.t, steps: s.steps || [], p: 0, st: 'idle'}; }), log: [], t: 0, seq: 0, done: false, say: ''}; }
  function swarmTick(s, conc, dt){
    var a = s.agents.map(function(x){ return Object.assign({}, x); }), log = s.log.slice(), seq = s.seq, t = s.t + dt, say = s.say, verified = [];
    function push(cls, txt){ log.unshift({id: ++seq, ts: stamp(t), cls: cls, txt: txt}); }
    a.forEach(function(x){
      if (x.st !== 'active') return;
      x.p = Math.min(100, x.p + 4 + Math.random() * 9);
      if (x.p >= 100){ x.st = 'done'; push('ok', '✓ agent ' + pad2(x.n) + ' · ' + x.title + ' verified'); verified.push(x.n + ', ' + x.title); }
      else if (x.steps.length && Math.random() < 0.3) push('ag', 'agent ' + pad2(x.n) + ' · ' + x.steps[Math.floor(Math.random() * x.steps.length)]);
    });
    var running = a.filter(function(x){ return x.st === 'active'; }).length;
    a.forEach(function(x){ if (running < conc && x.st === 'idle'){ x.st = 'active'; running++; push('go', '→ dispatch agent ' + pad2(x.n) + ' · ' + x.title); } });
    if (verified.length) say = (verified.length > 1 ? 'Stages ' : 'Stage ') + verified.join('; ') + ' verified.';
    var done = a.length > 0 && a.every(function(x){ return x.st === 'done'; });
    if (done && !s.done){ push('ok', '★ swarm complete · ' + a.length + '/' + a.length + ' stages verified'); say = 'All ' + a.length + ' stages verified.'; }
    return {agents: a, log: log.slice(0, 7), t: t, seq: seq, done: done, say: say};
  }
  function SwarmBoard(p){
    var list = (p.stages || SWARM_STAGES).map(function(s){ return typeof s === 'string' ? {t: s, steps: []} : s; });
    var conc = p.concurrency || 3, tickMs = p.tickMs || 450;
    var s = useState(function(){ return swarmInit(list); }), st = s[0], set = s[1];
    var r = useState(p.autoplay !== false), run = r[0], setRun = r[1];
    var ref = useRef(null), active = useActive(ref), wasDone = useRef(false);
    var real = Array.isArray(p.progress);
    useEffect(function(){
      if (real || !run || st.done || !active) return undefined;
      var id = setInterval(function(){ set(function(prev){ return swarmTick(prev, conc, tickMs / 1000); }); }, tickMs);
      return function(){ clearInterval(id); };
    }, [real, run, st.done, active, conc, tickMs]);
    useEffect(function(){ if (st.done && !wasDone.current && !real) celebrate(ref.current); wasDone.current = st.done; }, [st.done]);
    /* real mode: progress[] (0-100 per stage) drives the cards; no simulation, no feed */
    var agents = real ? list.map(function(s, i){ var v = clamp(p.progress[i]); return {n: i + 1, title: s.t, p: v, st: v >= 100 ? 'done' : v > 0 ? 'active' : 'idle'}; }) : st.agents;
    var c = {idle: 0, active: 0, done: 0}; agents.forEach(function(x){ c[x.st]++; });
    var allDone = agents.length > 0 && c.done === agents.length;
    var halted = real ? !active : (!run || st.done || !active);
    return h('div', {className: cx('dk-swarm', halted && 'paused'), ref: ref},
      h('div', {className: 'dk-toolbar'},
        h('span', {className: cx('dk-live', (real ? allDone : (!run || st.done)) && 'paused')}, (real ? allDone : st.done) ? 'DONE' : (real || run) ? 'LIVE' : 'PAUSED'),
        h('span', {className: 'dk-meta'}, c.active + ' running · ' + c.done + ' done · ' + c.idle + ' queued' + (real ? '' : ' · T+' + stamp(st.t) + (p.demo === false ? '' : ' · demo data'))),
        h('span', {className: 'sp'}),
        real ? null : h(Button, {size: 'sm', onClick: function(){ if (!st.done) setRun(!run); }, ariaDisabled: st.done}, run ? 'Pause' : 'Resume'),
        real ? null : h(Button, {size: 'sm', onClick: function(){ wasDone.current = false; set(swarmInit(list)); setRun(true); }}, 'Replay')),
      h('div', {className: 'grid'}, agents.map(function(x){
        return h(StageCard, {key: x.n, n: x.n, title: x.title, progress: x.p, state: x.st, status: x.st === 'active' ? (real ? 'in progress' : 'agent working') : null});
      })),
      real ? null : h('div', {className: 'feed', 'aria-hidden': 'true'}, st.log.map(function(l){
        return h('div', {key: l.id}, h('span', {className: 'ts'}, l.ts), h('span', {className: l.cls}, l.txt));
      })),
      real ? null : h('div', {className: 'dk-sr', role: 'status'}, st.say),
      allDone ? h('div', {className: 'dk-banner'}, '✓ All ' + agents.length + ' stages verified.') : null);
  }

  /* ---------- TopologyTrace ---------- */
  var TOPO = {"viewBox":[1000,580],"nodes":{"phone":{"x":110,"y":50,"w":110,"l":"phone","s":"Tailscale","k":"net","i":"Your phone on Tailscale. Nothing is port-forwarded; the tailnet policy decides what it can reach."},"internet":{"x":420,"y":50,"w":120,"l":"internet","s":"","k":"net","i":"The public internet. No inbound ports are open on your router."},"isp":{"x":420,"y":130,"w":130,"l":"ISP","s":"1G · DHCP","k":"net","i":"Your internet provider: 1G with DHCP. The modem just passes traffic."},"opn":{"x":640,"y":205,"w":150,"l":"OPNsense box","s":"192.0.2.1 · P2","k":"net","buy":true,"i":"OPNsense box: a small fanless PC with four 2.5G ports and 16 GB. Phase 2 router with Suricata IPS."},"router":{"x":420,"y":205,"w":150,"l":"router","s":"192.0.2.1","k":"net","i":"Wi-Fi router with a 2.5G WAN port and a 2.5G LAN port. Phase 1: router, DHCP, AdGuard #1 and Tailscale subnet router #1. Phase 2: the Wi-Fi access point behind OPNsense."},"switch":{"x":420,"y":300,"w":150,"l":"1G switch","s":"192.0.2.2 · 1G","k":"net","i":"8-port 1G managed switch. Today: the only switch. After the 10G switch arrives: the edge switch for your laptop and spares."},"crs":{"x":420,"y":300,"w":170,"l":"10G switch","s":"192.0.2.3 · 2.5G/10G","k":"net","buy":true,"i":"Managed switch with 8 × 2.5G ports and 2 × SFP+ 10G cages. Core switch: 10G to ops, 2.5G to the nodes."},"admin":{"x":860,"y":300,"w":130,"l":"admin laptop","s":"192.0.2.250","k":"net","i":"Admin laptop · your one trusted device. Everything is managed from here."},"ups":{"x":95,"y":300,"w":110,"l":"UPS","s":"to buy","k":"net","buy":true,"i":"UPS: line-interactive, pure sine wave, about 1000 VA. Clean shutdowns via NUT on core."},"media":{"x":100,"y":430,"w":140,"l":"media","s":"192.0.2.10","k":"media","live":true,"i":"Media server. Mini PC · 6 cores · hardware video encoder · 16 GB"},"dev":{"x":265,"y":430,"w":140,"l":"dev","s":"192.0.2.11","k":"dev","live":true,"i":"DevOps lab. Mini PC · 12 cores · 16 GB"},"core":{"x":430,"y":430,"w":140,"l":"core","s":"192.0.2.12","k":"core","live":true,"i":"Monitoring + control. Mini PC · 6 cores · 16 GB"},"ops":{"x":595,"y":430,"w":140,"l":"ops","s":"192.0.2.13","k":"ops","live":true,"i":"Storage + backup hub. Mini PC · 6 cores · 32 GB · 1 TB NVMe"},"sec":{"x":800,"y":430,"w":150,"l":"sec · laptop","s":"192.0.2.14","k":"sec","live":true,"i":"DevSec lab + projects. Laptop · 10 cores · 16 GB"},"usb":{"x":595,"y":530,"w":140,"h":40,"l":"NAS HDD","s":"USB dock + cold copy","k":"ops","i":"A 3.5-inch CMR HDD in a USB dock holds NAS data. A second USB HDD takes the backup cold copy."},"opnlab":{"x":745,"y":530,"w":120,"h":40,"l":"OPNsense-lab","s":"VM 130","k":"sec","i":"OPNsense VM 130 on sec (the laptop): the lab firewall. Its WAN card is the only way out of vmbr1, and LAN to private ranges is blocked."},"kali":{"x":895,"y":530,"w":100,"h":40,"l":"Kali","s":"198.51.100.x","k":"sec","i":"Kali VM 132 on vmbr1. Can reach the targets, never your home network."}},"phases":[{"id":"p1","label":"Phase 1 · today","note":"Today: the router routes, the 1G switch switches, everything runs at 1G.","hide":["opn","crs"],"links":[["phone","internet","ts"],["internet","isp"],["isp","router"],["router","switch"],["switch","media"],["switch","dev"],["switch","core"],["switch","ops"],["switch","sec"],["switch","admin"],["ops","usb"],["sec","opnlab","lab"],["opnlab","kali","lab"],["ups","core","pwr"],["ups","media","pwr"],["ups","switch","pwr"]]},{"id":"up","label":"+ 10G switch","note":"The 10G switch becomes the core: a 10G DAC cable to ops, 2.5G to the nodes.","hide":["opn"],"move":{"switch":{"x":660,"y":300,"w":130,"s":"edge · 1G"}},"links":[["phone","internet","ts"],["internet","isp"],["isp","router"],["router","crs","two5"],["crs","media","two5"],["crs","dev","two5"],["crs","core","two5"],["crs","ops","ten"],["crs","sec"],["crs","switch"],["switch","admin"],["ops","usb"],["sec","opnlab","lab"],["opnlab","kali","lab"],["ups","core","pwr"],["ups","media","pwr"],["ups","crs","pwr"]]},{"id":"p2","label":"Phase 2 · VLANs","note":"Plan only: the OPNsense box routes VLANs 10/20/30/40/50/60/99; the router becomes the Wi-Fi access point.","hide":[],"move":{"switch":{"x":660,"y":300,"w":130,"s":"edge · 1G"},"router":{"x":200,"y":205,"w":150,"s":"Wi-Fi AP · P2"},"opn":{"x":420,"y":205}},"links":[["phone","internet","ts"],["internet","isp"],["isp","opn","two5"],["opn","crs","two5"],["opn","router"],["crs","media","two5"],["crs","dev","two5"],["crs","core","two5"],["crs","ops","ten"],["crs","sec"],["crs","switch"],["switch","admin"],["ops","usb"],["sec","opnlab","lab"],["opnlab","kali","lab"],["ups","core","pwr"],["ups","opn","pwr"],["ups","crs","pwr"]]}],"traces":[{"id":"tr-film","t":"Stream a film from outside","phase":"p1","path":["phone","internet","isp","router","switch","media"],"hops":["Your phone runs Tailscale; the packet is encrypted with WireGuard.","It crosses the internet; no port is open on your router.","The ISP's modem passes it through like any other traffic.","The router is subnet router #1: it unwraps the tailnet packet and forwards it onto 192.0.2.0/24.","The switch delivers it to media's port.","Jellyfin (CT 100, 192.0.2.100:8096) answers. Your policy only allows tcp:8096 for you and family."]},{"id":"tr-backup","t":"Nightly backup at 01:00","phase":"p1","path":["core","switch","ops","usb"],"hops":["01:00: core's backup job snapshots each guest and encrypts chunks on core with your key.","Only new chunks cross the switch (deduplication).","PBS (VM 116 on ops) stores them in datastore 'main' on the 1 TB NVMe.","When you plug in the USB disk, a sync job copies everything to usb-cold: the copy that can leave the house."]},{"id":"tr-dns","t":"A DNS lookup","phase":"p1","path":["admin","switch","core","switch","router","isp","internet"],"hops":["Your laptop asks 'where is example.com?'","DHCP told it to ask AdGuard #2 first.","AdGuard #2 (CT 115 on core) drops it if it's an ad or tracker domain.","…back across the switch…","Otherwise it goes out through the router…","…past the modem…","…to an encrypted DoH resolver. If core is down, the router's AdGuard #1 answers instead."]},{"id":"tr-lab","t":"Lab isolation test","phase":"p1","path":["kali","opnlab","sec","switch","core"],"hops":["Kali (VM 132) sits on vmbr1, a bridge with no physical port.","Its only way out is OPNsense-lab (VM 130).","OPNsense's LAN rule: 198.51.100.0/24 → private ranges = BLOCK, logged.","Blocked. The packet never reaches vmbr0 or your switch.","core and the rest of home never see it. lab-18 proves this before any target exists."],"blockAt":3},{"id":"tr-power","t":"Power cut","phase":"p1","path":["ups","core","switch","media"],"hops":["Mains fails; the UPS switches to battery and tells core over USB.","core's NUT server waits for 50% charge or 10 minutes left…","…then broadcasts 'shut down' through the switch.","media, dev, ops and sec shut down cleanly (sec rides on its own battery); core goes last and tells the UPS to cut and restore power."]},{"id":"tr-10g","t":"10G backup lane (after the 10G switch)","phase":"up","path":["dev","crs","ops"],"hops":["dev's backup leaves at 1G (2.5G once its port is upgraded).","The 10G switch merges every node's traffic…","…onto ops's 10G SFP+ link, so the network stops being the bottleneck. The next limits are ops's disk and PBS's CPU, so the jobs still run staggered."]}],"zones":[{"x":675,"y":485,"w":315,"h":85,"l":"vmbr1 · 198.51.100.0/24 · no physical port","tone":"red"}]};
  var LEGEND = [['', '1G copper'], ['two5', '2.5G'], ['ten', '10G SFP+ DAC'], ['ts', 'Tailscale'], ['lab', 'lab-only bridge'], ['pwr', 'UPS power'], ['buy', 'to buy']];
  function lkey(a, b){ return a < b ? a + '|' + b : b + '|' + a; }
  var EMPTY_TRACE = {id: null, hot: {}, hotL: {}, blocked: null, x: null, hops: [], status: '', done: false};
  function TopologyTrace(p){
    var data = p.data || TOPO;
    var phases = data.phases && data.phases.length ? data.phases : [{id: 'all', label: 'All', links: data.links || [], hide: []}];
    var ph = useState(p.phase || phases[0].id), phase = ph[0], setPhase = ph[1];
    var P = phases.filter(function(x){ return x.id === phase; })[0] || phases[0];
    var sl = useState(p.selected || null), sel = sl[0], setSel = sl[1];
    var tr0 = useState(EMPTY_TRACE), tr = tr0[0], setTr = tr0[1];
    var wrapRef = useRef(null), svgRef = useRef(null), fxRef = useRef(null), ambRef = useRef(null), links = useRef({}), runRef = useRef(null);
    var mapRef = useRef(null), active = useActive(wrapRef), rm = useReduced(), scrolls = useScrollable(mapRef);
    var pz = useState(false), paused = pz[0], setPaused = pz[1];
    var hv = useState(false), hover = hv[0], setHover = hv[1];
    var still = paused || hover || !active || rm;
    var vb = data.viewBox || [1000, 580];
    useEffect(function(){ if (p.phase && p.phase !== phase) setPhase(p.phase); }, [p.phase]);
    useEffect(function(){ if (p.selected !== undefined) setSel(p.selected); }, [p.selected]);
    useEffect(function(){
      var svg = svgRef.current; if (!svg || !svg.pauseAnimations) return;
      if (still) svg.pauseAnimations(); else svg.unpauseAnimations();
    }, [still, phase]);
    function pos(id){ var m = (P.move || {})[id] || {}; return Object.assign({}, data.nodes[id], m); }
    function isHidden(id){ return (P.hide || []).indexOf(id) >= 0; }
    function isBuy(id){ return !!data.nodes[id] && !!data.nodes[id].buy; }
    function linkPath(a, b){
      var A = pos(a), B = pos(b);
      if (Math.abs(A.y - B.y) < 4) return 'M' + A.x + ',' + A.y + ' L' + B.x + ',' + B.y;
      var my = (A.y + B.y) / 2;
      return 'M' + A.x + ',' + A.y + ' C' + A.x + ',' + my + ' ' + B.x + ',' + my + ' ' + B.x + ',' + B.y;
    }
    useEffect(function(){ return function(){ if (runRef.current) runRef.current.cancel = true; }; }, []);
    /* ambient traffic */
    useEffect(function(){
      if (still || p.ambient === false) return undefined;
      var raf = 0, last = 0, amb = [];
      function tick(t){
        var g = ambRef.current, svg = svgRef.current;
        if (g && svg){
          if (t - last > 380 && amb.length < 14){
            last = t;
            var ls = svg.querySelectorAll('path.lk:not(.pwr)');
            if (ls.length){
              var L = ls[Math.floor(Math.random() * ls.length)], ten = L.classList.contains('ten');
              var c = document.createElementNS(SVGNS, 'circle');
              c.setAttribute('r', ten ? 3.5 : 2.5);
              c.setAttribute('class', 'amb' + (ten ? ' ten' : L.classList.contains('lab') ? ' lab' : L.classList.contains('ts') ? ' ts' : ''));
              g.appendChild(c);
              amb.push({el: c, L: L, len: L.getTotalLength(), t0: t, dur: (ten ? 700 : 1400) + Math.random() * 600, rev: Math.random() < 0.5});
            }
          }
          for (var i = amb.length - 1; i >= 0; i--){
            var a = amb[i], k = (t - a.t0) / a.dur;
            if (k >= 1 || !a.L.isConnected){ if (a.el.parentNode) a.el.parentNode.removeChild(a.el); amb.splice(i, 1); continue; }
            var pt = a.L.getPointAtLength((a.rev ? 1 - Math.max(0, k) : Math.max(0, k)) * a.len);
            a.el.setAttribute('cx', pt.x.toFixed(1)); a.el.setAttribute('cy', pt.y.toFixed(1)); a.el.setAttribute('opacity', (Math.sin(Math.max(0, k) * Math.PI) * 0.85).toFixed(3));
          }
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return function(){ cancelAnimationFrame(raf); amb.forEach(function(a){ if (a.el.parentNode) a.el.parentNode.removeChild(a.el); }); };
    }, [still, phase, p.ambient]);
    function animAlong(L, rev, dur, run){
      return new Promise(function(res){
        var fx = fxRef.current;
        if (!fx || !L || dur <= 0) return res();
        var c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('r', 6); c.setAttribute('class', 'pkt'); fx.appendChild(c);
        var len = L.getTotalLength(), t0 = performance.now();
        function f(now){
          if (run.cancel){ c.remove(); return res(); }
          var k = Math.min(1, Math.max(0, (now - t0) / dur)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          var pt = L.getPointAtLength((rev ? 1 - e : e) * len);
          c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
          if (k < 1) requestAnimationFrame(f); else { c.remove(); res(); }
        }
        requestAnimationFrame(f);
      });
    }
    function stop(){ if (runRef.current) runRef.current.cancel = true; runRef.current = null; setTr(EMPTY_TRACE); }
    function play(t){
      if (runRef.current) runRef.current.cancel = true;
      var run = {cancel: false}; runRef.current = run;
      var rm = reduced(), want = t.phase || phases[0].id, N = (t.hops || []).length;
      if (!t.path || !t.path.length || !N) return;
      var S = {id: t.id, hot: {}, hotL: {}, blocked: null, x: null, hops: t.hops.map(function(){ return ''; }), status: '', done: false};
      function commit(){ if (!run.cancel) setTr({id: S.id, hot: Object.assign({}, S.hot), hotL: Object.assign({}, S.hotL), blocked: S.blocked, x: S.x, hops: S.hops.slice(), status: S.status, done: S.done}); }
      if (phase !== want) setPhase(want);
      (async function(){
        await wait(rm ? 30 : 80);
        if (run.cancel) return;
        S.hot[t.path[0]] = 1; S.hops[0] = 'on'; S.status = 'Hop 1 of ' + N + ': ' + t.hops[0]; commit();
        await wait(rm ? 300 : 1100);
        var blocked = false;
        for (var i = 1; i < t.path.length; i++){
          if (run.cancel) return;
          var a = t.path[i - 1], b = t.path[i], key = lkey(a, b), L = links.current[key];
          if (t.blockAt != null && i === t.blockAt){
            if (L){ var m = L.getPointAtLength(L.getTotalLength() / 2); S.blocked = key; S.x = {x: m.x, y: m.y}; }
            S.hops[i] = 'x'; S.status = 'Blocked: ' + t.hops[i]; commit(); blocked = true;
            for (var j = i + 1; j < N; j++){ await wait(rm ? 200 : 900); if (run.cancel) return; S.hops[j] = 'on'; S.status = t.hops[j]; commit(); }
            break;
          }
          if (L){ S.hotL[key] = 1; commit(); await animAlong(L, L.getAttribute('data-a') !== a, rm ? 0 : 900, run); }
          if (run.cancel) return;
          S.hot[b] = 1; S.hops[i] = 'on'; S.status = 'Hop ' + (i + 1) + ' of ' + N + ': ' + t.hops[i]; commit();
          await wait(rm ? 250 : 900);
        }
        if (!blocked){ for (var q = t.path.length; q < N; q++){ if (run.cancel) return; S.hops[q] = 'on'; S.status = t.hops[q]; commit(); await wait(rm ? 150 : 500); } }
        if (run.cancel) return;
        S.done = true; commit();
      })();
    }
    var cur = sel ? pos(sel) : null;
    var nodeIds = Object.keys(data.nodes).filter(function(id){ return !isHidden(id); });
    return h('div', {className: 'dk-topo', ref: wrapRef},
      h('div', {className: 'map'},
        h('div', {className: 'dk-toolbar'},
          phases.length > 1 ? h('div', {className: 'dk-seg', role: 'group', 'aria-label': 'Network phase'}, phases.map(function(x){
            return h('button', {key: x.id, type: 'button', 'aria-pressed': String(x.id === phase), onClick: function(){ stop(); setPhase(x.id); }}, x.label || x.id);
          })) : null,
          h('span', {className: 'sp'}),
          rm || p.ambient === false ? null : h(Button, {size: 'sm', pressed: paused, onClick: function(){ setPaused(!paused); }}, 'Pause motion')),
        P.note ? h('p', {className: 'dk-meta note'}, P.note) : null,
        h('div', {ref: mapRef, className: 'svgwrap', tabIndex: scrolls ? 0 : undefined, role: scrolls ? 'region' : undefined, 'aria-label': scrolls ? 'Network map, scrolls sideways' : undefined, onMouseEnter: function(){ setHover(true); }, onMouseLeave: function(){ setHover(false); }},
          h('svg', {ref: svgRef, viewBox: '0 0 ' + vb[0] + ' ' + vb[1], role: 'group', 'aria-label': 'Network topology: select a box for details'},
            (data.zones || []).map(function(z, i){
              return h('g', {key: 'z' + i, className: 'zone ' + (z.tone || '')}, h('rect', {x: z.x, y: z.y, width: z.w, height: z.h, rx: 12}), h('text', {x: z.x + 10, y: z.y + 18, className: 'tag'}, z.l));
            }),
            h('g', null, P.links.map(function(l){
              var key = lkey(l[0], l[1]), kind = l[2] || '', buy = (isBuy(l[0]) || isBuy(l[1])) && kind !== 'pwr';
              return h('path', {key: key, 'data-a': l[0], 'data-b': l[1], className: cx('lk', kind, buy && 'buy', tr.hotL[key] && 'hot', tr.blocked === key && 'blocked'), d: linkPath(l[0], l[1]),
                ref: function(el){ if (el) links.current[key] = el; else delete links.current[key]; }});
            })),
            h('g', {ref: ambRef, 'aria-hidden': 'true'}),
            h('g', null, nodeIds.map(function(id){
              var n = pos(id), w = n.w || 130, hh = n.h || 48;
              return h('g', {key: id, className: cx('nd', isBuy(id) && 'buy', sel === id && 'sel', tr.hot[id] && 'hot'), transform: 'translate(' + (n.x - w / 2) + ',' + (n.y - hh / 2) + ')',
                tabIndex: 0, role: 'button', 'aria-pressed': String(sel === id),
                onClick: function(){ setSel(id); }, onKeyDown: function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setSel(id); } }},
                h('rect', {className: 'b', width: w, height: hh, rx: 9}),
                h('rect', {className: 'stripe', width: 4, height: hh - 14, x: 7, y: 7, rx: 2, style: {fill: 'var(--node-' + (n.k || 'net') + ')'}}),
                h('text', {x: 19, y: hh / 2 - 3}, n.l),
                n.s ? h('text', {className: 's', x: 19, y: hh / 2 + 12}, n.s) : null,
                isBuy(id) ? h('text', {className: 'tag', x: w, y: -5, textAnchor: 'end'}, 'TO BUY') : null,
                n.live ? h('circle', {className: 'live', cx: w - 10, cy: hh - 10, r: 3.5, 'aria-hidden': 'true'}, rm ? null : h('animate', {attributeName: 'opacity', values: '1;.3;1', dur: (2 + (id.length % 4) * 0.4) + 's', repeatCount: 'indefinite'})) : null);
            })),
            h('g', {ref: fxRef, 'aria-hidden': 'true'}),
            tr.x ? h('g', {transform: 'translate(' + tr.x.x.toFixed(1) + ',' + tr.x.y.toFixed(1) + ')', 'aria-hidden': 'true'},
              h('line', {className: 'x', x1: -9, y1: -9, x2: 9, y2: 9}), h('line', {className: 'x', x1: 9, y1: -9, x2: -9, y2: 9})) : null)),
        scrolls ? h('p', {className: 'dk-meta swipe', 'aria-hidden': 'true'}, '← Swipe the map to see every node →') : null,
        h('div', {className: 'legend', 'aria-hidden': 'true'}, LEGEND.map(function(l){ return h('span', {key: l[1]}, h('i', {className: l[0]}), l[1]); }))),
      h('div', {className: 'side'},
        h('div', {className: 'dk-eyebrow'}, 'Packet traces'),
        h('div', {className: 'traces'}, (data.traces || []).map(function(t){
          var on = tr.id === t.id, running = on && !tr.done;
          return h('button', {key: t.id, type: 'button', className: 'dk-trace-btn', 'aria-pressed': String(on), onClick: function(){ if (running) stop(); else play(t); }},
            h('span', {className: 'pl', 'aria-hidden': 'true'}, running ? '■' : on ? '↻' : '▶'),
            h('span', null, h('span', {className: 'dk-sr'}, running ? 'Stop trace: ' : on ? 'Replay trace: ' : 'Play trace: '), h('b', null, t.t), h('span', {className: 'path'}, t.path.join(' → '))));
        })),
        tr.id ? h('ol', {className: 'dk-hops'}, tr.hops.map(function(s, i){
          var t = (data.traces || []).filter(function(x){ return x.id === tr.id; })[0];
          return h('li', {key: i, className: s}, t ? t.hops[i] : '');
        })) : null,
        h('div', {className: 'dk-sr', role: 'status'}, tr.status),
        h('div', {className: 'dk-detail'}, cur ? h(React.Fragment, null, h('b', null, cur.l + (cur.s ? ' · ' + cur.s : '')), cur.i || '') : 'Select any box in the map for details.')));
  }

  /* ---------- TerminalReplay ---------- */
  function TerminalReplay(p){
    var script = p.script || [], host = p.prompt || 'root@core:~#', rm = useReduced();
    var s = useState(rm ? {i: script.length, c: 0} : {i: 0, c: 0}), st = s[0], set = s[1];
    var ref = useRef(null), active = useActive(ref), f = useFlash(1400), copied = f[0], flash = f[1];
    useEffect(function(){
      if (!active || st.i >= script.length) return;
      var line = script[st.i], id;
      if (line.cmd != null && st.c < line.cmd.length) id = setTimeout(function(){ set({i: st.i, c: st.c + 1}); }, 26 + Math.random() * 40);
      else id = setTimeout(function(){ set({i: st.i + 1, c: 0}); }, line.cmd != null ? 320 : 140);
      return function(){ clearTimeout(id); };
    }, [st, active]);
    function cls(o){ return /^(✓|OK\b|ok:)/.test(o) ? 'ok' : /^(WARN|!)/.test(o) ? 'wn' : /^(ERR|✗)/.test(o) ? 'er' : 'o'; }
    var typing = st.i < script.length;
    var rows = script.slice(0, Math.min(st.i + 1, script.length)).map(function(L, i){
      var full = i < st.i;
      if (L.cmd != null) return h('div', {key: i}, h('span', {className: 'pr'}, host + ' '), full ? L.cmd : L.cmd.slice(0, st.c), !full ? h('span', {className: 'dk-cur', 'aria-hidden': 'true'}) : null);
      return full ? h('div', {key: i, className: cls(L.out)}, L.out) : null;
    });
    if (!typing) rows.push(h('div', {key: 'end'}, h('span', {className: 'pr'}, host + ' '), h('span', {className: 'dk-cur idle', 'aria-hidden': 'true'})));
    function copy(){ copyText(script.filter(function(x){ return x.cmd != null; }).map(function(x){ return x.cmd; }).join('\n')).then(function(ok){ flash(ok ? 'copied' : 'failed'); }); }
    var title = p.title || host.replace(/[:#$~ ]+$/, '') + ' — ssh';
    return h('div', {className: 'dk-term', ref: ref, role: 'group', 'aria-label': 'Terminal replay: ' + title, 'aria-busy': typing ? 'true' : 'false'},
      h('div', {className: 'bar'}, h('span', null, title), h('span', {className: 'sp'}),
        h('button', {type: 'button', onClick: function(){ set(rm ? {i: script.length, c: 0} : {i: 0, c: 0}); }}, h('span', {'aria-hidden': 'true'}, '↻ '), 'replay', h('span', {className: 'dk-sr'}, ' commands')),
        h('button', {type: 'button', onClick: copy}, copied ? copied : 'copy all', h('span', {className: 'dk-sr'}, ' commands'))),
      h('pre', null, rows),
      h('span', {className: 'dk-sr', role: 'status'}, copied ? 'Commands ' + copied : ''));
  }

  /* ---------- GlossaryTerm ---------- */
  function GlossaryTerm(p){
    var s = useState(false), on = s[0], set = s[1];
    var ps = useState({below: false, dx: 0}), pos = ps[0], setPos = ps[1];
    var id = useUid('tip'), tip = useRef(null), timer = useRef(0);
    useEffect(function(){ return function(){ clearTimeout(timer.current); }; }, []);
    useEffect(function(){
      if (!on) return undefined;
      function esc(e){ if (e.key === 'Escape') set(false); }
      document.addEventListener('keydown', esc);
      return function(){ document.removeEventListener('keydown', esc); };
    }, [on]);
    function show(){ clearTimeout(timer.current); set(true); }
    function hideSoon(){ clearTimeout(timer.current); timer.current = setTimeout(function(){ set(false); }, 150); }
    useLayoutEffect(function(){
      if (!on){ if (pos.below || pos.dx) setPos({below: false, dx: 0}); return; }
      var el = tip.current; if (!el) return;
      var r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, dx = 0;
      if (r.left < 8) dx = 8 - r.left; else if (r.right > vw - 8) dx = (vw - 8) - r.right;
      var below = r.top < 8;
      if (below !== pos.below || Math.abs(dx - pos.dx) > 0.5) setPos({below: below, dx: dx});
    }, [on]);
    return h('span', {className: 'dk-term-g', tabIndex: 0, 'aria-describedby': id,
      onMouseEnter: show, onMouseLeave: hideSoon, onFocus: show, onBlur: function(){ clearTimeout(timer.current); set(false); }},
      p.children || p.term,
      h('span', {ref: tip, id: id, role: 'tooltip', className: cx('dk-tip', pos.below && 'below'), hidden: !on, style: {'--dx': pos.dx + 'px'}},
        h('b', null, p.term), p.def));
  }

  /* ---------- Flashcards ---------- */
  function Flashcards(p){
    var cards = p.cards || [];
    var deckKey = cards.map(function(c){ return c.q + '' + c.a; }).join('');
    function fresh(){ return {key: deckKey, q: cards.map(function(_, i){ return i; }), known: [], flipped: false, misses: 0}; }
    var s = useState(fresh), raw = s[0], set = s[1];
    var st = raw.key === deckKey ? raw : fresh();   /* a new deck starts over instead of reading stale indices */
    useEffect(function(){ if (raw.key !== deckKey) set(fresh()); }, [deckKey]);
    var sy = useState(''), say = sy[0], setSay = sy[1];
    var ref = useRef(null), cardRef = useRef(null), restartRef = useRef(null), wasDone = useRef(false);
    var empty = cards.length === 0, done = !empty && st.q.length === 0, card = cards[st.q[0]];
    useEffect(function(){
      if (done && !wasDone.current){ if (st.misses === 0) celebrate(ref.current); if (restartRef.current) restartRef.current.focus(); }
      wasDone.current = done;
    }, [done]);
    function flip(){ if (!card) return; var f = !st.flipped; set(Object.assign({}, st, {flipped: f})); setSay(f ? 'Answer: ' + card.a : 'Question: ' + card.q); }
    function grade(ok, fromButton){
      if (!st.flipped || !card) return;
      var q = st.q.slice(1), known = st.known.slice();
      if (ok) known.push(st.q[0]); else q.push(st.q[0]);
      set({key: deckKey, q: q, known: known, flipped: false, misses: st.misses + (ok ? 0 : 1)});
      setSay((ok ? 'Marked known. ' : 'Will repeat. ') + (q.length ? 'Next question: ' + cards[q[0]].q : 'Deck cleared.'));
      if (fromButton && q.length) setTimeout(function(){ if (cardRef.current) cardRef.current.focus({preventScroll: true}); }, 0);
    }
    function key(e){
      if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); flip(); }
      else if (e.key === 'ArrowRight'){ e.preventDefault(); grade(true); }
      else if (e.key === 'ArrowLeft'){ e.preventDefault(); grade(false); }
    }
    return h('div', {className: 'dk-flash', ref: ref},
      h('div', {className: 'dk-toolbar'}, h('span', {className: 'dk-eyebrow'}, p.title || 'Recall check'), h('span', {className: 'sp'}),
        h('span', {className: 'dk-meta'}, st.known.length + ' / ' + cards.length + ' known' + (st.misses ? ' · ' + st.misses + ' retries' : ''))),
      empty ? h('div', {className: 'dk-flip done'}, h('div', {className: 'in'}, h('div', {className: 'f'}, h('div', {className: 'q'}, 'No cards yet.'), h('div', {className: 'a'}, 'Add cards with a question and an answer.'))))
      : done ? h('div', {className: 'dk-flip done'}, h('div', {className: 'in'}, h('div', {className: 'f'},
          h('div', {className: 'q'}, st.misses ? 'Deck cleared.' : 'Perfect run.'),
          h('div', {className: 'a'}, st.misses ? st.misses + ' card' + (st.misses > 1 ? 's' : '') + ' needed a second look. Run it again tomorrow.' : 'Every card on the first try.'),
          h('div', null, h('button', {ref: restartRef, type: 'button', className: 'dk-btn amber', onClick: function(){ set(fresh()); setSay('Deck restarted. Question: ' + (cards[0] ? cards[0].q : '')); setTimeout(function(){ if (cardRef.current) cardRef.current.focus(); }, 0); }}, 'Restart deck')))))
      : h('div', {ref: cardRef, className: cx('dk-flip', st.flipped && 'on'), tabIndex: 0, role: 'button', 'aria-label': (st.flipped ? 'Answer: ' + card.a : 'Question: ' + card.q) + '. Space flips; right arrow: got it; left arrow: again.',
          onClick: flip, onKeyDown: key},
          h('div', {className: 'in', 'aria-hidden': 'true'},
            h('div', {className: 'f'}, h('span', {className: 'dk-eyebrow'}, card.tag || 'Question'), h('div', {className: 'q'}, card.q), h('span', {className: 'dk-meta'}, 'click or space to flip')),
            h('div', {className: 'f back'}, h('span', {className: 'dk-eyebrow ans'}, 'Answer'), h('div', {className: 'a'}, card.a)))),
      empty ? null : h('div', {className: 'dk-dots', 'aria-hidden': 'true'}, cards.map(function(_, i){ return h('i', {key: i, className: st.known.indexOf(i) >= 0 ? 'k' : (!done && st.q[0] === i ? 'c' : '')}); })),
      done || empty ? null : h('div', {className: 'dk-row'},
        h(Button, {onClick: function(){ grade(false, true); }, ariaDisabled: !st.flipped}, '← Again'),
        h(Button, {variant: 'primary', onClick: function(){ grade(true, true); }, ariaDisabled: !st.flipped}, 'Got it →')),
      h('div', {className: 'dk-sr', role: 'status'}, say));
  }

  /* ---------- CommandPalette ---------- */
  /* Search match. A whole-query run scores 8 a letter plus bonuses for a word start, the start of the text and the whole text,
     so it always beats scattered letters (at most 6 a letter); run tells the two apart. Spaces around the query are ignored. */
  function wordStart(s, i){ return i === 0 || /[\s\-_.,:;\/()·]/.test(s.charAt(i - 1)); }
  function fuzzy(q, t){
    var ql = String(q || '').trim().toLowerCase(), tl = String(t || '').toLowerCase(), n = ql.length;
    if (!n) return {score: 1, marks: []};
    var best = -1, at = tl.indexOf(ql);
    while (at >= 0){ if (best < 0) best = at; if (wordStart(tl, at)){ best = at; break; } at = tl.indexOf(ql, at + 1); }
    if (best >= 0){
      var run = []; for (var k = 0; k < n; k++) run.push(best + k);
      return {score: 8 * n + (wordStart(tl, best) ? 4 : 0) + (best === 0 ? 4 : 0) + (tl.length === n ? 4 : 0), marks: run, run: true};
    }
    var j = 0, marks = [], score = 0, last = -2;
    for (var i = 0; i < tl.length && j < n; i++){
      if (tl.charAt(i) === ql.charAt(j)){ marks.push(i); score += (i === last + 1 ? 3 : 1) + (wordStart(tl, i) ? 2 : 0); last = i; j++; }
    }
    return j === n ? {score: score, marks: marks} : null;
  }
  function hl(t, marks){
    if (!marks.length) return t;
    var set = {}, out = []; marks.forEach(function(m){ set[m] = 1; });
    for (var i = 0; i < t.length; i++) out.push(set[i] ? h('mark', {key: i}, t[i]) : t[i]);
    return out;
  }
  function isMac(){ try { var pl = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; return /mac|iphone|ipad/i.test(pl); } catch (e) { return false; } }
  /* True while the user is typing somewhere, so single-key hotkeys such as "/" stay out of the way. */
  function isTyping(el){
    if (!el || el === document.body) return false;
    var tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable;
  }
  function CommandPalette(p){
    var items = p.items || [], ctl = p.open != null;
    var o = useState(false), openS = o[0], setOpenS = o[1], open = ctl ? !!p.open : openS;
    var q = useState(''), query = q[0], setQuery = q[1];
    var a = useState(0), act = a[0], setAct = a[1];
    var tt = useFlash(1800), toast = tt[0], flash = tt[1];
    var id = useUid('pal'), trigger = useRef(null), input = useRef(null), prevFocus = useRef(null), wasOpen = useRef(false);
    var openRef = useRef(open), setOpenRef = useRef(null);
    function setOpen(v){ if (!ctl) setOpenS(v); if (p.onOpenChange && v !== openRef.current) p.onOpenChange(v); }
    openRef.current = open; setOpenRef.current = setOpen;
    var extra = (p.hotkeys || []).filter(function(k){ return typeof k === 'string' && k.length > 0; }), extraKey = extra.join('\u0001');
    useEffect(function(){
      if (p.hotkey === false && !extra.length) return undefined;
      function k(e){
        var key = String(e.key);
        if (p.hotkey !== false && (e.metaKey || e.ctrlKey) && !e.altKey && key.toLowerCase() === 'k'){ e.preventDefault(); setOpenRef.current(!openRef.current); return; }
        if (openRef.current || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || extra.indexOf(key) < 0) return;
        if (isTyping(e.target) || isTyping(document.activeElement) || document.querySelector('.dk-pal')) return;
        e.preventDefault(); setOpenRef.current(true);
      }
      window.addEventListener('keydown', k); return function(){ window.removeEventListener('keydown', k); };
    }, [p.hotkey, extraKey]);
    /* Opening remembers where focus was; closing clears the query and puts focus back there (or on the trigger),
       unless something such as onSelect has already moved it. */
    useEffect(function(){
      if (open && !wasOpen.current){ prevFocus.current = document.activeElement; if (input.current) input.current.focus(); }
      else if (!open && wasOpen.current){
        setQuery(''); setAct(0);
        var prev = prevFocus.current; prevFocus.current = null;
        setTimeout(function(){
          var ae = document.activeElement;
          if (ae && ae !== document.body) return;
          if (prev && prev !== document.body && prev !== trigger.current && prev.isConnected && typeof prev.focus === 'function'){ prev.focus({preventScroll: true}); if (document.activeElement === prev) return; }
          if (trigger.current) trigger.current.focus({preventScroll: true});
        }, 0);
      }
      wasOpen.current = open;
    }, [open]);
    /* Title counts double. An item with a whole-query run in its title, sub or kind ranks above items with scattered letters only;
       a kind (a short label such as "step" or "M3") matches only as a run. */
    var res = items.map(function(it){
      var mt = fuzzy(query, it.title), ms = it.sub ? fuzzy(query, it.sub) : null, mk = it.kind ? fuzzy(query, it.kind) : null;
      if (mk && !mk.run) mk = null;
      if (!mt && !ms && !mk) return null;
      var run = !!((mt && mt.run) || (ms && ms.run) || mk);
      /* the title shows its marks only when they explain the match: its own run, or scattered letters when nothing has a run */
      return {it: it, score: (run ? 1000 : 0) + (mt ? mt.score * 2 : 0) + (ms ? ms.score : 0) + (mk ? mk.score : 0), marks: mt && (mt.run || !run) ? mt.marks : []};
    }).filter(Boolean).sort(function(x, y){ return y.score - x.score; }).slice(0, p.max || 8);
    useEffect(function(){
      if (!open) return;
      var el = document.getElementById(id + '-o' + act);
      if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest'});
    }, [act, open, query]);
    function pick(r){ if (!r) return; setOpen(false); if (p.onSelect) p.onSelect(r.it); flash('Jumped to ' + r.it.title); }
    function key(e){
      if (e.key === 'ArrowDown'){ e.preventDefault(); setAct(Math.min(act + 1, res.length - 1)); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); setAct(Math.max(act - 1, 0)); }
      else if (e.key === 'Enter'){ e.preventDefault(); pick(res[act]); }
      else if (e.key === 'Escape'){ e.preventDefault(); setOpen(false); }
      else if (e.key === 'Tab'){ e.preventDefault(); }
    }
    /* The list holds options only. With no match it hides, the combobox reports collapsed, and the hint shows below it and is announced. */
    var optId = function(i){ return id + '-o' + i; };
    var hint = p.emptyHint || 'No match. Try fewer letters or another word.';
    /* The kind column fits the page's longest kind, in characters of its mono font (CSS keeps at least 44px; past 14 it wraps). */
    var kw = 0; items.forEach(function(it){ var n = it && it.kind ? String(it.kind).length : 0; if (n > kw) kw = n; });
    var ph = p.placeholder || 'Search steps, terms, nodes', compact = p.compact === true || p.compact === 'auto';
    var keys = (p.hotkey === false ? [] : ['Control+K', 'Meta+K']).concat(extra).join(' ');
    return h(React.Fragment, null,
      p.trigger === false ? null : h('button', {ref: trigger, type: 'button', className: cx('dk-kbtn', p.compact === true && 'compact', p.compact === 'auto' && 'compact-auto'), onClick: function(){ setOpen(true); },
          'aria-haspopup': 'dialog', 'aria-label': compact ? ph : undefined, 'aria-keyshortcuts': keys || undefined},
        h('svg', {width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, 'aria-hidden': 'true'}, h('circle', {cx: 11, cy: 11, r: 7}), h('path', {d: 'm20 20-3.5-3.5'})),
        h('span', {className: 'lbl'}, ph), h('span', {className: 'sp'}), p.hotkey === false ? null : h('kbd', null, isMac() ? '⌘K' : 'Ctrl K')),
      open ? h('div', {className: 'dk-pal', onMouseDown: function(e){ if (e.target === e.currentTarget) setOpen(false); }},
        h('div', {className: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': p.label || 'Search', onKeyDown: key,
            onMouseDown: function(e){ if (e.target !== input.current) e.preventDefault(); }},
          h('input', {ref: input, value: query, placeholder: 'Type to search…', role: 'combobox', 'aria-expanded': res.length ? 'true' : 'false', 'aria-controls': id + '-list', 'aria-autocomplete': 'list',
            'aria-activedescendant': res.length ? optId(Math.min(act, res.length - 1)) : undefined, 'aria-label': p.label || 'Search', autoComplete: 'off', spellCheck: false,
            onChange: function(e){ setQuery(e.target.value); setAct(0); }}),
          h('div', {className: 'dk-sr', role: 'status'}, query ? (res.length ? res.length + (res.length === 1 ? ' result' : ' results') : hint) : ''),
          h('div', {className: 'res', role: 'listbox', id: id + '-list', 'aria-label': 'Results', hidden: !res.length, style: kw ? {'--dk-pal-k': Math.min(kw, 14) + 'ch'} : undefined}, res.map(function(r, i){
            return h('div', {key: r.it.id || r.it.title, id: optId(i), role: 'option', 'aria-selected': String(i === act), className: cx('r', i === act && 'on'), onMouseEnter: function(){ setAct(i); }, onClick: function(){ pick(r); }},
              h('span', {className: 'k'}, r.it.kind || ''),
              h('span', {className: 'c'}, h('span', {className: 't'}, hl(r.it.title, r.marks)), r.it.sub ? h('span', {className: 'x'}, r.it.sub) : null),
              i === act ? h('span', {className: 'ent', 'aria-hidden': 'true'}, '↵') : null);
          })),
          res.length ? null : h('div', {className: 'empty'}, hint),
          h('div', {className: 'ft', 'aria-hidden': 'true'}, h('span', null, '↑↓ move'), h('span', null, '↵ open'), h('span', null, 'esc close')))) : null,
      h('div', {className: 'dk-sr', role: 'status'}, toast || ''),
      toast ? h('div', {className: 'dk-toast', 'aria-hidden': 'true'}, toast) : null);
  }

  /* ---------- LiveConsole ---------- */
  var CONSOLE = [
    {name: 'feat/vlan-plan', stages: ['lint', 'secrets', 'sast', 'sca', 'sign', 'deploy'], fail: null, lines: ['$ git push origin feat/vlan-plan', 'lint     ansible-lint, yamllint: clean', 'secrets  gitleaks: 0 findings', 'sast     semgrep: 0 blocking', 'sca      trivy fs: 0 critical', 'sign     cosign sign ghcr.io/example/netcfg', 'deploy   ansible-playbook site.yml --limit lab']},
    {name: 'fix/grafana-auth', stages: ['lint', 'secrets', 'sast', 'sca', 'sign', 'deploy'], fail: 1, lines: ['$ git push origin fix/grafana-auth', 'lint     eslint, hadolint: clean', 'secrets  gitleaks: 1 finding  grafana.ini:12 admin_password'], why: 'Secret in a tracked file. Rotate it, move it to the vault, rewrite history.'},
    {name: 'chore/base-image', stages: ['lint', 'secrets', 'sast', 'sca', 'sign', 'deploy'], fail: 3, lines: ['$ git push origin chore/base-image', 'lint     hadolint: clean', 'secrets  gitleaks: 0 findings', 'sast     semgrep: 0 blocking', 'sca      trivy image: critical CVE in openssl (base layer)'], why: 'Critical in the base image. Bump to the patched digest, rebuild, rescan.'}
  ];
  function LiveConsole(p){
    var sc = p.scenarios && p.scenarios.length ? p.scenarios : CONSOLE, rm = useReduced();
    var s = useState({k: 0, n: reduced() ? sc[0].lines.length : 0}), raw = s[0], set = s[1];
    var st = raw.k < sc.length ? raw : {k: 0, n: 0};
    var pz = useState(false), paused = pz[0], setPaused = pz[1];
    var hv = useState(false), hover = hv[0], setHover = hv[1];
    var ref = useRef(null), active = useActive(ref);
    var S = sc[st.k], total = S.lines.length, end = st.n >= total, halted = paused || hover || !active;
    var rows = sc.reduce(function(m, x){ return Math.max(m, (x.lines || []).length); }, 0) + 1;   /* longest run plus its verdict: no jump between runs */
    useEffect(function(){
      if (halted) return;
      var delay = rm ? 4000 : end ? 2600 : st.n === 0 ? 500 : 560;
      var id = setTimeout(function(){
        if (end){ var k = (st.k + 1) % sc.length; set({k: k, n: rm ? sc[k].lines.length : 0}); }
        else set({k: st.k, n: st.n + 1});
      }, delay);
      return function(){ clearTimeout(id); };
    }, [st, halted]);
    var reached = Math.max(0, st.n - 2);
    function pip(i){ if (S.fail != null && i === S.fail && end) return 'bad'; if (i < reached || (end && S.fail == null)) return 'ok'; if (i === reached && !end) return 'run'; return ''; }
    function lc(i){ if (i === 0) return 'c'; if (S.fail != null && end && i === total - 1) return 'bad'; if (!end && i === st.n - 1) return 'go'; return 'ok'; }
    return h('div', {className: 'dk-console', ref: ref, role: 'group', 'aria-label': 'CI pipeline console' + (p.demo === false ? '' : ' (demo data)'),
      onMouseEnter: function(){ setHover(true); }, onMouseLeave: function(){ setHover(false); }},
      h('div', {className: 'hd'},
        h('span', {className: cx('dk-live', halted && 'paused')}, halted ? 'PAUSED' : 'LIVE'),
        h('span', {className: 'nm'}, 'pipeline · ' + S.name + (p.demo === false ? '' : ' · demo data')), h('span', {className: 'sp'}),
        end ? h('span', {className: cx('dk-verdict', S.fail == null ? 'pass' : 'block')}, S.fail == null ? 'PASSED' : 'BLOCKED') : h('span', null, 'run ' + (st.k + 1) + '/' + sc.length),
        h('button', {type: 'button', className: 'ctl', 'aria-pressed': String(paused), onClick: function(){ setPaused(!paused); }}, h('span', {'aria-hidden': 'true'}, '❚❚ '), 'pause')),
      h('div', {className: 'pips', 'aria-hidden': 'true'}, S.stages.map(function(x, i){ return h('span', {key: x, className: cx('pip', pip(i))}, x); })),
      h('pre', {style: {'--dk-console-lines': rows}}, S.lines.slice(0, st.n).map(function(t, i){ return h('div', {key: st.k + '-' + i, className: lc(i)}, t); }),
        end ? h('div', {key: 'v', className: S.fail == null ? 'ok' : 'go'}, S.fail == null ? (S.pass || p.passLine || '✓ all gates green · deployed to lab') : '→ ' + (S.why || 'blocked at ' + (S.stages[S.fail] || 'a gate'))) : h('span', {className: 'dk-cur', 'aria-hidden': 'true'})));
  }

  /* ---------- GateSimulator ---------- */
  var GATES = [
    {id: 'pre', l: 'Pre-commit', t: 'gitleaks', zone: 'your laptop', doing: 'scanning the staged diff', ok: 'no secrets'},
    {id: 'sast', l: 'SAST', t: 'Semgrep', zone: 'CI on every push', doing: 'scanning the change', ok: '0 blocking findings'},
    {id: 'sca', l: 'SCA', t: 'Trivy', zone: 'CI on every push', doing: 'scanning dependencies', ok: '0 critical'},
    {id: 'sign', l: 'Sign', t: 'cosign', zone: 'CI on every push', doing: 'signing the image', ok: 'signed with your key'},
    {id: 'adm', l: 'Admission', t: 'Kyverno', zone: 'cluster', doing: 'checking the signature', ok: 'admitted'},
    {id: 'net', l: 'Network', t: 'OPNsense', zone: 'firewall', doing: 'checking lab traffic', ok: 'lab traffic stayed in the lab'}];
  var ATTACKS = [
    {id: 'key', l: 'Leaked cloud key', g: 'pre', cmd: 'git commit -m "add deploy script"', finding: 'access key pattern in deploy.sh:4', why: 'gitleaks matched an access-key pattern in the staged diff. The commit never leaves your laptop.', fix: 'Rotate the key, load it from a secret store, allowlist the path in .gitleaks.toml only if it is a test fixture.'},
    {id: 'nov', l: 'Hook skipped with --no-verify', g: 'sast', skip: ['pre'], skipWhy: 'hooks bypassed with --no-verify', cmd: 'git commit --no-verify -m "quick fix" && git push', finding: 'hard-coded credential in deploy.sh:4', why: 'The pre-commit hook never ran, so the key reached the remote. Semgrep\'s secrets rules scan every push in CI and failed the check.', fix: 'Rotate the key now: it left your laptop. Keep a secret scan in CI as well, because anyone can skip a local hook.'},
    {id: 'sqli', l: 'SQL injection in a PR', g: 'sast', cmd: 'git push origin feat/search', finding: 'string-built SQL reaches a query sink', why: 'Semgrep flagged string-built SQL reaching a query sink. CI fails the PR check.', fix: 'Use parameterized queries; keep the rule blocking on main.'},
    {id: 'dep', l: 'Vulnerable dependency', g: 'sca', cmd: 'git push origin chore/deps', finding: 'critical CVE in a transitive package', why: 'Trivy found a critical CVE in a transitive package. The build stops before an image exists.', fix: 'Bump to the fixed version, regenerate the lockfile, rescan.'},
    {id: 'img', l: 'Unsigned image', g: 'adm', skip: ['pre', 'sast', 'sca', 'sign'], skipWhy: 'built and pushed from a laptop, outside CI', cmd: 'docker push ghcr.io/example/api:hotfix && kubectl apply -f deploy.yaml', finding: 'no cosign signature from your key', why: 'The image skipped CI, so nothing scanned or signed it. Kyverno verifyImages found no cosign signature from your key and the API server rejected the pod.', fix: 'Build and sign in CI with cosign; deploy by digest, never :latest.'},
    {id: 'lat', l: 'Lab VM scans home LAN', g: 'net', skip: ['pre', 'sast', 'sca', 'sign', 'adm'], skipWhy: 'network traffic, not a code change', cmd: 'nmap -sS 192.0.2.0/24', finding: 'lab → LAN blocked and logged', why: 'OPNsense rule lab→LAN: block + log. The scan gets no replies; the attempt lands in the firewall log.', fix: 'Nothing to fix: this is the wall doing its job. Review the log weekly.'},
    {id: 'ok', l: 'Clean change', g: null, cmd: 'git push origin feat/healthcheck', why: 'Every gate passed. The signed image was admitted; lab traffic stayed in the lab.', fix: 'Ship it.'}
  ];
  /* Fail closed: an attack naming a gate this pipeline lacks is a data bug, never a clean run. */
  function gateCheck(x, gates){
    var ids = gates.map(function(g){ return g.id; }), sk = x.skip || [];
    if (x.g && ids.indexOf(x.g) < 0) return {log: 'unknown gate "' + x.g + '"', msg: x.l + ' names gate "' + x.g + '", which this pipeline does not have. Nothing ran; fix the attack data.'};
    for (var i = 0; i < sk.length; i++){
      if (ids.indexOf(sk[i]) < 0) return {log: 'unknown gate "' + sk[i] + '"', msg: x.l + ' skips gate "' + sk[i] + '", which this pipeline does not have. Nothing ran; fix the attack data.'};
      if (sk[i] === x.g) return {log: 'gate "' + x.g + '" is both skipped and blocking', msg: x.l + ' both skips and is blocked by gate "' + x.g + '". Nothing ran; fix the attack data.'};
    }
    return null;
  }
  /* The run as frames: where the packet is, the log lines it adds, how long it stays. */
  function gatePlan(x, gates, o){
    var n = gates.length, skip = x.skip || [], pass = x.pass || {}, stop = x.g ? gates.map(function(g){ return g.id; }).indexOf(x.g) : n;
    var frames = [], carry = x.cmd ? [{k: 'c', t: '$ ' + x.cmd}] : [];
    for (var i = 0; i < n && i <= stop; i++){
      var g = gates[i], tag = '[' + g.l + '] ';
      if (skip.indexOf(g.id) >= 0){ frames.push({pos: i, ms: 300, lines: carry.concat([{k: 'mu', t: tag + 'skipped' + (x.skipWhy ? ': ' + x.skipWhy : '')}])}); carry = []; continue; }
      frames.push({pos: i, ms: 560, lines: carry.concat([{k: 'go', t: tag + (g.doing || 'running ' + (g.t || g.l)) + '…'}])});
      carry = i === stop ? [] : [{k: 'ok', t: tag + '✓ ' + (pass[g.id] || g.ok || 'passed')}];
    }
    var blocked = stop < n;
    return {frames: frames, blocked: blocked, stop: blocked ? stop : n,
      end: blocked ? [{k: 'bad', t: '[' + gates[stop].l + '] ✕ ' + (x.finding || 'blocked')}, {k: 'mu', t: o.blockLine || 'exit 1 · nothing ships'}]
        : carry.concat([{k: 'ok', t: o.passLine || '✓ every gate passed · shipped'}])};
  }
  var SKIP_ICON = 'M4 12h11M11 7l5 5-5 5M20 6v12';
  function GateSimulator(p){
    var gates = p.gates || GATES, atks = p.attacks || ATTACKS, passLabel = p.passLabel || 'Shipped';
    var a = useState(null), atk = a[0], setAtk = a[1];
    var b = useState(-1), pos = b[0], setPos = b[1];
    var c = useState(null), res = c[0], setRes = c[1];
    var d = useState({blocked: 0, passed: 0}), stat = d[0], setStat = d[1];
    var ln = useState([]), lines = ln[0], setLines = ln[1];
    var f = useState(''), err = f[0], setErr = f[1];
    var timer = useRef(0), ref = useRef(null), trackRef = useRef(null), logRef = useRef(null), scrolls = useScrollable(trackRef);
    var busy = !!atk && !res, busyRef = useRef(false), startRef = useRef(null), autoDone = useRef(false), atkRef = useRef(null), atksRef = useRef(atks);
    busyRef.current = busy; atkRef.current = atk; atksRef.current = atks;
    useEffect(function(){ return function(){ clearTimeout(timer.current); }; }, []);
    useEffect(function(){
      var wrap = trackRef.current; if (!wrap || pos < 0 || wrap.scrollWidth <= wrap.clientWidth + 1) return;
      var g = wrap.querySelectorAll('.dk-gate')[Math.min(pos, gates.length - 1)];
      if (g) wrap.scrollTo({left: g.offsetLeft - (wrap.clientWidth - g.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth'});
    }, [pos]);
    /* the log is a tab stop only while it scrolls, and never stops being one while it has focus */
    var lsc = useState(false), logScroll = lsc[0], setLogScroll = lsc[1];
    function logCheck(){ var el = logRef.current; if (!el) return; var v = el.scrollHeight > el.clientHeight + 1; if (v || document.activeElement !== el) setLogScroll(v); }
    useEffect(function(){ var el = logRef.current; if (el) el.scrollTop = el.scrollHeight; logCheck(); }, [lines]);
    useEffect(function(){
      var el = logRef.current; if (!el || typeof window.ResizeObserver !== 'function') return undefined;
      var ro = new ResizeObserver(function(){ logCheck(); }); ro.observe(el);
      return function(){ ro.disconnect(); };
    }, [!!p.log]);
    /* how: 'click' (an attack button: ignored while a packet flies), 'play' (the play prop) or 'auto' (autoplay; never celebrates) */
    function start(x, how){
      if (how === 'click' && busyRef.current) return;
      clearTimeout(timer.current);
      setAtk(x); setRes(null); setPos(-1); setLines([]); setErr('');
      var bad = gateCheck(x, gates);
      if (bad){ if (window.console) console.warn('GateSimulator: ' + bad.log); setErr(bad.msg); setRes('err'); return; }
      var P = gatePlan(x, gates, p), k = 0, acc = [];
      function finish(){
        setPos(P.stop); setLines(acc.concat(P.end)); setRes(P.blocked ? 'blk' : 'ok');
        setStat(function(s){ return P.blocked ? {blocked: s.blocked + 1, passed: s.passed} : {blocked: s.blocked, passed: s.passed + 1}; });
        if (!P.blocked && how !== 'auto') celebrate(ref.current);
      }
      if (reduced()){ P.frames.forEach(function(fr){ acc = acc.concat(fr.lines); }); finish(); return; }   /* the last frame at once */
      function step(){
        if (k >= P.frames.length){ finish(); return; }
        var fr = P.frames[k++]; acc = acc.concat(fr.lines); setPos(fr.pos); setLines(acc);
        timer.current = setTimeout(step, fr.ms);
      }
      timer.current = setTimeout(step, 120);
    }
    startRef.current = start;
    /* autoplay: the first attack, once, when a third of the simulator is on screen */
    useEffect(function(){
      if (!p.autoplay || autoDone.current) return undefined;
      function go(){ if (autoDone.current) return; autoDone.current = true; var first = atksRef.current[0]; if (first && !atkRef.current) startRef.current(first, 'auto'); }
      var el = ref.current;
      if (!el || typeof window.IntersectionObserver !== 'function'){ go(); return undefined; }
      var io = new IntersectionObserver(function(es){ if (es[es.length - 1].isIntersecting){ io.disconnect(); go(); } }, {threshold: 0.35});
      io.observe(el);
      return function(){ io.disconnect(); };
    }, [p.autoplay]);
    /* play: run the attack with this id from outside; change playKey to run the same one again */
    useEffect(function(){
      if (p.play == null) return;
      var x = atksRef.current.filter(function(t){ return t.id === p.play; })[0];
      if (x){ autoDone.current = true; startRef.current(x, 'play'); }
      else if (window.console) console.warn('GateSimulator: unknown attack "' + p.play + '"');
    }, [p.play, p.playKey]);
    var n = gates.length, left = pos < 0 ? 0 : pos >= n ? 100 : ((pos + 0.5) / n) * 100;
    if (!n) return h('p', {className: 'dk-meta'}, 'Add gates to simulate a pipeline.');
    var skipped = atk && res !== 'err' ? (atk.skip || []) : [];
    function state(i, g){
      if (!atk || res === 'err') return '';
      var sk = skipped.indexOf(g.id) >= 0;
      if (res === 'blk') return i === pos ? 'blk' : i > pos ? 'unreached' : sk ? 'skip' : 'ok';
      if (res === 'ok' || i < pos) return sk ? 'skip' : 'ok';
      return i === pos ? (sk ? 'skip' : 'cur') : '';
    }
    var zones = [];
    gates.forEach(function(g){ var z = g.zone || '', last = zones[zones.length - 1]; if (last && last.z === z) last.n++; else zones.push({z: z, n: 1}); });
    var hasZones = gates.some(function(g){ return !!g.zone; });
    return h('div', {className: 'dk-gates', ref: ref},
      h('div', {className: 'dk-toolbar'}, h('span', {className: 'dk-eyebrow'}, 'Pick an attack'), h('span', {className: 'dk-meta'}, 'simulated'), h('span', {className: 'sp'}),
        h(Chip, {tone: 'red', dot: true}, stat.blocked + ' blocked'), h(Chip, {tone: 'green', dot: true}, stat.passed + ' ' + passLabel.toLowerCase())),
      h('div', {className: 'atk', role: 'group', 'aria-label': 'Attacks'}, atks.map(function(x){
        return h('button', {key: x.id, type: 'button', 'aria-pressed': String(atk === x || (!!atk && x.id != null && atk.id === x.id)), 'aria-disabled': busy ? 'true' : undefined, onClick: function(){ start(x, 'click'); }}, x.l);
      })),
      h('div', {ref: trackRef, className: 'dk-track-wrap', tabIndex: scrolls ? 0 : undefined, role: scrolls ? 'region' : undefined, 'aria-label': scrolls ? 'Pipeline gates, scrolls sideways' : undefined},
        hasZones ? h('div', {className: 'dk-zones', style: {'--n': n}}, zones.map(function(z, i){ return h('span', {key: i, className: cx('z', !z.z && 'none'), style: {gridColumn: 'span ' + z.n}}, z.z); })) : null,
        h('div', {className: 'dk-track', style: {'--n': n}},
          atk && res !== 'err' ? h('div', {className: cx('dk-packet', res), style: {left: res === 'blk' ? 'calc(' + left + '% - 40px)' : left + '%'}, 'aria-hidden': 'true'}) : null,
          gates.map(function(g, i){
            var cls = state(i, g);
            return h('div', {key: g.id, className: cx('dk-gate', cls)},
              cls === 'skip' || cls === 'unreached' ? h('span', {className: 'bd'}, cls === 'skip' ? 'skipped' : 'not reached') : null,
              h('div', {className: 'ic'}, cls === 'blk' || cls === 'ok' || cls === 'skip'
                ? h('svg', {width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: cls === 'skip' ? 2.4 : 3, strokeLinecap: 'round', strokeLinejoin: 'round', role: 'img', 'aria-label': cls === 'blk' ? 'blocked' : cls === 'ok' ? 'passed' : 'skipped'},
                    h('path', {d: cls === 'blk' ? 'M6 6l12 12M18 6L6 18' : cls === 'ok' ? 'M5 12.5l4.5 4.5L19 7' : SKIP_ICON}))
                : pad2(i + 1)),
              h('div', {className: 'gl'}, g.l), h('div', {className: 'gt'}, g.t));
          }))),
      p.log ? h('div', {ref: logRef, className: 'log', role: logScroll ? 'region' : undefined, 'aria-label': logScroll ? 'Simulated output' : undefined, tabIndex: logScroll ? 0 : undefined},
        lines.length ? lines.map(function(l, i){ return h('div', {key: i, className: l.k}, l.t); }) : h('div', {className: 'mu'}, 'Output appears here when you fire an attack.')) : null,
      h('div', {className: 'dk-why', 'aria-live': 'polite'},
        res === 'err' ? h(Callout, {kind: 'warn', label: 'Setup error'}, err)
          : res ? h(Callout, {kind: res === 'blk' ? 'warn' : 'adapt', label: res === 'blk' ? 'Blocked at ' + gates[pos].l : passLabel}, (atk.why || '') + (atk.fix ? ' Fix: ' + atk.fix : ''))
          : h('p', {className: 'dk-meta'}, atk ? 'Packet in flight…' : 'Each gate is one tool in your pipeline. Fire an attack and watch which one catches it.')));
  }

  /* ---------- BentoCard ---------- */
  function BentoCard(p){
    function mv(e){ var r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', (e.clientX - r.left) + 'px'); e.currentTarget.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
    var style = {'--span': p.span || 2}; if (p.tone) style['--tone'] = 'var(--' + p.tone + ')';
    var href = safeHref(p.href);
    return h(href ? 'a' : 'div', {className: cx('dk-glow', p.tone && 'tone-' + p.tone), style: style, onPointerMove: mv, href: href || undefined, target: href && p.newTab === true ? '_blank' : undefined, rel: href ? 'noopener noreferrer' : undefined},
      p.eyebrow ? h('div', {className: 'dk-eyebrow'}, p.eyebrow) : null,
      p.stat != null ? h('div', {className: 'big'}, p.stat) : null,
      p.title ? h('h3', null, p.title, href && p.newTab === true ? h('span', {className: 'ext', 'aria-hidden': 'true'}, ' ↗') : null) : null,
      p.children ? h('p', null, p.children) : null,
      href && p.newTab === true ? h('span', {className: 'dk-sr'}, ' (opens in a new tab)') : null);
  }

  window.Dukecodes = {Button: Button, Chip: Chip, Panel: Panel, Callout: Callout, CodeBlock: CodeBlock, StatTile: StatTile, StageCard: StageCard, Segmented: Segmented, StepCard: StepCard, LiveConsole: LiveConsole, SwarmBoard: SwarmBoard, TopologyTrace: TopologyTrace, GateSimulator: GateSimulator, TerminalReplay: TerminalReplay, Flashcards: Flashcards, CommandPalette: CommandPalette, GlossaryTerm: GlossaryTerm, ProgressRing: ProgressRing, BentoCard: BentoCard, celebrate: celebrate, copyText: copyText};
})();
