// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboardTab() {
  const loading = document.getElementById('dashboard-loading');
  const error   = document.getElementById('dashboard-error');
  const content = document.getElementById('dashboard-content');

  loading.classList.remove('hidden');
  error.classList.add('hidden');
  content.classList.add('hidden');

  // Clear previous renders
  document.getElementById('dashboard-meetings-body').innerHTML = '';
  document.getElementById('dashboard-clients-body').innerHTML = '';
  document.getElementById('dashboard-unavailable-list').innerHTML = '';

  try {
    const [calendarResp, clientResp, statusResp] = await Promise.all([
      fetchCalendarAuditData(),
      fetchSheetData(),
      fetchMentorData()   // includes hiddenCols
    ]);

    const myEmail = (signedInEmail || '').toLowerCase().trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. Upcoming client meetings ───────────────────────────────────────────
    // Rows from this mentor's calendar (email column) for future dates, nearest first
    const emailHeader   = calendarResp.headers.find(h => h.toLowerCase().trim() === 'email');
    const dateHeader    = calendarResp.headers.find(h => h.toLowerCase().trim() === 'date');
    const timeHeader    = calendarResp.headers.find(h => h.toLowerCase().trim() === 'time');
    const subjectHeader = calendarResp.headers.find(h => h.toLowerCase().trim() === 'subject');
    const guestsHeader  = calendarResp.headers.find(h => h.toLowerCase().trim() === 'guests');

    const myMeetings = calendarResp.rows
      .filter(row => {
        if (!emailHeader) return false;
        if ((row[emailHeader] || '').toLowerCase().trim() !== myEmail) return false;
        const d = dateHeader ? new Date(row[dateHeader]) : null;
        return d && !isNaN(d.getTime()) && d >= today;
      })
      .sort((a, b) => new Date(a[dateHeader]) - new Date(b[dateHeader]));

    renderDashboardMeetings(myMeetings, { dateHeader, timeHeader, subjectHeader, guestsHeader });

    // ── 2. Clients assigned to this mentor ────────────────────────────────────
    // Look up mentor's display name from Mentor Status by email
    const myStatusRow = statusResp.rows.find(row =>
      (col(row, EMAIL_KEYS) || '').toLowerCase().trim() === myEmail
    );
    const myName = myStatusRow ? (col(myStatusRow, NAME_KEYS) || '').trim() : '';

    const mentor1Header    = clientResp.headers.find(h => h.toLowerCase().trim() === 'mentor 1');
    const needMentorHeader = clientResp.headers.find(h => h.toLowerCase().trim() === 'need mentor');
    const myClients = myName && mentor1Header
      ? clientResp.rows.filter(row =>
          (row[mentor1Header] || '').trim().toLowerCase() === myName.toLowerCase() &&
          needMentorHeader && (row[needMentorHeader] || '').trim().toUpperCase() === 'YES'
        )
      : [];

    renderDashboardClients(myClients, clientResp.headers, myName);

    // ── 3. Weeks marked unavailable ───────────────────────────────────────────
    renderDashboardUnavailable(myStatusRow, statusResp.headers, statusResp.hiddenCols || new Set());

    content.classList.remove('hidden');
    dashboardLoaded = true;
  } catch (err) {
    error.textContent = err.message === 'SESSION_EXPIRED'
      ? 'Your session expired. Please use the Sign Out button to sign in again.'
      : `Failed to load dashboard: ${err.message}`;
    error.classList.remove('hidden');
    console.error(err);
  } finally {
    loading.classList.add('hidden');
  }
}

// ─── RENDER: UPCOMING MEETINGS ────────────────────────────────────────────────
function renderDashboardMeetings(rows, { dateHeader, timeHeader, subjectHeader, guestsHeader }) {
  const tbody = document.getElementById('dashboard-meetings-body');

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'no-results';
    td.textContent = 'No upcoming meetings found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';

    [
      dateHeader    ? formatMeetingDate(row[dateHeader])    : '',
      timeHeader    ? (row[timeHeader]    || '')             : '',
      subjectHeader ? (row[subjectHeader] || '')             : ''
    ].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    // Invitees — one per line
    const guestsTd = document.createElement('td');
    guestsTd.className = 'cm-invitees';
    const guests = guestsHeader ? (row[guestsHeader] || '') : '';
    guests.split(',').forEach(g => {
      const trimmed = g.trim();
      if (!trimmed) return;
      const div = document.createElement('div');
      div.textContent = trimmed;
      guestsTd.appendChild(div);
    });
    tr.appendChild(guestsTd);

    tbody.appendChild(tr);
  });
}

// ─── RENDER: MY CLIENTS ───────────────────────────────────────────────────────
function renderDashboardClients(rows, headers, mentorName) {
  const tbody = document.getElementById('dashboard-clients-body');

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'no-results';
    td.textContent = 'No clients currently assigned.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const SHOW_COLS = ['name', 'email', 'date submitted'];
  const visibleHeaders = SHOW_COLS
    .map(key => headers.find(h => h.toLowerCase().trim() === key))
    .filter(Boolean);

  const mentor1ColIdx = headers.findIndex(h => h.toLowerCase().trim() === 'mentor 1');

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';

    visibleHeaders.forEach(header => {
      const td = document.createElement('td');
      const val = row[header] || '';
      td.textContent = header.toLowerCase().trim() === 'date submitted'
        ? formatDateValue(val)
        : val;
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const assignBtn = document.createElement('button');
    assignBtn.className = 'assign-cic-btn';
    assignBtn.textContent = 'Assign Client to CIC';
    assignBtn.addEventListener('click', () =>
      onAssignToCIC(row, headers, mentor1ColIdx, mentorName, assignBtn, actionTd)
    );
    actionTd.appendChild(assignBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
}

// ─── ASSIGN CLIENT TO CIC ─────────────────────────────────────────────────────
function onAssignToCIC(row, headers, mentor1ColIdx, mentorName, btn, td) {
  btn.remove();

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'assign-cic-confirm-btn';
  confirmBtn.textContent = 'Confirm';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'assign-cic-cancel-btn';
  cancelBtn.textContent = 'Cancel';

  cancelBtn.addEventListener('click', () => {
    confirmBtn.remove();
    cancelBtn.remove();
    const newBtn = document.createElement('button');
    newBtn.className = 'assign-cic-btn';
    newBtn.textContent = 'Assign Client to CIC';
    newBtn.addEventListener('click', () =>
      onAssignToCIC(row, headers, mentor1ColIdx, mentorName, newBtn, td)
    );
    td.appendChild(newBtn);
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.remove();
    cancelBtn.remove();

    const statusSpan = document.createElement('span');
    statusSpan.textContent = 'Processing…';
    statusSpan.className = 'assign-cic-status';
    td.appendChild(statusSpan);

    try {
      // Clear Mentor 1 in Client Tracking
      if (mentor1ColIdx >= 0) {
        await updateClientCell(row._rowIndex, colIndexToLetter(mentor1ColIdx), '');
      }

      // Build email body with client and mentor details
      const nameHeader  = headers.find(h => h.toLowerCase().trim() === 'name');
      const emailHeader = headers.find(h => h.toLowerCase().trim() === 'email');
      const dateHeader  = headers.find(h => h.toLowerCase().trim() === 'date submitted');

      const body = [
        `Client Name: ${nameHeader  ? (row[nameHeader]  || '') : ''}`,
        `Client Email: ${emailHeader ? (row[emailHeader] || '') : ''}`,
        `Date Submitted: ${dateHeader ? formatDateValue(row[dateHeader] || '') : ''}`,
        '',
        `Mentor Name: ${mentorName}`,
        `Mentor Email: ${signedInEmail}`,
      ].join('\n');

      await sendReassignEmail('slo-score-cic@scorevolunteer.org', 'Please reassign client', body, signedInEmail);

    } catch (err) {
      console.error('[AssignCIC] Failed:', err);
      statusSpan.textContent = `Failed: ${err.message}`;
      return; // don't reload on error
    }

    // Reload dashboard to reflect cleared mentor
    dashboardLoaded = false;
    loadDashboardTab();
  });

  td.appendChild(confirmBtn);
  td.appendChild(cancelBtn);
}

// ─── RENDER: UNAVAILABLE WEEKS ────────────────────────────────────────────────
function renderDashboardUnavailable(statusRow, headers, hiddenCols) {
  const list = document.getElementById('dashboard-unavailable-list');

  if (!statusRow) {
    const li = document.createElement('li');
    li.className = 'db-unavail-empty';
    li.textContent = 'No availability data found for your account.';
    list.appendChild(li);
    return;
  }

  // Week columns are non-readonly, non-hidden; TRUE = marked unavailable
  const readonlySet = new Set([...MENTOR_READONLY_COLUMNS, ...MENTOR_FORCE_HIDDEN]);
  const unavailableWeeks = headers
    .map((h, i) => ({ header: h, colIdx: i }))
    .filter(({ header, colIdx }) =>
      !hiddenCols.has(colIdx) &&
      !readonlySet.has(header.toLowerCase().trim()) &&
      (statusRow[header] || '').toString().toUpperCase() === 'TRUE'
    )
    .map(({ header }) => header);

  if (unavailableWeeks.length === 0) {
    const li = document.createElement('li');
    li.className = 'db-unavail-empty';
    li.textContent = 'No weeks currently marked unavailable.';
    list.appendChild(li);
    return;
  }

  unavailableWeeks.forEach(week => {
    const li = document.createElement('li');
    li.textContent = week;
    list.appendChild(li);
  });
}
