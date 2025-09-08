// Background service worker for Browser Dimmer (Manifest V3)

// Use session storage so values are per-browser-session and ephemeral
// Key by tabId: `b:<tabId>` -> number (0..2)

const STORAGE_AREA = chrome.storage.session || chrome.storage.local;

async function getKey(tabId) {
  return `b:${tabId}`;
}

async function getBrightness(tabId) {
  const key = await getKey(tabId);
  const obj = await STORAGE_AREA.get(key);
  const val = obj[key];
  // Default brightness is 1 (100%)
  if (typeof val !== 'number' || !isFinite(val)) return 1;
  return Math.max(0, Math.min(2, val));
}

async function setBrightness(tabId, value) {
  const key = await getKey(tabId);
  const v = Math.max(0, Math.min(2, Number(value)));
  await STORAGE_AREA.set({ [key]: v });
  // Notify content script in the target tab
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'applyBrightness', value: v });
  } catch (e) {
    // No receiver (e.g., page where content scripts can't run like chrome://)
    // Silently ignore.
  }
}

// Cleanup when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId, _info) => {
  const key = await getKey(tabId);
  try {
    await STORAGE_AREA.remove(key);
  } catch (_e) {
    // ignore
  }
});

// Messaging API
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message || {};
  if (type === 'ensureInjected') {
    (async () => {
      try {
        const tabId = Number(message.tabId);
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        });
        // After injection, return current brightness for convenience
        const value = await getBrightness(tabId);
        sendResponse({ ok: true, value });
      } catch (e) {
        try {
          // Best-effort: mark icon disabled for this tab if injection failed
          await updateIconForTab(message.tabId);
        } catch {}
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }
  if (type === 'getBrightness') {
    // From popup: expects tabId in message
    (async () => {
      try {
        const tabId = Number(message.tabId);
        const value = await getBrightness(tabId);
        sendResponse({ ok: true, value });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }

  if (type === 'setBrightness') {
    (async () => {
      try {
        const tabId = Number(message.tabId);
        await setBrightness(tabId, message.value);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }

  if (type === 'content_request_brightness') {
    // From content script: use sender.tab.id
    (async () => {
      try {
        const tabId = sender?.tab?.id;
        if (typeof tabId !== 'number') {
          sendResponse({ ok: false, error: 'No tab id in sender' });
          return;
        }
        const value = await getBrightness(tabId);
        sendResponse({ ok: true, value });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }

  // Not handled
  return false;
});

// ---- Action icon (monochrome line icon) ----
const ICON_FG = '#a8a9a9';
const ICON_BG = '#202121';

function isRestrictedUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const restrictedProtocols = ['chrome:', 'chrome-extension:', 'chrome-devtools:'];
    if (restrictedProtocols.includes(u.protocol)) return true;
    const restrictedHosts = new Set(['chrome.google.com', 'chromewebstore.google.com']);
    return restrictedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

async function updateIconForTab(tabId) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetTab = tabId ? await chrome.tabs.get(tabId) : tab;
    if (!targetTab) return;
    const restricted = isRestrictedUrl(targetTab.pendingUrl || targetTab.url);
    if (typeof OffscreenCanvas === 'undefined') return;
    const sizes = [16, 32, 48, 128];
    const svgText = await getBacklightSvg();
    const imageData = {};
    for (const s of sizes) {
      imageData[s] = await rasterizeIconFromSvg(svgText, s, restricted);
    }
    await chrome.action.setIcon({ imageData, tabId: targetTab.id });
  } catch (_e) {
    // ignore
  }
}

let _svgCacheText = null;
async function getBacklightSvg() {
  if (_svgCacheText) return _svgCacheText;
  try {
    const url = chrome.runtime.getURL('icons/backlight.svg');
    const res = await fetch(url);
    const text = await res.text();
    // Ensure monochrome by coercing common stroke/fill values to ICON_FG
    const normalized = text
      .replace(/stroke="#?[0-9a-fA-F]{3,6}"/g, `stroke="${ICON_FG}"`)
      .replace(/fill="#?[0-9a-fA-F]{3,6}"/g, (m) => (m.includes('none') ? m : `fill="${ICON_FG}"`));
    _svgCacheText = normalized;
    return _svgCacheText;
  } catch {
    // Fallback empty circle outline if fetch fails
    _svgCacheText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke="${ICON_FG}" fill="none" stroke-width="2"/></svg>`;
    return _svgCacheText;
  }
}

async function rasterizeIconFromSvg(svgText, size, disabled) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  // Background panel
  ctx.fillStyle = ICON_BG;
  ctx.fillRect(0, 0, size, size);

  // Draw SVG centered with padding
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const bitmap = await createImageBitmap(blob);
  const pad = Math.floor(size * 0.06); // less padding -> larger icon
  const targetW = size - pad * 2;
  const targetH = size - pad * 2;
  // Maintain aspect ratio
  const scale = Math.min(targetW / bitmap.width, targetH / bitmap.height);
  const drawW = Math.round(bitmap.width * scale);
  const drawH = Math.round(bitmap.height * scale);
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);
  ctx.globalAlpha = disabled ? 0.45 : 1.0;
  ctx.drawImage(bitmap, dx, dy, drawW, drawH);

  // Disabled strike-through
  if (disabled) {
    ctx.strokeStyle = ICON_FG;
    ctx.lineWidth = Math.max(1, Math.floor(size * 0.08));
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.8);
    ctx.lineTo(size * 0.8, size * 0.2);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, size, size);
}

// Update icon on install/activation/navigation
chrome.runtime.onInstalled.addListener(() => { updateIconForTab(); });
chrome.tabs.onActivated.addListener(({ tabId }) => { updateIconForTab(tabId); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    updateIconForTab(tabId);
  }
});
