(() => {
	const STORAGE_KEY = 'assign-time.assignments.v1';
	const REMINDER_KEY = 'assign-time.reminders.v1';
	const DAY_MS = 24 * 60 * 60 * 1000;
	const state = {
		assignments: loadAssignments(),
		view: 'today',
		filter: 'all',
		selectedDate: toDateKey(new Date()),
		reminders: localStorage.getItem(REMINDER_KEY) === 'on',
		toastHandle: null
	};

	const $ = (selector) => document.querySelector(selector);
	const list = $('#assignment-list');
	const dialog = $('#assignment-dialog');
	const form = $('#assignment-form');
	const dateInput = $('#date');
	const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	})[character]);

	function loadAssignments() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
			return Array.isArray(saved) ? saved.filter((item) => item && item.id && item.title && item.dueAt) : [];
		} catch {
			return [];
		}
	}

	function save() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state.assignments));
	}

	function toDateKey(date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function dateFromKey(key) {
		const [year, month, day] = key.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function startOfWeek(date) {
		const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
		return start;
	}

	function formatDate(date, options = { month: 'short', day: 'numeric' }) {
		return new Intl.DateTimeFormat(undefined, options).format(date);
	}

	function dueDate(item) {
		return new Date(item.dueAt);
	}

	function isUrgent(item) {
		return !item.completedAt && dueDate(item).getTime() - Date.now() <= DAY_MS;
	}

	function formatDue(item) {
		const due = dueDate(item);
		const today = toDateKey(new Date());
		const dueKey = toDateKey(due);
		const dayLabel = dueKey === today ? 'Today' : dueKey < today ? 'Overdue' : formatDate(due);
		const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(due);
		return `${dayLabel} at ${timeLabel}`;
	}

	function assignmentMarkup(item) {
		const completed = Boolean(item.completedAt);
		const urgent = isUrgent(item);
		const due = dueDate(item);
		const priority = item.priority === 'high' ? '<span class="tag tag-high">High priority</span>' : '';
		const status = completed
			? '<span class="tag tag-done">Completed</span>'
			: urgent
				? `<span class="tag tag-urgent">${due.getTime() < Date.now() ? 'Overdue' : 'Due soon'}</span>`
				: '';
		return `<article class="assignment${completed ? ' is-complete' : ''}${urgent ? ' is-urgent' : ''}">
			<button class="complete-toggle${completed ? ' checked' : ''}" type="button" data-action="toggle" data-id="${escapeHtml(item.id)}" aria-label="${completed ? 'Mark incomplete' : 'Mark complete'}: ${escapeHtml(item.title)}" aria-pressed="${completed}"><svg><use href="#check"></use></svg></button>
			<div class="assignment-copy"><h4>${escapeHtml(item.title)}</h4><div class="assignment-meta">${item.course ? `<span>${escapeHtml(item.course)}</span><i></i>` : ''}<span class="due-label${urgent && !completed ? ' due-urgent' : ''}"><svg><use href="#clock"></use></svg>${escapeHtml(formatDue(item))}</span></div></div>
			<div class="assignment-tags">${priority}${status}</div>
			<button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}" title="Delete assignment"><svg><use href="#trash"></use></svg></button>
		</article>`;
	}

	function getVisibleAssignments() {
		const todayKey = toDateKey(new Date());
		const selected = dateFromKey(state.selectedDate);
		const weekStart = startOfWeek(selected);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 7);

		let items = [...state.assignments];
		if (state.view === 'done') {
			items = items.filter((item) => item.completedAt);
		} else {
			items = items.filter((item) => !item.completedAt);
			if (state.view === 'week') {
				items = items.filter((item) => {
					const date = dueDate(item);
					const key = toDateKey(date);
					return key < todayKey || (date >= weekStart && date < weekEnd);
				});
			} else {
				items = items.filter((item) => toDateKey(dueDate(item)) === state.selectedDate || toDateKey(dueDate(item)) < todayKey);
			}
		}

		if (state.filter === 'urgent') items = items.filter(isUrgent);
		if (state.filter === 'done') items = items.filter((item) => item.completedAt);
		if (state.view !== 'done' && state.filter !== 'done') items = items.filter((item) => !item.completedAt);
		return items.sort((a, b) => dueDate(a) - dueDate(b));
	}

	function renderWeekStrip() {
		const selected = dateFromKey(state.selectedDate);
		const start = startOfWeek(selected);
		$('#week-strip').innerHTML = Array.from({ length: 7 }, (_, index) => {
			const date = new Date(start);
			date.setDate(start.getDate() + index);
			const key = toDateKey(date);
			const count = state.assignments.filter((item) => !item.completedAt && toDateKey(dueDate(item)) === key).length;
			const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
			return `<button type="button" class="day-choice${key === state.selectedDate ? ' selected' : ''}${key === toDateKey(new Date()) ? ' is-today' : ''}" data-date="${key}" aria-pressed="${key === state.selectedDate}"><span>${dayName}</span><strong>${date.getDate()}</strong><i class="day-dot${count ? ' has-items' : ''}"></i></button>`;
		}).join('');
	}

	function renderActivity() {
		const today = new Date();
		const days = Array.from({ length: 7 }, (_, index) => {
			const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
			const key = toDateKey(date);
			const completed = state.assignments.some((item) => item.completedAt && toDateKey(new Date(item.completedAt)) === key);
			const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
			return `<span class="activity-day${completed ? ' active' : ''}" aria-label="${label}${completed ? ', completed work' : ', no completions'}" title="${label}"></span>`;
		}).join('');
		$('#activity').innerHTML = days;
		let streak = 0;
		const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const completedDates = new Set(state.assignments.filter((item) => item.completedAt).map((item) => toDateKey(new Date(item.completedAt))));
		if (!completedDates.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
		while (completedDates.has(toDateKey(cursor))) {
			streak += 1;
			cursor.setDate(cursor.getDate() - 1);
		}
		$('#streak').textContent = `${streak} day${streak === 1 ? '' : 's'} streak`;
	}

	function render() {
		const now = new Date();
		$('#top-date').textContent = formatDate(now, { month: 'long', day: 'numeric', year: 'numeric' });
		$('#welcome-date').textContent = formatDate(now, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
		const open = state.assignments.filter((item) => !item.completedAt);
		const weekStart = startOfWeek(now);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 7);
		const dueThisWeek = open.filter((item) => dueDate(item) >= weekStart && dueDate(item) < weekEnd);
		const urgentToday = open.filter((item) => toDateKey(dueDate(item)) === toDateKey(now) && isUrgent(item));
		const completedThisWeek = state.assignments.filter((item) => item.completedAt && new Date(item.completedAt) >= weekStart);
		const next = open.sort((a, b) => dueDate(a) - dueDate(b))[0];
		$('#due-count').textContent = dueThisWeek.length;
		$('#urgent-count').textContent = urgentToday.length;
		$('#week-count').textContent = dueThisWeek.length;
		$('#open-count').textContent = `${open.length} assignment${open.length === 1 ? '' : 's'}`;
		$('#done-count').textContent = `${completedThisWeek.length} this week`;
		$('#done-meta').textContent = completedThisWeek.length ? 'Look at you go' : 'Your effort counts';
		$('#next-stat').textContent = next ? next.title : 'Nothing due yet';
		$('#next-meta').textContent = next ? formatDue(next) : 'Enjoy the breathing room';
		$('#reminder').classList.toggle('is-on', state.reminders);
		$('#reminder').setAttribute('aria-pressed', String(state.reminders));
		$('#reminder-label').textContent = state.reminders ? 'Reminders on' : 'Reminders off';
		document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
		document.querySelectorAll('.filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.filter));
		renderWeekStrip();
		renderActivity();

		const title = state.view === 'done' ? 'Completed assignments' : state.view === 'week' ? 'This week' : state.selectedDate === toDateKey(now) ? 'Coming up' : formatDate(dateFromKey(state.selectedDate), { weekday: 'long', month: 'short', day: 'numeric' });
		$('#list-title').textContent = title;
		const visible = getVisibleAssignments();
		$('#list-meta').textContent = visible.length ? `${visible.length} assignment${visible.length === 1 ? '' : 's'} · sorted by deadline` : 'Your list is clear';
		list.innerHTML = visible.length ? visible.map(assignmentMarkup).join('') : `<div class="empty-state"><span class="empty-mark">${state.view === 'done' || state.filter === 'done' ? '✓' : '✳'}</span><strong>${state.view === 'done' || state.filter === 'done' ? 'Nothing completed here yet.' : state.filter === 'urgent' ? 'No urgent deadlines.' : 'A little breathing room.'}</strong><p>${state.view === 'done' || state.filter === 'done' ? 'Finished work will find its way here.' : state.filter === 'urgent' ? 'You are clear for now. Keep an eye on what is coming up.' : 'Add an assignment to make your plan.'}</p></div>`;
	}

	function showToast(message) {
		const toast = $('#toast');
		toast.textContent = message;
		toast.classList.add('visible');
		clearTimeout(state.toastHandle);
		state.toastHandle = setTimeout(() => toast.classList.remove('visible'), 2600);
	}

	function openDialog() {
		dateInput.value = state.selectedDate;
		if (typeof dialog.showModal === 'function') dialog.showModal();
		else dialog.setAttribute('open', '');
		$('#name').focus();
	}

	function closeDialog() {
		if (typeof dialog.close === 'function') dialog.close();
		else dialog.removeAttribute('open');
	}

	function toggleAssignment(id) {
		const item = state.assignments.find((assignment) => assignment.id === id);
		if (!item) return;
		item.completedAt = item.completedAt ? null : new Date().toISOString();
		save();
		render();
		showToast(item.completedAt ? 'Assignment completed. Nice work.' : 'Assignment moved back to your plan.');
	}

	async function toggleReminders() {
		if (state.reminders) {
			state.reminders = false;
			localStorage.setItem(REMINDER_KEY, 'off');
			render();
			showToast('Browser reminders turned off.');
			return;
		}
		if (!('Notification' in window)) {
			showToast('This browser does not support notifications.');
			return;
		}
		const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
		if (permission !== 'granted') {
			showToast('Allow notifications in your browser to turn reminders on.');
			return;
		}
		state.reminders = true;
		localStorage.setItem(REMINDER_KEY, 'on');
		render();
		showToast('Reminders are on while this planner is open.');
		checkReminders();
	}

	function checkReminders() {
		if (!state.reminders || !('Notification' in window) || Notification.permission !== 'granted') return;
		const now = Date.now();
		state.assignments.filter((item) => !item.completedAt && dueDate(item).getTime() > now && dueDate(item).getTime() - now <= DAY_MS).forEach((item) => {
			const key = `assign-time.notified.${item.id}`;
			if (localStorage.getItem(key)) return;
			new Notification('Assignment due soon', { body: `${item.title} is due ${formatDue(item)}.` });
			localStorage.setItem(key, 'yes');
		});
	}

	document.addEventListener('click', (event) => {
		const addButton = event.target.closest('.add-open');
		if (addButton) {
			openDialog();
			return;
		}
		const nav = event.target.closest('.nav-link');
		if (nav) {
			state.view = nav.dataset.view;
			state.filter = 'all';
			render();
			return;
		}
		const filter = event.target.closest('.filter');
		if (filter) {
			state.filter = filter.dataset.filter;
			render();
			return;
		}
		const day = event.target.closest('.day-choice');
		if (day) {
			state.selectedDate = day.dataset.date;
			if (state.view === 'done') state.view = 'today';
			render();
			return;
		}
		const action = event.target.closest('[data-action]');
		if (action) {
			if (action.dataset.action === 'toggle') toggleAssignment(action.dataset.id);
			if (action.dataset.action === 'delete') {
				const item = state.assignments.find((assignment) => assignment.id === action.dataset.id);
				state.assignments = state.assignments.filter((assignment) => assignment.id !== action.dataset.id);
				save();
				render();
				showToast(item ? `Deleted “${item.title}”.` : 'Assignment deleted.');
			}
			return;
		}
		if (event.target.closest('#reminder')) toggleReminders();
		if (event.target.closest('#close-dialog, #cancel-dialog')) closeDialog();
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!form.reportValidity()) return;
		const values = new FormData(form);
		const dueAt = new Date(`${values.get('date')}T${values.get('time')}`);
		const item = {
			id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			title: String(values.get('name')).trim(),
			course: String(values.get('course') || '').trim(),
			priority: values.get('priority') === 'high' ? 'high' : 'normal',
			dueAt: dueAt.toISOString(),
			completedAt: null,
			createdAt: new Date().toISOString()
		};
		state.assignments.push(item);
		save();
		state.selectedDate = String(values.get('date'));
		state.view = 'today';
		state.filter = 'all';
		form.reset();
		closeDialog();
		render();
		showToast('Assignment added to your plan.');
	});

	$('#reminder').addEventListener('click', toggleReminders);
	$('#close-dialog').addEventListener('click', closeDialog);
	$('#cancel-dialog').addEventListener('click', closeDialog);

	render();
	if (state.reminders) checkReminders();
	setInterval(checkReminders, 60 * 1000);
})();
