// Two views, switched by the URL hash:
//   #/timeline            the totals, the day-by-day chart and the releases (default)
//   #/counter/<tag>       fullscreen counter for one release, e.g. #/counter/v2.1.0
//   #/counter/latest      fullscreen counter for the newest release
//   #/counter/all         fullscreen counter for every release combined
//   #/counter/site        fullscreen counter of download clicks on the site
//   #/counter/installs    fullscreen counter of desktop installs that launched
//   #/counter/users       fullscreen counter of desktop unique users in the last 30 days
//   #/counter/phone-installs, #/counter/phone-users    the same two for the phone app

const SVG_NS = 'http://www.w3.org/2000/svg';
const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
// The site counts days in UTC, so its dates are read as UTC too, or midnight shows as the day before west of Greenwich.
const utcDateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmt = (n) => n.toLocaleString('en-US');

let releases = [];
let stats = null; // the site's counts, or null when they could not be read
let hiddenTags = new Set(readHidden());

function readHidden() {
  try { return JSON.parse(localStorage.getItem('oscarcounter:hidden')) || []; } catch (e) { return []; }
}
function writeHidden() {
  try { localStorage.setItem('oscarcounter:hidden', JSON.stringify([...hiddenTags])); } catch (e) {}
}

const $ = (id) => document.getElementById(id);

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function allReleasesEntry() {
  const byPlatform = { windows: 0, mac: 0, linux: 0 };
  for (const r of releases) for (const p of PLATFORMS) byPlatform[p.key] += r.byPlatform[p.key];
  return {
    tag: 'all',
    name: 'All releases',
    date: null,
    hint: `${releases.length} releases`,
    byPlatform,
    total: releases.reduce((sum, r) => sum + r.total, 0),
  };
}

// The computer and the phone app are counted apart. Each has the same four
// ids on the page, the phone's with a prefix: open-phone-installs, phone-facts.
const KINDS = [
  { key: 'desktop', label: 'Desktop', prefix: '', installsName: 'Desktop installs that launched', usersName: 'Desktop unique users, last 30 days' },
  { key: 'phone', label: 'Phone app', prefix: 'phone-', installsName: 'Phone app installs that launched', usersName: 'Phone app unique users, last 30 days' },
];

// One kind's counts, or null when the stats file has none for it. A file
// from before the split counts everything together: that is shown as the
// desktop's, which it nearly all was, and there is no phone group.
function kindStats(kind) {
  if (!stats) return null;
  const i = stats.installs;
  const u = stats.users;
  if (!i.desktop) return kind === 'desktop' ? { installs: i, users: u || null } : null;
  if (!i[kind]) return null;
  return { installs: i[kind], users: (u && u[kind]) || null };
}

// The site's counts, shaped like a release so the counter can show them.
function signalEntries() {
  if (!stats) return [];
  const since = (day) => utcDateFormat.format(new Date(day + 'T00:00:00Z'));
  const entries = [
    {
      tag: 'site',
      name: 'Downloads from the site',
      date: null,
      hint: `people only, since ${since(stats.clicks.since)}`,
      byPlatform: stats.clicks.byPlatform,
      total: stats.clicks.total,
    },
  ];
  for (const k of KINDS) {
    const part = kindStats(k.key);
    if (!part) continue;
    entries.push({
      tag: k.prefix + 'installs',
      name: k.installsName,
      date: null,
      hint: `since ${since(part.installs.since)}`,
      total: part.installs.total,
    });
    if (!part.users) continue;
    entries.push({
      tag: k.prefix + 'users',
      name: k.usersName,
      date: null,
      hint: `${fmt(part.users.last7)} in the last 7 days · ${fmt(part.users.total)} ever`,
      total: part.users.last30,
    });
  }
  return entries;
}

// What the installs did afterwards, each as a share of them. The one that
// matters is "came back": an install opened on more than one day is a
// person using it, not a person trying it. Publishing is the computer's
// alone, so the phone has no such line. Empty until the site publishes
// these fields, so an older stats file still renders.
function installFacts(i, k) {
  if (!i.total || i.cameBack === undefined) return [];
  const share = (n) => `${Math.round((100 * n) / i.total)}%`;
  const facts = [
    { id: `fact-${k.prefix}back`, count: i.cameBack, share: share(i.cameBack) },
    { id: `fact-${k.prefix}week`, count: i.last7, share: share(i.last7) },
  ];
  if (i.published !== undefined) facts.push({ id: `fact-${k.prefix}published`, count: i.published, share: share(i.published) });
  return facts;
}

// ---------- Totals ----------

function renderSignals() {
  $('sig-github').textContent = fmt(allReleasesEntry().total);
  const byTag = {};
  for (const e of signalEntries()) byTag[e.tag] = e;
  const tags = ['site', ...KINDS.flatMap((k) => [k.prefix + 'installs', k.prefix + 'users'])];
  for (const tag of tags) {
    const e = byTag[tag];
    $('sig-' + tag).textContent = e ? fmt(e.total) : '—';
    $('sig-' + tag + '-hint').textContent = e ? `${e.hint} · open counter ›` : 'not available right now';
    $('open-' + tag).disabled = !e;
  }
  for (const k of KINDS) {
    const part = kindStats(k.key);
    if (k.key !== 'desktop') $('group-' + k.key).hidden = !part;
    const facts = part ? installFacts(part.installs, k) : [];
    for (const f of facts) {
      $(f.id).textContent = fmt(f.count);
      $(f.id + '-share').textContent = f.share;
    }
    $(k.prefix + 'facts').hidden = facts.length === 0;
  }
  $('countries').hidden = !stats;
  if (stats) $('countries-count').textContent = fmt(stats.installs.countries);
}

// ---------- Day by day ----------

// Downloads are of the computer's installers only: the phone app comes from
// the stores, which do not say.
const DAILY_SERIES = [
  { key: 'site', label: 'Downloads from the site', kinds: ['desktop'] },
  { key: 'installs', label: 'Installs that launched', kinds: ['desktop', 'phone'] },
  { key: 'users', label: 'Unique users', kinds: ['desktop', 'phone'] },
];
const DAILY_DAYS = 42;

let dailyKind = readDailyKind();
function readDailyKind() {
  try { return localStorage.getItem('oscarcounter:daily') === 'phone' ? 'phone' : 'desktop'; } catch (e) { return 'desktop'; }
}

// The last six weeks as "YYYY-MM-DD", in UTC, which is what the site counts in.
function recentDays() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = DAILY_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Desktop or phone: one at a time, so a quiet week of one is not flattened by the other.
function renderDailyKinds() {
  const box = $('daily-kind');
  const both = !!kindStats('phone');
  box.hidden = !both;
  if (!both) dailyKind = 'desktop';
  box.innerHTML = KINDS.map((k) =>
    `<label class="chip"><input type="radio" name="daily-kind" value="${k.key}" ${k.key === dailyKind ? 'checked' : ''}>${k.label}</label>`
  ).join('');
  box.onchange = (e) => {
    dailyKind = e.target.value;
    try { localStorage.setItem('oscarcounter:daily', dailyKind); } catch (err) {}
    renderDaily();
  };
}

function renderDaily() {
  const section = $('daily');
  const chart = $('daily-chart');
  chart.innerHTML = '';
  if (!stats) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  renderDailyKinds();

  const days = recentDays();
  // A row from before the split has only `count`: all of it the desktop's.
  const ofKind = (row) => (row[dailyKind] !== undefined ? row[dailyKind] : dailyKind === 'desktop' ? row.count : 0);
  const site = {};
  for (const row of stats.clicks.byDay) site[row.day] = row.windows + row.mac + row.linux;
  const installs = {};
  for (const row of stats.installs.byDay) installs[row.day] = ofKind(row);
  const users = {};
  for (const row of (stats.users && stats.users.byDay) || []) users[row.day] = ofKind(row);
  const byKey = { site, installs, users };
  const valueOf = (key, day) => byKey[key][day] || 0;
  // Without unique users in the stats file, the chart goes without that series.
  const series = DAILY_SERIES.filter((s) => s.kinds.includes(dailyKind) && (s.key !== 'users' || stats.users));

  $('daily-legend').innerHTML = series.map(
    (s) => `<span><i class="swatch" style="background:var(--series-${s.key})"></i>${s.label}</span>`
  ).join('');

  const W = Math.max(chart.clientWidth - 16, 300);
  const H = 240;
  const m = { top: 20, right: 8, bottom: 36, left: 36 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const max = Math.max(1, ...days.map((d) => Math.max(...series.map((s) => valueOf(s.key, d)))));
  const step = niceStep(max, 3);
  const yMax = Math.ceil(max / step) * step;
  const y = (v) => m.top + plotH - (v / yMax) * plotH;

  const band = plotW / days.length;
  const barW = Math.max(2, Math.min(14, (band * 0.76) / series.length));
  const kindLabel = KINDS.find((k) => k.key === dailyKind).label;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${kindLabel}: ${series.map((s) => s.label.toLowerCase()).join(', ')}, per day` }, chart);

  for (let v = 0; v <= yMax; v += step) {
    el('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, svg);
    const label = el('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 12, fill: 'var(--text-muted)' }, svg);
    label.textContent = fmt(v);
  }

  days.forEach((day, i) => {
    const cx = m.left + band * (i + 0.5);
    const g = el('g', { class: 'band' }, svg);
    el('rect', { class: 'band-bg', x: m.left + band * i, y: m.top - 12, width: band, height: plotH + 12 + m.bottom - 4, rx: 4, fill: 'transparent' }, g);
    series.forEach((s, j) => {
      const v = valueOf(s.key, day);
      if (!v) return;
      const x = cx - (series.length * barW) / 2 + j * barW;
      el('path', { d: topRoundedRect(x, y(v), barW - 1, y(0) - y(v), 2), fill: `var(--series-${s.key})` }, g);
    });
    // A date every week, on the right-hand edge of the band it names.
    if ((days.length - 1 - i) % 7 === 0) {
      const label = el('text', { x: cx, y: H - m.bottom + 18, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-muted)' }, g);
      label.textContent = dayFormat.format(new Date(day + 'T00:00:00Z'));
    }
    g.addEventListener('pointerenter', () => g.querySelector('.band-bg').setAttribute('fill', 'var(--hover)'));
    g.addEventListener('pointermove', (e) => showDayTooltip(day, kindLabel, series.map((s) => ({ ...s, value: valueOf(s.key, day) })), e.clientX, e.clientY));
    g.addEventListener('pointerleave', () => {
      g.querySelector('.band-bg').setAttribute('fill', 'transparent');
      hideTooltip();
    });
  });
}

function showDayTooltip(day, kindLabel, rows, px, py) {
  placeTooltip(
    `<div class="tt-title">${utcDateFormat.format(new Date(day + 'T00:00:00Z'))}</div><div class="tt-date">${kindLabel}</div>` +
      rows.map(
        (r) => `<div class="tt-row"><i class="swatch" style="background:var(--series-${r.key})"></i>${r.label}<b>${fmt(r.value)}</b></div>`
      ).join(''),
    px,
    py
  );
}

// ---------- Releases ----------

function niceStep(max, targetTicks) {
  const raw = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

// Column with only its top corners rounded, so the bar stays anchored to the baseline.
function topRoundedRect(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function renderLegend() {
  $('legend').innerHTML = PLATFORMS.map(
    (p) => `<span><i class="swatch" style="background:var(--series-${p.key})"></i>${p.label}</span>`
  ).join('');
}

// One toggle per release, so small releases can be read without the big one flattening the scale.
function renderFilters() {
  $('filters').innerHTML = releases.map((r) =>
    `<label class="chip"><input type="checkbox" value="${r.tag}" ${hiddenTags.has(r.tag) ? '' : 'checked'}>${r.tag}</label>`
  ).join('');
  $('filters').onchange = (e) => {
    if (e.target.checked) hiddenTags.delete(e.target.value);
    else hiddenTags.add(e.target.value);
    writeHidden();
    renderChart();
  };
}

function renderChart() {
  const chart = $('chart');
  chart.innerHTML = '';
  const shown = releases.filter((r) => !hiddenTags.has(r.tag));
  if (!shown.length) {
    chart.innerHTML = `<p class="muted">${releases.length ? 'Pick at least one release above.' : 'No releases found.'}</p>`;
    return;
  }

  const W = Math.max(chart.clientWidth - 16, 300);
  const H = 340;
  const m = { top: 28, right: 8, bottom: 52, left: 48 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const max = Math.max(...shown.map((r) => r.total), 1);
  const step = niceStep(max, 4);
  const yMax = Math.ceil(max / step) * step;
  const y = (v) => m.top + plotH - (v / yMax) * plotH;

  const band = plotW / shown.length;
  const barW = Math.min(56, band * 0.55);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Downloads per OSCAR release by platform' }, chart);

  for (let v = 0; v <= yMax; v += step) {
    el('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, svg);
    const label = el('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 12, fill: 'var(--text-muted)' }, svg);
    label.textContent = fmt(v);
  }

  shown.forEach((r, i) => {
    const cx = m.left + band * (i + 0.5);
    const g = el('g', { class: 'band', tabindex: 0, role: 'link', 'aria-label': `${r.name}: ${fmt(r.total)} downloads. Open counter.` }, svg);
    el('rect', { class: 'band-bg', x: m.left + band * i + 2, y: m.top - 24, width: band - 4, height: plotH + 24 + m.bottom - 4, rx: 8, fill: 'transparent' }, g);

    // Stack bottom-up, with a 2px surface gap between segments
    const visible = PLATFORMS.filter((p) => r.byPlatform[p.key] > 0);
    let acc = 0;
    visible.forEach((p, j) => {
      const v = r.byPlatform[p.key];
      const top = y(acc + v);
      const bottom = y(acc) - (j > 0 ? 2 : 0);
      const h = Math.max(bottom - top, 1);
      const isTop = j === visible.length - 1;
      el('path', {
        d: isTop ? topRoundedRect(cx - barW / 2, top, barW, h, 4) : `M${cx - barW / 2},${top}h${barW}v${h}h${-barW}Z`,
        fill: `var(--series-${p.key})`,
      }, g);
      acc += v;
    });

    const total = el('text', { x: cx, y: y(r.total) - 8, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--text-primary)' }, g);
    total.textContent = fmt(r.total);

    const tag = el('text', { x: cx, y: H - m.bottom + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--text-primary)' }, g);
    tag.textContent = r.tag;
    const date = el('text', { x: cx, y: H - m.bottom + 38, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-muted)' }, g);
    date.textContent = dateFormat.format(r.date);

    const open = () => (location.hash = `#/counter/${encodeURIComponent(r.tag)}`);
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    g.addEventListener('pointerenter', () => g.querySelector('.band-bg').setAttribute('fill', 'var(--hover)'));
    g.addEventListener('pointermove', (e) => showTooltip(r, e.clientX, e.clientY));
    g.addEventListener('pointerleave', () => {
      g.querySelector('.band-bg').setAttribute('fill', 'transparent');
      hideTooltip();
    });
  });
}

function showTooltip(r, px, py) {
  placeTooltip(
    `<div class="tt-title">${r.name}</div><div class="tt-date">${dateFormat.format(r.date)}</div>` +
      PLATFORMS.map(
        (p) => `<div class="tt-row"><i class="swatch" style="background:var(--series-${p.key})"></i>${p.label}<b>${fmt(r.byPlatform[p.key])}</b></div>`
      ).join('') +
      `<div class="tt-row tt-total">Total<b>${fmt(r.total)}</b></div><div class="tt-hint">Click to open the counter</div>`,
    px,
    py
  );
}

function placeTooltip(html, px, py) {
  const tip = $('tooltip');
  tip.innerHTML = html;
  tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  const x = px + 16 + width > window.innerWidth ? px - 16 - width : px + 16;
  const yPos = Math.min(Math.max(py - height / 2, 8), window.innerHeight - height - 8);
  tip.style.left = `${Math.max(x, 8)}px`;
  tip.style.top = `${yPos}px`;
}

function hideTooltip() {
  $('tooltip').hidden = true;
}

function renderTable() {
  const rows = [...releases].reverse().map((r) =>
    `<tr><td>${r.name}</td><td>${dateFormat.format(r.date)}</td>` +
    PLATFORMS.map((p) => `<td>${fmt(r.byPlatform[p.key])}</td>`).join('') +
    `<td><b>${fmt(r.total)}</b></td></tr>`
  );
  const all = allReleasesEntry();
  $('table').innerHTML =
    `<thead><tr><th>Release</th><th>Published</th>${PLATFORMS.map((p) => `<th>${p.label}</th>`).join('')}<th>Total</th></tr></thead>` +
    `<tbody>${rows.join('')}</tbody>` +
    `<tfoot><tr><td><b>All releases</b></td><td></td>${PLATFORMS.map((p) => `<td>${fmt(all.byPlatform[p.key])}</td>`).join('')}<td><b>${fmt(all.total)}</b></td></tr></tfoot>`;
}

// ---------- Counter ----------

// Navigation order for prev/next: oldest release ... newest release, all combined, then the site's counts.
function counterSequence() {
  return [...releases, allReleasesEntry(), ...signalEntries()];
}

function findCounterEntry(tag) {
  const seq = counterSequence();
  if (tag === 'latest') return seq[releases.length - 1];
  return seq.find((r) => r.tag === tag);
}

function openCounter(entry) {
  const seq = counterSequence();
  const index = seq.findIndex((r) => r.tag === entry.tag);
  $('counter-name').textContent = entry.name;
  $('counter-date').textContent = entry.date ? dateFormat.format(entry.date) : entry.hint;
  $('prev').disabled = index <= 0;
  $('next').disabled = index >= seq.length - 1;
  document.title = `${fmt(entry.total)} · ${entry.name} · OSCAR Downloads`;
  showCounter(entry.total);
  wakeOverlay();
}

function stepCounter(delta) {
  const seq = counterSequence();
  const current = location.hash.split('/')[2];
  const index = seq.findIndex((r) => r.tag === decodeURIComponent(current));
  const next = seq[index + delta];
  if (next) location.hash = `#/counter/${encodeURIComponent(next.tag)}`;
}

// Fade the controls after a few idle seconds so the counter can run on a display.
let idleTimer;
function wakeOverlay() {
  $('overlay').classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => $('overlay').classList.add('idle'), 3000);
}

// ---------- Routing ----------

function route() {
  const [, view, tag] = location.hash.split('/');
  hideTooltip();
  if (view === 'counter' && releases.length) {
    const entry = findCounterEntry(decodeURIComponent(tag || 'latest'));
    if (entry) {
      $('timeline-view').hidden = true;
      $('counter-view').hidden = false;
      openCounter(entry);
      return;
    }
  }
  hideCounter();
  document.title = 'OSCAR Downloads';
  $('counter-view').hidden = true;
  $('timeline-view').hidden = false;
  renderDaily();
  renderChart();
}

async function init() {
  renderLegend();
  $('open-all').addEventListener('click', () => (location.hash = '#/counter/all'));
  for (const tag of ['site', ...KINDS.flatMap((k) => [k.prefix + 'installs', k.prefix + 'users'])]) {
    $('open-' + tag).addEventListener('click', () => (location.hash = '#/counter/' + tag));
  }
  $('prev').addEventListener('click', () => stepCounter(-1));
  $('next').addEventListener('click', () => stepCounter(1));
  $('counter-view').addEventListener('pointermove', wakeOverlay);
  document.addEventListener('keydown', (e) => {
    if ($('counter-view').hidden) return;
    wakeOverlay();
    if (e.key === 'ArrowLeft') stepCounter(-1);
    if (e.key === 'ArrowRight') stepCounter(1);
    if (e.key === 'Escape') location.hash = '#/timeline';
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => {
    if ($('timeline-view').hidden) return;
    renderDaily();
    renderChart();
  });

  $('timeline-view').hidden = false;
  // Both at once; the site's counts are optional, GitHub's are not.
  const [releasesResult, statsResult] = await Promise.allSettled([fetchReleases(), fetchStats()]);
  if (statsResult.status === 'fulfilled') stats = statsResult.value;
  else console.warn("The site's counts are not available:", statsResult.reason && statsResult.reason.message);
  if (releasesResult.status === 'rejected') {
    $('status').textContent = `Couldn't load releases from GitHub (${releasesResult.reason.message}). Try again in a few minutes.`;
    renderSignals();
    return;
  }
  releases = releasesResult.value;
  renderSignals();
  renderTable();
  renderFilters();
  route();
}

window.addEventListener('load', init);
