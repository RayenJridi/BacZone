/* ============================================================
   BacZone — pomodoro.js
   تايمر بومودورو مربوط بالمواد، كل شيء بـ localStorage.
   ============================================================ */

(function () {
  "use strict";

  const SESS_KEY = "baczone_pomo_sessions_v1";
  const DURATIONS = { pomodoro: 25, pause: 5 };

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

  document.addEventListener("DOMContentLoaded", () => {
    // ---------- state ----------
    let mode = "pomodoro"; // "pomodoro" | "pause"
    let durationMin = DURATIONS.pomodoro;
    let remaining = durationMin * 60;
    let running = false;
    let timerId = null;
    let selectedSubject = SUBJECTS[0];

    // ---------- elements ----------
    const els = {
      tabPomo: document.getElementById("pmTabPomo"),
      tabPause: document.getElementById("pmTabPause"),
      ring: document.getElementById("pmRingFg"),
      time: document.getElementById("pmTime"),
      label: document.getElementById("pmLabel"),
      startBtn: document.getElementById("pmStart"),
      resetBtn: document.getElementById("pmReset"),
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
    };

    if (!els.ring) return; // مش صفحة Pomodoro

    const RADIUS = 100;
    const CIRC = 2 * Math.PI * RADIUS;
    els.ring.style.strokeDasharray = CIRC;

    // ---------- render subjects ----------
    els.subjectsWrap.innerHTML = SUBJECTS.map((s, i) => `
      <button type="button" class="pomo-subj-btn ${i === 0 ? "active" : ""}" data-id="${s.id}" style="--accent:${s.accent}">
        <span class="dot"></span>${s.name}
      </button>`).join("");

    els.subjectsWrap.querySelectorAll(".pomo-subj-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        els.subjectsWrap.querySelectorAll(".pomo-subj-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedSubject = SUBJECTS.find(s => s.id === btn.dataset.id);
      });
    });

    // ---------- quote ----------
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    els.quote.innerHTML = `“${q.t}”` + (q.a ? `<span class="auth">— ${q.a}</span>` : "");

    // ---------- ring update ----------
    function updateRing() {
      const total = durationMin * 60;
      const frac = total > 0 ? remaining / total : 0;
      els.ring.style.strokeDashoffset = CIRC * (1 - frac);
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = Math.floor(remaining % 60).toString().padStart(2, "0");
      els.time.textContent = `${m}:${s}`;
    }

    function setMode(newMode) {
      mode = newMode;
      durationMin = mode === "pomodoro" ? DURATIONS.pomodoro : DURATIONS.pause;
      remaining = durationMin * 60;
      els.durationSelect.value = String(durationMin);
      els.label.textContent = mode === "pomodoro" ? "Pomodoro" : "Pause";
      els.tabPomo.classList.toggle("active", mode === "pomodoro");
      els.tabPause.classList.toggle("active", mode === "pause");
      pauseTimer();
      updateRing();
    }

    els.tabPomo.addEventListener("click", () => setMode("pomodoro"));
    els.tabPause.addEventListener("click", () => setMode("pause"));

    els.durationSelect.addEventListener("change", () => {
      durationMin = parseInt(els.durationSelect.value, 10);
      remaining = durationMin * 60;
      pauseTimer();
      updateRing();
    });

    // ---------- timer engine ----------
    function tick() {
      if (remaining <= 0) {
        finishSession();
        return;
      }
      remaining -= 1;
      updateRing();
    }

    function startTimer() {
      if (running) return;
      running = true;
      els.startBtn.innerHTML = "⏸ Pause";
      els.startBtn.classList.add("running");
      timerId = setInterval(tick, 1000);
    }

    function pauseTimer() {
      running = false;
      clearInterval(timerId);
      els.startBtn.innerHTML = "▶ Start";
      els.startBtn.classList.remove("running");
    }

    function resetTimer() {
      pauseTimer();
      remaining = durationMin * 60;
      updateRing();
    }

    function finishSession() {
      pauseTimer();
      remaining = 0;
      updateRing();

      if (mode === "pomodoro") {
        const sessions = getSessions();
        sessions.unshift({
          id: Date.now(),
          date: todayStr(),
          time: new Date().toTimeString().slice(0, 5),
          subject: selectedSubject.name,
          subjectId: selectedSubject.id,
          accent: selectedSubject.accent,
          duration: durationMin,
          note: (els.note.value || "").slice(0, 100),
        });
        saveSessions(sessions);
        els.note.value = "";
        renderAll();
      }

      // نصيح صوتي بسيط (اهتزاز لو مدعوم)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      setTimeout(() => { remaining = durationMin * 60; updateRing(); }, 300);
    }

    els.startBtn.addEventListener("click", () => {
      running ? pauseTimer() : startTimer();
    });
    els.resetBtn.addEventListener("click", resetTimer);

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

      // streak: أيام متتالية فيها جلسة وحدة على الأقل
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

    // ---------- init ----------
    setMode("pomodoro");
    renderAll();
  });
})();
