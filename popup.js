(async function init() {
  const slider = document.getElementById('slider');
  const valueEl = document.getElementById('value');
  const resetBtn = document.getElementById('resetBtn');
  const hintEl = document.querySelector('.hint');

  const tab = await getActiveTab();
  if (!tab) return;

  // If the current page is restricted by Chrome, disable controls and inform the user
  if (isRestrictedUrl(tab.pendingUrl || tab.url)) {
    slider.disabled = true;
    resetBtn.disabled = true;
    if (hintEl) {
      hintEl.textContent = 'This page is restricted by Chrome; extensions cannot modify it.';
    }
    return;
  }

  // Load current brightness for this tab
  const current = await sendMessage({ type: 'getBrightness', tabId: tab.id });
  const brightness = normalize(current?.value ?? 1);
  setUI(brightness);

  slider.addEventListener('input', async (e) => {
    const percent = Number(e.target.value);
    valueEl.textContent = `${percent}%`;
    const val = clamp(percent / 100, 0, 2);
    await sendMessage({ type: 'setBrightness', tabId: tab.id, value: val });
  });

  resetBtn.addEventListener('click', async () => {
    const val = 1; // 100%
    await sendMessage({ type: 'setBrightness', tabId: tab.id, value: val });
    setUI(val);
  });

  function setUI(val) {
    const percent = Math.round(clamp(val, 0, 2) * 100);
    slider.value = String(percent);
    valueEl.textContent = `${percent}%`;
  }
})();

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function normalize(n) { return clamp(Number(n) || 1, 0, 2); }

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0]);
    });
  });
}

function isRestrictedUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const restrictedProtocols = ['chrome:', 'chrome-extension:', 'chrome-devtools:'];
    if (restrictedProtocols.includes(u.protocol)) return true;
    const restrictedHosts = new Set([
      'chrome.google.com', // legacy web store
      'chromewebstore.google.com', // new web store domain
    ]);
    return restrictedHosts.has(u.hostname);
  } catch {
    return false;
  }
}

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      resolve(res && res.ok ? res : { ok: false, value: 1 });
    });
  });
}
