# Browser Dimmer (Chrome Extension)

Adjust the brightness of the current page only using a simple slider from the extension popup. Brightness is per-tab and remembered while the tab stays open.

## Features
- Per-tab brightness control (0%–200% internally; slider shows 0%–100%).
- Applies instantly without reloading the page.
- Resets to normal when the tab is closed.
 - One-click Reset button to return to 100%.

## How it works
- A content script injects a CSS rule: `html { filter: brightness(var(--browser-dimmer-brightness, 1)) !important; }`
- The popup slider sends updates to the background, which stores the brightness per tab and notifies the content script to update a CSS variable on the page.

## Install (Load Unpacked)
1. Open Chrome and go to `chrome://extensions`.
2. Enable "Developer mode" (top-right).
3. Click "Load unpacked" and select this folder.
4. Pin the extension (optional), then click its icon to adjust brightness on the current tab.

## Notes
- Some pages do not allow extensions to run content scripts; brightness will not apply there. Examples:
  - Chrome Web Store: `chromewebstore.google.com` and `chrome.google.com`
  - Browser internals: `chrome://*`, `chrome-extension://*`, `chrome-devtools://*`
- Existing tabs opened before installation may require a refresh to activate the content script.
- Default brightness is 100% (no change). The extension supports up to 200% internally to allow potential brightening; the popup shows 0–100% by default.

## Files
- `manifest.json` — MV3 manifest
- `background.js` — service worker holding per-tab state and messaging
  - Toolbar icon is a monochrome line drawing (#a8a9a9 on #202121) generated at multiple sizes. It dims on restricted pages.
- `content.js` — injects and updates the brightness CSS on pages
- `popup.html`, `popup.js`, `popup.css` — slider UI and logic
  - Includes a Reset button (☀️) to jump to 100%

## Icons
- Source SVGs: `icons/backlight.svg` (toolbar) and `icons/reset.svg` (popup button)
- Pre-generated PNGs used by the manifest live in `icons/generated/`.
  No build step is required.
