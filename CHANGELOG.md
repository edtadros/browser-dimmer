# Changelog

## v1.0.0 — 2025-09-08
- Initial release.
- Per‑tab brightness control via popup slider (0–100%).
- Reset button to instantly return to 100%.
- Content script applies `filter: brightness()` scoped to the current page.
- Detects restricted pages (Chrome Web Store, chrome://, etc.) and disables controls; toolbar icon dims/strikes to indicate restriction.
- Monochrome toolbar icon (#a8a9a9 on #202121). PNGs generated at 16/32/48/128 from `icons/backlight.svg`.
- Manifest V3, background service worker, and README.
