// Columns displayed as plain text (read-only)
const MENTOR_READONLY_COLUMNS = ['email', 'name', 'status', 'activity', 'availability'];

// Columns always hidden in Mentor Calendar (moved to Mentor Information cards)
const MENTOR_FORCE_HIDDEN = ['status', 'activity'];

// Returns the Sunday that is 2 weeks before today (local time)
function calendarStartDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 14);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

// Parses a column header in M/D/YYYY format; returns a Date or null
function parseHeaderDate(header) {
  const parts = header.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y) || y < 2000) return null;
  return new Date(y, m - 1, d);
}

let mentorHeaders = [];
let mentorHeaderIndices = {};
let mentorVisibleCols = [];

// ─── RENDER MENTOR TABLE ──────────────────────────────────────────────────────
function renderMentorTable(headers, rows) {
  mentorHeaders = headers;
  mentorHeaderIndices = {};
  headers.forEach((h, i) => { mentorHeaderIndices[h] = i; });

  // Visible columns: non-force-hidden; date columns only shown from 2 Sundays prior onward
  const startDate = calendarStartDate();
  mentorVisibleCols = headers
    .map((h, i) => ({ header: h, colIdx: i }))
    .filter(({ header }) => {
      if (MENTOR_FORCE_HIDDEN.includes(header.toLowerCase().trim())) return false;
      const d = parseHeaderDate(header);
      if (d !== null) return d >= startDate;
      return true; // non-date columns always shown
    });

  const table = document.getElementById('mentor-table');
  table.innerHTML = '';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  mentorVisibleCols.forEach(({ header }) => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = mentorVisibleCols.length;
    td.className = 'no-results';
    td.textContent = 'No mentor data found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, displayIdx) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIndex = row._rowIndex;
      buildMentorRow(tr, row, displayIdx);
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);

  document.getElementById('mentor-table-wrap').classList.remove('hidden');
  document.getElementById('mentor-loading').classList.add('hidden');
}

// ─── BUILD / REFRESH A SINGLE ROW ────────────────────────────────────────────
function buildMentorRow(tr, row, displayIdx) {
  tr.innerHTML = '';
  const dataRowIndex = row._rowIndex !== undefined ? row._rowIndex : parseInt(tr.dataset.rowIndex, 10);

  // Determine edit permission: CIC members can edit all rows;
  // others can only edit the row whose email matches their own sign-in.
  const emailHeader = mentorHeaders.find(h =>
    ['email', 'score email', 'scorevolunteer email', 'mentor email', 'e-mail']
      .includes(h.toLowerCase().trim())
  );
  const rowEmail = emailHeader ? (row[emailHeader] || '').toLowerCase().trim() : '';
  const userCanEdit = isCICMember || (signedInEmail && rowEmail === signedInEmail.toLowerCase().trim());

  // Availability coloring takes priority over stripe
  const availability = (row['Availability'] || '').trim();
  if (availability === 'Unavailable') {
    tr.style.backgroundColor = '#EC3254';
    tr.style.color = '#fff';
    tr.className = '';
  } else {
    tr.style.backgroundColor = '';
    tr.style.color = '';
    tr.className = displayIdx % 2 === 0 ? 'row-even' : 'row-odd';
  }

  mentorVisibleCols.forEach(({ header, colIdx }) => {
    const td = document.createElement('td');
    const isReadOnly = MENTOR_READONLY_COLUMNS.includes(header.toLowerCase().trim());

    if (isReadOnly) {
      td.textContent = row[header] || '';
    } else {
      const val = (row[header] || '').toString().toUpperCase();
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = val === 'TRUE';
      cb.className = 'mentor-checkbox';
      cb.dataset.rowIndex = dataRowIndex;
      cb.dataset.colIndex = colIdx;
      cb.dataset.header = header;
      if (userCanEdit) {
        cb.addEventListener('change', onMentorCheckboxChange);
      } else {
        cb.disabled = true;
      }
      td.appendChild(cb);
      td.className = 'checkbox-cell';
    }

    tr.appendChild(td);
  });
}

// ─── CHECKBOX CHANGE → IMMEDIATE WRITE + ROW REFRESH ────────────────────────
async function onMentorCheckboxChange(e) {
  const cb = e.target;
  const rowIndex = parseInt(cb.dataset.rowIndex, 10);
  const colIndex = parseInt(cb.dataset.colIndex, 10);
  const newValue = cb.checked;
  const tr = cb.closest('tr');
  const displayIdx = Array.from(tr.parentNode.children).indexOf(tr);

  // Disable row checkboxes while saving
  tr.querySelectorAll('.mentor-checkbox').forEach(c => c.disabled = true);

  try {
    await updateMentorCell(rowIndex, colIndex, newValue);

    // Re-fetch the row from the sheet and refresh the DOM
    const rawRow = await fetchMentorRow(rowIndex);
    const rowObj = { _rowIndex: rowIndex };
    mentorHeaders.forEach((h, i) => { rowObj[h] = rawRow[i] !== undefined ? rawRow[i] : ''; });
    buildMentorRow(tr, rowObj, displayIdx);
  } catch (err) {
    cb.checked = !newValue;
    showMentorError(`Failed to save change: ${err.message}`);
    console.error(err);
    tr.querySelectorAll('.mentor-checkbox').forEach(c => c.disabled = false);
  }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showMentorError(msg) {
  const el = document.getElementById('mentor-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}
