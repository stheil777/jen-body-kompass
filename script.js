// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { localStorage.removeItem(key); return fallback; }
}

function today() {
  return new Date().toISOString().split("T")[0];
}

const formatNumber = (value) => new Intl.NumberFormat("de-DE").format(Math.round(value));

// ── Profile ───────────────────────────────────────────────────────────────────

const defaultProfile = {
  weight: 72,
  gender: "female",
  activity: 1.45,
  goal: "maintain",
};

const profile = { ...defaultProfile, ...safeJSON("protein-kompass-profile", {}) };

const profileComplete = () => localStorage.getItem("protein-kompass-profile-complete") === "true";
let activeView = profileComplete() ? "today" : "settings";
let proteinTarget = 105;
let calorieTarget = 1900;

// ── Foods ─────────────────────────────────────────────────────────────────────

const baseFoods = [
  { id: "skyr",    name: "Skyr",           unit: "g",       amount: 200, step: 50, proteinBase: 10, caloriesBase: 57,  baseAmount: 100, icon: "SK" },
  { id: "eggs",    name: "Eier",           unit: "Stück",   amount: 2,   step: 1,  proteinBase: 6,  caloriesBase: 72,  baseAmount: 1,   icon: "EI" },
  { id: "chicken", name: "Hähnchen",       unit: "g",       amount: 150, step: 50, proteinBase: 22, caloriesBase: 165, baseAmount: 100, icon: "HN" },
  { id: "lentils", name: "Linsen gekocht", unit: "g",       amount: 150, step: 50, proteinBase: 9,  caloriesBase: 116, baseAmount: 100, icon: "LI" },
  { id: "tofu",    name: "Tofu",           unit: "g",       amount: 150, step: 50, proteinBase: 12, caloriesBase: 96,  baseAmount: 100, icon: "TF" },
  { id: "salmon",  name: "Lachs",          unit: "g",       amount: 150, step: 50, proteinBase: 20, caloriesBase: 187, baseAmount: 100, icon: "LA" },
  { id: "rice",    name: "Reis gekocht",   unit: "g",       amount: 200, step: 50, proteinBase: 2.7,caloriesBase: 130, baseAmount: 100, icon: "RE" },
  { id: "shake",   name: "Proteinshake",   unit: "Portion", amount: 1,   step: 1,  proteinBase: 24, caloriesBase: 118, baseAmount: 1,   icon: "PS" },
];

const customFoods = safeJSON("protein-kompass-custom-foods", []);

const suggestions = [
  { id: "cottage",   name: "Hüttenkäse",   unit: "g", amount: 200, proteinBase: 11,  caloriesBase: 82,  baseAmount: 100, icon: "HK" },
  { id: "chickpeas", name: "Kichererbsen", unit: "g", amount: 150, proteinBase: 8.9, caloriesBase: 109, baseAmount: 100, icon: "KI" },
  { id: "quark",     name: "Magerquark",   unit: "g", amount: 250, proteinBase: 12,  caloriesBase: 68,  baseAmount: 100, icon: "MQ" },
  { id: "turkey",    name: "Putenbrust",   unit: "g", amount: 120, proteinBase: 24,  caloriesBase: 110, baseAmount: 100, icon: "PB" },
];

// ── State ─────────────────────────────────────────────────────────────────────

const baseWeek = [
  { day: "Mo", protein: 96,  calories: 1860 },
  { day: "Di", protein: 104, calories: 1940 },
  { day: "Mi", protein: 88,  calories: 1720 },
  { day: "Do", protein: 75,  calories: 1610 },
  { day: "Fr", protein: 101, calories: 1905 },
  { day: "Sa", today: true, protein: 0, calories: 0 },
  { day: "So", protein: null, calories: null },
];

const state = {
  meal: "Frühstück",
  entries: safeJSON("protein-kompass-entries", []),
  amounts: safeJSON("protein-kompass-amounts", {}),
  dailyLogs: safeJSON("protein-kompass-daily-logs", []),
};

// ── Daily log helpers ─────────────────────────────────────────────────────────

function getLogForDate(date) {
  return state.dailyLogs.find((log) => log.date === date) || null;
}

function setLog(date, patch) {
  const idx = state.dailyLogs.findIndex((log) => log.date === date);
  const base = idx >= 0 ? state.dailyLogs[idx] : { date, energy: null, sleepHours: null, sleepQuality: null, water: 0 };
  const updated = { ...base, ...patch };
  if (idx >= 0) {
    state.dailyLogs[idx] = updated;
  } else {
    state.dailyLogs.push(updated);
  }
  saveLogs();
}

function saveLogs() {
  localStorage.setItem("protein-kompass-daily-logs", JSON.stringify(state.dailyLogs));
}

// ── Persistence ───────────────────────────────────────────────────────────────

function save() {
  localStorage.setItem("protein-kompass-entries", JSON.stringify(state.entries));
  localStorage.setItem("protein-kompass-amounts", JSON.stringify(state.amounts));
  localStorage.setItem("protein-kompass-custom-foods", JSON.stringify(customFoods));
}

function saveProfile() {
  localStorage.setItem("protein-kompass-profile", JSON.stringify(profile));
}

// ── Calculations ──────────────────────────────────────────────────────────────

function calculateTargets() {
  const proteinFactor = profile.goal === "strength" ? 1.7 : profile.goal === "fatloss" ? 1.6 : 1.45;
  const calorieMultiplier = profile.goal === "strength" ? 34 : profile.goal === "fatloss" ? 26 : 30;
  const genderAdjustment = profile.gender === "male" ? 1.12 : 1;
  const activityAdjustment = Number(profile.activity) / 1.45;
  proteinTarget = Math.round(profile.weight * proteinFactor);
  calorieTarget = Math.round((profile.weight * calorieMultiplier * genderAdjustment * activityAdjustment) / 50) * 50;
}

function totals() {
  return state.entries.reduce(
    (sum, entry) => ({ protein: sum.protein + entry.protein, calories: sum.calories + entry.calories }),
    { protein: 0, calories: 0 },
  );
}

function amountFor(item) {
  const stored = Number(state.amounts[item.id]);
  if (!stored || stored < item.step) return item.amount;
  return stored;
}

function nutritionFor(item, amount = amountFor(item)) {
  const factor = amount / item.baseAmount;
  return { protein: Math.round(item.proteinBase * factor), calories: Math.round(item.caloriesBase * factor) };
}

function foods() {
  return [...baseFoods, ...customFoods];
}

// ── Profile helpers ───────────────────────────────────────────────────────────

function profileLabel() {
  const gender = profile.gender === "male" ? "männlich" : "weiblich";
  const activity = { 1.2: "ruhiger Alltag", 1.45: "regelmäßig aktiv", 1.7: "sehr aktiv" }[String(profile.activity)] || "regelmäßig aktiv";
  return `${formatNumber(profile.weight)} kg · ${gender} · ${activity}`;
}

function readProfileForm() {
  profile.weight = Number(document.querySelector("#weightInput").value) || defaultProfile.weight;
  profile.gender = document.querySelector("#genderInput").value;
  profile.activity = Number(document.querySelector("#activityInput").value);
  profile.goal = document.querySelector("#goalInput").value;
}

// ── Entry helpers ─────────────────────────────────────────────────────────────

function addEntry(item) {
  const amount = amountFor(item);
  const nutrition = nutritionFor(item, amount);
  state.entries.push({ id: item.id, name: item.name, amount, unit: item.unit, protein: nutrition.protein, calories: nutrition.calories, meal: state.meal, time: Date.now() });
  save();
  render();
}

function removeLatest(id) {
  const index = state.entries.map((e) => e.id).lastIndexOf(id);
  if (index >= 0) state.entries.splice(index, 1);
  save();
  render();
}

function countFor(id) {
  return state.entries.filter((e) => e.id === id).length;
}

function entryLabel(food, count) {
  if (!count) return "";
  const entries = state.entries.filter((e) => e.id === food.id);
  const amount = entries.reduce((sum, e) => sum + (e.amount || amountFor(food)), 0);
  const unit = food.id === "eggs" && amount === 1 ? "Ei" : food.unit;
  return `${formatNumber(amount)} ${unit} heute`;
}

function entryAmountLabel(entry) {
  const fallbackFood = foods().find((f) => f.id === entry.id);
  const amount = Number(entry.amount || fallbackFood?.amount || 1);
  const rawUnit = entry.unit || fallbackFood?.unit || "Portion";
  const unit = entry.id === "eggs" && amount === 1 ? "Ei" : rawUnit;
  return `${formatNumber(amount)} ${unit}`;
}

// ── Render: Quick Trackers ────────────────────────────────────────────────────

const energyLabels = { 1: "Müde", 2: "Träge", 3: "Ok", 4: "Gut", 5: "Top" };

function renderQuickTrackers() {
  const log = getLogForDate(today());

  // Energy stepper — null = kein Wert gesetzt, zeige "–"
  const energy = log?.energy ?? null;
  document.querySelector("#energyValue").textContent = energy !== null ? String(energy) : "–";
  const energyLabelEl = document.querySelector("#energyLabel");
  energyLabelEl.textContent = energy !== null ? energyLabels[energy] : "";
  energyLabelEl.style.visibility = energy !== null ? "visible" : "hidden";
  document.querySelector("#energyMinus").disabled = energy === null || energy <= 1;
  document.querySelector("#energyPlus").disabled = energy !== null && energy >= 5;

  // Sleep stepper — null = kein Wert gesetzt
  const sleep = log?.sleepHours ?? null;
  document.querySelector("#sleepValue").textContent = sleep !== null ? `${sleep}h` : "–";
  document.querySelector("#sleepMinus").disabled = sleep === null || sleep <= 0;
  document.querySelector("#sleepPlus").disabled = sleep !== null && sleep >= 14;

  // Sleep quality
  document.querySelectorAll("#sleepQuality button").forEach((btn) => {
    btn.classList.toggle("active", log?.sleepQuality === Number(btn.dataset.val));
  });

  // Water
  const water = log?.water || 0;
  document.querySelector("#waterCount").textContent = water;
  document.querySelector("#waterMinus").disabled = water <= 0;
  document.querySelector("#waterPlus").disabled = water >= 16;
  renderWaterGlasses(water);

  // Check-in status — zählt nur gesetzte Werte
  const filled = [energy !== null, sleep !== null, log?.sleepQuality != null, water > 0].filter(Boolean).length;
  document.querySelector("#checkInStatus").textContent = filled > 0 ? `${filled} von 4` : "";
}

function renderWaterGlasses(count) {
  const container = document.querySelector("#waterGlasses");
  const dots = [];
  for (let i = 0; i < 8; i++) {
    dots.push(`<span class="glass-dot ${i < count ? "filled" : ""}"></span>`);
  }
  container.innerHTML = dots.join("");
}

// ── Render: Summary ───────────────────────────────────────────────────────────

function renderSummary() {
  const current = totals();
  const proteinLeft = Math.max(0, proteinTarget - current.protein);
  const calorieLeft = Math.max(0, calorieTarget - current.calories);
  const proteinRatio = Math.min(current.protein / proteinTarget, 1);
  const calorieRatio = Math.min(current.calories / calorieTarget, 1);

  document.querySelector("#proteinTotal").textContent = formatNumber(current.protein);
  document.querySelector("#proteinTarget").textContent = formatNumber(proteinTarget);
  document.querySelector("#proteinLeft").textContent = formatNumber(proteinLeft);
  document.querySelector("#calorieTotal").textContent = formatNumber(current.calories);
  document.querySelector("#calorieTarget").textContent = formatNumber(calorieTarget);
  document.querySelector("#calorieLeft").textContent = formatNumber(calorieLeft);
  document.querySelector("#quickProtein").textContent = formatNumber(current.protein);
  document.querySelector("#quickProteinTarget").textContent = formatNumber(proteinTarget);
  document.querySelector("#quickCalories").textContent = formatNumber(current.calories);
  document.querySelector("#proteinBar").style.width = `${proteinRatio * 100}%`;
  document.querySelector("#calorieBar").style.width = `${calorieRatio * 100}%`;
}

// ── Render: Diary ─────────────────────────────────────────────────────────────

function renderDiary() {
  const diaryList = document.querySelector("#diaryList");
  document.querySelector("#entryCount").textContent =
    state.entries.length === 1 ? "1 Eintrag" : `${state.entries.length} Einträge`;

  if (!state.entries.length) {
    diaryList.innerHTML = `<p class="empty-diary">Noch nichts eingetragen.</p>`;
    return;
  }

  diaryList.innerHTML = [...state.entries].reverse().map((entry) => `
    <article class="diary-row">
      <span>
        <strong>${entry.name}</strong>
        <small>${entryAmountLabel(entry)} · ${entry.meal}</small>
      </span>
      <span class="diary-macros">${entry.protein} g · ${entry.calories} kcal</span>
      <button type="button" data-time="${entry.time}" aria-label="${entry.name} löschen">×</button>
    </article>
  `).join("");

  document.querySelectorAll(".diary-row button").forEach((button) => {
    button.addEventListener("click", () => {
      const time = Number(button.dataset.time);
      state.entries = state.entries.filter((e) => e.time !== time);
      save();
      render();
    });
  });
}

// ── Render: Food List ─────────────────────────────────────────────────────────

function renderFoodList() {
  const foodList = document.querySelector("#foodList");
  foodList.innerHTML = foods().map((food) => {
    const count = countFor(food.id);
    const amount = amountFor(food);
    const { protein, calories } = nutritionFor(food, amount);
    return `
      <article class="food-row ${count ? "selected" : ""}" data-id="${food.id}">
        <span class="food-main">
          <strong>${food.name}</strong>
          ${count ? `<span>${entryLabel(food, count)}</span>` : ""}
        </span>
        <label class="amount-control">
          <span>Menge</span>
          <span class="amount-input-wrap">
            <input type="number" min="${food.step}" step="${food.step}" value="${amount}" data-action="amount" aria-label="Menge für ${food.name}" />
            <span>${food.unit}</span>
          </span>
        </label>
        <span class="macro protein-macro">${protein} g<small>Eiweiss</small></span>
        <span class="macro kcal-macro">${calories}<small>kcal</small></span>
        <span class="quantity-controls">
          <button class="minus-control" type="button" data-action="minus" aria-label="${food.name} entfernen">−</button>
          <button class="add-control" type="button" data-action="plus" aria-label="${food.name} hinzufügen">+</button>
        </span>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".food-row input").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest(".food-row");
      const food = foods().find((item) => item.id === row.dataset.id);
      state.amounts[food.id] = Math.max(Number(input.value) || food.amount, food.step);
      save();
      render();
    });
  });

  document.querySelectorAll(".food-row button").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".food-row");
      const food = foods().find((item) => item.id === row.dataset.id);
      if (button.dataset.action === "minus") removeLatest(food.id);
      if (button.dataset.action === "plus") addEntry(food);
    });
  });
}

// ── Render: Suggestions ───────────────────────────────────────────────────────

function renderSuggestions() {
  const proteinLeft = Math.max(0, proteinTarget - totals().protein);
  const best = [...suggestions].sort(
    (a, b) => Math.abs(nutritionFor(a, a.amount).protein - proteinLeft) - Math.abs(nutritionFor(b, b.amount).protein - proteinLeft),
  ).slice(0, 2);

  document.querySelector("#suggestionList").innerHTML = best.map((food) => `
    <button class="suggestion-card" type="button" data-id="${food.id}">
      <span>
        <strong>${food.name}</strong>
        <span>${formatNumber(food.amount)} ${food.unit}</span>
        <span>${nutritionFor(food, food.amount).protein} g Eiweiss</span>
        <span>${nutritionFor(food, food.amount).calories} kcal</span>
      </span>
      <span class="add-control" aria-hidden="true">+</span>
    </button>
  `).join("");

  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const food = suggestions.find((item) => item.id === card.dataset.id);
      addEntry(food);
    });
  });
}

// ── Render: Week rows (side panel + mobile) ───────────────────────────────────

function renderWeek() {
  const current = totals();
  const week = baseWeek.map((day) => (day.today ? { ...day, ...current } : day));
  const finished = week.filter((day) => day.protein !== null);
  const proteinAvg = finished.reduce((sum, day) => sum + day.protein, 0) / finished.length;
  const calorieAvg = finished.reduce((sum, day) => sum + day.calories, 0) / finished.length;

  const weekMarkup = week.map((day) => {
    const percent = day.protein === null ? 0 : Math.min((day.protein / proteinTarget) * 100, 100);
    return `
      <div class="week-row ${day.today ? "today" : ""}">
        <span>${day.day}</span>
        <span class="week-bar"><span style="width:${percent}%"></span></span>
        <strong>${day.protein === null ? `- / ${formatNumber(proteinTarget)}` : `${formatNumber(day.protein)} / ${formatNumber(proteinTarget)}`}</strong>
        <span>${day.calories === null ? "-" : formatNumber(day.calories)}</span>
      </div>
    `;
  }).join("");

  document.querySelector("#weekRows").innerHTML = weekMarkup;
  document.querySelector("#proteinAverage").textContent = `${formatNumber(proteinAvg)} g`;
  document.querySelector("#calorieAverage").textContent = `${formatNumber(calorieAvg)} kcal`;
}

// ── Render: Rhythmus Graph ────────────────────────────────────────────────────

function getWeekDates() {
  // Returns array of 7 YYYY-MM-DD strings Mo–So for current week
  const now = new Date();
  const dow = now.getDay(); // 0 = Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow === 0 ? 7 : dow) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function renderRhythmChart() {
  const canvas = document.querySelector("#rhythmChart");
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth || 320;
  const H = 200;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const weekDates = getWeekDates();
  const todayStr = today();
  const currentTotals = totals();

  // Collect data per day
  const dayData = weekDates.map((date, i) => {
    const log = getLogForDate(date) || {};
    let protein = null;
    if (date === todayStr) {
      protein = currentTotals.protein;
    } else {
      // Use base week demo data for past days without real data
      const base = baseWeek[i];
      protein = base.protein !== null ? base.protein : null;
    }
    return {
      date,
      energy: log.energy ?? null,
      sleepHours: log.sleepHours ?? null,
      sleepQuality: log.sleepQuality ?? null,
      water: log.water ?? 0,
      protein,
    };
  });

  // Padding
  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / 6;

  // Sand zone: middle 40% of chart height
  const sandTop = padT + chartH * 0.28;
  const sandBot = padT + chartH * 0.72;
  ctx.fillStyle = "rgba(241,231,214,0.35)";
  const sandRadius = 10;
  ctx.beginPath();
  ctx.moveTo(padL + sandRadius, sandTop);
  ctx.lineTo(padL + chartW - sandRadius, sandTop);
  ctx.quadraticCurveTo(padL + chartW, sandTop, padL + chartW, sandTop + sandRadius);
  ctx.lineTo(padL + chartW, sandBot - sandRadius);
  ctx.quadraticCurveTo(padL + chartW, sandBot, padL + chartW - sandRadius, sandBot);
  ctx.lineTo(padL + sandRadius, sandBot);
  ctx.quadraticCurveTo(padL, sandBot, padL, sandBot - sandRadius);
  ctx.lineTo(padL, sandTop + sandRadius);
  ctx.quadraticCurveTo(padL, sandTop, padL + sandRadius, sandTop);
  ctx.closePath();
  ctx.fill();

  // Day labels at bottom
  ctx.fillStyle = "rgba(42,33,27,0.4)";
  ctx.font = "500 11px Manrope, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 7; i++) {
    const x = padL + i * stepX;
    ctx.fillText(dayLabels[i], x, H - 8);
  }

  // Helper: normalize 0→1 with explicit min/max
  function norm(val, min, max) {
    if (val === null || val === undefined) return null;
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  }

  function xFor(i) { return padL + i * stepX; }
  function yFor(ratio) { return padT + chartH * (1 - ratio); }

  // Draw a smooth line for a series
  function drawLine(points, color, lineWidth = 2) {
    const valid = points.map((p, i) => p !== null ? { x: xFor(i), y: yFor(p), i } : null).filter(Boolean);
    if (valid.length < 1) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    valid.forEach((pt, idx) => {
      if (idx === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        const prev = valid[idx - 1];
        const cpX = (prev.x + pt.x) / 2;
        ctx.bezierCurveTo(cpX, prev.y, cpX, pt.y, pt.x, pt.y);
      }
    });
    ctx.stroke();

    // Dots
    valid.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // White inner
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    });

    ctx.restore();
  }

  // Normalize each series
  // Energy: 1–5
  const energySeries = dayData.map((d) => norm(d.energy, 1, 5));
  // Schlaf hours: 4–10
  const sleepSeries = dayData.map((d) => norm(d.sleepHours, 4, 10));
  // Protein: 0 – proteinTarget*1.2
  const proteinSeries = dayData.map((d) => norm(d.protein, 0, proteinTarget * 1.2));
  // Water: 0–8
  const waterSeries = dayData.map((d) => norm(d.water, 0, 8));

  drawLine(proteinSeries, "rgba(42,33,27,0.28)", 1.5);
  drawLine(waterSeries,   "rgba(240,107,93,0.45)", 1.5);
  drawLine(sleepSeries,   "#D9A441", 2);
  drawLine(energySeries,  "#F06B5D", 2.5);
}

function renderRhythmSummary() {
  const weekDates = getWeekDates();
  const todayStr = today();
  const currentTotals = totals();

  const summary = weekDates.map((date, i) => {
    const log = getLogForDate(date) || {};
    const isToday = date === todayStr;
    const base = baseWeek[i];
    const protein = isToday ? currentTotals.protein : (base.protein ?? null);

    const energyLabel = log.energy ? ["", "⚡ Müde", "○ Leicht", "◎ Gut", "◎◎ Stark", "◎◎◎ Top"][log.energy] : null;
    const qualityLabel = log.sleepQuality ? ["", "⚡ Unruhig", "○ Ok", "◎ Gut"][log.sleepQuality] : null;

    const parts = [];
    if (energyLabel) parts.push(`<span class="rs-chip energy-chip">${energyLabel}</span>`);
    if (log.sleepHours) parts.push(`<span class="rs-chip sleep-chip">${log.sleepHours}h</span>`);
    if (qualityLabel) parts.push(`<span class="rs-chip sleep-chip">${qualityLabel}</span>`);
    if (log.water) parts.push(`<span class="rs-chip water-chip">${log.water} Gläser</span>`);
    if (protein !== null) parts.push(`<span class="rs-chip protein-chip">${formatNumber(protein)} g</span>`);

    return `
      <div class="rhythm-day-row ${isToday ? "is-today" : ""}">
        <span class="rhythm-day-label">${dayLabels[i]}</span>
        <div class="rhythm-day-chips">${parts.length ? parts.join("") : '<span class="rs-chip empty-chip">–</span>'}</div>
      </div>
    `;
  }).join("");

  document.querySelector("#rhythmWeekSummary").innerHTML = summary;
}

// ── Render: Profile ───────────────────────────────────────────────────────────

function renderProfile() {
  document.querySelector("#weightInput").value = profile.weight;
  document.querySelector("#weightDisplay").textContent = profile.weight;
  document.querySelector("#weightMinus").disabled = profile.weight <= 40;
  document.querySelector("#weightPlus").disabled = profile.weight >= 180;
  document.querySelector("#genderInput").value = profile.gender;
  document.querySelector("#activityInput").value = String(profile.activity);
  document.querySelector("#goalInput").value = profile.goal;
  const avgCards = document.querySelectorAll(".average-card small");
  if (avgCards[0]) avgCards[0].textContent = `von ${formatNumber(proteinTarget)} g`;
  if (avgCards[1]) avgCards[1].textContent = `von ca. ${formatNumber(calorieTarget)} kcal`;
}

// ── Render: Date ──────────────────────────────────────────────────────────────

function renderDate() {
  const label = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  document.querySelector("#todayLabel").textContent = `Heute, ${label}`;
}

// ── Render: View ──────────────────────────────────────────────────────────────

function renderView() {
  document.querySelectorAll(".view-section").forEach((section) => {
    section.hidden = section.dataset.view !== activeView;
  });
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === activeView);
  });
  document.querySelector(".icon-button").classList.toggle("is-close", activeView === "settings");
  document.querySelector(".icon-button").setAttribute("aria-label", activeView === "settings" ? "Setup schließen" : "Einstellungen");

  // Render chart when rhythmus view is shown
  if (activeView === "rhythmus") {
    requestAnimationFrame(() => {
      renderRhythmChart();
      renderRhythmSummary();
    });
  }
}

// ── Main render ───────────────────────────────────────────────────────────────

function render() {
  calculateTargets();
  renderProfile();
  renderSummary();
  renderDiary();
  renderFoodList();
  renderSuggestions();
  renderWeek();
  renderQuickTrackers();
  renderView();
}

// ── Event: Meal Tabs ──────────────────────────────────────────────────────────

document.querySelectorAll(".meal-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".meal-tabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.meal = button.dataset.meal;
  });
});

// ── Event: Reset Day ──────────────────────────────────────────────────────────

document.querySelector("#resetDay").addEventListener("click", () => {
  state.entries = [];
  save();
  render();
});

// ── Event: Profile Form ───────────────────────────────────────────────────────

document.querySelector("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  readProfileForm();
  saveProfile();
  localStorage.setItem("protein-kompass-profile-complete", "true");
  activeView = "today";
  render();
});

document.querySelector(".icon-button").addEventListener("click", () => {
  activeView = activeView === "settings" ? "today" : "settings";
  render();
});

document.querySelector("#closeProfile").addEventListener("click", () => {
  localStorage.setItem("protein-kompass-profile-complete", "true");
  activeView = "today";
  render();
});

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.nav === "settings" ? "settings" : button.dataset.nav;
    render();
  });
});

document.querySelectorAll("#profileForm input, #profileForm select").forEach((field) => {
  field.addEventListener("input", () => { readProfileForm(); saveProfile(); render(); });
  field.addEventListener("change", () => { readProfileForm(); saveProfile(); render(); });
});

// ── Event: Custom Food ────────────────────────────────────────────────────────

document.querySelector("#customFoodForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#customName").value.trim();
  const unit = document.querySelector("#customUnit").value;
  const amount = Number(document.querySelector("#customAmount").value);
  const protein = Number(document.querySelector("#customProtein").value);
  const calories = Number(document.querySelector("#customCalories").value);
  if (!name || !amount) return;
  const baseAmount = unit === "g" ? 100 : 1;
  customFoods.push({ id: `custom-${Date.now()}`, name, unit, amount, step: unit === "g" ? 50 : 1, proteinBase: protein, caloriesBase: calories, baseAmount, icon: name.slice(0, 2).toUpperCase() });
  event.target.reset();
  document.querySelector("#customAmount").value = unit === "g" ? 100 : 1;
  save();
  render();
});

// ── Event: Energy Stepper ─────────────────────────────────────────────────────

document.querySelector("#energyMinus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const cur = log?.energy ?? null;
  if (cur === null) return;
  setLog(today(), { energy: Math.max(1, cur - 1) });
  renderQuickTrackers();
});

document.querySelector("#energyPlus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const cur = log?.energy ?? null;
  // Erster Klick → startet bei 3 (Mitte der Skala)
  setLog(today(), { energy: cur === null ? 3 : Math.min(5, cur + 1) });
  renderQuickTrackers();
});

// ── Event: Sleep Stepper ──────────────────────────────────────────────────────

document.querySelector("#sleepMinus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const cur = log?.sleepHours ?? null;
  if (cur === null) return;
  setLog(today(), { sleepHours: Math.max(0, Math.round((cur - 0.5) * 2) / 2) });
  renderQuickTrackers();
});

document.querySelector("#sleepPlus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const cur = log?.sleepHours ?? null;
  // Erster Klick → startet bei 6h (Standard)
  setLog(today(), { sleepHours: cur === null ? 6 : Math.min(14, Math.round((cur + 0.5) * 2) / 2) });
  renderQuickTrackers();
});

// ── Event: Sleep Quality ──────────────────────────────────────────────────────

document.querySelector("#sleepQuality").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-val]");
  if (!btn) return;
  const val = Number(btn.dataset.val);
  const log = getLogForDate(today());
  const newVal = log?.sleepQuality === val ? null : val;
  setLog(today(), { sleepQuality: newVal });
  renderQuickTrackers();
});

// ── Event: Water Counter ──────────────────────────────────────────────────────

document.querySelector("#waterPlus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const current = log?.water || 0;
  setLog(today(), { water: Math.min(current + 1, 16) });
  renderQuickTrackers();
});

document.querySelector("#waterMinus").addEventListener("click", () => {
  const log = getLogForDate(today());
  const current = log?.water || 0;
  setLog(today(), { water: Math.max(current - 1, 0) });
  renderQuickTrackers();
});

// ── Event: Weight Stepper ─────────────────────────────────────────────────────

document.querySelector("#weightMinus").addEventListener("click", () => {
  profile.weight = Math.max(40, profile.weight - 1);
  document.querySelector("#weightInput").value = profile.weight;
  document.querySelector("#weightDisplay").textContent = profile.weight;
  document.querySelector("#weightMinus").disabled = profile.weight <= 40;
  document.querySelector("#weightPlus").disabled = profile.weight >= 180;
});

document.querySelector("#weightPlus").addEventListener("click", () => {
  profile.weight = Math.min(180, profile.weight + 1);
  document.querySelector("#weightInput").value = profile.weight;
  document.querySelector("#weightDisplay").textContent = profile.weight;
  document.querySelector("#weightMinus").disabled = profile.weight <= 40;
  document.querySelector("#weightPlus").disabled = profile.weight >= 180;
});

// ── Event: Window resize (re-draw chart) ──────────────────────────────────────

window.addEventListener("resize", () => {
  if (activeView === "rhythmus") {
    requestAnimationFrame(renderRhythmChart);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

renderDate();
render();
