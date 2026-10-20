// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmyDate = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const prettyDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // RailKit running_days is Monday-first
const AC = ['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'FC', 'VC', 'VA'];
const CLASS_NAMES = { '1A': 'First AC', '2A': 'AC 2 Tier', '3A': 'AC 3 Tier', '3E': 'AC 3 Economy', SL: 'Sleeper', CC: 'AC Chair Car', EC: 'Exec. Chair Car', EA: 'Anubhuti', '2S': 'Second Sitting', FC: 'First Class', VS: 'Vistadome', VC: 'Vistadome CC', VA: 'Vistadome AC' };
const IRCTC_BOOK = 'https://www.irctc.co.in/nget/train-search';

const LOADER_LINES = ['Departing from platform 1…', 'Signal is green 🟢', 'Checking the chart…', 'Counting the berths…', 'Passing the junction…', 'Asking the station master…', 'Almost at the platform…'];

function showLoader(container, lines = LOADER_LINES) {
  const node = $('#loaderTpl').content.firstElementChild.cloneNode(true);
  container.replaceChildren(node);
  const text = $('.loader-text', node);
  let i = 0;
  text.textContent = lines[0];
  const timer = setInterval(() => { i = (i + 1) % lines.length; text.textContent = lines[i]; }, 1400);
  return () => clearInterval(timer);
}

async function api(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  const res = await fetch(`/api/${path}${qs ? `?${qs}` : ''}`);
  let body;
  try { body = await res.json(); } catch { throw new Error('Server returned an unexpected response'); }
  if (!body.success) throw new Error(body.error || 'Request failed');
  return body;
}

// Runs fn with the train loader in `container`; renders an error box on failure.
async function load(container, fn, lines) {
  const stop = showLoader(container, lines);
  try {
    const html = await fn();
    container.innerHTML = html;
    return true;
  } catch (err) {
    container.innerHTML = errorBox(err.message);
    return false;
  } finally {
    stop();
  }
}

const errorBox = (msg) => `<div class="error-box"><span class="big">🚧</span><div><b>Signal red.</b><br>${esc(msg)}</div></div>`;
const empty = (icon, msg) => `<div class="card empty"><span class="big">${icon}</span>${msg}</div>`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// "00:07", "15 Mins.", "On Time" → minutes (null if unknown)
function delayMin(s) {
  if (!s) return null;
  if (/on\s*time/i.test(s)) return 0;
  let m = /(\d+):(\d+)/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /(\d+)\s*min/i.exec(s);
  if (m) return Number(m[1]);
  return null;
}
function delayTag(s) {
  const m = delayMin(s);
  if (m === null) return s ? esc(s) : '';
  if (m === 0) return '<span class="ontime">On time</span>';
  const h = Math.floor(m / 60);
  return `<span class="late">+${h ? `${h}h ` : ''}${m % 60}m</span>`;
}
const runDays = (str = '') => `<span class="days" title="Runs on">${DAYS.map((d, i) => `<span class="${str[i] === '1' ? 'on' : ''}">${d}</span>`).join('')}</span>`;
const toMin = (t) => { const m = /(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fmtDur = (min) => `${Math.floor(min / 60)}h ${min % 60}m`;

// ---------- theme ----------
const root = document.documentElement;
const savedTheme = store.get('theme');
if (savedTheme) root.dataset.theme = savedTheme;
const syncThemeIcon = () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#themeToggle').textContent = dark ? '☀️' : '🌙';
  return dark;
};
syncThemeIcon();
$('#themeToggle').addEventListener('click', () => {
  root.dataset.theme = syncThemeIcon() ? 'light' : 'dark';
  store.set('theme', root.dataset.theme);
  syncThemeIcon();
});

// ---------- tabs ----------
function showTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
  $(`.tab[data-tab="${name}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}
$('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); });
const initialTab = location.hash.slice(1);
if ($(`#panel-${initialTab}`)) showTab(initialTab);
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if ($(`#panel-${t}`)) showTab(t); });

// ---------- autocomplete ----------
function autocomplete(input, kind) {
  const list = input.parentElement.querySelector('.suggest');
  let timer, items = [], hl = -1, seq = 0;
  const close = () => { list.classList.remove('open'); hl = -1; };
  const pick = (it) => {
    input.value = `${it.name} (${it.code})`;
    input.dataset.code = it.code;
    close();
  };
  const render = () => {
    list.innerHTML = items.map((it, i) => `<li data-i="${i}" class="${i === hl ? 'hl' : ''}"><span class="code">${esc(it.code)}</span>${esc(it.name)}</li>`).join('');
    list.classList.toggle('open', items.length > 0);
  };
  input.addEventListener('input', () => {
    delete input.dataset.code;
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { items = []; close(); return; }
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        items = kind === 'station' ? await searchStations(q) : await searchTrains(q);
        if (mine === seq) { hl = -1; render(); }
      } catch { /* ignore suggestion errors */ }
    }, 250);
  });
  input.addEventListener('keydown', (e) => {
    if (!list.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, items.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && hl >= 0) { pick(items[hl]); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(items[li.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(close, 150));
  // a pending lookup must not reopen the list over the submit button
  input.form?.addEventListener('submit', () => { seq++; clearTimeout(timer); close(); });
}
async function searchStations(q) {
  const r = await api('stations', { q });
  return (r.data?.stations || []).slice(0, 10).map((s) => ({ code: s.code, name: s.name }));
}
async function searchTrains(q) {
  const r = await api('trains/search', { q });
  return (r.data?.trains || []).slice(0, 10).map((t) => ({ code: t.trainNo, name: t.trainName }));
}

// Resolve whatever the user typed into a station code / train number.
async function resolveStation(input) {
  if (input.dataset.code) return input.dataset.code;
  const v = input.value.trim();
  const m = /\(([A-Za-z0-9]{1,5})\)\s*$/.exec(v);
  if (m) return m[1].toUpperCase();
  if (/^[A-Za-z0-9]{1,5}$/.test(v)) {
    const code = v.toUpperCase();
    const hits = v.length >= 2 ? await searchStations(v).catch(() => []) : [];
    // prefer a name match only when the text clearly isn't a code
    if (hits.length && !hits.some((h) => h.code === code) && v.length > 4) { input.value = `${hits[0].name} (${hits[0].code})`; return hits[0].code; }
    return code;
  }
  const hits = await searchStations(v);
  if (!hits.length) throw new Error(`No station found for "${v}"`);
  input.value = `${hits[0].name} (${hits[0].code})`;
  input.dataset.code = hits[0].code;
  return hits[0].code;
}
async function resolveTrain(input) {
  if (input.dataset.code) return input.dataset.code;
  const v = input.value.trim();
  const m = /(\d{5})/.exec(v);
  if (m) return m[1];
  const hits = await searchTrains(v);
  if (!hits.length) throw new Error(`No train found for "${v}"`);
  input.value = `${hits[0].name} (${hits[0].code})`;
  input.dataset.code = hits[0].code;
  return hits[0].code;
}
const setTrainInput = (input, no, name) => { input.value = name ? `${name} (${no})` : no; input.dataset.code = no; };

$$('.station-field input').forEach((i) => autocomplete(i, 'station'));
$$('.train-field input').forEach((i) => autocomplete(i, 'train'));

// ---------- dates ----------
const today = new Date();
$('#journeyDate').value = isoDate(addDays(today, 1));
$('#journeyDate').min = isoDate(today);
$('#journeyDate').max = isoDate(addDays(today, 120));
$('#historyDate').value = isoDate(addDays(today, -2));
$('#historyDate').max = isoDate(addDays(today, -1));
$('#trackDate').innerHTML = [0, 1, 2, 3, 4, 5].map((n) => {
  const d = addDays(today, -n);
  const label = n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
  return `<option value="${dmyDate(d)}">${label} · ${prettyDate(d)}</option>`;
}).join('');

// =====================================================================
// JOURNEY PLANNER
// =====================================================================
let journey = null; // { from, to, date, quota, trains }

$('#swapBtn').addEventListener('click', () => {
  const a = $('#fromStn'), b = $('#toStn');
  [a.value, b.value] = [b.value, a.value];
  const [ca, cb] = [a.dataset.code, b.dataset.code];
  if (cb) a.dataset.code = cb; else delete a.dataset.code;
  if (ca) b.dataset.code = ca; else delete b.dataset.code;
});

$('#journeyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#journeyResults');
  await load(out, async () => {
    const [from, to] = await Promise.all([resolveStation($('#fromStn')), resolveStation($('#toStn'))]);
    if (from === to) throw new Error('From and To stations are the same');
    const dateIso = $('#journeyDate').value;
    const r = await api('between', { from, to, date: dateIso });
    const trains = Array.isArray(r.data) ? r.data : r.data?.trains || [];
    journey = { from, to, dateIso, quota: $('#journeyQuota').value, trains, sort: 'dep', cls: 'ALL' };
    store.set('lastJourney', JSON.stringify({ from: $('#fromStn').value, to: $('#toStn').value }));
    return renderJourney();
  }, ['Looking for trains on this route…', 'Checking timetables…', 'Measuring the distance…', ...LOADER_LINES.slice(1)]);
});

const bookableClasses = (t) => (t.classes_of_travel || '').split(',').map((c) => c.trim()).filter((c) => c && !['GEN', 'PWD', 'UR', 'GN'].includes(c));

function renderJourney() {
  const { trains, from, to, dateIso, sort, cls } = journey;
  if (!trains.length) return empty('🛤️', `No direct trains found from <b>${esc(from)}</b> to <b>${esc(to)}</b>. Try a nearby major station.`);
  const allCls = [...new Set(trains.flatMap(bookableClasses))].sort((a, b) => Object.keys(CLASS_NAMES).indexOf(a) - Object.keys(CLASS_NAMES).indexOf(b));
  let list = cls === 'ALL' ? trains : trains.filter((t) => bookableClasses(t).includes(cls));
  const dur = (t) => { const m = /(\d+):(\d+)/.exec(t.travel_time || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 1e9; };
  const sorters = { dep: (a, b) => toMin(a.from_time) - toMin(b.from_time), dur: (a, b) => dur(a) - dur(b), arr: (a, b) => toMin(a.to_time) - toMin(b.to_time) };
  list = [...list].sort(sorters[sort]);
  const t0 = trains[0];
  return `
    <div class="results-head">
      <div><h2>${trains.length} trains · ${esc(t0.from_stn_name || from)} → ${esc(t0.to_stn_name || to)}</h2>
        <span class="muted">${prettyDate(new Date(dateIso))} · Distance ≈ <b>${esc(t0.distance)} km</b> · Tap a class for official fare & seats</span></div>
      <div class="filters">
        <select id="jSort" aria-label="Sort">
          <option value="dep" ${sort === 'dep' ? 'selected' : ''}>Sort: Departure</option>
          <option value="dur" ${sort === 'dur' ? 'selected' : ''}>Sort: Fastest</option>
          <option value="arr" ${sort === 'arr' ? 'selected' : ''}>Sort: Arrival</option>
        </select>
        <select id="jCls" aria-label="Class filter">
          <option value="ALL">All classes</option>
          ${allCls.map((c) => `<option value="${esc(c)}" ${cls === c ? 'selected' : ''}>${esc(c)} · ${esc(CLASS_NAMES[c] || c)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${list.map(trainCard).join('') || empty('🔎', 'No trains with that class.')}`;
}

function trainCard(t) {
  const classes = bookableClasses(t);
  return `
  <article class="card train-card" data-train="${esc(t.train_no)}">
    <div class="tc-top">
      <div><span class="tc-no">${esc(t.train_no)}</span><span class="tc-name">${esc(t.train_name)}</span>
        <span class="badge">${esc(t.train_type_name || '')}</span></div>
      ${runDays(t.running_days)}
    </div>
    <div class="tc-mid">
      <div><div class="tc-time">${esc(t.from_time)}</div><div class="tc-stn">${esc(t.from_stn_name)} (${esc(t.from_stn_code)})</div></div>
      <div class="tc-line"><strong>${esc(t.travel_time)}</strong><div class="bar"></div>${esc(t.distance)} km · ${esc(t.halts ?? '–')} halts</div>
      <div class="tc-right"><div class="tc-time">${esc(t.to_time)}</div><div class="tc-stn">${esc(t.to_stn_name)} (${esc(t.to_stn_code)})</div></div>
    </div>
    <div class="tc-bottom">
      ${classes.map((c) => `<button class="class-btn" data-act="fare" data-cls="${esc(c)}" title="${esc(CLASS_NAMES[c] || c)}">${esc(c)}</button>`).join('')}
      <span class="spacer"></span>
      <button class="btn ghost sm" data-act="route">🚂 Route</button>
      <button class="btn ghost sm" data-act="track">📍 Live</button>
    </div>
  </article>`;
}

$('#journeyResults').addEventListener('change', (e) => {
  if (e.target.id === 'jSort') journey.sort = e.target.value;
  else if (e.target.id === 'jCls') journey.cls = e.target.value;
  else return;
  $('#journeyResults').innerHTML = renderJourney();
});
$('#journeyResults').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const t = journey.trains.find((x) => x.train_no === btn.closest('.train-card').dataset.train);
  if (btn.dataset.act === 'fare') openFare(t, btn.dataset.cls);
  if (btn.dataset.act === 'route') goRoute(t.train_no, t.train_name, t.from_stn_code, t.to_stn_code);
  if (btn.dataset.act === 'track') goTrack(t.train_no, t.train_name);
});

// ---------- fare & availability drawer ----------
const drawer = $('#drawer'), backdrop = $('#drawerBackdrop');
function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); backdrop.hidden = false; document.body.style.overflow = 'hidden'; }
function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); backdrop.hidden = true; document.body.style.overflow = ''; }
$('#drawerClose').addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });

let fareCtx = null;
async function openFare(t, cls) {
  fareCtx = { t, cls };
  openDrawer();
  const body = $('#drawerBody');
  const { from, to, dateIso, quota } = journey;
  const fromC = t.from_stn_code || from, toC = t.to_stn_code || to;
  await load(body, async () => {
    let fare, avail = [], distance = t.distance, availErr = null;
    try {
      const r = await api('availability', { train: t.train_no, from: fromC, to: toC, date: dateIso, cls, quota });
      const f = r.data.fare || {};
      fare = { base: f.baseFare, reservation: f.reservationCharge, superfast: f.superfastCharge, gst: f.serviceTax, total: f.totalFare };
      avail = r.data.availability || [];
      distance = r.data.train?.distance || distance;
    } catch (err) {
      availErr = err.message;
    }
    if (!fare || !fare.total) {
      const r = await api('fare', { train: t.train_no, from: fromC, to: toC, date: dateIso, cls, quota });
      const f = r.data;
      fare = { base: f.baseFare, reservation: f.reservation, superfast: f.superfast, catering: f.catering, tatkal: f.tatkalFare, dynamic: f.dynamicFare, fuel: f.fuelAmount, other: f.otherCharge, concession: f.concession, gst: f.gst, total: f.totalFare };
      distance = f.distance || distance;
    }
    return fareView(t, cls, quota, dateIso, fromC, toC, fare, avail, distance, availErr);
  }, ['Fetching official fare…', 'Checking seats for 6 days…', 'Predicting confirmation…']);
}

function fareView(t, cls, quota, dateIso, fromC, toC, fare, avail, distance, availErr) {
  const rows = [
    ['Base fare', fare.base], ['Reservation charge', fare.reservation], ['Superfast charge', fare.superfast],
    ['Tatkal charge', fare.tatkal], ['Dynamic fare', fare.dynamic], ['Catering', fare.catering], ['Fuel', fare.fuel],
    ['Other', fare.other], ['Concession', fare.concession ? -fare.concession : 0], ['GST', fare.gst],
  ].filter(([, v]) => Number(v));
  const fee = AC.includes(cls) ? 30 : 15;
  const feeGst = Math.round(fee * 0.18 * 100) / 100;
  const perKm = distance ? (fare.total / distance).toFixed(2) : null;
  const quotaName = { GN: 'General', TQ: 'Tatkal', LD: 'Ladies', SS: 'Senior/Lower berth' }[quota] || quota;
  const others = bookableClasses(t);
  const statusCls = (s = '') => /AVL|AVAILABLE|CNF/i.test(s) ? 'ok' : /WL|WAIT|RAC/i.test(s) ? 'wl' : 'no';
  return `
    <h2>${esc(t.train_no)} · ${esc(t.train_name)}</h2>
    <p class="muted">${esc(t.from_stn_name)} → ${esc(t.to_stn_name)} · ${esc(distance)} km · ${esc(t.travel_time)}<br>
      ${esc(cls)} (${esc(CLASS_NAMES[cls] || cls)}) · ${esc(quotaName)} quota</p>
    <div class="filters">${others.map((c) => `<button class="class-btn" data-drawer-cls="${esc(c)}" ${c === cls ? 'style="background:var(--ir-blue);color:#fff"' : ''}>${esc(c)}</button>`).join('')}</div>

    <div class="zero-banner">✅ IRS commission: ₹0. This is the official IRCTC fare.</div>
    <table class="fare-table">
      ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${rupee(v)}</td></tr>`).join('')}
      <tr class="total"><td>Ticket fare (per adult)</td><td>${rupee(fare.total)}</td></tr>
    </table>
    ${perKm ? `<p class="muted small">That's about ₹${perKm} per km.</p>` : ''}

    <h3>Seat availability</h3>
    ${avail.length ? `<div class="avail-list">${avail.map((a) => `
      <div class="avail-item">
        <div><b>${esc(a.date)}</b></div>
        <div><span class="st ${statusCls(a.availabilityText || a.status)}">${esc(a.availabilityText || a.status)}</span>
          ${a.rawStatus && a.rawStatus !== a.availabilityText ? `<div class="muted small">${esc(a.rawStatus)}</div>` : ''}</div>
        <div style="min-width:110px">${a.predictionPercentage != null ? `<span class="small">${esc(a.prediction)}</span>
          <div class="chance"><i style="width:${Math.max(4, Math.min(100, a.predictionPercentage))}%;background:var(--${a.predictionPercentage >= 70 ? 'green' : a.predictionPercentage >= 40 ? 'saffron' : 'red'})"></i></div>` : (a.canBook === false ? '<span class="badge red">Not bookable</span>' : '')}</div>
      </div>`).join('')}</div>` : `<p class="muted">${availErr ? `Availability not available right now (${esc(availErr)}).` : 'No availability data.'}</p>`}

    <div class="book-box">
      <b>Book directly on IRCTC, with no agent fee</b>
      <p class="small muted" style="margin:.3em 0">At payment IRCTC adds its own convenience fee of about ${rupee(fee)} + ${rupee(feeGst)} GST per ticket (bank/UPI charges may apply).
        Expected total ≈ <b>${rupee(Math.round(fare.total + fee + feeGst))}</b> for 1 passenger.</p>
      <a class="btn primary" id="bookIrctc" href="${IRCTC_BOOK}" target="_blank" rel="noopener">Book on IRCTC ↗</a>
      <div class="copy-row">
        <button class="btn ghost sm" id="copyTrip">📋 Copy trip details</button>
        <button class="btn ghost sm" id="drawerRoute">🚂 See full route</button>
      </div>
      <p class="small muted" style="margin:.6em 0 0">Tip: we copy the train, stations, date & class for you, so you can paste them on IRCTC.</p>
    </div>`;
  // copy text is built on click from fareCtx
}

drawer.addEventListener('click', async (e) => {
  if (!fareCtx) return;
  const { t } = fareCtx;
  const c = e.target.closest('[data-drawer-cls]');
  if (c) return openFare(t, c.dataset.drawerCls);
  const summary = () => `Train ${t.train_no} ${t.train_name}\nFrom: ${t.from_stn_name} (${t.from_stn_code}) ${t.from_time}\nTo: ${t.to_stn_name} (${t.to_stn_code}) ${t.to_time}\nDate: ${journey.dateIso.split('-').reverse().join('-')}\nClass: ${fareCtx.cls} · Quota: ${journey.quota}`;
  if (e.target.id === 'copyTrip') toast((await copy(summary())) ? 'Trip details copied 📋' : 'Could not copy. Please select manually.');
  if (e.target.id === 'bookIrctc') { if (await copy(summary())) toast('Trip details copied. Paste them on IRCTC 🚆'); }
  if (e.target.id === 'drawerRoute') { closeDrawer(); goRoute(t.train_no, t.train_name, t.from_stn_code, t.to_stn_code); }
});

// =====================================================================
// TRAIN ROUTE / INFO
// =====================================================================
let routeCtx = null;
function goRoute(no, name, fromC, toC) {
  setTrainInput($('#infoTrain'), no, name);
  routeCtx = { pickFrom: fromC, pickTo: toC };
  showTab('info');
  $('#infoForm').requestSubmit();
}

$('#infoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pre = routeCtx; routeCtx = null;
  const out = $('#infoResults');
  await load(out, async () => {
    const no = await resolveTrain($('#infoTrain'));
    const r = await api('train', { train: no });
    return routeView(r.data, pre);
  }, ['Laying out the route…', 'Counting the stops…', ...LOADER_LINES]);
  bindDistanceCalc();
});

let currentRoute = [];
function routeView(d, pre) {
  const i = d.trainInfo || {}, route = d.route || [];
  currentRoute = route;
  const total = route.length ? route[route.length - 1].distance : '–';
  const opt = (sel) => route.map((s, idx) => `<option value="${idx}" ${s.stnCode === sel ? 'selected' : ''}>${esc(s.stnName)} (${esc(s.stnCode)})</option>`).join('');
  const fromSel = pre?.pickFrom || route[0]?.stnCode, toSel = pre?.pickTo || route[route.length - 1]?.stnCode;
  return `
  <div class="card">
    <div class="results-head" style="margin-top:0">
      <div><h2><span class="tc-no">${esc(i.train_no)}</span>${esc(i.train_name)}</h2>
        <span class="muted">${esc(i.from_stn_name)} (${esc(i.from_stn_code)}) ${esc(i.from_time)} → ${esc(i.to_stn_name)} (${esc(i.to_stn_code)}) ${esc(i.to_time)}</span></div>
      <div class="filters">
        <button class="btn blue sm" data-go="track">📍 Live status</button>
        <button class="btn ghost sm" data-go="history">🕓 History</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><b>${esc(total)} km</b><span>Total distance</span></div>
      <div class="stat"><b>${esc(i.travel_time)}</b><span>Journey time</span></div>
      <div class="stat"><b>${route.length}</b><span>Stops</span></div>
      <div class="stat"><b>${esc(i.type || '–')}</b><span>Train type</span></div>
      <div class="stat">${runDays(i.running_days)}<span>Runs on</span></div>
    </div>
    <div class="distance-calc">
      <div class="field"><label for="dcFrom">Distance from</label><select id="dcFrom">${opt(fromSel)}</select></div>
      <div class="field"><label for="dcTo">To</label><select id="dcTo">${opt(toSel)}</select></div>
      <div class="distance-out" id="dcOut"></div>
    </div>
  </div>
  <div class="card">
    <h3>Full route & timetable</h3>
    <div class="table-wrap"><table class="data stack" id="routeTable">
      <thead><tr><th>#</th><th>Station</th><th>Arrives</th><th>Departs</th><th>Halt</th><th>Day</th><th>Km</th><th>PF</th><th></th></tr></thead>
      <tbody>${route.map((s, idx) => `
        <tr data-idx="${idx}">
          <td data-label="#">${idx + 1}</td>
          <td data-label="Station"><b>${esc(s.stnName)}</b> <span class="muted">${esc(s.stnCode)}</span></td>
          <td data-label="Arrives">${esc(s.arrival)}</td><td data-label="Departs">${esc(s.departure)}</td>
          <td data-label="Halt">${esc(s.halt)}</td><td data-label="Day">${esc(s.day)}</td>
          <td data-label="Km">${esc(s.distance)}</td><td data-label="Platform">${esc(s.platform ?? '–')}</td>
          <td data-label="Map">${s.coordinates ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(`${s.coordinates.latitude},${s.coordinates.longitude}`)}" target="_blank" rel="noopener" title="Open in maps">🗺️</a>` : ''}</td>
        </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function bindDistanceCalc() {
  const f = $('#dcFrom'), t = $('#dcTo'), out = $('#dcOut');
  if (!f) return;
  const calc = () => {
    let a = currentRoute[f.value], b = currentRoute[t.value];
    if (Number(f.value) > Number(t.value)) [a, b] = [b, a];
    const km = Math.abs(Number(b.distance) - Number(a.distance));
    const dep = toMin(a.departure) ?? toMin(a.arrival), arr = toMin(b.arrival) ?? toMin(b.departure);
    let txt = `📏 <b>${km} km</b> between ${esc(a.stnName)} and ${esc(b.stnName)}`;
    if (dep != null && arr != null) {
      const mins = (Number(b.day) - Number(a.day)) * 1440 + arr - dep;
      if (mins > 0) txt += ` · ⏱️ <b>${fmtDur(mins)}</b> (dep ${esc(a.departure)}, arr ${esc(b.arrival)}${Number(b.day) > Number(a.day) ? ` +${Number(b.day) - Number(a.day)} day` : ''}) · avg ${Math.round(km / (mins / 60))} km/h`;
    }
    out.innerHTML = txt;
    $$('#routeTable tbody tr').forEach((tr) => {
      const i = Number(tr.dataset.idx), lo = Math.min(f.value, t.value), hi = Math.max(f.value, t.value);
      tr.classList.toggle('sel', i >= lo && i <= hi);
    });
  };
  f.addEventListener('change', calc);
  t.addEventListener('change', calc);
  calc();
}

$('#infoResults').addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  const input = $('#infoTrain');
  const no = input.dataset.code || (/(\d{5})/.exec(input.value) || [])[1];
  if (b.dataset.go === 'track') goTrack(no);
  if (b.dataset.go === 'history') { setTrainInput($('#historyTrain'), no); showTab('history'); $('#historyForm').requestSubmit(); }
});

// =====================================================================
// LIVE TRACK
// =====================================================================
let trackTimer = null, showAllStations = false, lastTrack = null;
function goTrack(no, name) {
  setTrainInput($('#trackTrain'), no, name);
  showTab('track');
  $('#trackForm').requestSubmit();
}

async function fetchTrack() {
  const no = await resolveTrain($('#trackTrain'));
  const r = await api('track', { train: no, date: $('#trackDate').value });
  lastTrack = r.data;
  return trackView(r.data);
}

$('#trackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearInterval(trackTimer);
  const ok = await load($('#trackResults'), fetchTrack, ['Locating the train…', 'Pinging the loco pilot…', 'Reading signal logs…', ...LOADER_LINES.slice(1)]);
  if (ok && $('#autoRefresh').checked) startAutoRefresh();
});
$('#autoRefresh').addEventListener('change', (e) => { if (e.target.checked && lastTrack) startAutoRefresh(); else clearInterval(trackTimer); });
function startAutoRefresh() {
  clearInterval(trackTimer);
  trackTimer = setInterval(async () => {
    if (!$('#panel-track').classList.contains('active')) return;
    try { $('#trackResults').innerHTML = await fetchTrack(); toast('Live status refreshed 🔄'); } catch { /* keep last view */ }
  }, 60_000);
}

function trackView(d) {
  const p = d.progress || {};
  const pct = Math.max(0, Math.min(100, Number(p.percent) || 0));
  const tl = d.timeline || [];
  const stops = tl.filter((s) => s.type === 'stoppage');
  const first = stops[0], last = stops[stops.length - 1];
  const items = showAllStations ? tl : stops;
  const curIdx = tl.findIndex((s) => s.stationCode === d.currentStationCode);
  return `
  <div class="card">
    <div class="results-head" style="margin-top:0">
      <div><h2><span class="tc-no">${esc(d.trainNo)}</span>${esc(d.trainName)}</h2><span class="muted">Journey started ${esc(d.date)} · Updated ${esc(d.lastUpdate)}</span></div>
      <button class="btn ghost sm" data-track-refresh>🔄 Refresh</button>
    </div>
    <div class="status-note">» ${esc(d.statusNote || 'Status unavailable')}</div>
    <div class="progress-wrap">
      <div class="progress-rail"></div>
      <div class="progress-fill" style="width:${pct}%"></div>
      <div class="progress-train" style="left:${pct}%">🚆</div>
      <div class="progress-ends"><span>${esc(first?.stationName || '')}</span><b>${pct.toFixed(0)}%</b><span>${esc(last?.stationName || '')}</span></div>
    </div>
    <div class="stats">
      <div class="stat"><b>${esc(p.currentDistanceKm ?? '–')} / ${esc(d.totalDistanceKm ?? '–')} km</b><span>Distance covered</span></div>
      <div class="stat"><b>${esc(p.distanceRemainingKm ?? '–')} km</b><span>Remaining</span></div>
      <div class="stat"><b>${esc(d.averageSpeedKmph ?? '–')} km/h</b><span>Average speed</span></div>
      <div class="stat"><b>${esc(p.passedStations ?? '–')} / ${esc(p.totalStations ?? d.totalStations ?? '–')}</b><span>Stations passed</span></div>
      <div class="stat"><b>${esc(d.totalStoppageStations ?? stops.length)}</b><span>Scheduled stops</span></div>
    </div>
  </div>
  ${coachStrip(d.coachPosition)}
  <div class="card">
    <div class="results-head" style="margin-top:0"><h3>Running timeline</h3>
      <label class="check"><input type="checkbox" data-show-all ${showAllStations ? 'checked' : ''}/> Show all ${tl.length} stations</label></div>
    <ul class="timeline">${items.map((s) => {
      const i = tl.indexOf(s);
      const state = i === curIdx ? 'current' : s.status === 'passed' ? 'passed' : '';
      if (s.type !== 'stoppage') return `<li class="intermediate ${state}"><span>${esc(s.stationName)} <span class="muted">${esc(s.stationCode)}</span></span><span class="tl-times">${esc(s.departure?.scheduled || '')} · ${esc(s.distanceKm)} km</span></li>`;
      const a = s.arrival || {}, dp = s.departure || {};
      return `<li class="${state}">
        <span class="tl-name">${esc(s.stationName)} <span class="muted">${esc(s.stationCode)}</span>${i === curIdx ? ' <span class="badge amber">Train is here</span>' : ''}</span>
        <span class="tl-times">${a.actual && a.actual !== 'SRC' ? `Arr ${esc(a.actual)} ${delayTag(a.delay)}` : ''}${dp.actual && dp.actual !== 'DSTN' ? `<br>Dep ${esc(dp.actual)} ${delayTag(dp.delay)}` : ''}</span>
        <span class="tl-meta">Sch ${esc(a.scheduled)} / ${esc(dp.scheduled)} · ${esc(s.distanceKm)} km${s.platform ? ` · PF ${esc(s.platform)}` : ''}</span>
      </li>`;
    }).join('')}</ul>
  </div>`;
}

function coachStrip(coaches) {
  if (!coaches?.length) return '';
  const cls = (c) => { const t = (c.coachClass || c.type || '').toUpperCase(); return t === 'ENG' ? 'eng' : AC.includes(t) ? 'ac' : t === 'SL' ? 'sl' : ''; };
  return `<div class="card"><h3>Coach position <span class="muted small">(engine first)</span></h3>
    <div class="coach-strip">${coaches.map((c) => `<div class="coach-pill ${cls(c)}">${esc(c.coachNo || c.number)}<small>${esc(c.coachClass || c.type)}</small></div>`).join('')}</div>
    <p class="muted small" style="margin:0">Use this to stand at the right spot on the platform.</p></div>`;
}

$('#trackResults').addEventListener('click', async (e) => {
  if (e.target.closest('[data-track-refresh]')) $('#trackForm').requestSubmit();
});
$('#trackResults').addEventListener('change', (e) => {
  if (e.target.matches('[data-show-all]')) { showAllStations = e.target.checked; $('#trackResults').innerHTML = trackView(lastTrack); }
});

// =====================================================================
// HISTORY
// =====================================================================
$('#historyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await load($('#historyResults'), async () => {
    const no = await resolveTrain($('#historyTrain'));
    const r = await api('history', { train: no, date: $('#historyDate').value });
    return historyView(r.data, no);
  }, ['Opening the logbook…', 'Reading past journeys…', ...LOADER_LINES]);
});

function historyView(d, no) {
  const st = d.stations || [];
  const delays = st.map((s) => delayMin(s.departure?.delay) ?? delayMin(s.arrival?.delay)).filter((x) => x != null);
  const lastStn = st[st.length - 1];
  const finalDelay = lastStn ? (delayMin(lastStn.arrival?.delay) ?? delays[delays.length - 1]) : null;
  const onTime = delays.length ? Math.round((delays.filter((x) => x <= 5).length / delays.length) * 100) : null;
  return `
  <div class="card">
    <div class="results-head" style="margin-top:0">
      <div><h2><span class="tc-no">${esc(d.trainNo)}</span>${esc(d.trainName)}</h2>
        <span class="muted">${esc(d.sourceStationName)} → ${esc(d.destinationStationName)} · Journey ${esc(d.journeyDate)}</span></div>
      <button class="btn blue sm" data-punctuality="${esc(no)}">📊 Last 5 days punctuality</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${finalDelay == null ? '–' : finalDelay === 0 ? 'On time' : `${finalDelay} min`}</b><span>Delay at destination</span></div>
      <div class="stat"><b>${delays.length ? `${Math.max(...delays)} min` : '–'}</b><span>Worst delay</span></div>
      <div class="stat"><b>${onTime == null ? '–' : `${onTime}%`}</b><span>Stops within 5 min</span></div>
      <div class="stat"><b>${st.length}</b><span>Stops</span></div>
    </div>
    <div id="punctuality"></div>
  </div>
  ${coachStrip(d.coachPosition)}
  <div class="card"><h3>Station-wise record</h3><div class="table-wrap"><table class="data stack">
    <thead><tr><th>Station</th><th>PF</th><th>Km</th><th>Sch arr</th><th>Actual arr</th><th>Sch dep</th><th>Actual dep</th><th>Delay</th></tr></thead>
    <tbody>${st.map((s) => `<tr>
      <td data-label="Station"><b>${esc(s.stationName)}</b> <span class="muted">${esc(s.stationCode)}</span></td>
      <td data-label="Platform">${esc(s.platform || '–')}</td><td data-label="Km">${esc(s.distanceKm)}</td>
      <td data-label="Sch arr">${esc(s.arrival?.scheduled)}</td><td data-label="Actual arr">${esc(s.arrival?.actual)}</td>
      <td data-label="Sch dep">${esc(s.departure?.scheduled)}</td><td data-label="Actual dep">${esc(s.departure?.actual)}</td>
      <td data-label="Delay">${delayTag(s.departure?.delay || s.arrival?.delay)}</td></tr>`).join('')}</tbody>
  </table></div></div>`;
}

$('#historyResults').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-punctuality]');
  if (!b) return;
  const no = b.dataset.punctuality;
  await load($('#punctuality'), async () => {
    const dates = [1, 2, 3, 4, 5].map((n) => addDays(today, -n));
    const results = await Promise.all(dates.map((d) => api('history', { train: no, date: dmyDate(d) }).then((r) => r.data).catch(() => null)));
    const rows = dates.map((d, i) => {
      const h = results[i];
      const last = h?.stations?.[h.stations.length - 1];
      const dl = last ? delayMin(last.arrival?.delay) ?? delayMin(last.departure?.delay) : null;
      return `<tr><td data-label="Date">${prettyDate(d)}</td><td data-label="Arrived">${esc(last?.arrival?.actual || '–')}</td>
        <td data-label="Delay">${h ? (dl == null ? '–' : dl === 0 ? '<span class="ontime">On time</span>' : `<span class="late">+${dl} min</span>`) : '<span class="muted">No run / not finished</span>'}</td></tr>`;
    });
    return `<h3>Arrival at destination, last 5 days</h3><table class="data stack"><thead><tr><th>Date</th><th>Arrived</th><th>Delay</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }, ['Checking the last 5 runs…']);
});

// =====================================================================
// PNR
// =====================================================================
$('#pnrForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pnr = $('#pnrInput').value.trim();
  await load($('#pnrResults'), async () => {
    if (!/^\d{10}$/.test(pnr)) throw new Error('PNR must be exactly 10 digits');
    const { data: d } = await api('pnr', { pnr });
    const j = d.journey || {};
    const st = (s = '') => /CNF/.test(s) ? 'green' : /RAC|WL/.test(s) ? 'amber' : /CAN/.test(s) ? 'red' : '';
    return `
    <div class="card">
      <div class="results-head" style="margin-top:0">
        <div><h2>PNR ${esc(d.pnr)}</h2><span class="muted"><span class="tc-no">${esc(d.train?.number)}</span>${esc(d.train?.name)}</span></div>
        <span class="badge ${/prepared/i.test(d.chart?.status) ? 'green' : 'amber'}">${esc(d.chart?.status || 'Chart status unknown')}</span>
      </div>
      <div class="stats">
        <div class="stat"><b>${esc(j.source?.code)} → ${esc(j.destination?.code)}</b><span>${esc(j.source?.name)} → ${esc(j.destination?.name)}</span></div>
        <div class="stat"><b>${esc(j.dateOfJourney)}</b><span>Departure</span></div>
        <div class="stat"><b>${esc(j.arrivalDate || '–')}</b><span>Arrival</span></div>
        <div class="stat"><b>${esc(j.boardingPoint?.name || j.source?.name)}</b><span>Boarding at</span></div>
        <div class="stat"><b>${esc(j.class)} · ${esc(j.quota)}</b><span>Class · Quota</span></div>
        <div class="stat"><b>${esc(j.distance)} km</b><span>Distance</span></div>
        <div class="stat"><b>${rupee(d.booking?.fare)}</b><span>Fare paid</span></div>
      </div>
      <h3>Passengers</h3>
      <div class="pax">${(d.passengers || []).map((p) => `
        <div class="stat"><span>${esc(p.serialNumber)}</span>
          <b><span class="badge ${st(p.current?.status)}">${esc(p.current?.status)}</span> ${esc(p.current?.details)}</b>
          <span>Booked: ${esc(p.booking?.details)}</span></div>`).join('')}</div>
      <div class="filters" style="margin-top:14px">
        <button class="btn blue sm" data-pnr-track="${esc(d.train?.number)}">📍 Track this train</button>
        <a class="btn ghost sm" href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noopener">Cancel / TDR on IRCTC ↗</a>
      </div>
    </div>`;
  }, ['Reading the reservation chart…', 'Finding your berth…', ...LOADER_LINES]);
});
$('#pnrResults').addEventListener('click', (e) => { const b = e.target.closest('[data-pnr-track]'); if (b) goTrack(b.dataset.pnrTrack); });

// =====================================================================
// STATION
// =====================================================================
let timetable = [];
$('#stationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await load($('#stationResults'), async () => {
    const code = await resolveStation($('#stationInput'));
    const [info, amen, live] = await Promise.all([
      api('station', { code }).then((r) => r.data).catch(() => null),
      api('amenities', { code }).then((r) => r.data).catch(() => null),
      api('live-station', { code, hours: $('#stationHours').value }).then((r) => r.data).catch((err) => ({ error: err.message })),
    ]);
    if (!info && live.error) throw new Error(live.error);
    return stationView(code, info, amen, live);
  }, ['Walking to the station…', 'Reading the departure board…', ...LOADER_LINES]);
});

function stationView(code, info, amen, live) {
  const yes = (v) => v === true ? '✅ Yes' : v === false ? '❌ No' : '–';
  const am = amen ? [
    ['Category', amen.stationCategory], ['Platforms', amen.platforms], ['Daily footfall', amen.dailyPassengerCount?.toLocaleString('en-IN')],
    ['Retiring rooms', amen.retiringRoomCount], ['Waiting room seats', amen.waitingRoomSeatCount], ['Escalators', amen.escalatorCount],
    ['Lifts', amen.liftCount], ['Foot over bridges', amen.footOverBridgeCount], ['Toilets', amen.toiletCount], ['Drinking water points', amen.waterFacilityCount],
    ['Booking windows', amen.bookingWindowCount], ['Enquiry offices', amen.enquiryOfficeCount], ['ATMs', amen.atmCount],
    ['Wheelchair', yes(amen.wheelchairAvailable)], ['Food plaza', yes(amen.foodPlazaAvailable)], ['Parking', yes(amen.parkingAvailable)],
    ['Train display boards', yes(amen.electronicTrainDisplayAvailable)], ['Ticket vending machine', yes(amen.cashCoinSmartCardTicketVendingMachineAvailable)],
  ] : [];
  const trains = live?.trains || [];
  return `
  <div class="card">
    <div class="results-head" style="margin-top:0">
      <div><h2>🏛️ ${esc(info?.name || code)} <span class="muted">${esc(code)}</span></h2>
        ${info?.lat ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(`${info.lat},${info.lon}`)}" target="_blank" rel="noopener">Open in maps ↗</a>` : ''}</div>
      <button class="btn ghost sm" data-timetable="${esc(code)}">📅 Full timetable</button>
    </div>
  </div>
  <div class="card">
    <h3>Live board <span class="muted small">${esc(live?.summary || '')}</span></h3>
    ${live?.error ? `<p class="muted">${esc(live.error)}</p>` : trains.length ? `<div class="led-board"><table>
      <thead><tr><th>TRAIN</th><th>NAME</th><th>FROM → TO</th><th>ARR</th><th>DEP</th><th>PF</th><th>STATUS</th></tr></thead>
      <tbody>${trains.map((t) => {
        const d = t.departure?.delayed ? t.departure : t.arrival;
        return `<tr><td><a href="#" data-led-track="${esc(t.trainNo)}" style="color:inherit">${esc(t.trainNo)}</a></td><td>${esc(t.trainName)}</td>
          <td>${esc(t.source)} → ${esc(t.dest)}</td>
          <td>${esc(t.arrival?.actual || t.arrival?.scheduled || '')}</td><td>${esc(t.departure?.actual || t.departure?.scheduled || '')}</td>
          <td>${esc(t.platform)}</td><td class="${t.cancelled ? 'late' : d?.delayed ? 'late' : 'ontime'}">${t.cancelled ? 'CANCELLED' : esc(d?.delay || 'On Time')}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="muted">No trains in this window.</p>'}
  </div>
  ${am.length ? `<div class="card"><h3>Facilities & amenities</h3><div class="amen-grid">${am.map(([k, v]) => `<div class="amen"><b>${esc(v ?? '–')}</b>${k}</div>`).join('')}</div></div>` : ''}
  <div id="timetableBox"></div>`;
}

$('#stationResults').addEventListener('click', async (e) => {
  const lt = e.target.closest('[data-led-track]');
  if (lt) { e.preventDefault(); return goTrack(lt.dataset.ledTrack); }
  const tb = e.target.closest('[data-timetable]');
  if (!tb) return;
  await load($('#timetableBox'), async () => {
    const r = await api('timetable', { code: tb.dataset.timetable });
    timetable = r.data?.trains || [];
    return `<div class="card"><div class="results-head" style="margin-top:0"><h3>${esc(r.data?.summary || 'Timetable')}</h3>
      <input id="ttFilter" placeholder="Filter by train / city…" style="max-width:260px" /></div>
      <div class="table-wrap"><table class="data stack"><thead><tr><th>Train</th><th>Name</th><th>From → To</th><th>Arr</th><th>Dep</th><th>PF</th><th>Days</th></tr></thead>
      <tbody id="ttBody">${ttRows(timetable)}</tbody></table></div></div>`;
  }, ['Printing the timetable…']);
});
const ttRows = (list) => list.map((t) => `<tr>
  <td data-label="Train"><a href="#" data-led-track="${esc(t.trainNo)}">${esc(t.trainNo)}</a></td><td data-label="Name">${esc(t.trainName)}</td>
  <td data-label="Route">${esc(t.sourceName)} → ${esc(t.destinationName)}</td><td data-label="Arr">${esc(t.arrival || '–')}</td>
  <td data-label="Dep">${esc(t.departure || '–')}</td><td data-label="PF">${esc(t.platformNumber || '–')}</td><td data-label="Days">${esc(t.runningDays)}</td></tr>`).join('');
$('#stationResults').addEventListener('input', (e) => {
  if (e.target.id !== 'ttFilter') return;
  const q = e.target.value.toLowerCase();
  $('#ttBody').innerHTML = ttRows(timetable.filter((t) => `${t.trainNo} ${t.trainName} ${t.sourceName} ${t.destinationName}`.toLowerCase().includes(q)));
});

// =====================================================================
// CANCELLED
// =====================================================================
let cancelled = null;
$('#cancelLoad').addEventListener('click', async () => {
  await load($('#cancelResults'), async () => {
    const r = await api('cancelled');
    cancelled = r;
    return cancelView();
  }, ['Checking cancellation notices…']);
});
$('#cancelFilter').addEventListener('input', () => { if (cancelled) $('#cancelResults').innerHTML = cancelView(); });

function cancelView() {
  const q = $('#cancelFilter').value.toLowerCase();
  const match = (t) => !q || JSON.stringify(t).toLowerCase().includes(q);
  const full = (cancelled.data?.fullyCancelledTrains || []).filter(match);
  const part = (cancelled.data?.partiallyCancelledTrains || []).filter(match);
  const s = cancelled.summary || {};
  const row = (t) => `<tr><td data-label="Train"><b>${esc(t.trainNo)}</b></td><td data-label="Name">${esc(t.trainName)}</td>
    <td data-label="Date">${esc(t.journeyDate)}</td><td data-label="Route">${esc(t.route?.source?.name)} → ${esc(t.route?.destination?.name)}</td>
    <td data-label="Cancelled">${t.cancelledSegment ? `${esc(t.cancelledSegment.from?.name)} → ${esc(t.cancelledSegment.to?.name)}` : 'Entire route'}</td></tr>`;
  const table = (list) => list.length ? `<div class="table-wrap"><table class="data stack"><thead><tr><th>Train</th><th>Name</th><th>Date</th><th>Route</th><th>Cancelled section</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>` : '<p class="muted">None match.</p>';
  return `
  <div class="stats"><div class="stat"><b>${esc(s.total ?? '–')}</b><span>Total affected</span></div>
    <div class="stat"><b>${esc(s.fullyCancelled ?? full.length)}</b><span>Fully cancelled</span></div>
    <div class="stat"><b>${esc(s.partiallyCancelled ?? part.length)}</b><span>Partially cancelled</span></div>
    <div class="stat"><b>${esc((s.journeyDates || []).join(', ') || '–')}</b><span>Journey dates</span></div></div>
  <div class="card"><h3>⛔ Fully cancelled</h3>${table(full)}</div>
  <div class="card"><h3>⚠️ Partially cancelled</h3>${table(part)}</div>
  <p class="muted small">If your train is cancelled, IRCTC e-tickets are refunded automatically. Check your booking history on IRCTC.</p>`;
}

// =====================================================================
// IRCTC SERVICES
// =====================================================================
const SERVICES = [
  ['🎟️', 'Book train tickets', 'Official IRCTC booking (reserved & Tatkal)', 'https://www.irctc.co.in/nget/train-search'],
  ['↩️', 'Cancel ticket / File TDR', 'Log in, go to My Transactions, then Booked Ticket History', 'https://www.irctc.co.in/nget/train-search'],
  ['🍱', 'Order food on train', 'IRCTC e-Catering, delivered to your seat', 'https://www.ecatering.irctc.co.in/'],
  ['🛏️', 'Retiring rooms', 'Book rooms & dorms at stations', 'https://www.rr.irctc.co.in/'],
  ['🏖️', 'IRCTC Tourism', 'Tour packages, Bharat Gaurav & luxury trains', 'https://www.irctctourism.com/'],
  ['🎫', 'Unreserved / platform tickets', 'UTS: general tickets with no convenience fee', 'https://www.utsonmobile.indianrail.gov.in/'],
  ['🛰️', 'NTES (official status)', 'National Train Enquiry System', 'https://enquiry.indianrail.gov.in/mntes/'],
  ['🆘', 'Rail Madad complaints', 'Cleanliness, safety, refunds, or call 139', 'https://railmadad.indianrail.gov.in/'],
];
$('#serviceGrid').innerHTML = SERVICES.map(([i, t, d, u]) => `<a class="service" href="${u}" target="_blank" rel="noopener"><span class="ico">${i}</span><div><b>${t} ↗</b><span>${d}</span></div></a>`).join('');

// restore last route for convenience
try {
  const last = JSON.parse(store.get('lastJourney') || 'null');
  if (last) { $('#fromStn').value = last.from; $('#toStn').value = last.to; }
} catch { /* ignore */ }
