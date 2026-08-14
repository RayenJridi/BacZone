/* ============================================================
   BacZone — app.js
   يخدم في كل صفحات الموقع:
   1) تسجيل Service Worker (PWA)
   2) زر "Ajouter à l'écran d'accueil"
   3) نظام Favoris (⭐) بالكامل بـ localStorage — بلا database
   ============================================================ */

(function () {
  "use strict";

  const FAV_KEY = "baczone_favorites_v1";

  // ---------- 1) Service Worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/BacZone/sw.js").catch(() => {});
    });
  }

  // ---------- 2) PWA install prompt ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.classList.add("show");
    const navBtn = document.getElementById("navInstallBtn");
    if (navBtn) navBtn.classList.add("show");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.classList.remove("show");
    const navBtn = document.getElementById("navInstallBtn");
    if (navBtn) navBtn.classList.remove("show");
  });

  document.addEventListener("DOMContentLoaded", () => {
    const installBtn = document.getElementById("pwaInstallBtn");
    const dismissBtn = document.getElementById("pwaDismissBtn");
    const banner = document.getElementById("pwaInstallBanner");
    const navBtn = document.getElementById("navInstallBtn");

    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (banner) banner.classList.remove("show");
        if (navBtn) navBtn.classList.remove("show");
      });
    }
    if (navBtn) {
      navBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        navBtn.classList.remove("show");
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        if (banner) banner.classList.remove("show");
        sessionStorage.setItem("baczone_pwa_dismissed", "1");
      });
    }
    if (sessionStorage.getItem("baczone_pwa_dismissed") === "1" && banner) {
      banner.classList.remove("show");
    }
  });

  // ---------- 3) Favoris ----------
  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  }

  function isFavorited(id) {
    return getFavorites().some((f) => f.id === id);
  }

  function toggleFavorite(item) {
    let list = getFavorites();
    const exists = list.some((f) => f.id === item.id);
    if (exists) {
      list = list.filter((f) => f.id !== item.id);
    } else {
      list.unshift(item);
    }
    saveFavorites(list);
    return !exists; // true = تزادت، false = تحيّدت
  }

  function updateStarUI(btn, active) {
    btn.textContent = active ? "★" : "☆";
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.title = active ? "إزالة من المفضلة" : "أضف للمفضلة";
  }

  // يزيد زر ⭐ بجانب كل رابط .go داخل .res-item إلي ما فيهاش placeholder
  function injectStarButtons() {
    const items = document.querySelectorAll(".res-item:not(.placeholder)");
    const subjectName =
      document.querySelector(".subject-hero h1")?.textContent?.trim() ||
      document.title.split("—")[0].trim();
    const pageUrl = window.location.pathname.split("/").pop();

    items.forEach((li) => {
      if (li.querySelector(".fav-btn")) return; // ما نزيدوش مرتين
      const link = li.querySelector("a.go");
      const labelEl = li.querySelector(".label");
      if (!link || !labelEl) return;

      const id = link.getAttribute("href");
      const title = labelEl.textContent.replace(/🆕.*$/, "").trim();

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fav-btn";
      updateStarUI(btn, isFavorited(id));

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const active = toggleFavorite({
          id,
          title,
          subject: subjectName,
          page: pageUrl,
          url: id,
        });
        updateStarUI(btn, active);
      });

      li.insertBefore(btn, li.firstChild);
    });
  }

  document.addEventListener("DOMContentLoaded", injectStarButtons);

  // نعرضها عالميا باش صفحة favoris.html تنجم تستعملها
  window.BacZoneFav = { getFavorites, saveFavorites, toggleFavorite, isFavorited };
})();
