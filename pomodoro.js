/* ============================================================
   BacZone — pomodoro.js
   تايمر بومودورو مربوط بالمواد، كل شيء بـ localStorage.
   محرك التايمر مبني على "وقت حقيقي" (timestamps) موش عد تيكات،
   باش يبقى دقيق حتى لو الصفحة اتسكرت فالخلفية أو الطالب خرج
   وبعدها رجع — الوقت يتحسب من جديد على أساس الوقت الحقيقي إلي فات.
   ============================================================ */

(function () {
  "use strict";

  const SESS_KEY = "baczone_pomo_sessions_v1";
  const STATE_KEY = "baczone_pomo_active_v1"; // حالة الجلسة الجارية (تعيش حتى بعد ما تسكر التبويبة)
  const DURATIONS = { pomodoro: 25, pause: 5 };
  const MIN_LOG_SECONDS = 60; // أقل وقت يتسجل (دقيقة وحدة) باش نتفادى تسجيل ضغطات بالغلط

  const SUBJECTS = [
    { id: "mathematiques", name: "Mathématiques", accent: "#3E63B5" },
    { id: "physique", name: "Physique", accent: "#7A4FBF" },
    { id: "genie-electrique", name: "Génie Électrique", accent: "#C9822B" },
    { id: "mecanique", name: "Mécanique", accent: "#45795A" },
    { id: "arabe", name: "Arabe", accent: "#B04A32" },
    { id: "francais", name: "Français", accent: "#1F7A73" },
    { id: "anglais", name: "Anglais", accent: "#AD3B69" },
    { id: "philosophie", name: "Philosophie", accent: "#6B4A34" },
    { id: "autre", name: "أخرى", accent: "#8A8FA9" },
  ];

  const QUOTES = [
    { t: "الانضباط هو الجسر بين الأهداف والإنجاز.", a: "Jim Rohn" },
    { t: "النجاح هو مجموع مجهودات صغيرة تتكرر يوم بعد يوم.", a: "Robert Collier" },
    { t: "لا تستنى الوقت المناسب، اصنعو.", a: "" },
    { t: "25 دقيقة تركيز خير من ساعة تشتت.", a: "" },
    { t: "الطريق للباك يبدا بجلسة وحدة، توا.", a: "BacZone" },
  ];

  function getSessions() {
    try { return JSON.parse(localStorage.getItem(SESS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveSessions(list) {
    localStorage.setItem(SESS_KEY, JSON.stringify(list));
  }
  function todayStr(d) {
    d = d || new Date();
    return d.toISOString().slice(0, 10);
  }

  function loadActiveState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)); }
    catch (e) { return null; }
  }
  function saveActiveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
  function clearActiveState() {
    localStorage.removeItem(STATE_KEY);
  }

  document.addEventListener("DOMContentLoaded", () => {
    // ---------- state ----------
    let mode = "pomodoro"; // "pomodoro" | "pause"
    let durationMin = DURATIONS.pomodoro;
    let selectedSubject = SUBJECTS[0];
    let running = false;
    let endAt = null;          // timestamp (ms) لي بش يوصلها العد كي يكون شغال
    let pausedRemaining = null; // ثواني متبقية كي يكون معلّق (paused)
    let timerId = null;

    // ---------- elements ----------
    const els = {
      tabPomo: document.getElementById("pmTabPomo"),
      tabPause: document.getElementById("pmTabPause"),
      ring: document.getElementById("pmRingFg"),
      time: document.getElementById("pmTime"),
      label: document.getElementById("pmLabel"),
      startBtn: document.getElementById("pmStart"),
      resetBtn: document.getElementById("pmReset"),
      stopBtn: document.getElementById("pmStop"),
      durationSelect: document.getElementById("pmDurationSelect"),
      subjectsWrap: document.getElementById("pmSubjects"),
      note: document.getElementById("pmNote"),
      sessionList: document.getElementById("pmSessionList"),
      statSessions: document.getElementById("pmStatSessions"),
      statTime: document.getElementById("pmStatTime"),
      statStreak: document.getElementById("pmStatStreak"),
      statTotal: document.getElementById("pmStatTotal"),
      chart: document.getElementById("pmChart"),
      quote: document.getElementById("pmQuote"),
      notifBtn: document.getElementById("pmNotifBtn"),
    };

    if (!els.ring) return; // مش صفحة Pomodoro

    // ---------- notifications ----------
    let notifTimerId = null;
    const NOTIF_TAG = "baczone-pomo";

    function notifSupported() {
      return "Notification" in window;
    }

    function updateNotifBtnUI() {
      if (!notifSupported()) { els.notifBtn.style.display = "none"; return; }
      const on = Notification.permission === "granted";
      els.notifBtn.classList.toggle("on", on);
      els.notifBtn.textContent = on
        ? "🔔 التنبيهات مفعّلة — تبان حتى برا الموقع"
        : "🔔 فعّل تنبيهات الوقت (يبان حتى برا الموقع)";
    }

    if (els.notifBtn) {
      updateNotifBtnUI();
      els.notifBtn.addEventListener("click", async () => {
        if (!notifSupported()) return;
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        updateNotifBtnUI();
      });
    }

    function showNotification(title, body, opts) {
      if (!notifSupported() || Notification.permission !== "granted") return null;
      try {
        return new Notification(title, Object.assign({
          body,
          tag: NOTIF_TAG,
          renotify: true,
          icon: "/BacZone/icons/icon-192.png",
          badge: "/BacZone/icons/icon-192.png",
        }, opts || {}));
      } catch (e) { return null; }
    }

    function updateNotifNow() {
      if (!running) return;
      const r = computeRemaining();
      const m = Math.ceil(r / 60);
      const modeLabel = mode === "pomodoro" ? `🍅 ${selectedSubject.name}` : "☕ استراحة";
      showNotification(
        `${modeLabel} — باقي ${m} د`,
        mode === "pomodoro" ? "ركّز، قريب توصل!" : "استريح شوية، توا ترجع تراجع."
      );
    }

    function startNotifLoop() {
      if (!notifSupported() || Notification.permission !== "granted") return;
      updateNotifNow();
      clearInterval(notifTimerId);
      notifTimerId = setInterval(updateNotifNow, 60 * 1000);
    }

    function stopNotifLoop() {
      clearInterval(notifTimerId);
      notifTimerId = null;
    }

    const RADIUS = 100;
    const CIRC = 2 * Math.PI * RADIUS;
    els.ring.style.strokeDasharray = CIRC;

    // ---------- render subjects ----------
    els.subjectsWrap.innerHTML = SUBJECTS.map((s) => `
      <button type="button" class="pomo-subj-btn" data-id="${s.id}" style="--accent:${s.accent}">
        <span class="dot"></span>${s.name}
      </button>`).join("");

    function setActiveSubjectUI(id) {
      els.subjectsWrap.querySelectorAll(".pomo-subj-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.id === id));
    }

    els.subjectsWrap.querySelectorAll(".pomo-subj-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setActiveSubjectUI(btn.dataset.id);
        selectedSubject = SUBJECTS.find(s => s.id === btn.dataset.id);
        persistState();
      });
    });

    // ---------- quote ----------
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    els.quote.innerHTML = `“${q.t}”` + (q.a ? `<span class="auth">— ${q.a}</span>` : "");

    // ---------- الوقت المتبقي الحقيقي (يتحسب من التوقيت، موش عد تيكات) ----------
    function computeRemaining() {
      if (running && endAt) {
        return Math.max(0, Math.round((endAt - Date.now()) / 1000));
      }
      if (pausedRemaining != null) return pausedRemaining;
      return durationMin * 60;
    }

    // ---------- حفظ/استرجاع الحالة (باش الجلسة تكمل حتى بعد ما تسكر الصفحة) ----------
    function persistState() {
      saveActiveState({
        mode, durationMin,
        subjectId: selectedSubject.id,
        endAt: running ? endAt : null,
        pausedRemaining: running ? null : pausedRemaining,
        note: els.note.value || "",
      });
    }

    // ---------- ring update ----------
    function updateRing() {
      const remaining = computeRemaining();
      const total = durationMin * 60;
      const frac = total > 0 ? remaining / total : 0;
      els.ring.style.strokeDashoffset = CIRC * (1 - frac);
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = Math.floor(remaining % 60).toString().padStart(2, "0");
      els.time.textContent = `${m}:${s}`;
      return remaining;
    }

    function setMode(newMode, opts) {
      opts = opts || {};
      mode = newMode;
      durationMin = mode === "pomodoro" ? DURATIONS.pomodoro : DURATIONS.pause;
      pausedRemaining = null;
      running = false;
      endAt = null;
      els.durationSelect.value = String(durationMin);
      els.label.textContent = mode === "pomodoro" ? "Pomodoro" : "Pause";
      els.tabPomo.classList.toggle("active", mode === "pomodoro");
      els.tabPause.classList.toggle("active", mode === "pause");
      stopTicking();
      updateRing();
      updateButtonsUI();
      if (!opts.silent) { clearActiveState(); }
    }

    els.tabPomo.addEventListener("click", () => setMode("pomodoro"));
    els.tabPause.addEventListener("click", () => setMode("pause"));

    els.durationSelect.addEventListener("change", () => {
      durationMin = parseInt(els.durationSelect.value, 10);
      pausedRemaining = null;
      running = false;
      endAt = null;
      stopTicking();
      updateRing();
      updateButtonsUI();
      clearActiveState();
    });

    els.note.addEventListener("input", persistState);

    // ---------- محرك التايمر ----------
    function tick() {
      const remaining = updateRing();
      if (remaining <= 0) {
        finishSession();
      }
    }

    function startTicking() {
      clearInterval(timerId);
      timerId = setInterval(tick, 1000);
    }
    function stopTicking() {
      clearInterval(timerId);
      timerId = null;
    }

    function updateButtonsUI() {
      els.startBtn.innerHTML = running ? "⏸ Pause" : "▶ Start";
      els.startBtn.classList.toggle("running", running);
      const remaining = computeRemaining();
      const hasProgress = remaining < durationMin * 60;
      els.stopBtn.disabled = !running && !hasProgress;
    }

    function startTimer() {
      if (running) return;
      const base = pausedRemaining != null ? pausedRemaining : durationMin * 60;
      endAt = Date.now() + base * 1000;
      pausedRemaining = null;
      running = true;
      updateButtonsUI();
      startTicking();
      startNotifLoop();
      persistState();
    }

    function pauseTimer() {
      if (!running) return;
      pausedRemaining = computeRemaining();
      running = false;
      endAt = null;
      stopTicking();
      stopNotifLoop();
      updateRing();
      updateButtonsUI();
      persistState();
    }

    function resetTimer() {
      running = false;
      endAt = null;
      pausedRemaining = null;
      stopTicking();
      stopNotifLoop();
      updateRing();
      updateButtonsUI();
      clearActiveState();
    }

    // زر "توقف": يسجل الوقت إلي فات (partial session) ويرجع الصفر
    function stopTimer() {
      const remaining = computeRemaining();
      const elapsedSec = (durationMin * 60) - remaining;

      if (mode === "pomodoro" && elapsedSec >= MIN_LOG_SECONDS) {
        logSession(Math.floor(elapsedSec / 60));
      }

      resetTimer();
    }

    function logSession(minutes) {
      const sessions = getSessions();
      sessions.unshift({
        id: Date.now(),
        date: todayStr(),
        time: new Date().toTimeString().slice(0, 5),
        subject: selectedSubject.name,
        subjectId: selectedSubject.id,
        accent: selectedSubject.accent,
        duration: minutes,
        note: (els.note.value || "").slice(0, 100),
      });
      saveSessions(sessions);
      els.note.value = "";
      renderAll();
    }

    function finishSession() {
      running = false;
      endAt = null;
      pausedRemaining = 0;
      stopTicking();
      stopNotifLoop();
      updateRing();
      updateButtonsUI();

      if (mode === "pomodoro") {
        logSession(durationMin);
        showNotification("🍅 خلصت الجلسة!", `${durationMin} دقيقة ${selectedSubject.name} — برافو، وقت الاستراحة 🎉`);
      } else {
        showNotification("☕ خلصت الاستراحة", "توا وقت ترجع تراجع 💪");
      }

      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      clearActiveState();
      setTimeout(() => {
        pausedRemaining = null;
        remainingReset();
      }, 300);
    }

    function remainingReset() {
      updateRing();
      updateButtonsUI();
    }

    els.startBtn.addEventListener("click", () => {
      running ? pauseTimer() : startTimer();
    });
    els.resetBtn.addEventListener("click", resetTimer);
    els.stopBtn.addEventListener("click", stopTimer);

    // ---------- rendering: stats, list, chart ----------
    function renderStats(sessions) {
      const today = todayStr();
      const todaySessions = sessions.filter(s => s.date === today);
      const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);

      els.statSessions.textContent = todaySessions.length;
      const h = Math.floor(todayMinutes / 60);
      const m = todayMinutes % 60;
      els.statTime.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
      els.statTotal.textContent = sessions.length;

      const daysWithSessions = new Set(sessions.map(s => s.date));
      let streak = 0;
      let cursor = new Date();
      while (true) {
        const ds = todayStr(cursor);
        if (daysWithSessions.has(ds)) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          if (streak === 0 && ds === today) { cursor.setDate(cursor.getDate() - 1); continue; }
          break;
        }
      }
      els.statStreak.textContent = streak;
    }

    function renderList(sessions) {
      const today = todayStr();
      const todaySessions = sessions.filter(s => s.date === today);

      if (todaySessions.length === 0) {
        els.sessionList.innerHTML = `<p class="pomo-empty">مازلت ما بديتش أي جلسة اليوم — 🍅 بدا وحدة توا!</p>`;
        return;
      }

      els.sessionList.innerHTML = todaySessions.map(s => `
        <div class="pomo-session-item">
          <div class="l">
            <span class="dot" style="background:${s.accent}"></span>
            ${s.subject}${s.note ? ` — <span style="color:#9599B5">${s.note}</span>` : ""}
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="t">${s.time} · ${s.duration}min</span>
            <button type="button" class="del" data-id="${s.id}">🗑</button>
          </div>
        </div>`).join("");

      els.sessionList.querySelectorAll(".del").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = Number(btn.dataset.id);
          saveSessions(getSessions().filter(s => s.id !== id));
          renderAll();
        });
      });
    }

    function renderChart(sessions) {
      const days = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const weekData = [];
      let maxMin = 1;
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const ds = todayStr(d);
        const mins = sessions.filter(s => s.date === ds).reduce((sum, s) => sum + s.duration, 0);
        weekData.push({ label: days[i], mins });
        if (mins > maxMin) maxMin = mins;
      }

      els.chart.innerHTML = weekData.map(d => {
        const h = Math.max(3, Math.round((d.mins / maxMin) * 100));
        const valLabel = d.mins > 0 ? (d.mins >= 60 ? `${Math.floor(d.mins/60)}h${d.mins%60 ? (d.mins%60)+"m" : ""}` : `${d.mins}m`) : "";
        return `
        <div class="bar-col">
          <span class="val">${valLabel}</span>
          <div class="bar" style="height:${h}%"></div>
          <span class="lbl">${d.label}</span>
        </div>`;
      }).join("");
    }

    function renderAll() {
      const sessions = getSessions();
      renderStats(sessions);
      renderList(sessions);
      renderChart(sessions);
    }

    // ---------- استرجاع جلسة كانت شغالة (بعد رجوع/إعادة فتح الصفحة) ----------
    function restoreActiveState() {
      const saved = loadActiveState();
      if (!saved) {
        setMode("pomodoro", { silent: true });
        return;
      }

      mode = saved.mode || "pomodoro";
      durationMin = saved.durationMin || DURATIONS[mode];
      const subj = SUBJECTS.find(s => s.id === saved.subjectId) || SUBJECTS[0];
      selectedSubject = subj;
      setActiveSubjectUI(subj.id);
      els.note.value = saved.note || "";
      els.durationSelect.value = String(durationMin);
      els.label.textContent = mode === "pomodoro" ? "Pomodoro" : "Pause";
      els.tabPomo.classList.toggle("active", mode === "pomodoro");
      els.tabPause.classList.toggle("active", mode === "pause");

      if (saved.endAt) {
        const rem = Math.round((saved.endAt - Date.now()) / 1000);
        if (rem <= 0) {
          // خلصت الجلسة وقتلي كنت برا الصفحة — نسجلها كاملة أوتوماتيك
          running = false; endAt = null; pausedRemaining = 0;
          updateRing(); updateButtonsUI();
          if (mode === "pomodoro") logSession(durationMin);
          clearActiveState();
          setTimeout(() => { pausedRemaining = null; updateRing(); updateButtonsUI(); }, 300);
        } else {
          running = true;
          endAt = saved.endAt;
          updateRing();
          updateButtonsUI();
          startTicking();
          startNotifLoop();
        }
      } else if (saved.pausedRemaining != null) {
        pausedRemaining = saved.pausedRemaining;
        running = false;
        updateRing();
        updateButtonsUI();
      } else {
        updateRing();
        updateButtonsUI();
      }
    }

    // كي يرجع الطالب للصفحة (تبويبة كانت فالخلفية)، نصحح الوقت فورا بلا ما نستنى tick
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && running) {
        const remaining = updateRing();
        if (remaining <= 0) finishSession();
      }
    });

    // ---------- init ----------
    restoreActiveState();
    renderAll();
  });
})();
