"use strict";
/* Study Tracker. Sections: 1 Config, 2 Helpers, 3 Storage and state, 4 State changes, 5 Rendering, 6 Events.
   Flow for every feature: Event -> State change -> commit() -> render(). */

/* 1. Config */
const STORAGE_KEY = "study-tracker:v1";
const MOVE_EARLIER_DAYS = 3;
const MAX_NAME = 60;
const MAX_PDF_MB = 8; // kept small since PDFs are stored as text in localStorage
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

/* 2. Helpers */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const midnight = iso => new Date(`${iso}T00:00:00`);
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysUntil = iso => Math.round((midnight(iso) - todayStart()) / 864e5);
const countdownText = n => n < 0 ? "Exam passed" : n === 0 ? "Exam today!" : n === 1 ? "1 day left" : `${n} days left`;
const progressOf = s => {
  const total = s.topics.length, done = s.topics.filter(t => t.done).length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
};
const esc = str => String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const findSubject = id => state.find(s => s.id === id);

function readPdfFile(file) { // -> Promise<{name, data: base64 data URL}>, rejects with a short reason code
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("none"));
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) return reject(new Error("type"));
    if (file.size > MAX_PDF_BYTES) return reject(new Error("size"));
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name.slice(0, MAX_NAME), data: reader.result });
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}
function pdfErrorToast(err) {
  toast(err && err.message === "size" ? `PDF is too large (max ${MAX_PDF_MB}MB).`
    : err && err.message === "type" ? "Please choose a PDF file."
    : "Could not read that PDF.", true);
}

/* 3. Storage and state */
const storage = {
  load() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  save(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable: keep working in memory */ } },
};

function seed() { // fictional sample data so the app is useful on first load
  const inDays = n => { const d = todayStart(); d.setDate(d.getDate() + n); return toISO(d); };
  const topics = (names, k) => names.map((name, i) => ({ id: uid(), name, done: i < k }));
  return [
    { id: uid(), name: "Data Structures", exam: inDays(10), difficulty: "hard", topics: topics(["Arrays", "Linked Lists", "Stacks and Queues", "Trees"], 2) },
    { id: uid(), name: "Machine Learning Basics", exam: inDays(21), difficulty: "medium", topics: topics(["Linear Regression", "Decision Trees", "Neural Networks"], 1) },
  ];
}

const saved = storage.load();
let state = Array.isArray(saved) ? saved : seed();

let toastTimer;
function toast(text, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.className = `toast show${isError ? " bad" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 2200);
}
function commit() { storage.save(state); render(); }

/* 4. State changes (validate, change data, commit, show a message) */
function addSubject(name, exam, difficulty, pdf) {
  name = name.trim();
  if (!name) return toast("Please enter a subject name.", true);
  if (!exam) return toast("Please pick an exam date.", true);
  state.push({ id: uid(), name: name.slice(0, MAX_NAME), exam, difficulty: DIFFICULTY_DAYS[difficulty] ? difficulty : "medium", pdf: pdf || null, topics: [] });
  commit(); toast(`Added subject: ${name}`);
  return true;
}
function setExamDate(sid, newDate) { // independent of the simulate/reset pair below: just edits the date directly
  if (!newDate) return toast("Please pick a valid date.", true);
  findSubject(sid).exam = newDate;
  commit(); toast("Exam date updated.");
}
function setSubjectPdf(sid, pdf) {
  findSubject(sid).pdf = pdf;
  commit(); toast(pdf ? `Attached PDF: ${pdf.name}` : "PDF removed.");
}
function setTopicPdf(sid, tid, pdf) {
  const t = findSubject(sid).topics.find(t => t.id === tid);
  t.pdf = pdf;
  commit(); toast(pdf ? `Attached PDF: ${pdf.name}` : "PDF removed.");
}
function addTopic(sid, name) {
  name = name.trim();
  if (!name) return toast("Please enter a topic name.", true);
  findSubject(sid).topics.push({ id: uid(), name: name.slice(0, MAX_NAME), done: false });
  commit(); toast("Topic added.");
  return true;
}
function toggleTopic(sid, tid) {
  const t = findSubject(sid).topics.find(t => t.id === tid);
  t.done = !t.done; commit();
  toast(t.done ? "Topic marked complete!" : "Topic marked incomplete.");
}
function deleteTopic(sid, tid) { const s = findSubject(sid); s.topics = s.topics.filter(t => t.id !== tid); commit(); }
function deleteSubject(sid) { if (!confirm("Delete this subject?")) return; state = state.filter(s => s.id !== sid); commit(); }
function simulateEarlier(sid) { // judge demo step 2
  const s = findSubject(sid);
  if (!s.originalExam) s.originalExam = s.exam;
  const d = midnight(s.exam); d.setDate(d.getDate() - MOVE_EARLIER_DAYS);
  s.exam = toISO(d < todayStart() ? todayStart() : d);
  s.moved = true; commit();
  toast("Exam moved earlier! Check the highlighted topics.", true);
}
function resetExam(sid) {
  const s = findSubject(sid);
  if (s.originalExam) s.exam = s.originalExam;
  delete s.originalExam; s.moved = false; commit();
}

function setPriority(sid, tid, value) {
  if (!PRIORITY_LABEL[value]) return;
  const t = findSubject(sid).topics.find(t => t.id === tid);
  t.priority = value; commit();
  toast(`Priority set to ${PRIORITY_LABEL[value]}.`);
}

/* 5. Rendering (data in, HTML out) */
const PRIORITY_RANK = { high: 0, med: 1, low: 2 };
const PRIORITY_LABEL = { high: "High", med: "Medium", low: "Low" };
const priorityOf = t => (PRIORITY_LABEL[t.priority] ? t.priority : "med");

const DIFFICULTY_DAYS = { hard: 7, medium: 4, easy: 2 }; // alert this many days before the exam
const DIFFICULTY_LABEL = { hard: "Hard", medium: "Medium", easy: "Easy" };
const DIFFICULTY_RANK = { hard: 0, medium: 1, easy: 2 };
const difficultyOf = s => (DIFFICULTY_DAYS[s.difficulty] ? s.difficulty : "medium");
const pendingPct = s => 100 - progressOf(s).pct;

function difficultyAlertHTML(s) {
  const diff = difficultyOf(s), days = DIFFICULTY_DAYS[diff], n = daysUntil(s.exam);
  const { done, total } = progressOf(s);
  if (!total || done === total || n < 0 || n > days) return "";
  const left = n === 0 ? "the exam is today" : `only ${n} day(s) left`;
  return `<div class="alert" role="alert">⏰ ${DIFFICULTY_LABEL[diff]} difficulty: ${left}. Recommended prep window is ${days} day(s) before the exam.</div>`;
}

function priorityPlan(s) { // unfinished topics: highest priority first, then in the order added
  return s.topics.map((t, i) => ({ t, i })).filter(x => !x.t.done)
    .sort((a, b) => PRIORITY_RANK[priorityOf(a.t)] - PRIORITY_RANK[priorityOf(b.t)] || a.i - b.i)
    .map(x => x.t);
}
function prioritySelect(s, t) {
  const opts = Object.keys(PRIORITY_LABEL).map(k => `<option value="${k}"${priorityOf(t) === k ? " selected" : ""}>${PRIORITY_LABEL[k]}</option>`).join("");
  return `<select data-action="priority" data-subject="${s.id}" data-topic="${t.id}" aria-label="Priority for ${esc(t.name)}">${opts}</select>`;
}
function planHTML(s) {
  const plan = priorityPlan(s), n = daysUntil(s.exam);
  if (!plan.length) return `<div class="plan"><strong>Study priority order</strong><p>All topics are complete. You are ready!</p></div>`;
  const advice = n <= 0 ? "The exam is here. Start with number 1."
    : n < plan.length ? `Only ${n} day(s) left for ${plan.length} topics. Focus on the top ${n} first.`
    : `Around ${Math.floor(n / plan.length)} day(s) per topic.`;
  const items = plan.map(t => `<li><span class="pri ${priorityOf(t)}">${PRIORITY_LABEL[priorityOf(t)]}</span> ${esc(t.name)}</li>`).join("");
  return `<div class="plan"><strong>Study priority order</strong><ol>${items}</ol><p>${advice} Change a topic priority to reorder.</p></div>`;
}
function pdfLinkHTML(pdf, name, removeAction, removeData) {
  return pdf
    ? `<a class="pdf-link" href="${pdf.data}" target="_blank" rel="noopener">📄 ${esc(pdf.name)}</a><button type="button" class="ghost" data-action="${removeAction}" ${removeData} aria-label="Remove PDF for ${esc(name)}">✕</button>`
    : "";
}
function subjectHTML(s) {
  const { done, total, pct } = progressOf(s);
  const n = daysUntil(s.exam);
  const topics = s.topics.map(t => `
    <li class="topic${t.done ? " done" : ""}${s.moved && !t.done ? " hl" : ""}">
      <div class="topic-main">
        <label><input type="checkbox" data-action="toggle" data-subject="${s.id}" data-topic="${t.id}"${t.done ? " checked" : ""}><span>${esc(t.name)}</span></label>${t.done ? "" : prioritySelect(s, t)}
        <button type="button" class="ghost" data-action="delete-topic" data-subject="${s.id}" data-topic="${t.id}" aria-label="Delete topic ${esc(t.name)}">✕</button>
      </div>
      <div class="topic-pdf">
        ${pdfLinkHTML(t.pdf, t.name, "remove-topic-pdf", `data-subject="${s.id}" data-topic="${t.id}"`)}
        <input type="file" class="pdf-input" accept="application/pdf,.pdf" data-action="upload-topic-pdf" data-subject="${s.id}" data-topic="${t.id}" aria-label="Attach PDF for topic ${esc(t.name)}">
      </div>
    </li>`).join("");
  const banner = s.moved
    ? `<div class="warn" role="alert">⚠ Exam moved earlier! Was ${countdownText(daysUntil(s.originalExam))}, now ${countdownText(n)}. ${total - done} unfinished topic(s) highlighted.</div>`
    : "";
  const wish = n === 0 ? `<div class="wish" role="status">🍀 Good luck on your ${esc(s.name)} exam today — you've got this!</div>` : "";
  const diff = difficultyOf(s);
  return `
  <section class="card">
    <div class="head"><h2>${esc(s.name)}</h2><span class="diff ${diff}">${DIFFICULTY_LABEL[diff]}</span><span class="cd${n < 0 ? " past" : ""}">${countdownText(n)}</span></div>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <p class="pct">${pct}% complete (${done}/${total} topics) · Exam:
      <input type="date" class="exam-date" data-action="set-exam" data-subject="${s.id}" value="${esc(s.exam)}" aria-label="Change exam date for ${esc(s.name)}">
    </p>
    <div class="pdf-row">
      ${pdfLinkHTML(s.pdf, s.name, "remove-subject-pdf", `data-subject="${s.id}"`)}
      <input type="file" class="pdf-input" accept="application/pdf,.pdf" data-action="upload-subject-pdf" data-subject="${s.id}" aria-label="Attach reference PDF for ${esc(s.name)}">
    </div>
    ${wish}
    ${difficultyAlertHTML(s)}
    ${banner}${s.moved ? planHTML(s) : ""}
    <ul class="topics">${topics}</ul>
    <form class="row" data-form="topic" data-subject="${s.id}">
      <input name="topic" placeholder="Add a topic" maxlength="${MAX_NAME}" aria-label="New topic name">
      <button>Add</button>
    </form>
    <div class="actions">
      <button type="button" class="accent" data-action="simulate" data-subject="${s.id}">Simulate exam moved earlier</button>
      ${s.moved ? `<button type="button" class="ghost" data-action="reset" data-subject="${s.id}">Reset date</button>` : ""}
      <button type="button" class="ghost" data-action="delete-subject" data-subject="${s.id}">Delete subject</button>
    </div>
  </section>`;
}

let sortMode = "date"; // date | difficulty | pending
function sortSubjects(list) {
  const arr = [...list];
  if (sortMode === "difficulty") arr.sort((a, b) => DIFFICULTY_RANK[difficultyOf(a)] - DIFFICULTY_RANK[difficultyOf(b)] || a.exam.localeCompare(b.exam));
  else if (sortMode === "pending") arr.sort((a, b) => pendingPct(b) - pendingPct(a) || a.exam.localeCompare(b.exam));
  else arr.sort((a, b) => a.exam.localeCompare(b.exam)); // nearest exam first
  return arr;
}

function render() {
  const sorted = sortSubjects(state);
  document.getElementById("list").innerHTML = sorted.length
    ? sorted.map(subjectHTML).join("")
    : `<p class="empty">No subjects yet. Add one above.</p>`;
}

/* 6. Events (one listener per type, using data-action attributes) */
document.getElementById("subject-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const file = f.elements.pdf.files[0];
  let pdf = null;
  if (file) {
    try { pdf = await readPdfFile(file); }
    catch (err) { return pdfErrorToast(err); }
  }
  if (addSubject(f.elements.subject.value, f.elements.exam.value, f.elements.difficulty.value, pdf)) f.reset();
});

document.getElementById("sort-select").addEventListener("change", e => { sortMode = e.target.value; render(); });

const listEl = document.getElementById("list");
listEl.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.form !== "topic") return;
  const sid = f.dataset.subject;
  if (addTopic(sid, f.elements.topic.value)) {
    const next = document.querySelector(`[data-form="topic"][data-subject="${sid}"] input`);
    if (next) next.focus();
  } else f.elements.topic.focus();
});
listEl.addEventListener("change", async e => {
  const el = e.target;
  if (el.dataset.action === "toggle") toggleTopic(el.dataset.subject, el.dataset.topic);
  if (el.dataset.action === "priority") setPriority(el.dataset.subject, el.dataset.topic, el.value);
  if (el.dataset.action === "set-exam") setExamDate(el.dataset.subject, el.value);
  if (el.dataset.action === "upload-subject-pdf" || el.dataset.action === "upload-topic-pdf") {
    const file = el.files[0];
    try {
      const pdf = await readPdfFile(file);
      if (el.dataset.action === "upload-subject-pdf") setSubjectPdf(el.dataset.subject, pdf);
      else setTopicPdf(el.dataset.subject, el.dataset.topic, pdf);
    } catch (err) { pdfErrorToast(err); }
    el.value = ""; // allow re-selecting the same file later
  }
});
listEl.addEventListener("click", e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const { action, subject, topic } = b.dataset;
  const handlers = {
    "delete-topic": () => deleteTopic(subject, topic),
    "delete-subject": () => deleteSubject(subject),
    simulate: () => simulateEarlier(subject),
    reset: () => resetExam(subject),
    "remove-subject-pdf": () => setSubjectPdf(subject, null),
    "remove-topic-pdf": () => setTopicPdf(subject, topic, null),
  };
  if (handlers[action]) handlers[action]();
});

/* 7. Themes (Light, Dark or JellyFish, remembered in the browser) */
const THEME_KEY = "study-tracker:theme";
const THEMES = ["light", "dark", "jellyfish"];
function systemTheme() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("theme-select").value = theme;
}
let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
applyTheme(THEMES.indexOf(savedTheme) !== -1 ? savedTheme : systemTheme());
document.getElementById("theme-select").addEventListener("change", e => {
  applyTheme(e.target.value);
  try { localStorage.setItem(THEME_KEY, e.target.value); } catch (err) { /* ignore */ }
});

render();

const examsToday = state.filter(s => daysUntil(s.exam) === 0).map(s => s.name);
if (examsToday.length === 1) toast(`🍀 Good luck on your ${examsToday[0]} exam today!`);
else if (examsToday.length > 1) toast(`🍀 Good luck today — exams: ${examsToday.join(", ")}!`);
