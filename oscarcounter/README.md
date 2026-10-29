# OSCAR DOWNLOADS COUNTER

Three counts of [OSCAR](https://github.com/trafalmejo/OSCAR), side by side:

- **Installer downloads on GitHub**, per release. The upper bound: GitHub keeps a running total per
  file and cannot tell a person from a crawler.
- **Downloads from the site**: clicks on the download buttons at
  [createwithoscar.com](https://www.createwithoscar.com) by people. Crawlers, link previews and
  scripts are left out. Counted since 29 October 2026.
- **Installs that launched**: the first time a copy of OSCAR was opened, from the app's anonymous
  telemetry (which anyone can switch off). Counted since 25 September 2026.

[DEMO HERE](https://trafalmejo.github.io/data-visualization/oscarcounter)

## Views

- **Timeline** (`#/timeline`, default): the three totals, a day-by-day chart of site downloads and
  installs over the last six weeks, then one stacked column per release in release order, split by
  Windows / macOS / Linux. Hover for the breakdown, toggle releases on and off with the chips, and
  click a total or a release to open its counter. A table view is at the bottom.
- **Fullscreen counter** (`#/counter/<tag>`): the zooming number animation for one count, e.g.
  [`#/counter/v2.1.0`](https://trafalmejo.github.io/data-visualization/oscarcounter/#/counter/v2.1.0).
  `#/counter/latest` shows the newest release, `#/counter/all` every release combined,
  `#/counter/site` the site's downloads and `#/counter/installs` the installs that launched.
  Use ← / → to step through them and Esc to go back. The controls fade after 3 seconds.

## Where the numbers come from

GitHub's come from its releases API: installer files only (`.exe`, `.dmg`, `.AppImage`, `.deb`,
`.zip`, ...), with the auto-updater's `.yml` manifests and `.blockmap` files skipped because the app
downloads those, not people. GitHub only keeps a running total per file, not when each download
happened, so releases sit by publish date rather than showing downloads over time.

The other two come from `https://www.createwithoscar.com/stats.json`, which the website publishes
from OSCAR's anonymous counts: totals and per-day numbers only, no ids, no countries, nothing about
any one install. When it cannot be reached the page shows GitHub's numbers alone.

Both are cached in the browser for 10 minutes, which keeps GitHub's unauthenticated rate limit happy.
`?stats=<url>` points the page at another stats file while working on it.
