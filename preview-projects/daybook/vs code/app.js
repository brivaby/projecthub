const STORAGE_KEY = "daybook-assignments-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = new Date();
const todayKey = dateKey(today);
const dateAfter = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};

const starterTasks = [
  { id: "sample-1", title: "Read and annotate chapter 6", course: "Environmental Science", due: dateAfter(1), priority: "High", status: "progress", progress: 35 },
  { id: "sample-2", title: "Draft thesis statement", course: "Modern Literature", due: dateAfter(2), priority: "Medium", status: "open" },
  { id: "sample-3", title: "Submit lab reflection", course: "Cell Biology", due: dateAfter(4), priority: "Low", status: "open" },
  { id: "sample-4", title: "Review lecture notes", course: "Statistics", due: dateAfter(7), priority: "Medium", status: "open" },
];

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return starterTasks;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map((task) => ({
      ...task,
      progress: task.status === "done" ? 100 : task.status === "progress" && (!Number.isFinite(task.progress) || task.progress === 0) ? 35 : Number.isFinite(task.progress) ? Math.min(100, Math.max(0, task.progress)) : 0,
    })) : starterTasks;
  } catch {
    return starterTasks;
  }
}

let tasks = loadTasks();
let activeView = "all";
let activePriority = "all";
let activeDateKey = null;
let heatmapMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let toastTimer;

const listEl = document.querySelector("#assignment-list");
const upcomingEl = document.querySelector("#upcoming-list");
const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const themeToggle = document.querySelector("#theme-toggle");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function applyTheme(theme, persist = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.setAttribute("title", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.firstElementChild.textContent = isDark ? "☀" : "☾";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#141b18" : "#f6f7f4";
  if (persist) localStorage.setItem("daybook-theme", isDark ? "dark" : "light");
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(task) {
  const due = new Date(`${task.due}T00:00:00`);
  return Math.round((startOfDay(due) - startOfDay(today)) / DAY_MS);
}

function formatDue(task) {
  const difference = daysUntil(task);
  if (difference < 0) return `Overdue ${Math.abs(difference)}d`;
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return new Date(`${task.due}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatShortDay(date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function displayDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function filteredTasks() {
  const search = document.querySelector("#search-input").value.trim().toLowerCase();
  return tasks.filter((task) => {
    const matchesView = activeDateKey ? task.due === activeDateKey
      : activeView === "completed" ? task.status === "done"
      : activeView === "today" ? task.status !== "done" && task.due === todayKey
        : activeView === "week" ? task.status !== "done" && daysUntil(task) >= 0 && daysUntil(task) < 7
          : true;
    const matchesPriority = activePriority === "all" || task.priority === activePriority;
    const matchesSearch = `${task.title} ${task.course}`.toLowerCase().includes(search);
    return matchesView && matchesPriority && matchesSearch;
  }).sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
}

function renderList() {
  const visible = filteredTasks();
  document.querySelector("#list-count").textContent = `${visible.length} ${visible.length === 1 ? "item" : "items"}`;
  if (!visible.length) {
    const heading = activeView === "completed" ? "Nothing completed just yet." : "A clear page.";
    const detail = activeView === "completed" ? "Finished assignments will show up here." : "No assignments match this view. Add one to get started.";
    listEl.innerHTML = `<div class="empty-state"><strong>${heading}</strong>${detail}</div>`;
    return;
  }

  listEl.innerHTML = visible.map((task, index) => {
    const complete = task.status === "done";
    const overdue = !complete && daysUntil(task) < 0;
    const progress = complete ? 100 : Math.min(100, Math.max(0, Number(task.progress) || 0));
    const stateLabel = complete ? "Completed" : task.status === "progress" ? "In progress" : "Not started";
    return `<article class="assignment-row ${complete ? "is-complete" : ""}" style="animation-delay:${Math.min(index, 6) * 35}ms">
      <button class="complete-button" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${complete ? "Mark incomplete" : "Mark complete"}: ${escapeHtml(task.title)}">${complete ? "✓" : ""}</button>
      <div class="assignment-copy"><span class="assignment-title">${escapeHtml(task.title)}</span><span class="assignment-meta"><span>${escapeHtml(task.course || "No course")}</span><span class="meta-divider">·</span><span>${stateLabel}</span></span><div class="task-progress"><div class="task-progress-track" role="progressbar" aria-label="${escapeHtml(task.title)} progress" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><span>${progress}%</span></div></div>
      <div class="priority-tag"><span class="priority-dot ${task.priority.toLowerCase()}"></span>${escapeHtml(task.priority)}</div>
      <span class="due-date ${overdue ? "is-overdue" : ""}">${formatDue(task)}</span>
      <div class="row-actions"><button class="more-button" data-action="menu" data-id="${escapeHtml(task.id)}" aria-label="Actions for ${escapeHtml(task.title)}">···</button></div>
    </article>`;
  }).join("");
}

function renderHeatmap() {
  const year = heatmapMonth.getFullYear();
  const month = heatmapMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  document.querySelector("#heatmap-month").textContent = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    if (day < 1 || day > daysInMonth) return '<span class="heatmap-blank" aria-hidden="true"></span>';
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const count = tasks.filter((task) => task.status !== "done" && task.due === key).length;
    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
    const isToday = key === todayKey;
    const isSelected = key === activeDateKey;
    const dueLabel = `${count} open ${count === 1 ? "assignment" : "assignments"} due`;
    return `<button type="button" class="heatmap-day heat-level-${level} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}" data-date="${key}" aria-label="${displayDate(key)}, ${dueLabel}" aria-pressed="${isSelected}" style="animation-delay:${Math.min(index, 35) * 7}ms">${day}</button>`;
  }).join("");
  document.querySelector("#deadline-heatmap").innerHTML = cells;
}

function renderUpcoming() {
  const upcoming = tasks.filter((task) => task.status !== "done" && daysUntil(task) >= 0 && daysUntil(task) < 7).sort((a, b) => a.due.localeCompare(b.due));
  upcomingEl.innerHTML = upcoming.map((task) => `<div class="upcoming-item"><div class="upcoming-date"><strong>${displayDate(task.due)}</strong>${daysUntil(task) === 0 ? "Today" : daysUntil(task) === 1 ? "Tomorrow" : formatShortDay(new Date(`${task.due}T00:00:00`))}</div><div class="upcoming-copy"><span class="upcoming-title">${escapeHtml(task.title)}</span><span class="upcoming-course">${escapeHtml(task.course || "No course")}</span></div></div>`).join("");
  document.querySelector("#empty-upcoming").hidden = upcoming.length > 0;
}

function renderStats() {
  const open = tasks.filter((task) => task.status !== "done");
  const completed = tasks.filter((task) => task.status === "done").length;
  const dueToday = open.filter((task) => task.due === todayKey).length;
  const weekTasks = tasks.filter((task) => daysUntil(task) >= 0 && daysUntil(task) < 7);
  const weekDone = weekTasks.filter((task) => task.status === "done").length;
  const weekTotal = weekTasks.length;
  document.querySelector("#stat-open").textContent = open.length;
  document.querySelector("#stat-today").textContent = dueToday;
  document.querySelector("#stat-completed").textContent = completed;
  document.querySelector("#nav-open-count").textContent = open.length;
  document.querySelector("#week-progress-label").textContent = `${weekDone} of ${weekTotal} assignments done`;
  document.querySelector("#week-progress-fill").style.width = `${weekTotal ? (weekDone / weekTotal) * 100 : 0}%`;
  document.querySelector("#week-note-copy").textContent = weekTotal ? "Every finished task is progress." : "A little progress adds up.";
  const focusTask = open[0];
  document.querySelector("#focus-message").textContent = focusTask ? focusTask.title : "One thing at a time.";
  document.querySelector("#focus-description").textContent = focusTask ? `${focusTask.course || "Assignment"} · due ${formatDue(focusTask).toLowerCase()}` : "Pick a task and give it your attention.";
}

function render() {
  renderStats();
  renderList();
  renderHeatmap();
  renderUpcoming();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function openDialog(task) {
  form.reset();
  document.querySelector("#task-id").value = task?.id ?? "";
  document.querySelector("#task-title").value = task?.title ?? "";
  document.querySelector("#task-course").value = task?.course ?? "";
  document.querySelector("#task-due").value = task?.due ?? todayKey;
  document.querySelector("#task-priority").value = task?.priority ?? "Medium";
  document.querySelector("#task-status").value = task?.status ?? "open";
  document.querySelector("#task-progress").value = task?.progress ?? (task?.status === "progress" ? 35 : task?.status === "done" ? 100 : 0);
  document.querySelector("#task-progress-value").value = `${document.querySelector("#task-progress").value}%`;
  document.querySelector("#dialog-title").textContent = task ? "Edit assignment" : "Add assignment";
  document.querySelector("#save-task").textContent = task ? "Save changes" : "Save assignment";
  dialog.showModal();
  document.querySelector("#task-title").focus();
}

document.querySelector("#today-label").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
document.querySelector("#greeting").textContent = `${today.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase()} · A FRESH START`;
applyTheme(document.documentElement.dataset.theme || "light");

themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
document.querySelector("#add-assignment").addEventListener("click", () => openDialog());
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => dialog.close());
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#task-id").value;
  const existing = tasks.find((task) => task.id === id);
  const task = {
    id: id || (crypto.randomUUID?.() ?? `task-${Date.now()}`),
    title: document.querySelector("#task-title").value.trim(),
    course: document.querySelector("#task-course").value.trim(),
    due: document.querySelector("#task-due").value,
    priority: document.querySelector("#task-priority").value,
    status: document.querySelector("#task-status").value,
    progress: Number(document.querySelector("#task-progress").value),
  };
  if (task.status === "done" || task.progress === 100) {
    task.status = "done";
    task.progress = 100;
  } else if (task.progress > 0) {
    task.status = "progress";
  }
  tasks = existing ? tasks.map((item) => item.id === id ? task : item) : [...tasks, task];
  saveTasks();
  render();
  dialog.close();
  showToast(existing ? "Assignment updated" : "Assignment added");
});

listEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = tasks.find((item) => item.id === button.dataset.id);
  if (!task) return;
  if (button.dataset.action === "toggle") {
    task.status = task.status === "done" ? "open" : "done";
    task.progress = task.status === "done" ? 100 : 0;
    saveTasks();
    render();
    showToast(task.status === "done" ? "Nice work. Assignment completed." : "Assignment marked incomplete");
  } else {
    document.querySelectorAll(".row-menu").forEach((menu) => menu.remove());
    const menu = document.createElement("div");
    menu.className = "row-menu";
    menu.innerHTML = '<button type="button" data-menu-action="edit">Edit</button><button type="button" data-menu-action="delete">Delete</button>';
    button.parentElement.append(menu);
    menu.addEventListener("click", (menuEvent) => {
      const action = menuEvent.target.closest("button")?.dataset.menuAction;
      if (action === "edit") openDialog(task);
      if (action === "delete") {
        tasks = tasks.filter((item) => item.id !== task.id);
        saveTasks();
        render();
        showToast("Assignment deleted");
      }
    }, { once: true });
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".row-actions")) document.querySelectorAll(".row-menu").forEach((menu) => menu.remove());
});

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  activeView = button.dataset.filter;
  activeDateKey = null;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelector("#list-heading").textContent = { all: "All assignments", today: "Due today", week: "This week", completed: "Completed" }[activeView];
  renderList();
}));

document.querySelector("#deadline-heatmap").addEventListener("click", (event) => {
  const day = event.target.closest("button[data-date]");
  if (!day) return;
  activeDateKey = activeDateKey === day.dataset.date ? null : day.dataset.date;
  document.querySelector("#list-heading").textContent = activeDateKey ? `Due ${displayDate(activeDateKey)}` : { all: "All assignments", today: "Due today", week: "This week", completed: "Completed" }[activeView];
  renderList();
  renderHeatmap();
});

document.querySelector("#previous-month").addEventListener("click", () => {
  heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() - 1, 1);
  renderHeatmap();
});

document.querySelector("#next-month").addEventListener("click", () => {
  heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() + 1, 1);
  renderHeatmap();
});

document.querySelector("#task-progress").addEventListener("input", (event) => {
  const value = Number(event.target.value);
  document.querySelector("#task-progress-value").value = `${value}%`;
  if (value === 100) document.querySelector("#task-status").value = "done";
  else if (value > 0) document.querySelector("#task-status").value = "progress";
  else if (document.querySelector("#task-status").value === "done") document.querySelector("#task-status").value = "open";
});

document.querySelector("#task-status").addEventListener("change", (event) => {
  const progress = document.querySelector("#task-progress");
  if (event.target.value === "done") progress.value = "100";
  else if (event.target.value === "open") progress.value = "0";
  else if (Number(progress.value) === 0) progress.value = "35";
  document.querySelector("#task-progress-value").value = `${progress.value}%`;
});

document.querySelectorAll(".priority-filter").forEach((button) => button.addEventListener("click", () => {
  activePriority = button.dataset.priority;
  document.querySelectorAll(".priority-filter").forEach((item) => item.classList.toggle("is-selected", item === button));
  renderList();
}));

document.querySelector("#search-input").addEventListener("input", renderList);
render();