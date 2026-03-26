(function () {
  if (window.__dunorteMapsBridgeLoaded) return;
  window.__dunorteMapsBridgeLoaded = true;
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (event.source !== window) return;
    if (data.source !== "dunorte-site") return;
    if (data.action === "pingExtension") {
      window.postMessage({ source: "dunorte-extension", requestId: data.requestId, ok: true }, "*");
      return;
    }
    if (data.action === "getShortMapsLink") {
      chrome.runtime.sendMessage({ type: "getShortMapsLink", address: data.address }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          window.postMessage({ source: "dunorte-extension", requestId: data.requestId, ok: false, error: err.message || "Falha ao falar com a extensão." }, "*");
          return;
        }
        window.postMessage({ source: "dunorte-extension", requestId: data.requestId, ok: !!response?.ok, link: response?.link || "", error: response?.error || "" }, "*");
      });
    }
  });
})();
