if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function (registration) {
        // Sofort auf eine neue Version prüfen (umgeht den 24h-Browser-Intervall)
        registration.update();

        // Reload, sobald eine neue SW-Version übernommen hat (skipWaiting + clients.claim
        // im Service Worker führen dazu, dass "controllerchange" feuert)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(function (err) { console.warn("SW registration failed:", err); });
  });
}
