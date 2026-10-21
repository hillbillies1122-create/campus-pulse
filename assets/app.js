/* Campus Pulse app */
(function () {
  "use strict";

  var SUPABASE_URL = "https://msfxjvscqllptpjjujep.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZnhqdnNjcWxscHRwamp1amVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTUxOTEsImV4cCI6MjEwODE3MTE5MX0.RRdLtljrkkOcq3oyEt556GN7SyfjBDhNW6b322CjvtU";

  var D = window.CP_DATA, ITEMS = window.CP_ITEMS, RIASEC = window.CP_RIASEC, ISR = window.CP_ISR;
  var CAREERS = D.careers, BY_CODE = {};
  CAREERS.forEach(function (c) { BY_CODE[c.code] = c; });
  var LETTERS = ["R", "I", "A", "S", "E", "C"];
  var ALL_KEYS = D.skillKeys.concat(D.knowKeys);

  var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

  var S = { session: null, user: null, profile: null, marks: [], assessment: null, saved: {}, roadmap: [], loaded: false, cohort: null, recovery: false };

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function round(n) { return Math.round(n); }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function initials(name, email) {
    var n = (name || "").trim();
    if (!n) return (email || "?").charAt(0).toUpperCase();
    return n.split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join("").toUpperCase();
  }
  function firstName() { var n = (S.profile && S.profile.full_name || "").trim(); return n ? n.split(/\s+/)[0] : "there"; }
  function myGroup() { return S.profile && S.profile.branch_group || null; }

  /* ---------- theme & background ---------- */
  function applyLook(theme, bg, custom) {
    var root = document.documentElement;
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme); else root.removeAttribute("data-theme");
    document.body.setAttribute("data-bg", bg || "silk");
    if (custom) root.style.setProperty("--bg-custom", custom);
  }
  function currentLook() {
    return { theme: lsGet("cp-theme") || "system", bg: lsGet("cp-bg") || "silk", custom: lsGet("cp-bg-custom") || "#0b7a55" };
  }
  function setLook(part, value) {
    var look = currentLook();
    if (part === "theme") { look.theme = value; lsSet("cp-theme", value); }
    if (part === "bg") { look.bg = value; lsSet("cp-bg", value); }
    if (part === "custom") { look.custom = value; look.bg = "custom"; lsSet("cp-bg-custom", value); lsSet("cp-bg", "custom"); }
    applyLook(look.theme, look.bg, look.custom);
    if (S.user && S.profile) {
      var patch = { theme: look.theme, background: look.bg, custom_bg: look.custom };
      Object.assign(S.profile, patch);
      sb.from("profiles").update(patch).eq("id", S.user.id).then(function () { });
    }
  }
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  /* ---------- scoring ---------- */
  function riasecFromAnswers(ans) {
    var sums = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    ITEMS.forEach(function (it, i) { var v = ans[i]; if (v === 2) sums[it.area] += 1; else if (v === 1) sums[it.area] += 0.5; });
    var out = {}; LETTERS.forEach(function (k) { out[k] = round(sums[k] / 10 * 100); });
    return out;
  }
  function topCode(r) { return LETTERS.slice().sort(function (a, b) { return r[b] - r[a]; }).slice(0, 3).join(""); }
  function pearson(a, b) {
    var n = a.length, ma = 0, mb = 0, i; for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    var num = 0, da = 0, db = 0; for (i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) * (a[i] - ma); db += (b[i] - mb) * (b[i] - mb); }
    if (da === 0 || db === 0) return null; return num / Math.sqrt(da * db);
  }
  function interestFit(c) {
    var r = S.assessment && S.assessment.riasec; if (!r) return null;
    var p = pearson(LETTERS.map(function (k) { return r[k]; }), LETTERS.map(function (k) { return c.riasec[k]; }));
    return p == null ? null : round(Math.max(0, p) * 100);
  }
  function requirements(c) {
    var req = [];
    D.skillKeys.forEach(function (k, i) { if (c.skills[i] >= 50) req.push({ key: k, kind: "skill", imp: c.skills[i], target: 1 + c.skills[i] / 25 }); });
    D.knowKeys.forEach(function (k, i) { if (c.know[i] >= 50) req.push({ key: k, kind: "knowledge", imp: c.know[i], target: 1 + c.know[i] / 25 }); });
    return req.sort(function (a, b) { return b.imp - a.imp; });
  }
  function readiness(c) {
    var ratings = S.assessment && S.assessment.ratings; if (!ratings) return null;
    var req = requirements(c), tot = 0, n = 0;
    req.forEach(function (q) { var have = ratings[q.key]; if (have) { tot += Math.min(have / q.target, 1); n++; } });
    return n ? round(tot / n * 100) : null;
  }
  function match(c) {
    var f = interestFit(c), r = readiness(c);
    if (f == null && r == null) return null;
    if (f == null) return r; if (r == null) return f;
    return round(0.6 * f + 0.4 * r);
  }
  function rankedCareers(filterGroup) {
    return CAREERS.filter(function (c) { return !filterGroup || c.branches.indexOf(filterGroup) >= 0; })
      .map(function (c) { return { c: c, m: match(c), f: interestFit(c), r: readiness(c) }; })
      .sort(function (a, b) { return (b.m == null ? -1 : b.m) - (a.m == null ? -1 : a.m) || a.c.name.localeCompare(b.c.name); });
  }

  /* ---------- SVG pieces ---------- */
  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 13h4l2-6 4 12 3-9 2 3h5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    road: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14M5 12h14M5 20h14"/><circle cx="8" cy="4" r="0.5"/><path d="M9 4v16"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    palette: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function pulsePath(vals, x0, step, base, scale) {
    var d = "M 0 " + base;
    LETTERS.forEach(function (k, i) {
      var x = x0 + i * step, h = (vals[k] || 0) * scale;
      d += " L " + (x - 22) + " " + base + " L " + (x - 13) + " " + (base + 7) + " L " + x + " " + (base - Math.max(h, 4)) +
        " L " + (x + 10) + " " + (base + 16) + " L " + (x + 18) + " " + base;
    });
    return d + " L " + (x0 + 5 * step + 60) + " " + base;
  }
  function pulseSVG(vals, opts) {
    opts = opts || {};
    var W = 640, H = opts.compact ? 190 : 250, base = H - 58, step = (W - 120) / 5, x0 = 60, scale = (base - 34) / 100;
    var s = '<svg class="pulse" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(opts.label || "Interest profile") + '">';
    s += '<line class="pulse-base" x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '"/>';
    if (opts.compare) s += '<path class="pulse-compare" d="' + pulsePath(opts.compare, x0, step, base, scale) + '"/>';
    var d = pulsePath(vals, x0, step, base, scale);
    s += '<path class="pulse-glow' + (opts.animate ? " draw-in" : "") + '" d="' + d + '"/>';
    s += '<path class="pulse-path' + (opts.animate ? " draw-in" : "") + '" d="' + d + '"/>';
    LETTERS.forEach(function (k, i) {
      var x = x0 + i * step, y = base - Math.max((vals[k] || 0) * scale, 4);
      if (!opts.noValues) s += '<text class="pulse-val" x="' + x + '" y="' + (y - 10) + '">' + round(vals[k] || 0) + "</text>";
      s += '<text class="pulse-label" x="' + x + '" y="' + (base + 34) + '">' + k + "</text>";
      s += '<text class="pulse-sub" x="' + x + '" y="' + (base + 50) + '">' + RIASEC[k].name + "</text>";
    });
    return s + "</svg>";
  }
  function brandMark() {
    return '<svg class="brand-mark" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="10" fill="#0b7a55"/><path d="M4 19h6l2.5-7 4 13 3.5-10 2 4H30" fill="none" stroke="#e7c26a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function bar(value, max, cls, target) {
    var w = Math.max(0, Math.min(100, value / max * 100));
    var t = target != null ? '<span class="target" style="left:calc(' + (target / max * 100) + '% - 1px)"></span>' : "";
    return '<div class="bar"><i class="' + (cls || "") + '" style="width:' + w + '%"></i>' + t + "</div>";
  }

  /* ---------- data loading ---------- */
  function loadAll() {
    var uid = S.user.id;
    return Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("marks").select("*").order("created_at"),
      sb.from("assessments").select("*").eq("user_id", uid).maybeSingle(),
      sb.from("saved_careers").select("career_code"),
      sb.from("roadmap_items").select("*").order("position").order("id")
    ]).then(function (r) {
      var err = r.filter(function (x) { return x.error; })[0];
      if (err) throw err.error;
      S.profile = r[0].data;
      if (!S.profile) {
        S.profile = { id: uid, full_name: (S.user.user_metadata && S.user.user_metadata.full_name) || "", theme: currentLook().theme, background: currentLook().bg };
        return sb.from("profiles").insert({ id: uid, full_name: S.profile.full_name }).then(function () { return r; });
      }
      return r;
    }).then(function (r) {
      S.marks = r[1].data || [];
      S.assessment = r[2].data || null;
      S.saved = {}; (r[3].data || []).forEach(function (x) { S.saved[x.career_code] = true; });
      S.roadmap = r[4].data || [];
      S.loaded = true;
      if (S.profile.theme || S.profile.background) {
        if (S.profile.theme) lsSet("cp-theme", S.profile.theme);
        if (S.profile.background) lsSet("cp-bg", S.profile.background);
        if (S.profile.custom_bg) lsSet("cp-bg-custom", S.profile.custom_bg);
        var l = currentLook(); applyLook(l.theme, l.bg, l.custom);
      }
    });
  }

  /* ---------- routing ---------- */
  var APP_ROUTES = ["dashboard", "profile", "interests", "skills", "careers", "career", "roadmap", "insights", "settings"];
  var AUTH_ROUTES = ["login", "signup", "forgot", "new-password"];
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (/access_token=|error_description=|type=recovery/.test(h)) return { name: S.recovery ? "new-password" : "dashboard", arg: null };
    var parts = h.split("/");
    return { name: parts[0] || "", arg: parts[1] ? decodeURIComponent(parts[1]) : null };
  }
  function go(path) { if (location.hash === "#/" + path) render(); else location.hash = "#/" + path; }

  function show(which) {
    $("#landing").hidden = which !== "landing";
    $("#auth").hidden = which !== "auth";
    $("#app").hidden = which !== "app";
  }

  function render() {
    var r = parseHash();
    if (S.recovery && r.name !== "new-password") r = { name: "new-password" };
    if (AUTH_ROUTES.indexOf(r.name) >= 0) {
      if (S.user && r.name !== "new-password") return go("dashboard");
      show("auth"); renderAuth(r.name); window.scrollTo(0, 0); return;
    }
    if (APP_ROUTES.indexOf(r.name) >= 0) {
      if (!S.user) { lsSet("cp-after-login", r.name + (r.arg ? "/" + r.arg : "")); return go("login"); }
      show("app");
      if (!S.loaded) { $("#view").innerHTML = '<div class="loading">Loading your data…</div>'; return; }
      renderApp(r); return;
    }
    if (S.user) return go("dashboard");
    show("landing");
  }

  /* ---------- auth views ---------- */
  function renderAuth(name) {
    var el = $("#auth-view"), html = "";
    if (name === "login") {
      html = '<form class="auth-card" id="f-login" novalidate><h1>Welcome back</h1><p class="muted">Sign in on any device to pick up where you left off.</p>' +
        '<div class="field"><label for="li-email">Email</label><input class="input" id="li-email" type="email" autocomplete="email" required></div>' +
        '<div class="field"><label for="li-pass">Password</label><input class="input" id="li-pass" type="password" autocomplete="current-password" required></div>' +
        '<p class="error-text" id="li-err" role="alert"></p><button class="btn btn-primary" type="submit">Sign in</button>' +
        '<a href="#/forgot" class="small">Forgot your password?</a><p class="switch">New here? <a href="#/signup">Create an account</a></p></form>';
    } else if (name === "signup") {
      html = '<form class="auth-card" id="f-signup" novalidate><h1>Create your account</h1><p class="muted">Free for students. Your answers stay private to you.</p>' +
        '<div class="field"><label for="su-name">Your name</label><input class="input" id="su-name" maxlength="80" autocomplete="name" required></div>' +
        '<div class="field"><label for="su-email">Email</label><input class="input" id="su-email" type="email" autocomplete="email" required><small>Your VIT email or any email you can open.</small></div>' +
        '<div class="field"><label for="su-pass">Password</label><input class="input" id="su-pass" type="password" minlength="8" autocomplete="new-password" required><small>At least 8 characters.</small></div>' +
        '<label class="small" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" id="su-ok" style="margin-top:4px;accent-color:var(--emerald)"> <span>I understand Campus Pulse stores my profile, marks and answers so I can use them on any device, and that I can delete them any time. <a href="privacy.html">Privacy</a></span></label>' +
        '<p class="error-text" id="su-err" role="alert"></p><button class="btn btn-primary" type="submit">Create account</button>' +
        '<p class="switch">Already have an account? <a href="#/login">Sign in</a></p></form>';
    } else if (name === "forgot") {
      html = '<form class="auth-card" id="f-forgot" novalidate><h1>Reset your password</h1><p class="muted">We\'ll email you a link to set a new one.</p>' +
        '<div class="field"><label for="fp-email">Email</label><input class="input" id="fp-email" type="email" autocomplete="email" required></div>' +
        '<p class="error-text" id="fp-err" role="alert"></p><button class="btn btn-primary" type="submit">Send reset link</button><p class="switch"><a href="#/login">Back to sign in</a></p></form>';
    } else {
      html = '<form class="auth-card" id="f-newpass" novalidate><h1>Set a new password</h1>' +
        '<div class="field"><label for="np-pass">New password</label><input class="input" id="np-pass" type="password" minlength="8" autocomplete="new-password" required></div>' +
        '<p class="error-text" id="np-err" role="alert"></p><button class="btn btn-primary" type="submit">Save new password</button></form>';
    }
    el.innerHTML = html;
    var first = $("input", el); if (first) first.focus();
  }

  function friendlyAuthError(e) {
    var m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m)) return "That email and password don't match. Check them and try again.";
    if (/Email not confirmed/i.test(m)) return "Confirm your email first. Open the link we sent you, then sign in.";
    if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Sign in instead.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts right now. Wait a few minutes and try again.";
    if (/Password should be/i.test(m)) return "Choose a longer password (at least 8 characters).";
    return m;
  }

  document.addEventListener("submit", function (ev) {
    var f = ev.target; if (!f.id) return;
    ev.preventDefault();
    var btn = $("button[type=submit]", f);
    function busy(on) { if (btn) btn.disabled = on; }
    if (f.id === "f-login") {
      var email = $("#li-email").value.trim(), pass = $("#li-pass").value, err = $("#li-err");
      if (!email || !pass) { err.textContent = "Enter your email and password."; return; }
      busy(true); err.textContent = "";
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
        busy(false); if (r.error) err.textContent = friendlyAuthError(r.error);
      });
    } else if (f.id === "f-signup") {
      var nm = $("#su-name").value.trim(), em = $("#su-email").value.trim(), pw = $("#su-pass").value, e2 = $("#su-err");
      if (!nm || !em) { e2.textContent = "Enter your name and email."; return; }
      if (pw.length < 8) { e2.textContent = "Choose a password with at least 8 characters."; return; }
      if (!$("#su-ok").checked) { e2.textContent = "Tick the box to agree to how your data is stored."; return; }
      busy(true); e2.textContent = "";
      sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: nm }, emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        busy(false);
        if (r.error) { e2.textContent = friendlyAuthError(r.error); return; }
        if (!r.data.session) {
          $("#auth-view").innerHTML = '<div class="auth-card"><h1>Check your email</h1><p>We sent a confirmation link to <b>' + esc(em) + '</b>. Open it on this device, then sign in.</p><a class="btn btn-ghost" href="#/login">Go to sign in</a></div>';
        }
      });
    } else if (f.id === "f-forgot") {
      var fe = $("#fp-email").value.trim(), fer = $("#fp-err");
      if (!fe) { fer.textContent = "Enter your email."; return; }
      busy(true);
      sb.auth.resetPasswordForEmail(fe, { redirectTo: location.origin + location.pathname }).then(function (r) {
        busy(false);
        if (r.error) { fer.textContent = friendlyAuthError(r.error); return; }
        $("#auth-view").innerHTML = '<div class="auth-card"><h1>Check your email</h1><p>If an account exists for <b>' + esc(fe) + '</b>, a reset link is on its way. It can take a few minutes.</p><a class="btn btn-ghost" href="#/login">Back to sign in</a></div>';
      });
    } else if (f.id === "f-newpass") {
      var np = $("#np-pass").value, ner = $("#np-err");
      if (np.length < 8) { ner.textContent = "Use at least 8 characters."; return; }
      busy(true);
      sb.auth.updateUser({ password: np }).then(function (r) {
        busy(false);
        if (r.error) { ner.textContent = friendlyAuthError(r.error); return; }
        S.recovery = false; toast("Password updated"); history.replaceState(null, "", location.pathname + "#/dashboard"); render();
      });
    } else if (f.id === "f-profile") { saveProfile(f); }
    else if (f.id === "f-road-add") { addRoadItem(f); }
    else if (f.id === "f-pass") { changePassword(f); }
  });

  /* ---------- app shell ---------- */
  var NAV = [
    ["dashboard", "Home", "home"], ["interests", "Interests", "pulse"], ["skills", "Skills", "sliders"], ["careers", "Careers", "compass"],
    ["roadmap", "Roadmap", "road"], ["insights", "Insights", "chart"], ["profile", "Profile", "user"], ["settings", "Settings", "gear"]
  ];
  var TABS = ["dashboard", "interests", "careers", "roadmap", "insights"];
  function renderShellNav(active) {
    var cur = active === "career" ? "careers" : active;
    $("#nav").innerHTML = NAV.map(function (n) { return '<a href="#/' + n[0] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ICON[n[2]] + "<span>" + n[1] + "</span></a>"; }).join("");
    $("#tabs").innerHTML = NAV.filter(function (n) { return TABS.indexOf(n[0]) >= 0; }).map(function (n) { return '<a href="#/' + n[0] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ICON[n[2]] + "<span>" + n[1] + "</span></a>"; }).join("");
    var a = $("#avatar"); a.textContent = initials(S.profile && S.profile.full_name, S.user && S.user.email);
    $("#theme-btn").innerHTML = isDark() ? ICON.sun : ICON.moon;
    $("#theme-btn").setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
    var title = (NAV.filter(function (n) { return n[0] === cur; })[0] || ["", ""])[1];
    $("#page-title").textContent = title;
    document.title = (title ? title + " | " : "") + "Campus Pulse";
  }

  function renderApp(r) {
    renderShellNav(r.name);
    var v = $("#view"), fn = VIEWS[r.name] || VIEWS.dashboard;
    v.innerHTML = fn(r.arg);
    if (AFTER[r.name]) AFTER[r.name](r.arg);
    var h = $("h1", v); if (h && document.activeElement === document.body) { h.setAttribute("tabindex", "-1"); }
  }

  /* ---------- views ---------- */
  var VIEWS = {}, AFTER = {};

  VIEWS.dashboard = function () {
    var a = S.assessment || {}, hasI = !!a.riasec, hasR = !!a.ratings, p = S.profile || {};
    var hasP = !!(p.branch && p.full_name), hasSave = Object.keys(S.saved).length > 0, hasRoad = S.roadmap.length > 0;
    var next = !hasP ? ["profile", "Add your branch and year"] : !hasI ? ["interests", "Take the interest profiler"] : !hasR ? ["skills", "Rate your skills"] : !hasRoad ? ["careers", "Pick a career to work towards"] : ["roadmap", "Continue your roadmap"];
    var done = [hasP, hasI, hasR, hasSave, hasRoad].filter(Boolean).length;
    var h = '<section class="welcome"><svg class="bg-pulse" viewBox="0 0 600 160" aria-hidden="true"><path d="M0 110 H120 l14 -60 l20 90 l18 -70 l12 40 H330 l14 -40 l18 60 l12 -30 H600"/></svg>' +
      "<h1>Hi " + esc(firstName()) + "</h1><p>" + (done === 5 ? "You've set everything up. Keep ticking off roadmap steps and revisit your answers each semester." : "You're " + done + " of 5 steps in. Next: " + next[1].toLowerCase() + ".") + "</p>" +
      '<a class="btn btn-primary" href="#/' + next[0] + '">' + next[1] + "</a></section>";

    h += '<div class="grid-2"><section class="panel"><div class="panel-title"><h2>Your interest pulse</h2>' + (hasI ? '<span class="meta">Code ' + topCode(a.riasec) + "</span>" : "") + "</div>" +
      (hasI ? pulseSVG(a.riasec, { compact: true, label: "Your interest scores" }) + '<p class="small muted">Higher peaks are areas of work you said you\'d enjoy. <a href="#/interests">Retake</a></p>'
        : '<div class="empty"><h3>No interest profile yet</h3><p>60 quick questions, about 5 minutes. Your answers draw this pulse.</p><a class="btn btn-primary" href="#/interests">Start the profiler</a></div>') + "</section>";

    var steps = [[hasP, "profile", "Profile", "Branch, year and CGPA"], [hasI, "interests", "Interest profiler", "60 questions, about 5 minutes"], [hasR, "skills", "Skill self-rating", "22 quick ratings"], [hasSave, "careers", "Shortlist careers", "Save the ones that interest you"], [hasRoad, "roadmap", "Start a roadmap", "Small steps towards one career"]];
    h += '<section class="panel"><div class="panel-title"><h2>Getting set up</h2><span class="meta">' + done + " of 5</span></div><div class=\"checklist\">" +
      steps.map(function (s) { return '<a class="check-row" href="#/' + s[1] + '"><span class="tick' + (s[0] ? " done" : "") + '">' + (s[0] ? ICON.check : "") + '</span><span><span class="t">' + s[2] + '</span><br><span class="d">' + s[3] + "</span></span></a>"; }).join("") +
      "</div></section></div>";

    var top = rankedCareers(myGroup()).filter(function (x) { return x.m != null; }).slice(0, 4);
    h += '<div class="grid-2" style="margin-top:20px"><section class="panel"><div class="panel-title"><h2>Your closest matches</h2><a class="small" href="#/careers">See all</a></div>' +
      (top.length ? '<div class="career-list">' + top.map(careerRowCompact).join("") + "</div>" : '<div class="empty"><p>Take the interest profiler to see which of the 32 careers fit you best.</p></div>') + "</section>";

    var roadDone = S.roadmap.filter(function (x) { return x.done; }).length;
    h += '<div class="stack"><section class="panel"><div class="panel-title"><h2>Roadmap</h2><a class="small" href="#/roadmap">Open</a></div>' +
      (S.roadmap.length ? '<div class="bar-row"><span>' + roadDone + " of " + S.roadmap.length + " steps</span>" + bar(roadDone, S.roadmap.length) + '<span class="bar-val">' + round(roadDone / S.roadmap.length * 100) + "%</span></div>" +
        (S.roadmap.filter(function (x) { return !x.done; })[0] ? '<p class="small">Next: <b>' + esc(S.roadmap.filter(function (x) { return !x.done; })[0].title) + "</b></p>" : '<p class="small">All steps done. Add a new one.</p>')
        : '<p class="muted small">No roadmap yet. Open a career and choose "Start roadmap".</p>') + "</section>";

    h += '<section class="panel"><div class="panel-title"><h2>Marks</h2><a class="small" href="#/profile">Edit</a></div>' +
      (S.marks.length ? S.marks.slice(0, 6).map(function (m) { return '<div class="bar-row"><span>' + esc(m.subject) + "</span>" + bar(Number(m.score), 100, Number(m.score) < 50 ? "brass" : "") + '<span class="bar-val">' + round(Number(m.score)) + "</span></div>"; }).join("") +
        (p.cgpa ? '<p class="small muted">CGPA ' + Number(p.cgpa).toFixed(2) + "</p>" : "")
        : '<p class="muted small">Add subject marks in your profile to see them here. Marks are for your own reflection; they don\'t change your career matches.</p>') + "</section>";

    var g = myGroup(), isr = g && ISR.branches.filter(function (b) { return b.group === g; })[0];
    h += '<section class="panel"><div class="panel-title"><h2>India context</h2><span class="meta">' + ISR.edition + "</span></div>" +
      (isr ? "<p><b>" + isr.value + "%</b> of " + esc(isr.label) + " graduates tested were rated employable, against " + ISR.btech + "% for all B.E./B.Tech and " + ISR.national + "% nationally.</p>"
        : "<p>Across India, " + ISR.btech + "% of B.E./B.Tech graduates tested were rated employable (" + ISR.national + "% for all graduates).</p>") +
      '<p class="small muted" style="margin-top:8px"><a href="#/insights">See the branch comparison</a></p></section></div></div>';
    return h;
  };

  function careerRowCompact(x) {
    return '<a class="career-row" href="#/career/' + x.c.code + '" style="grid-template-columns:56px minmax(0,1fr)"><div class="score">' + x.m + "<small>match</small></div><div><h3>" + esc(x.c.name) + '</h3><p>' + esc(x.c.titles.slice(0, 3).join(", ")) + "</p></div></a>";
  }

  /* Profile */
  VIEWS.profile = function () {
    var p = S.profile || {};
    var opts = window.CP_BRANCHES.map(function (b) { return "<option" + (p.branch === b[0] ? " selected" : "") + ">" + esc(b[0]) + "</option>"; }).join("");
    var marks = S.marks.length ? S.marks : [{ subject: "", score: "" }];
    return '<header class="page-head"><h1>Your profile</h1><p>This decides which careers we show first and how your branch compares. Only you can see it.</p></header>' +
      '<form id="f-profile" class="stack" novalidate><section class="panel"><div class="panel-title"><h2>About you</h2></div><div class="form-grid">' +
      '<div class="field"><label for="p-name">Name</label><input class="input" id="p-name" maxlength="80" value="' + esc(p.full_name || "") + '"></div>' +
      '<div class="field"><label for="p-branch">Branch / programme</label><select class="input" id="p-branch"><option value="">Choose your branch</option>' + opts + "</select></div>" +
      '<div class="field"><label for="p-year">Year of study</label><select class="input" id="p-year"><option value="">Choose</option>' + [1, 2, 3, 4, 5].map(function (y) { return '<option value="' + y + '"' + (p.year_of_study == y ? " selected" : "") + ">Year " + y + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="p-cgpa">CGPA (optional)</label><input class="input" id="p-cgpa" type="number" min="0" max="10" step="0.01" inputmode="decimal" value="' + (p.cgpa != null ? esc(p.cgpa) : "") + '"></div>' +
      '<div class="field span-2"><label for="p-goal">A goal you want to work towards</label><input class="input" id="p-goal" maxlength="160" placeholder="e.g. Build my first embedded project this semester" value="' + esc(p.goal || "") + '"></div>' +
      '</div></section><section class="panel"><div class="panel-title"><h2>Subject marks</h2><span class="meta">Out of 100, optional</span></div><div id="marks">' +
      marks.map(markRow).join("") + '</div><button type="button" class="btn btn-ghost btn-sm" data-action="add-mark">Add a subject</button>' +
      '<p class="small muted" style="margin-top:12px">Marks are only shown back to you. They are not used to rank careers, because marks alone don\'t say what you\'ll enjoy or be good at.</p></section>' +
      '<p class="error-text" id="p-err" role="alert"></p><div><button class="btn btn-primary" type="submit">Save profile</button></div></form>';
  };
  function markRow(m) {
    return '<div class="mark-row"><input class="input" aria-label="Subject" placeholder="Subject, e.g. Digital Logic" maxlength="60" value="' + esc(m.subject || "") + '" data-k="subject"><input class="input" aria-label="Mark out of 100" type="number" min="0" max="100" inputmode="decimal" placeholder="Mark" value="' + (m.score !== "" && m.score != null ? esc(m.score) : "") + '" data-k="score"><button type="button" class="icon-btn" data-action="del-mark" aria-label="Remove subject">' + ICON.x + "</button></div>";
  }
  function saveProfile(f) {
    var err = $("#p-err"); err.textContent = "";
    var branch = $("#p-branch").value, grp = null;
    window.CP_BRANCHES.forEach(function (b) { if (b[0] === branch) grp = b[1]; });
    var cg = $("#p-cgpa").value;
    if (cg !== "" && (Number(cg) < 0 || Number(cg) > 10)) { err.textContent = "CGPA must be between 0 and 10."; return; }
    var rows = $all("#marks .mark-row").map(function (r) { return { subject: $("[data-k=subject]", r).value.trim(), score: $("[data-k=score]", r).value }; })
      .filter(function (r) { return r.subject || r.score !== ""; });
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].subject) { err.textContent = "Give every mark a subject name."; return; }
      var n = Number(rows[i].score);
      if (rows[i].score === "" || !isFinite(n) || n < 0 || n > 100) { err.textContent = "Marks must be numbers from 0 to 100 (" + rows[i].subject + ")."; return; }
    }
    var patch = { full_name: $("#p-name").value.trim(), branch: branch || null, branch_group: grp, year_of_study: $("#p-year").value ? Number($("#p-year").value) : null, cgpa: cg === "" ? null : Number(cg), goal: $("#p-goal").value.trim() || null };
    var btn = $("button[type=submit]", f); btn.disabled = true;
    sb.from("profiles").update(patch).eq("id", S.user.id).then(function (r) {
      if (r.error) throw r.error;
      Object.assign(S.profile, patch);
      return sb.from("marks").delete().eq("user_id", S.user.id);
    }).then(function (r) {
      if (r.error) throw r.error;
      if (!rows.length) return { data: [] };
      return sb.from("marks").insert(rows.map(function (x) { return { subject: x.subject, score: Number(x.score) }; })).select();
    }).then(function (r) {
      if (r.error) throw r.error;
      S.marks = r.data || []; btn.disabled = false; toast("Profile saved"); renderShellNav("profile");
    }).catch(function (e) { btn.disabled = false; err.textContent = "Couldn't save: " + (e.message || e) + ". Check your connection and try again."; });
  }

  /* Interest profiler */
  var ipPage = 0;
  function ipDraft() {
    try { var d = JSON.parse(lsGet("cp-ip-draft-" + S.user.id) || "null"); if (Array.isArray(d) && d.length === 60) return d; } catch (e) { }
    var saved = S.assessment && S.assessment.interest_answers;
    return Array.isArray(saved) && saved.length === 60 ? saved.slice() : new Array(60).fill(null);
  }
  VIEWS.interests = function (arg) {
    var a = S.assessment;
    if (a && a.riasec && arg !== "retake") return interestResults();
    var ans = ipDraft(), start = ipPage * 10, answered = ans.filter(function (x) { return x != null; }).length;
    var h = '<header class="page-head"><h1>What would you enjoy doing?</h1><p>For each activity, say whether you\'d like doing it. Don\'t think about pay or how much training it needs. There are no right answers.</p></header>' +
      '<section class="panel"><div class="panel-title"><h2>Questions ' + (start + 1) + "–" + (start + 10) + ' of 60</h2><span class="meta">' + answered + " answered</span></div>" +
      '<div class="progress" aria-hidden="true"><i style="width:' + (answered / 60 * 100) + '%"></i></div><div style="margin-top:8px">';
    for (var i = start; i < start + 10; i++) {
      h += '<div class="ip-item"><span class="q" id="q' + i + '">' + esc(ITEMS[i].text) + '</span><span class="seg" role="group" aria-labelledby="q' + i + '">' +
        [[2, "Like"], [1, "Not sure"], [0, "Dislike"]].map(function (o) { return '<button type="button" data-action="ip" data-i="' + i + '" data-v="' + o[0] + '" aria-pressed="' + (ans[i] === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</span></div>";
    }
    h += '</div><div class="ip-nav"><button class="btn btn-ghost" data-action="ip-prev"' + (ipPage === 0 ? " disabled" : "") + ">Back</button>" +
      (ipPage < 5 ? '<button class="btn btn-primary" data-action="ip-next">Next 10</button>' : '<button class="btn btn-primary" data-action="ip-finish">See my results</button>') + "</div>" +
      '<p class="small muted" style="margin-top:14px">Questions from the O*NET Interest Profiler Short Form, U.S. Department of Labor. <a href="sources.html#interest-profiler">How scoring works</a></p></section>';
    return h;
  };
  function interestResults() {
    var r = S.assessment.riasec, code = topCode(r);
    var h = '<header class="page-head"><h1>Your interest code is ' + code + '</h1><p>These are the three kinds of work you said you\'d enjoy most, in order. Your matches on the Careers page use the whole profile, not just the top three.</p></header>' +
      '<section class="panel">' + pulseSVG(r, { animate: true, label: "Your interest scores" }) + "</section>" +
      '<div class="grid-3" style="margin-top:20px">' + code.split("").map(function (k, i) {
        return '<section class="panel"><p class="small muted">' + ["Strongest", "Second", "Third"][i] + "</p><h2 style=\"margin:4px 0 8px\">" + RIASEC[k].name + " · " + r[k] + '</h2><p class="muted">' + RIASEC[k].blurb + "</p></section>";
      }).join("") + "</div>" +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px"><a class="btn btn-primary" href="#/careers">See matching careers</a><a class="btn btn-ghost" href="#/skills">Rate your skills next</a><a class="btn btn-ghost" href="#/interests/retake">Retake</a></div>';
    return h;
  }
  function ipFinish() {
    var ans = ipDraft(), missing = ans.map(function (v, i) { return v == null ? i : -1; }).filter(function (i) { return i >= 0; });
    if (missing.length) { ipPage = Math.floor(missing[0] / 10); toast(missing.length + " question" + (missing.length > 1 ? "s" : "") + " left. Answer them to see results."); render(); return; }
    var riasec = riasecFromAnswers(ans), row = { user_id: S.user.id, interest_answers: ans, riasec: riasec, interests_done_at: new Date().toISOString() };
    sb.from("assessments").upsert(row, { onConflict: "user_id" }).select().single().then(function (r) {
      if (r.error) { toast("Couldn't save: " + r.error.message); return; }
      S.assessment = r.data; lsDel("cp-ip-draft-" + S.user.id); ipPage = 0; go("interests");
    });
  }

  /* Skills */
  VIEWS.skills = function () {
    var ratings = (S.assessment && S.assessment.ratings) || {};
    function rows(keys) {
      return keys.map(function (k) {
        return '<div class="rate-row"><div><div class="t">' + esc(k) + '</div><div class="d">' + esc(window.CP_DEFS[k] || "") + '</div></div><div class="dots" role="group" aria-label="' + esc(k) + ' rating">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-action="rate" data-k="' + esc(k) + '" data-v="' + n + '" aria-pressed="' + (ratings[k] === n) + '">' + n + "</button>"; }).join("") + "</div></div>";
      }).join("");
    }
    var n = ALL_KEYS.filter(function (k) { return ratings[k]; }).length;
    return '<header class="page-head"><h1>Where are you now?</h1><p>Rate yourself from 1 (just starting) to 5 (very confident). Be honest; low numbers are useful because they show what to work on. These are the 12 skills and 10 knowledge areas O*NET uses to describe engineering jobs.</p></header>' +
      '<div class="grid-2"><section class="panel"><div class="panel-title"><h2>Skills</h2><span class="meta">1 new · 5 confident</span></div>' + rows(D.skillKeys) + "</section>" +
      '<section class="panel"><div class="panel-title"><h2>Knowledge</h2><span class="meta">1 new · 5 confident</span></div>' + rows(D.knowKeys) + "</section></div>" +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px"><button class="btn btn-primary" data-action="save-ratings">Save ratings</button><span class="muted small" id="rate-count">' + n + " of " + ALL_KEYS.length + " rated</span></div>";
  };
  var pendingRatings = null;
  function saveRatings() {
    var ratings = Object.assign({}, (S.assessment && S.assessment.ratings) || {}, pendingRatings || {});
    if (!Object.keys(ratings).length) { toast("Rate at least one skill first"); return; }
    sb.from("assessments").upsert({ user_id: S.user.id, ratings: ratings, ratings_done_at: new Date().toISOString() }, { onConflict: "user_id" }).select().single().then(function (r) {
      if (r.error) { toast("Couldn't save: " + r.error.message); return; }
      S.assessment = r.data; pendingRatings = null; toast("Ratings saved"); go("careers");
    });
  }

  /* Careers */
  var careerFilter = null, careerSort = "match", careerQuery = "";
  VIEWS.careers = function () {
    if (careerFilter === null) careerFilter = myGroup() || "all";
    var g = careerFilter === "all" ? null : careerFilter;
    var list = rankedCareers(g);
    if (careerQuery) { var q = careerQuery.toLowerCase(); list = list.filter(function (x) { return (x.c.name + " " + x.c.titles.join(" ") + " " + x.c.desc).toLowerCase().indexOf(q) >= 0; }); }
    if (careerSort === "fit") list.sort(function (a, b) { return (b.f || 0) - (a.f || 0); });
    if (careerSort === "ready") list.sort(function (a, b) { return (b.r || 0) - (a.r || 0); });
    if (careerSort === "az") list.sort(function (a, b) { return a.c.name.localeCompare(b.c.name); });
    var groups = ["all"].concat(Object.keys(window.CP_GROUPS).filter(function (k) { return k !== "other"; }));
    var noData = !(S.assessment && (S.assessment.riasec || S.assessment.ratings));
    var h = '<header class="page-head"><h1>Explore careers</h1><p>32 careers across engineering branches, described with data from O*NET. Match combines how well your interests fit (60%) and how ready your skills are (40%).</p></header>' +
      (noData ? '<p class="notice" style="margin-bottom:16px">Take the <a href="#/interests">interest profiler</a> and <a href="#/skills">rate your skills</a> to see your match scores.</p>' : "") +
      '<div class="filters"><input class="input" type="search" id="c-search" placeholder="Search careers or job titles" value="' + esc(careerQuery) + '" aria-label="Search careers">' +
      '<select class="input" id="c-sort" style="max-width:200px" aria-label="Sort by"><option value="match"' + (careerSort === "match" ? " selected" : "") + '>Best match</option><option value="fit"' + (careerSort === "fit" ? " selected" : "") + '>Interest fit</option><option value="ready"' + (careerSort === "ready" ? " selected" : "") + '>Skill readiness</option><option value="az"' + (careerSort === "az" ? " selected" : "") + ">A to Z</option></select></div>" +
      '<div class="filters" role="group" aria-label="Filter by branch">' + groups.map(function (k) { return '<button class="chip" data-action="cfilter" data-g="' + k + '" aria-pressed="' + (careerFilter === k) + '">' + (k === "all" ? "All branches" : window.CP_GROUPS[k]) + (k === myGroup() ? " (yours)" : "") + "</button>"; }).join("") + "</div>" +
      '<p class="small muted" style="margin-bottom:10px">' + list.length + " careers</p><div class=\"career-list\">" +
      list.map(function (x) {
        return '<a class="career-row" href="#/career/' + x.c.code + '"><div class="score">' + (x.m == null ? "–" : x.m) + "<small>match</small></div>" +
          "<div><h3>" + esc(x.c.name) + (S.saved[x.c.code] ? ' <span class="chip brass" style="font-size:12px;padding:2px 8px;vertical-align:middle">Saved</span>' : "") + "</h3><p>" + esc(x.c.desc) + "</p></div>" +
          '<div class="mini"><span>Interest fit ' + (x.f == null ? "–" : x.f) + "</span>" + bar(x.f || 0, 100) + "<span>Readiness " + (x.r == null ? "–" : x.r) + "</span>" + bar(x.r || 0, 100, "brass") + "</div>" +
          '<div class="side small muted">' + topCode(x.c.riasec) + " interests<br>Job zone " + x.c.zone + "</div></a>";
      }).join("") + (list.length ? "" : '<div class="empty"><h3>No careers match that search</h3><p>Try a broader word, or choose All branches.</p></div>') + "</div>";
    return h;
  };
  AFTER.careers = function () {
    var s = $("#c-search"); if (s) s.addEventListener("input", function () { careerQuery = s.value; var pos = s.selectionStart; render(); var n = $("#c-search"); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } });
    var o = $("#c-sort"); if (o) o.addEventListener("change", function () { careerSort = o.value; render(); });
  };

  VIEWS.career = function (code) {
    var c = BY_CODE[code]; if (!c) return '<div class="empty"><h3>Career not found</h3><a class="btn btn-primary" href="#/careers">Back to careers</a></div>';
    var m = match(c), f = interestFit(c), rd = readiness(c), ratings = (S.assessment && S.assessment.ratings) || {}, mine = S.assessment && S.assessment.riasec;
    var h = '<p><a href="#/careers" class="small">All careers</a></p><header class="page-head detail-head"><div><h1>' + esc(c.name) + '</h1><p class="code-tag">O*NET-SOC ' + c.code + " · Job zone " + c.zone + "</p><p>" + esc(c.desc) + '</p><div class="branch-strip">' +
      c.branches.map(function (b) { return '<span class="chip' + (b === myGroup() ? " brass" : "") + '">' + window.CP_GROUPS[b] + "</span>"; }).join("") + "</div>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn ' + (S.saved[code] ? "btn-ghost" : "btn-primary") + '" data-action="save-career" data-code="' + code + '">' + ICON.bookmark + (S.saved[code] ? " Saved" : " Save to shortlist") + '</button><button class="btn btn-ghost" data-action="start-road" data-code="' + code + '">Start roadmap for this</button></div></div>' +
      '<div class="big">' + (m == null ? "–" : m) + "<small>overall match</small></div></header>";

    h += '<div class="grid-2"><section class="panel"><div class="panel-title"><h2>Interests</h2><span class="meta">Fit ' + (f == null ? "–" : f + "/100") + "</span></div>" +
      '<div class="legend"><span><i></i>This career (O*NET)</span>' + (mine ? '<span><i class="brass"></i>You</span>' : "") + "</div>" +
      pulseSVG(c.riasec, { compact: true, compare: mine || null, label: "Interest profile of " + c.name }) +
      '<p class="small muted">Fit is the Pearson correlation between your six scores and this career\'s, × 100 (below 0 counts as 0). It compares which areas are high and low, not the overall level.</p></section>';

    var req = requirements(c);
    h += '<section class="panel"><div class="panel-title"><h2>What it asks of you</h2><span class="meta">Readiness ' + (rd == null ? "–" : rd + "/100") + "</span></div>" +
      '<div class="legend"><span><i></i>Your rating</span><span><i class="line"></i>Level this job expects</span></div>' +
      req.slice(0, 12).map(function (q) {
        var have = ratings[q.key] || 0;
        return '<div class="bar-row"><span title="' + esc(window.CP_DEFS[q.key] || "") + '">' + esc(q.key) + "</span>" + bar(have, 5, have >= q.target ? "" : "brass", q.target) + '<span class="bar-val">' + (have || "–") + "/" + q.target.toFixed(1) + "</span></div>";
      }).join("") +
      (Object.keys(ratings).length ? "" : '<p class="small"><a href="#/skills">Rate your skills</a> to compare.</p>') +
      '<p class="small muted">Expected level = O*NET importance converted back to its 1–5 scale. Only items rated "important" or higher (≥3) are listed.</p></section></div>';

    h += '<div class="grid-3" style="margin-top:20px"><section class="panel"><h2 style="font-size:18px;margin-bottom:12px">Typical tasks</h2><ul class="clean">' + c.tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>" +
      '<section class="panel"><h2 style="font-size:18px;margin-bottom:12px">Job titles you\'ll see</h2><div class="branch-strip" style="margin-top:0">' + c.titles.map(function (t) { return '<span class="chip outline">' + esc(t) + "</span>"; }).join("") + "</div></section>" +
      '<section class="panel"><h2 style="font-size:18px;margin-bottom:12px">Tools used</h2>' + (c.tools.length ? '<div class="branch-strip" style="margin-top:0">' + c.tools.map(function (t) { return '<span class="chip outline">' + esc(t) + "</span>"; }).join("") + "</div>" : '<p class="muted small">Not listed.</p>') + "</section></div>";

    h += '<section class="panel" style="margin-top:20px"><div class="panel-title"><h2>Starter roadmap</h2><span class="meta">Campus Pulse suggestion</span></div><ol style="margin:0;padding-left:20px;display:grid;gap:8px">' + c.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
      '<button class="btn btn-primary" style="margin-top:16px" data-action="start-road" data-code="' + code + '">Use these steps</button></section>';
    h += '<p class="small muted" style="margin-top:16px">Source: <a href="https://www.onetonline.org/link/summary/' + c.code + '" target="_blank" rel="noopener">O*NET OnLine, ' + c.code + "</a>, U.S. Department of Labor (CC BY 4.0). O*NET describes U.S. jobs; day-to-day work in India is similar, but pay and hiring differ.</p>";
    return h;
  };

  /* Roadmap */
  VIEWS.roadmap = function () {
    var items = S.roadmap, done = items.filter(function (x) { return x.done; }).length;
    var h = '<header class="page-head"><h1>Your roadmap</h1><p>' + (S.profile && S.profile.goal ? "Goal: <b>" + esc(S.profile.goal) + "</b>. " : "") + "Small, concrete steps. Tick them off as you go.</p></header>";
    if (!items.length) {
      var picks = Object.keys(S.saved).map(function (k) { return BY_CODE[k]; }).filter(Boolean);
      if (!picks.length) picks = rankedCareers(myGroup()).slice(0, 3).map(function (x) { return x.c; });
      return h + '<section class="panel"><div class="empty"><h3>Pick a career to start with</h3><p>We\'ll add four starter steps you can edit.</p></div><div class="career-list">' +
        picks.map(function (c) { return '<div class="career-row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(c.name) + "</h3><p>" + esc(c.steps[0]) + '</p></div><button class="btn btn-primary btn-sm" data-action="start-road" data-code="' + c.code + '">Start</button></div>'; }).join("") +
        '</div><p class="small muted" style="margin-top:14px">Or <a href="#/careers">browse all careers</a>.</p></section>';
    }
    var careers = {}; items.forEach(function (x) { if (x.career_code) careers[x.career_code] = true; });
    h += '<section class="panel"><div class="panel-title"><h2>' + Object.keys(careers).map(function (k) { return BY_CODE[k] ? esc(BY_CODE[k].name) : ""; }).filter(Boolean).join(" + ") + '</h2><span class="meta">' + done + " of " + items.length + " done</span></div>" +
      '<div class="progress"><i style="width:' + (done / items.length * 100) + '%"></i></div><div class="road">' +
      items.map(function (x) {
        return '<div class="road-item' + (x.done ? " done" : "") + '"><input type="checkbox" data-action="road-toggle" data-id="' + x.id + '" aria-label="Mark done: ' + esc(x.title) + '"' + (x.done ? " checked" : "") + '><div><div class="t">' + esc(x.title) + "</div>" + (x.detail ? '<div class="d">' + esc(x.detail) + "</div>" : "") + '</div><div class="actions"><button class="icon-btn" data-action="road-del" data-id="' + x.id + '" aria-label="Remove step">' + ICON.x + "</button></div></div>";
      }).join("") + "</div>" +
      '<form id="f-road-add" style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap" novalidate><input class="input" id="road-new" maxlength="160" placeholder="Add your own step" style="flex:1 1 240px" aria-label="New step"><button class="btn btn-primary" type="submit">Add step</button></form></section>' +
      '<p style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="road-clear">Start over with a different career</button></p>';
    return h;
  };
  function startRoad(code) {
    var c = BY_CODE[code]; if (!c) return;
    var base = S.roadmap.length;
    var rows = c.steps.map(function (s, i) { return { career_code: code, title: s, position: base + i }; });
    sb.from("roadmap_items").insert(rows).select().then(function (r) {
      if (r.error) { toast("Couldn't add steps: " + r.error.message); return; }
      S.roadmap = S.roadmap.concat(r.data); toast("Added " + rows.length + " steps"); go("roadmap");
    });
  }
  function addRoadItem(f) {
    var v = $("#road-new").value.trim(); if (!v) return;
    sb.from("roadmap_items").insert({ title: v, position: S.roadmap.length, career_code: (S.roadmap[0] && S.roadmap[0].career_code) || null }).select().single().then(function (r) {
      if (r.error) { toast("Couldn't add: " + r.error.message); return; }
      S.roadmap.push(r.data); render(); var n = $("#road-new"); if (n) n.focus();
    });
  }

  /* Insights */
  VIEWS.insights = function () {
    var a = S.assessment || {}, h = '<header class="page-head"><h1>Insights</h1><p>Your results next to everyone else using Campus Pulse, the O*NET career data, and national figures from the India Skills Report.</p></header>';
    h += '<div class="grid-2"><section class="panel"><div class="panel-title"><h2>You vs other students</h2><span class="meta" id="cohort-n">Loading…</span></div><div id="cohort-pulse">' +
      (a.riasec ? pulseSVG(a.riasec, { compact: true }) : '<p class="muted">Take the <a href="#/interests">interest profiler</a> to compare yourself.</p>') + '</div><div class="legend"><span><i></i>You</span><span><i class="brass"></i>Campus Pulse average</span></div><p class="small muted" id="cohort-note"></p></section>';
    h += '<section class="panel"><div class="panel-title"><h2>Employability by branch</h2><span class="meta">' + ISR.edition + "</span></div>" + isrChart() +
      '<p class="small muted">Share of graduates rated employable on the Global Employability Test (ETS, with CII, AICTE, AIU and Taggd; 1 lakh+ candidates). Branches not reported are not shown.</p></section></div>';
    h += '<section class="panel" style="margin-top:20px"><div class="panel-title"><h2>Interest fit vs skill readiness</h2><span class="meta">All 32 careers</span></div>' + scatter() + "</section>";
    h += '<section class="panel" style="margin-top:20px"><div class="panel-title"><h2>What careers in your branch demand</h2><span class="meta">O*NET importance, 0–100</span></div><div class="scroll-x">' + heatmap() + "</div></section>";
    h += '<section class="panel" style="margin-top:20px"><div class="panel-title"><h2>Your skill ratings vs average</h2><span class="meta" id="skills-n"></span></div><div id="skills-compare">' + skillsCompare(null) + "</div></section>";
    return h;
  };
  AFTER.insights = function () {
    sb.rpc("cohort_stats").then(function (r) {
      if (r.error) { $("#cohort-n").textContent = "Unavailable"; return; }
      var c = r.data || {}; S.cohort = c;
      $("#cohort-n").textContent = (c.users || 0) + " students signed up";
      var a = S.assessment || {};
      if (c.riasec && a.riasec) { $("#cohort-pulse").innerHTML = pulseSVG(a.riasec, { compact: true, compare: c.riasec }); }
      var g = myGroup(), bb = g && c.by_branch && c.by_branch[g];
      $("#cohort-note").textContent = c.riasec ? "Average of " + c.n_interest + " students who finished the profiler." + (bb ? " Your branch (" + bb.n + " students): code " + topCode(bb.riasec) + "." : "") : "The average appears once at least 5 students have finished the profiler, so no one can be identified (" + (c.n_interest || 0) + " so far).";
      if (c.skills) { $("#skills-compare").innerHTML = skillsCompare(c.skills); $("#skills-n").textContent = c.n_ratings + " students"; }
      else $("#skills-n").textContent = "Average shows after 5 students";
    });
  };
  function isrChart() {
    var rows = ISR.branches.slice().concat([{ label: "All B.E./B.Tech", value: ISR.btech, all: true }, { label: "All graduates (national)", value: ISR.national, all: true }]);
    return rows.map(function (b) { var mine = b.group && b.group === myGroup(); return '<div class="bar-row"><span' + (mine ? ' style="font-weight:750;color:var(--ink)"' : "") + ">" + esc(b.label) + (mine ? " (you)" : "") + "</span>" + bar(b.value, 100, b.all ? "brass" : "") + '<span class="bar-val">' + b.value + "%</span></div>"; }).join("");
  }
  function scatter() {
    var pts = CAREERS.map(function (c) { return { c: c, f: interestFit(c), r: readiness(c) }; });
    if (pts.every(function (p) { return p.f == null || p.r == null; })) return '<p class="muted">Finish the <a href="#/interests">interest profiler</a> and <a href="#/skills">skill ratings</a> to see where every career sits for you.</p>';
    var W = 680, H = 380, L = 50, B = 44, T = 16, R = 16, iw = W - L - R, ih = H - T - B;
    var s = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Scatter of interest fit against readiness for each career">';
    [0, 25, 50, 75, 100].forEach(function (v) { var x = L + v / 100 * iw, y = T + ih - v / 100 * ih; s += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v + '</text><text x="' + x + '" y="' + (H - B + 18) + '" text-anchor="middle">' + v + "</text>"; });
    s += '<text x="' + (L + iw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="lbl">Interest fit</text><text transform="translate(14 ' + (T + ih / 2) + ') rotate(-90)" text-anchor="middle" class="lbl">Skill readiness</text>';
    var ranked = pts.filter(function (p) { return p.f != null && p.r != null; }).sort(function (a, b) { return (0.6 * b.f + 0.4 * b.r) - (0.6 * a.f + 0.4 * a.r); });
    ranked.forEach(function (p, i) {
      var x = L + p.f / 100 * iw, y = T + ih - p.r / 100 * ih;
      s += '<a href="#/career/' + p.c.code + '"><circle class="dot' + (i < 5 ? " mine" : "") + '" cx="' + x + '" cy="' + y + '" r="' + (i < 5 ? 7 : 5) + '"><title>' + esc(p.c.name) + ": fit " + p.f + ", readiness " + p.r + "</title></circle>" +
        (i < 5 ? '<text x="' + (x > L + iw * 0.6 ? x - 10 : x + 10) + '" y="' + (y + 4) + '" text-anchor="' + (x > L + iw * 0.6 ? "end" : "start") + '" class="lbl" style="font-weight:650">' + esc(p.c.name.split(" (")[0].split(" /")[0]) + "</text>" : "") + "</a>";
    });
    return s + '</svg><p class="small muted">Each dot is a career. Top-right careers fit your interests and your current skills. Gold dots are your top 5 matches; tap a dot to open it.</p>';
  }
  function heatmap() {
    var g = myGroup(), list = CAREERS.filter(function (c) { return !g || c.branches.indexOf(g) >= 0; });
    var keys = D.skillKeys.concat(D.knowKeys.slice(0, 6)), dark = isDark();
    function cell(v) { var a = Math.max(0.06, v / 100); return '<td style="background:rgba(' + (dark ? "43,209,150" : "11,122,85") + "," + a.toFixed(2) + ");color:" + (v >= 60 ? (dark ? "#03140d" : "#fff") : "var(--ink-2)") + '">' + v + "</td>"; }
    return '<table class="heat"><thead><tr><th></th>' + keys.map(function (k) { return '<th class="rot"><div>' + esc(k) + "</div></th>"; }).join("") + "</tr></thead><tbody>" +
      list.map(function (c) {
        var vals = c.skills.concat(c.know.slice(0, 6));
        return '<tr><td class="name"><a href="#/career/' + c.code + '">' + esc(c.name) + "</a></td>" + vals.map(cell).join("") + "</tr>";
      }).join("") + "</tbody></table>" + '<p class="small muted">' + (g ? "Careers linked to " + window.CP_GROUPS[g] + ". " : "") + "Darker means more important to the job. 50+ means rated important or higher.</p>";
  }
  function skillsCompare(avg) {
    var r = S.assessment && S.assessment.ratings; if (!r) return '<p class="muted"><a href="#/skills">Rate your skills</a> to see this.</p>';
    return '<div class="legend"><span><i></i>You</span>' + (avg ? '<span><i class="line"></i>Average</span>' : "") + "</div>" + ALL_KEYS.filter(function (k) { return r[k]; }).map(function (k) {
      return '<div class="bar-row"><span>' + esc(k) + "</span>" + bar(r[k], 5, "", avg && avg[k] ? Number(avg[k]) : null) + '<span class="bar-val">' + r[k] + (avg && avg[k] ? '<span class="muted" style="font-weight:500"> /' + Number(avg[k]).toFixed(1) + "</span>" : "") + "</span></div>";
    }).join("");
  }

  /* Settings */
  var BGS = [["silk", "Silk"], ["contour", "Contour"], ["aurora", "Aurora"], ["grid", "Dots"], ["velvet", "Velvet"], ["plain", "Plain"]];
  function swatchesHTML() {
    var look = currentLook();
    return '<div class="swatches">' + BGS.map(function (b) { return '<button class="swatch" data-action="bg" data-bg="' + b[0] + '" aria-pressed="' + (look.bg === b[0]) + '"><div class="prev" data-bgprev="' + b[0] + '"></div>' + b[1] + "</button>"; }).join("") +
      '<label class="swatch" aria-pressed="' + (look.bg === "custom") + '" style="display:block"><div class="prev" style="background:' + esc(look.custom) + '"></div>Your colour<input type="color" id="bg-custom" value="' + esc(look.custom) + '" class="sr-only"></label></div>';
  }
  VIEWS.settings = function () {
    var look = currentLook();
    return '<header class="page-head"><h1>Settings</h1><p>Your look follows you to any device you sign in on.</p></header><div class="stack">' +
      '<section class="panel"><div class="panel-title"><h2>Appearance</h2></div><p class="label" style="margin-bottom:8px">Mode</p><div class="seg-theme" role="group" aria-label="Colour mode">' +
      [["system", "Match device"], ["light", "Light"], ["dark", "Dark"]].map(function (t) { return '<button class="chip" data-action="theme" data-t="' + t[0] + '" aria-pressed="' + (look.theme === t[0]) + '">' + t[1] + "</button>"; }).join("") +
      '</div><p class="label" style="margin:20px 0 8px">Background</p>' + swatchesHTML() + "</section>" +
      '<section class="panel"><div class="panel-title"><h2>Account</h2></div><p>Signed in as <b>' + esc(S.user.email) + '</b></p>' +
      '<form id="f-pass" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px" novalidate><input class="input" type="password" id="new-pass" autocomplete="new-password" minlength="8" placeholder="New password (8+ characters)" style="flex:1 1 240px" aria-label="New password"><button class="btn btn-ghost" type="submit">Change password</button></form>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="btn btn-ghost" data-action="signout">Sign out</button><button class="btn btn-ghost" data-action="export">Download my data</button></div></section>' +
      '<section class="panel"><div class="panel-title"><h2>Delete account</h2></div><p class="muted">This permanently deletes your account, profile, marks, answers, shortlist and roadmap. It can\'t be undone.</p><button class="btn btn-danger" style="margin-top:14px" data-action="delete-account">Delete my account</button></section></div>';
  };
  AFTER.settings = function () {
    var c = $("#bg-custom"); if (c) c.addEventListener("input", function () { setLook("custom", c.value); });
    paintSwatches();
  };
  function paintSwatches() {
    $all("[data-bgprev]").forEach(function (el) {
      var b = el.getAttribute("data-bgprev"), cs = getComputedStyle(document.body);
      var tmp = document.createElement("div"); tmp.setAttribute("data-bg", b);
      el.style.backgroundImage = b === "plain" ? "none" : bgImageFor(b);
      el.style.backgroundSize = b === "grid" ? "8px 8px" : b === "contour" ? "160px 160px" : "cover";
    });
  }
  function bgImageFor(b) {
    var e = "var(--emerald)", br = "var(--brass)";
    if (b === "silk") return "radial-gradient(80px 50px at 100% 0%, color-mix(in srgb," + e + " 45%, transparent), transparent), radial-gradient(70px 50px at 0% 100%, color-mix(in srgb," + br + " 35%, transparent), transparent)";
    if (b === "aurora") return "radial-gradient(60% 60% at 20% 10%, color-mix(in srgb," + e + " 50%, transparent), transparent 70%), radial-gradient(60% 60% at 80% 90%, color-mix(in srgb," + br + " 40%, transparent), transparent 70%)";
    if (b === "grid") return "radial-gradient(color-mix(in srgb," + e + " 55%, transparent) 1px, transparent 1.4px)";
    if (b === "velvet") return "linear-gradient(160deg, color-mix(in srgb," + e + " 30%, var(--bg)), var(--bg) 50%, color-mix(in srgb," + br + " 25%, var(--bg)))";
    if (b === "contour") return getComputedStyle(document.documentElement).getPropertyValue("--x") || "repeating-radial-gradient(circle at 30% 40%, transparent 0 9px, color-mix(in srgb," + e + " 30%, transparent) 9px 10px)";
    return "none";
  }

  /* ---------- click handling ---------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-action]"); if (!t) return;
    var act = t.getAttribute("data-action");
    if (act === "theme-toggle") { setLook("theme", isDark() ? "light" : "dark"); if (S.user && !$("#app").hidden) { renderShellNav(parseHash().name); if (parseHash().name === "settings" || parseHash().name === "insights") render(); } updateLandingThemeBtn(); return; }
    if (act === "bg-pop") { var p = $("#bg-pop"); p.hidden = !p.hidden; if (!p.hidden) { p.innerHTML = '<p class="label" style="margin-bottom:10px">Background</p>' + swatchesHTML(); var c = $("#bg-pop #bg-custom"); if (c) c.addEventListener("input", function () { setLook("custom", c.value); }); paintSwatches(); } return; }
    if (act === "theme") { setLook("theme", t.getAttribute("data-t")); render(); return; }
    if (act === "bg") { setLook("bg", t.getAttribute("data-bg")); $all('[data-action="bg"]').forEach(function (b) { b.setAttribute("aria-pressed", b === t); }); return; }
    if (act === "ip") {
      var i = Number(t.getAttribute("data-i")), v = Number(t.getAttribute("data-v")), ans = ipDraft(); ans[i] = v; lsSet("cp-ip-draft-" + S.user.id, JSON.stringify(ans));
      $all('[data-action="ip"][data-i="' + i + '"]').forEach(function (b) { b.setAttribute("aria-pressed", b === t); });
      var answered = ans.filter(function (x) { return x != null; }).length; var pi = $(".progress > i"); if (pi) pi.style.width = (answered / 60 * 100) + "%"; var mt = $(".panel-title .meta"); if (mt) mt.textContent = answered + " answered";
      return;
    }
    if (act === "ip-next") { ipPage = Math.min(5, ipPage + 1); render(); window.scrollTo(0, 0); return; }
    if (act === "ip-prev") { ipPage = Math.max(0, ipPage - 1); render(); window.scrollTo(0, 0); return; }
    if (act === "ip-finish") { ipFinish(); return; }
    if (act === "rate") {
      var k = t.getAttribute("data-k"), rv = Number(t.getAttribute("data-v")); pendingRatings = pendingRatings || {}; pendingRatings[k] = rv;
      t.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === t); });
      var merged = Object.assign({}, (S.assessment && S.assessment.ratings) || {}, pendingRatings); $("#rate-count").textContent = ALL_KEYS.filter(function (x) { return merged[x]; }).length + " of " + ALL_KEYS.length + " rated";
      return;
    }
    if (act === "save-ratings") { saveRatings(); return; }
    if (act === "cfilter") { careerFilter = t.getAttribute("data-g"); render(); return; }
    if (act === "save-career") {
      var code = t.getAttribute("data-code");
      var q = S.saved[code] ? sb.from("saved_careers").delete().eq("user_id", S.user.id).eq("career_code", code) : sb.from("saved_careers").insert({ career_code: code });
      q.then(function (r) { if (r.error) { toast("Couldn't update: " + r.error.message); return; } if (S.saved[code]) delete S.saved[code]; else S.saved[code] = true; toast(S.saved[code] ? "Saved to shortlist" : "Removed from shortlist"); render(); });
      return;
    }
    if (act === "start-road") { startRoad(t.getAttribute("data-code")); return; }
    if (act === "road-toggle") {
      var id = Number(t.getAttribute("data-id")), it = S.roadmap.filter(function (x) { return x.id === id; })[0];
      sb.from("roadmap_items").update({ done: t.checked }).eq("id", id).then(function (r) { if (r.error) { toast("Couldn't update"); t.checked = !t.checked; return; } it.done = t.checked; render(); });
      return;
    }
    if (act === "road-del") {
      var did = Number(t.getAttribute("data-id"));
      sb.from("roadmap_items").delete().eq("id", did).then(function (r) { if (r.error) { toast("Couldn't remove"); return; } S.roadmap = S.roadmap.filter(function (x) { return x.id !== did; }); render(); });
      return;
    }
    if (act === "road-clear") {
      if (!confirm("Remove all roadmap steps and pick a new career?")) return;
      sb.from("roadmap_items").delete().eq("user_id", S.user.id).then(function (r) { if (r.error) { toast("Couldn't clear"); return; } S.roadmap = []; render(); });
      return;
    }
    if (act === "add-mark") { $("#marks").insertAdjacentHTML("beforeend", markRow({ subject: "", score: "" })); $all("#marks .mark-row").slice(-1)[0].querySelector("input").focus(); return; }
    if (act === "del-mark") { t.closest(".mark-row").remove(); return; }
    if (act === "signout") { sb.auth.signOut().then(function () { location.hash = "#/"; }); return; }
    if (act === "export") { exportData(); return; }
    if (act === "delete-account") { deleteAccount(); return; }
  });
  document.addEventListener("click", function (ev) {
    var p = $("#bg-pop"); if (!p || p.hidden) return;
    if (!ev.target.closest(".pop-wrap")) p.hidden = true;
  });

  function changePassword(f) {
    var v = $("#new-pass").value; if (v.length < 8) { toast("Use at least 8 characters"); return; }
    sb.auth.updateUser({ password: v }).then(function (r) { if (r.error) toast(friendlyAuthError(r.error)); else { $("#new-pass").value = ""; toast("Password changed"); } });
  }
  function exportData() {
    var data = { exported_at: new Date().toISOString(), email: S.user.email, profile: S.profile, marks: S.marks, assessment: S.assessment, saved_careers: Object.keys(S.saved), roadmap: S.roadmap };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "campus-pulse-my-data.json"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function deleteAccount() {
    var typed = prompt("This deletes everything permanently. Type DELETE to confirm.");
    if (typed !== "DELETE") { if (typed !== null) toast("Not deleted. You need to type DELETE."); return; }
    sb.functions.invoke("delete-account", { method: "POST" }).then(function (r) {
      if (r.error) { toast("Couldn't delete: " + (r.error.message || "try again")); return; }
      sb.auth.signOut().finally(function () { lsDel("cp-ip-draft-" + S.user.id); location.hash = "#/"; toast("Your account has been deleted"); });
    });
  }

  function updateLandingThemeBtn() { var b = $("#landing-theme"); if (b) { b.innerHTML = isDark() ? ICON.sun : ICON.moon; b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode"); } }

  /* ---------- boot ---------- */
  function boot() {
    var look = currentLook(); applyLook(look.theme, look.bg, look.custom);
    $all("[data-brand]").forEach(function (el) { el.insertAdjacentHTML("afterbegin", brandMark()); });
    var demo = $("#hero-pulse"); if (demo) demo.innerHTML = pulseSVG({ R: 80, I: 90, A: 30, S: 25, E: 45, C: 70 }, { animate: true, label: "Example interest profile" });
    updateLandingThemeBtn();
    if (!sb) { toast("Couldn't load the login service. Check your connection and refresh."); render(); return; }
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === "PASSWORD_RECOVERY") { S.recovery = true; }
      var prev = S.user && S.user.id;
      S.session = session; S.user = session ? session.user : null;
      if (!S.user) { S.loaded = false; S.profile = null; render(); return; }
      if (prev !== S.user.id) {
        S.loaded = false;
        setTimeout(function () {
          loadAll().then(function () {
            var after = lsGet("cp-after-login"); lsDel("cp-after-login");
            if (/access_token=/.test(location.hash)) history.replaceState(null, "", location.pathname + (S.recovery ? "#/new-password" : "#/dashboard"));
            if (after && AUTH_ROUTES.indexOf(parseHash().name) >= 0) { location.hash = "#/" + after; return; }
            render();
          }).catch(function (e) { $("#view").innerHTML = '<div class="empty"><h3>Couldn\'t load your data</h3><p>' + esc(e.message || e) + '</p><button class="btn btn-primary" onclick="location.reload()">Try again</button></div>'; show("app"); });
        }, 0);
      }
      render();
    });
    window.addEventListener("hashchange", render);
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { updateLandingThemeBtn(); if (S.user) renderShellNav(parseHash().name); });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
