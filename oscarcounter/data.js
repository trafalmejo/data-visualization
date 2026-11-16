// Two sources, both read-only and public:
//
//   GitHub   installer download counts per release. A running total per file,
//            with no way to tell a person from a crawler, so it is the upper
//            bound. Auto-updater files (.yml manifests, .blockmap diffs) are
//            skipped: the app fetches those, not people.
//
//   The site  https://www.createwithoscar.com/stats.json, published by the
//            website itself from OSCAR's anonymous counts: download clicks on
//            the site's own buttons (people only, crawlers dropped) and
//            installs that actually launched, each by day, plus how many
//            installs came back, opened this week or published, and the
//            unique users: different installs opened per day. No ids,
//            no countries, nothing about any one install.

const REPO = 'trafalmejo/OSCAR';
const STATS_URL = 'https://www.createwithoscar.com/stats.json';
const CACHE_KEY = 'oscarcounter:releases';
const STATS_CACHE_KEY = 'oscarcounter:stats';
const CACHE_MS = 10 * 60 * 1000;

const PLATFORMS = [
  { key: 'windows', label: 'Windows' },
  { key: 'mac', label: 'macOS' },
  { key: 'linux', label: 'Linux' },
];

function platformOf(fileName) {
  const n = fileName.toLowerCase();
  if (/\.(ya?ml|blockmap)$/.test(n)) return null;
  // mac first: "darwin" contains "win"
  if (/mac|darwin|\.dmg$|\.pkg$/.test(n)) return 'mac';
  if (/win|\.exe$|\.msi$/.test(n)) return 'windows';
  if (/linux|\.appimage$|\.deb$|\.rpm$|\.snap$/.test(n)) return 'linux';
  return null;
}

function summarize(release) {
  const byPlatform = { windows: 0, mac: 0, linux: 0 };
  const assets = [];
  for (const a of release.assets) {
    const platform = platformOf(a.name);
    if (!platform) continue;
    byPlatform[platform] += a.download_count;
    assets.push({ name: a.name, platform, count: a.download_count });
  }
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    date: new Date(release.published_at || release.created_at),
    prerelease: release.prerelease,
    byPlatform,
    total: byPlatform.windows + byPlatform.mac + byPlatform.linux,
    assets,
  };
}

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (cached && Date.now() - cached.time < CACHE_MS) return cached.value;
  } catch (e) {}
  return null;
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), value }));
  } catch (e) {}
}

// Returns releases oldest first.
async function fetchReleases() {
  let releases = readCache(CACHE_KEY);
  if (!releases) {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    releases = (await response.json()).filter((r) => !r.draft).map(summarize);
    writeCache(CACHE_KEY, releases);
  }
  return releases
    .map((r) => ({ ...r, date: new Date(r.date) }))
    .sort((a, b) => a.date - b.date);
}

// The site's counts, or a throw when they cannot be had (the page then shows
// GitHub's numbers alone). `?stats=<url>` points it elsewhere while working
// on the page, and is never cached.
async function fetchStats() {
  const override = new URLSearchParams(location.search).get('stats');
  let stats = override ? null : readCache(STATS_CACHE_KEY);
  if (!stats) {
    const response = await fetch(override || STATS_URL);
    if (!response.ok) throw new Error(`stats responded ${response.status}`);
    stats = await response.json();
    if (!stats || !stats.installs || !stats.clicks) throw new Error('stats are not in the expected shape');
    if (!override) writeCache(STATS_CACHE_KEY, stats);
  }
  return stats;
}
