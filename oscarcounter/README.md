# OSCAR DOWNLOADS COUNTER

Shows how many OSCAR installers have been downloaded from
https://github.com/trafalmejo/OSCAR/releases, per release and in total.

[DEMO HERE](https://trafalmejo.github.io/data-visualization/oscarcounter)

## Views

- **Timeline** (`#/timeline`, default): one stacked column per release in release order, split by
  Windows / macOS / Linux. Hover for the breakdown, toggle releases on and off with the chips,
  and click a release to open its counter. A table view is at the bottom.
- **Fullscreen counter** (`#/counter/<tag>`): the zooming number animation for one release, e.g.
  [`#/counter/v2.1.0`](https://trafalmejo.github.io/data-visualization/oscarcounter/#/counter/v2.1.0).
  `#/counter/latest` shows the newest release and `#/counter/all` shows every release combined.
  Use ← / → to step through releases and Esc to go back. The controls fade after 3 seconds.

## What is counted

Installer files only (`.exe`, `.dmg`, `.AppImage`, `.deb`, `.zip`, ...). The auto-updater's
`.yml` manifests and `.blockmap` files are skipped because the app downloads those, not people.
GitHub only keeps a running total per file, not when each download happened, so the timeline
places releases by publish date rather than showing downloads over time. API responses are
cached for 10 minutes to stay under GitHub's unauthenticated rate limit.
