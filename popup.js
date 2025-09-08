(async function init() {
  const slider = document.getElementById('slider');
  const valueEl = document.getElementById('value');
  const resetBtn = document.getElementById('resetBtn');
  const hintEl = document.querySelector('.hint');

  const tab = await getActiveTab();
  if (!tab) return;

  // Ensure content is injected on the active tab (activeTab permission applies via user gesture)
  const injected = await sendMessage({ type: 'ensureInjected', tabId: tab.id });
  if (!injected || !injected.ok) {
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

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      resolve(res && res.ok ? res : { ok: false, value: 1 });
    });
  });
}
