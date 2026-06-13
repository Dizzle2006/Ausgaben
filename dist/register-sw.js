if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      // updateViaCache: "none" -> Browser darf den HTTP-Cache (GitHub Pages:
      // Cache-Control: max-age=600) NIEMALS für service-worker.js verwenden.
      // Ohne das kann registration.update() bis zu 10 Minuten lang dieselbe
      // alte SW-Datei aus dem HTTP-Cache bekommen und denkt, es gäbe kein Update.
      .register("service-worker.js", { updateViaCache: "none" })
      .then(function (registration) {
        // Sofort auf eine neue Version prüfen (umgeht den 24h-Browser-Intervall)
        registration.update();

        // Bei jedem Sichtbarwerden der App (z.B. PWA aus Hintergrund geholt)
        // erneut auf Updates prüfen — wichtig für lang offene PWA-Tabs.
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") registration.update();
        });

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
