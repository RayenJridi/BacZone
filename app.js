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
  const THEME_KEY = "baczone_theme"; // "light" | "dark" | absent = يتبع النظام

  // ---------- 0) Theme toggle (التطبيق المبكر قبل الرسم موجود في <head> كل صفحة) ----------
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggleBtn");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!getStoredTheme()) applyTheme(e.matches ? "dark" : "light");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggleBtn");
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    if (btn) btn.textContent = currentTheme === "dark" ? "☀️" : "🌙";

    if (btn) {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }
  });

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

  // ---------- 4) شنوّة الجديد (Quoi de neuf) ----------
  // قائمة مركزية بآخر التحديثات — نزيدها إحنا يدوي كل مرة نزيد محتوى.
  // "date" = آخر تاريخ تحديث في هاذ الدفعة، يتحسب مع آخر تاريخ شافو الطالب.
  const WHATS_NEW = [
    {
      date: "2026-08-15",
      items: [
        "🍅 تايمر Pomodoro جديد — راجع بتركيز وتابع وقتك يوم بيوم",
      ],
    },
    {
      date: "2026-08-14",
      items: [
        "🌙 وضع ليلي/نهاري جديد (Dark Mode) — بدلو من فوق يمين",
        "⭐ نظام المفضلة (Favoris) — احفظ أي درس ورجعلو بسرعة",
        "📱 تثبيت BacZone على الشاشة الرئيسية للهاتف",
      ],
    },
    {
      date: "2026-08-12",
      items: [
        "📚 دروس جديدة في Arabe (5 ملفات) و Français (Grammaire)",
        "📄 قسم Sujet Bac جديد في Physique — 24 سؤال مصحح",
      ],
    },
    {
      date: "2026-08-11",
      items: [
        "🎬 أكثر من 100 فيديو جديدة في Mathématiques و Génie Électrique",
        "📄 قسم Devoir BAC في Mathématiques — مواضيع من 2019 لـ2026",
      ],
    },
  ];

  function renderWhatsNew() {
    const banner = document.getElementById("whatsNewBanner");
    if (!banner) return;

    const SEEN_KEY = "baczone_whatsnew_seen";
    const lastSeen = localStorage.getItem(SEEN_KEY) || "2000-01-01";
    const fresh = WHATS_NEW.filter((batch) => batch.date > lastSeen);

    if (fresh.length === 0) return; // ما فماش جديد من آخر زيارة

    const list = fresh
      .flatMap((batch) => batch.items)
      .slice(0, 5)
      .map((t) => `<li>${t}</li>`)
      .join("");

    banner.innerHTML = `
      <div class="wn-inner">
        <div class="wn-head">
          <span class="wn-badge">🔔 شنوّة الجديد</span>
          <button type="button" class="wn-close" id="wnCloseBtn" aria-label="سكر">✕</button>
        </div>
        <ul class="wn-list">${list}</ul>
      </div>`;
    banner.classList.add("show");

    document.getElementById("wnCloseBtn").addEventListener("click", () => {
      localStorage.setItem(SEEN_KEY, WHATS_NEW[0].date);
      banner.classList.remove("show");
    });
  }

  document.addEventListener("DOMContentLoaded", renderWhatsNew);

  document.addEventListener("DOMContentLoaded", injectStarButtons);

  // نعرضها عالميا باش صفحة favoris.html تنجم تستعملها
  window.BacZoneFav = { getFavorites, saveFavorites, toggleFavorite, isFavorited };
})();


