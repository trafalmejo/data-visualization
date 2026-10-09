// Fetches OSCAR releases from GitHub and counts installer downloads per platform.
// Auto-updater files (.yml manifests, .blockmap diffs) are skipped: those are
// fetched by the app itself, not by people downloading OSCAR.

const REPO = 'trafalmejo/OSCAR';
const CACHE_KEY = 'oscarcounter:releases';
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

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.time < CACHE_MS) return cached.releases;
  } catch (e) {}
  return null;
}

function writeCache(releases) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), releases }));
  } catch (e) {}
}

// Returns releases oldest first.
async function fetchReleases() {
  let releases = readCache();
  if (!releases) {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    releases = (await response.json()).filter((r) => !r.draft).map(summarize);
    writeCache(releases);
  }
  return releases
    .map((r) => ({ ...r, date: new Date(r.date) }))
    .sort((a, b) => a.date - b.date);
}
