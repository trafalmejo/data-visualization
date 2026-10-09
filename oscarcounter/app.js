// Two views, switched by the URL hash:
//   #/timeline            releases as stacked columns in release order (default)
//   #/counter/<tag>       fullscreen counter for one release, e.g. #/counter/v2.1.0
//   #/counter/latest      fullscreen counter for the newest release
//   #/counter/all         fullscreen counter for every release combined

const SVG_NS = 'http://www.w3.org/2000/svg';
const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const fmt = (n) => n.toLocaleString('en-US');

let releases = [];
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
    byPlatform,
    total: releases.reduce((sum, r) => sum + r.total, 0),
  };
}

// ---------- Timeline ----------

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
  const tip = $('tooltip');
  tip.innerHTML =
    `<div class="tt-title">${r.name}</div><div class="tt-date">${dateFormat.format(r.date)}</div>` +
    PLATFORMS.map(
      (p) => `<div class="tt-row"><i class="swatch" style="background:var(--series-${p.key})"></i>${p.label}<b>${fmt(r.byPlatform[p.key])}</b></div>`
    ).join('') +
    `<div class="tt-row tt-total">Total<b>${fmt(r.total)}</b></div><div class="tt-hint">Click to open the counter</div>`;
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

// Navigation order for prev/next: oldest release ... newest release, then all combined.
function counterSequence() {
  return [...releases, allReleasesEntry()];
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
  $('counter-date').textContent = entry.date ? dateFormat.format(entry.date) : `${releases.length} releases`;
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
  renderChart();
}

async function init() {
  renderLegend();
  $('open-all').addEventListener('click', () => (location.hash = '#/counter/all'));
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
    if (!$('timeline-view').hidden) renderChart();
  });

  $('timeline-view').hidden = false;
  try {
    releases = await fetchReleases();
    $('total-all').textContent = fmt(allReleasesEntry().total);
    renderTable();
    renderFilters();
  } catch (err) {
    $('status').textContent = `Couldn't load releases from GitHub (${err.message}). Try again in a few minutes.`;
    return;
  }
  route();
}

window.addEventListener('load', init);
