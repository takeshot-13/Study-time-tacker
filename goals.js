// Goals & Progress page logic.
//
// SCOPE NOTE: goals are stored in localStorage (key: stt-goals), the same
// pattern the existing daily/monthly goal targets on the Study Time
// Tracker page already use. This intentionally does NOT use Supabase —
// only the Dashboard's binary calendar is account-scoped so far. See the
// chat summary for why.
//
// "Daily Log" here means the Study Time Tracker's per-day entries
// (localStorage key study-tracker-YYYY-MM, row shape
// {day, weekday, filled, topic}). Marking a planned session as logged
// writes the subject into that exact row's topic field, so it shows up
// for real the next time that month is opened on the Tracker page.

window.STTGoals = (function () {
  const GOALS_KEY = 'stt-goals';

  // ---------- Storage ----------
  function loadGoals() {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load goals', e);
      return [];
    }
  }

  function saveGoals(goals) {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    } catch (e) {
      console.error('Failed to save goals', e);
    }
  }

  let goals = loadGoals();

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayIso() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return isoFromDate(d);
  }

  function isoFromDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dateFromIso(iso) {
    return new Date(iso + 'T00:00:00');
  }

  function formatDateShort(iso) {
    return dateFromIso(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatDateFull(iso) {
    return dateFromIso(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysUntil(iso) {
    const ms = dateFromIso(iso) - dateFromIso(todayIso());
    return Math.round(ms / 86400000);
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  // ---------- Weekly plan generation ----------
  // Simple by design: cycles through the goal's subjects one per day for
  // the next 7 days, stopping early if the target date arrives first.
  function generateWeeklyPlan(goal) {
    if (!goal.subjects.length) return [];
    const today = dateFromIso(todayIso());
    const target = dateFromIso(goal.targetDate);
    const plan = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (d > target) break;
      const iso = isoFromDate(d);
      const subject = goal.subjects[i % goal.subjects.length];
      plan.push({ date: iso, subject, logged: false });
    }
    return plan;
  }

  // ---------- Progress ----------
  function computeProgress(goal) {
    if (goal.milestones.length) {
      const done = goal.milestones.filter((m) => m.done).length;
      return Math.round((done / goal.milestones.length) * 100);
    }
    if (goal.weeklyPlan.length) {
      const logged = goal.weeklyPlan.filter((p) => p.logged).length;
      return Math.round((logged / goal.weeklyPlan.length) * 100);
    }
    return 0;
  }

  // ---------- Daily Log (Study Time Tracker) integration ----------
  function trackerStorageKey(iso) {
    const [y, m] = iso.split('-');
    return 'study-tracker-' + y + '-' + m;
  }

  function logSessionToDailyLog(iso, subject) {
    const key = trackerStorageKey(iso);
    let rows = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) rows = JSON.parse(raw);
    } catch (e) {
      rows = null;
    }

    const d = dateFromIso(iso);
    const day = d.getDate();

    if (!Array.isArray(rows) || !rows.length) {
      // No Tracker data for this month yet — create a full month of blank
      // rows in the exact shape study-time-tracker.html expects, so it
      // loads normally (and shows this session) the next time it's opened.
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      rows = [];
      for (let dd = 1; dd <= daysInMonth; dd++) {
        rows.push({
          day: dd,
          weekday: new Date(d.getFullYear(), d.getMonth(), dd).getDay(),
          filled: 0,
          topic: ''
        });
      }
    }

    const row = rows.find((r) => r.day === day);
    if (row) {
      if (!row.topic) {
        row.topic = subject;
      } else if (!row.topic.split(',').map((s) => s.trim()).includes(subject)) {
        row.topic = row.topic + ', ' + subject;
      }
    }

    try {
      localStorage.setItem(key, JSON.stringify(rows));
      return true;
    } catch (e) {
      console.error('Failed to link session to Daily Log', e);
      return false;
    }
  }

  // ---------- Rendering ----------
  const goalsList = () => document.getElementById('goalsList');

  function render() {
    const container = goalsList();
    if (!goals.length) {
      container.innerHTML = '<p class="empty-state">No study goals yet — click "+ New Goal" to set your first target.</p>';
      return;
    }
    container.innerHTML = goals.map(goalCardHtml).join('');
  }

  function goalCardHtml(goal) {
    const progress = computeProgress(goal);
    const daysLeft = daysUntil(goal.targetDate);
    const overdue = daysLeft < 0;
    const targetLabel = overdue
      ? `Target: ${formatDateFull(goal.targetDate)} · overdue`
      : daysLeft === 0
        ? `Target: ${formatDateFull(goal.targetDate)} · today`
        : `Target: ${formatDateFull(goal.targetDate)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

    const tagsHtml = goal.subjects.map((s) => `<span class="goal-tag">${escapeHtml(s)}</span>`).join('');

    const milestonesHtml = goal.milestones.length
      ? goal.milestones.map((m) => `
        <label class="milestone-item${m.done ? ' done' : ''}">
          <input type="checkbox" data-goal-id="${goal.id}" data-milestone-id="${m.id}" ${m.done ? 'checked' : ''}>
          <span class="milestone-text">${escapeHtml(m.text)}</span>
          ${m.date ? `<span class="milestone-date">${formatDateShort(m.date)}</span>` : ''}
        </label>
      `).join('')
      : '<p class="plan-empty">No milestones added.</p>';

    const planHtml = goal.weeklyPlan.length
      ? goal.weeklyPlan.map((p) => `
        <div class="plan-day">
          <span class="plan-date">${formatDateShort(p.date)}</span>
          <span class="plan-subject">${escapeHtml(p.subject)}</span>
          <button type="button" class="plan-log-btn${p.logged ? ' logged' : ''}" data-goal-id="${goal.id}" data-plan-date="${p.date}">
            ${p.logged ? '\u2713 Logged to Daily Log' : 'Mark logged'}
          </button>
        </div>
      `).join('')
      : '<p class="plan-empty">Add at least one subject to generate a plan.</p>';

    return `
      <div class="goal-card" data-goal-id="${goal.id}">
        <div class="goal-card-header">
          <h3>${escapeHtml(goal.title)}</h3>
          <button type="button" class="goal-delete-btn" data-delete-goal="${goal.id}" aria-label="Delete goal">Delete</button>
        </div>
        <div class="goal-meta">
          ${tagsHtml}
          <span class="goal-target${overdue ? ' overdue' : ''}">${targetLabel}</span>
        </div>
        <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${progress}%"></div></div>
        <div class="goal-progress-label">${progress}% complete</div>

        <div class="milestones-block">
          <div class="goal-section-title">Milestones</div>
          ${milestonesHtml}
        </div>

        <div class="plan-block">
          <div class="plan-block-header">
            <div class="goal-section-title" style="margin:0;">This Week's Plan</div>
            <button type="button" class="btn-link" data-regen-goal="${goal.id}">Regenerate</button>
          </div>
          ${planHtml}
          <p class="plan-note">Marking a session "logged" writes the subject into that day's Study Time Tracker entry automatically.</p>
        </div>
      </div>
    `;
  }

  // ---------- Form: milestone rows ----------
  function milestoneRowHtml() {
    return `
      <div class="milestone-row">
        <input type="text" class="ms-text" placeholder="Milestone (e.g. Finish Chapter 3)">
        <input type="date" class="ms-date">
        <button type="button" class="milestone-remove-btn" aria-label="Remove milestone">&#10005;</button>
      </div>
    `;
  }

  function addMilestoneRow() {
    const wrap = document.getElementById('milestoneRows');
    wrap.insertAdjacentHTML('beforeend', milestoneRowHtml());
  }

  function resetForm() {
    document.getElementById('goalTitle').value = '';
    document.getElementById('goalTargetDate').value = '';
    document.getElementById('goalSubjects').value = '';
    document.getElementById('milestoneRows').innerHTML = '';
    addMilestoneRow();
  }

  function showForm() {
    resetForm();
    document.getElementById('goalFormCard').hidden = false;
    document.getElementById('goalTitle').focus();
  }

  function hideForm() {
    document.getElementById('goalFormCard').hidden = true;
  }

  function saveNewGoal() {
    const title = document.getElementById('goalTitle').value.trim();
    const targetDate = document.getElementById('goalTargetDate').value;
    const subjects = document.getElementById('goalSubjects').value
      .split(',').map((s) => s.trim()).filter(Boolean);

    if (!title) { alert('Give the goal a title.'); return; }
    if (!targetDate) { alert('Pick a target date.'); return; }
    if (daysUntil(targetDate) < 0) { alert('Target date is in the past — pick a future date.'); return; }

    const milestones = Array.from(document.querySelectorAll('#milestoneRows .milestone-row'))
      .map((row) => ({
        id: uid(),
        text: row.querySelector('.ms-text').value.trim(),
        date: row.querySelector('.ms-date').value || null,
        done: false
      }))
      .filter((m) => m.text);

    const goal = {
      id: uid(),
      title,
      targetDate,
      subjects,
      milestones,
      weeklyPlan: [],
      createdAt: todayIso()
    };
    goal.weeklyPlan = generateWeeklyPlan(goal);

    goals.push(goal);
    saveGoals(goals);
    hideForm();
    render();
  }

  // ---------- Event delegation for goal cards ----------
  function wireListEvents() {
    goalsList().addEventListener('click', (e) => {
      const del = e.target.closest('[data-delete-goal]');
      if (del) {
        if (confirm('Delete this goal? This cannot be undone.')) {
          goals = goals.filter((g) => g.id !== del.dataset.deleteGoal);
          saveGoals(goals);
          render();
        }
        return;
      }

      const regen = e.target.closest('[data-regen-goal]');
      if (regen) {
        const goal = goals.find((g) => g.id === regen.dataset.regenGoal);
        if (goal) {
          goal.weeklyPlan = generateWeeklyPlan(goal);
          saveGoals(goals);
          render();
        }
        return;
      }

      const logBtn = e.target.closest('.plan-log-btn');
      if (logBtn && !logBtn.classList.contains('logged')) {
        const goal = goals.find((g) => g.id === logBtn.dataset.goalId);
        if (goal) {
          const session = goal.weeklyPlan.find((p) => p.date === logBtn.dataset.planDate);
          if (session) {
            const ok = logSessionToDailyLog(session.date, session.subject);
            if (ok) {
              session.logged = true;
              saveGoals(goals);
              render();
            } else {
              alert('Could not save to the Daily Log — your browser storage may be full or unavailable.');
            }
          }
        }
        return;
      }
    });

    goalsList().addEventListener('change', (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-milestone-id]');
      if (!cb) return;
      const goal = goals.find((g) => g.id === cb.dataset.goalId);
      if (!goal) return;
      const milestone = goal.milestones.find((m) => m.id === cb.dataset.milestoneId);
      if (!milestone) return;
      milestone.done = cb.checked;
      saveGoals(goals);
      render();
    });
  }

  function wireFormEvents() {
    document.getElementById('newGoalBtn').addEventListener('click', showForm);
    document.getElementById('cancelGoalBtn').addEventListener('click', hideForm);
    document.getElementById('saveGoalBtn').addEventListener('click', saveNewGoal);
    document.getElementById('addMilestoneBtn').addEventListener('click', addMilestoneRow);

    document.getElementById('milestoneRows').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.milestone-remove-btn');
      if (!removeBtn) return;
      const rows = document.querySelectorAll('#milestoneRows .milestone-row');
      if (rows.length > 1) {
        removeBtn.closest('.milestone-row').remove();
      } else {
        // Always keep at least one row — just clear it instead of removing.
        removeBtn.closest('.milestone-row').querySelector('.ms-text').value = '';
        removeBtn.closest('.milestone-row').querySelector('.ms-date').value = '';
      }
    });
  }

  function init() {
    wireFormEvents();
    wireListEvents();
    render();
  }

  return { init };
})();
