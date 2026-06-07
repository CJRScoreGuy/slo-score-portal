// ─── DATE FORMATTING ──────────────────────────────────────────────────────────
function formatMeetingDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// ─── BUILD DISPLAY ROWS (pure — no DOM, testable) ─────────────────────────────
function buildClientMeetingRows(calendarRows, calendarHeaders, nameByEmail) {
  const emailHeader   = calendarHeaders.find(h => h.toLowerCase().trim() === 'email');
  const dateHeader    = calendarHeaders.find(h => h.toLowerCase().trim() === 'date');
  const timeHeader    = calendarHeaders.find(h => h.toLowerCase().trim() === 'time');
  const subjectHeader = calendarHeaders.find(h => h.toLowerCase().trim() === 'subject');
  const guestsHeader  = calendarHeaders.find(h => h.toLowerCase().trim() === 'guests');

  const rows = calendarRows.map(row => {
    const email = emailHeader ? (row[emailHeader] || '').toLowerCase().trim() : '';
    return {
      name:     nameByEmail[email] || email,
      date:     formatMeetingDate(dateHeader    ? row[dateHeader]    : ''),
      time:     timeHeader    ? (row[timeHeader]    || '') : '',
      subject:  subjectHeader ? (row[subjectHeader] || '') : '',
      invitees: guestsHeader  ? (row[guestsHeader]  || '') : ''
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderClientMeetingsTable(rows) {
  const table = document.getElementById('cm-table');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Name', 'Date', 'Time', 'Subject', 'Invitees'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'no-results';
    td.textContent = 'No meeting data found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';
      ['name', 'date', 'time', 'subject', 'invitees'].forEach(key => {
        const td = document.createElement('td');
        td.textContent = row[key] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);

  document.getElementById('cm-table-wrap').classList.remove('hidden');
  document.getElementById('cm-loading').classList.add('hidden');
}

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
async function loadClientMeetingsTab() {
  const loading   = document.getElementById('cm-loading');
  const error     = document.getElementById('cm-error');
  const tableWrap = document.getElementById('cm-table-wrap');

  loading.classList.remove('hidden');
  error.classList.add('hidden');
  tableWrap.classList.add('hidden');

  try {
    const [calendarResp, statusResp] = await Promise.all([
      fetchCalendarAuditData(),
      fetchMentorStatusRows()
    ]);

    // Build email → name lookup from Mentor Status
    const nameByEmail = {};
    statusResp.rows.forEach(row => {
      const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
      const name  = col(row, NAME_KEYS);
      if (email && name) nameByEmail[email] = name.trim();
    });

    const rows = buildClientMeetingRows(calendarResp.rows, calendarResp.headers, nameByEmail);
    renderClientMeetingsTable(rows);
    clientMeetingsLoaded = true;
  } catch (err) {
    loading.classList.add('hidden');
    error.textContent = err.message === 'SESSION_EXPIRED'
      ? 'Your session expired. Please use the Sign Out button to sign in again.'
      : `Failed to load client meetings: ${err.message}`;
    error.classList.remove('hidden');
    console.error(err);
  }
}
