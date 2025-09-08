// Content script for Browser Dimmer
// Injects a CSS rule that ties brightness to a CSS variable and updates it.

(function init() {
  try {
    ensureStyleInjected();
    // Ask background for current brightness for this tab
    chrome.runtime.sendMessage(
      { type: 'content_request_brightness' },
      (res) => {
        const value = res && res.ok ? Number(res.value) : 1;
        applyBrightness(value);
      }
    );
  } catch (e) {
    // noop
  }
})();

function ensureStyleInjected() {
  if (document.getElementById('browser-dimmer-style')) return;
  const style = document.createElement('style');
  style.id = 'browser-dimmer-style';
  style.textContent = `
    html { filter: brightness(var(--browser-dimmer-brightness, 1)) !important; }
  `;
  // head may not exist at document_start; attach to documentElement
  const parent = document.head || document.documentElement || document;
  parent.appendChild(style);
}

function applyBrightness(value) {
  const v = Math.max(0, Math.min(2, Number(value) || 0));
  document.documentElement.style.setProperty('--browser-dimmer-brightness', String(v));
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'applyBrightness') {
    applyBrightness(message.value);
  }
});

