const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "getShortMapsLink") return;
  handleGetShortMapsLink(message.address)
    .then((link) => sendResponse({ ok: true, link }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

async function handleGetShortMapsLink(address) {
  if (!address) throw new Error("Endereço vazio.");
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTabLoad(tab.id);
    await sleep(5000);
    for (let attempt = 0; attempt < 4; attempt++) {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: mapsShareExtractionStep });
      if (result?.done && result?.link) return result.link;
      await sleep(result?.waitMs || 2500);
    }
    const latest = await chrome.tabs.get(tab.id);
    if (latest?.url) return latest.url;
    throw new Error("Não foi possível capturar o link do Maps.");
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error("O Google Maps demorou demais para abrir.")); }, 30000);
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function mapsShareExtractionStep() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shortInput = [...document.querySelectorAll("input, textarea")].map((el) => (el.value || "").trim()).find((v) => /^https:\/\/maps\.app\.goo\.gl\//i.test(v));
  if (shortInput) return { done: true, link: shortInput };
  const shortAnchor = [...document.querySelectorAll("a[href]")].map((el) => el.href).find((href) => /^https:\/\/maps\.app\.goo\.gl\//i.test(href));
  if (shortAnchor) return { done: true, link: shortAnchor };
  const candidateButtons = [...document.querySelectorAll("button, [role=button], div[role=button]")];
  const findByText = (regex) => candidateButtons.find((el) => { const text = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim(); return regex.test(text); });
  const shareBtn = findByText(/\b(compartilhar|partilhar|share)\b/i);
  if (shareBtn) {
    shareBtn.click();
    await sleep(1800);
    const afterClickShortInput = [...document.querySelectorAll("input, textarea")].map((el) => (el.value || "").trim()).find((v) => /^https:\/\/maps\.app\.goo\.gl\//i.test(v));
    if (afterClickShortInput) return { done: true, link: afterClickShortInput };
    const copyBtn = findByText(/\b(copiar link|copy link|copiar)\b/i);
    if (copyBtn) {
      copyBtn.click();
      await sleep(1200);
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && /^https?:\/\//i.test(clip)) return { done: true, link: clip };
      } catch (_) {}
    }
    const anyInput = [...document.querySelectorAll("input, textarea")].map((el) => (el.value || "").trim()).find((v) => /^https?:\/\//i.test(v));
    if (anyInput) return { done: true, link: anyInput };
  }
  return { done: false, waitMs: 2500 };
}
