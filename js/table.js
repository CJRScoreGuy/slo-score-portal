// Columns that expand on hover to show full text
const EXPANDABLE_COLUMNS = ['client request', 'response'];

// Display name overrides — maps sheet header (lowercase) → label shown in UI
const COLUMN_DISPLAY_NAMES = {
  'mentor 1': 'Lead Mentor',
  'mentor 2': 'Co-mentor 1',
  'mentor 3': 'Co-mentor 2',
  'mentor 4': 'Co-mentor 3',
  'mentor 5': 'Co-mentor 4'
};

function getDisplayName(header) {
  return COLUMN_DISPLAY_NAMES[header.toLowerCase().trim()] || header;
}

// Columns to expose as filter inputs (case-insensitive match against sheet headers)
const FILTER_COLUMNS = [
  'email',
  'name',
  'date submitted',
  'mentor 1',
  'mentor 2',
  'mentor 3',
  'mentor 4',
  'mentor 5'
];

let allHeaders = [];
let allRows = [];
let filterValues = {}; // { normalizedHeader: filterString }

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderTable(headers, rows) {
  allHeaders = headers;
  allRows = rows;
  filterValues = {};

  buildFilterBar(headers);
  renderRows(rows);
  updateRowCount(rows.length, rows.length);
}

// ─── FILTER BAR ───────────────────────────────────────────────────────────────
function buildFilterBar(headers) {
  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  // Identify which headers match the filter columns
  const headerNorm = headers.map(h => h.toLowerCase().trim());

  FILTER_COLUMNS.forEach(col => {
    const idx = headerNorm.indexOf(col.toLowerCase());
    if (idx === -1) return; // column not present in this sheet

    const actualHeader = headers[idx];
    const displayName = getDisplayName(actualHeader);

    const wrapper = document.createElement('div');
    wrapper.className = 'filter-group';

    const label = document.createElement('label');
    label.textContent = displayName;
    label.htmlFor = `filter-${idx}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `filter-${idx}`;
    input.placeholder = `Filter ${displayName}…`;
    input.dataset.colIndex = idx;
    input.dataset.colHeader = actualHeader;
    input.addEventListener('input', onFilterChange);

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    bar.appendChild(wrapper);
  });

  // Clear all button
  if (bar.children.length > 0) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-filters';
    clearBtn.textContent = 'Clear Filters';
    clearBtn.addEventListener('click', clearAllFilters);
    bar.appendChild(clearBtn);
  }
}

// ─── FILTER LOGIC ─────────────────────────────────────────────────────────────
function onFilterChange(e) {
  const header = e.target.dataset.colHeader;
  filterValues[header] = e.target.value.trim().toLowerCase();
  applyFilters();
}

function clearAllFilters() {
  document.querySelectorAll('#filter-bar input').forEach(input => {
    input.value = '';
  });
  filterValues = {};
  applyFilters();
}

function applyFilters() {
  const activeFilters = Object.entries(filterValues).filter(([, val]) => val !== '');

  if (activeFilters.length === 0) {
    renderRows(allRows);
    updateRowCount(allRows.length, allRows.length);
    return;
  }

  const filtered = allRows.filter(row => {
    return activeFilters.every(([header, filterVal]) => {
      const cellVal = (row[header] || '').toLowerCase();
      return cellVal.includes(filterVal);
    });
  });

  renderRows(filtered);
  updateRowCount(filtered.length, allRows.length);
}

// ─── TABLE RENDER ─────────────────────────────────────────────────────────────
function buildTrCells(tr, row) {
  tr.innerHTML = '';
  allHeaders.forEach(header => {
    const td = document.createElement('td');
    const value = row[header] || '';
    const headerNorm = header.toLowerCase().trim();

    if (headerNorm === 'name') {
      td.textContent = value;
      const mentor1Header    = allHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
      const needMentorHeader = allHeaders.find(h => h.toLowerCase().trim() === 'need mentor');
      const mentor1Val    = mentor1Header    ? (row[mentor1Header]    || '').trim() : '';
      const needMentorVal = needMentorHeader ? (row[needMentorHeader] || '').trim().toUpperCase() : '';

      if (mentor1Val) {
        td.classList.add('has-reset-btn');
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-client-btn';
        resetBtn.textContent = 'Reset Mentor';
        resetBtn.addEventListener('click', () => onResetClient(row, resetBtn));
        td.appendChild(resetBtn);
      } else if (needMentorVal === 'YES') {
        td.classList.add('has-reset-btn');
        const getMentorBtn = document.createElement('button');
        getMentorBtn.className = 'get-mentor-btn';
        getMentorBtn.textContent = 'Get Mentor';
        getMentorBtn.addEventListener('click', () => onGetMentor(row, getMentorBtn, td));
        td.appendChild(getMentorBtn);
      }
    } else if (EXPANDABLE_COLUMNS.includes(headerNorm) && value.length > 0) {
      td.classList.add('cell-expandable');

      const textSpan = document.createElement('span');
      textSpan.className = 'cell-text';
      textSpan.textContent = value;
      td.appendChild(textSpan);

      const btn = document.createElement('button');
      btn.className = 'read-more-btn';
      btn.textContent = 'read more';
      btn.addEventListener('click', () => {
        const expanded = td.classList.toggle('expanded');
        btn.textContent = expanded ? 'read less' : 'read more';
      });
      td.appendChild(btn);
    } else {
      td.textContent = value;
    }

    tr.appendChild(td);
  });
}

function renderRows(rows) {
  const table = document.getElementById('data-table');
  table.innerHTML = '';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  allHeaders.forEach(h => {
    const th = document.createElement('th');
    th.textContent = getDisplayName(h);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = allHeaders.length;
    td.className = 'no-results';
    td.textContent = 'No records match the current filters.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';
      buildTrCells(tr, row);
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
}

// ─── GET MENTOR ───────────────────────────────────────────────────────────────
async function onGetMentor(row, btn, td) {
  btn.disabled = true;
  btn.textContent = 'Getting a mentor';
  btn.classList.add('flashing');

  try {
    const emailHeader = allHeaders.find(h => h.toLowerCase().trim() === 'email');
    const clientEmail = emailHeader ? (row[emailHeader] || '').trim() : '';
    if (!clientEmail) throw new Error('No email address found for this client row');
    const result = await runGetMentorScript(clientEmail);

    // Check for API-level error
    if (result.error) {
      const errMsg = result.error.details?.[0]?.errorMessage
        || result.error.message
        || 'Script error';
      throw new Error(errMsg);
    }

    // Check for script-returned error string
    const scriptResult = result.response?.result;
    if (typeof scriptResult === 'string' && scriptResult.toLowerCase().startsWith('error')) {
      throw new Error(scriptResult);
    }

    // Success — refresh the table to show updated mentor columns
    await loadClientData();

  } catch (err) {
    console.error('[GetMentor] Failed:', err);
    btn.classList.remove('flashing');
    const errSpan = document.createElement('span');
    errSpan.className = 'get-mentor-error';
    errSpan.textContent = err.message;
    td.replaceChild(errSpan, btn);
  }
}

// ─── RESET CLIENT ─────────────────────────────────────────────────────────────
function onResetClient(row, btn) {
  const mentor1Header = allHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
  const mentor1Name = mentor1Header ? (row[mentor1Header] || '').trim() : '';
  if (!mentor1Name) return;

  const td = btn.parentElement;

  // Step 1: Replace button with Continue? / Cancel? confirmation
  btn.remove();

  const continueBtn = document.createElement('button');
  continueBtn.className = 'reset-confirm-btn';
  continueBtn.textContent = 'Continue?';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'reset-cancel-btn';
  cancelBtn.textContent = 'Cancel?';

  cancelBtn.addEventListener('click', () => {
    continueBtn.remove();
    cancelBtn.remove();
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-client-btn';
    resetBtn.textContent = 'Reset Mentor';
    resetBtn.addEventListener('click', () => onResetClient(row, resetBtn));
    td.classList.add('has-reset-btn');
    td.appendChild(resetBtn);
  });

  continueBtn.addEventListener('click', async () => {
    continueBtn.remove();
    cancelBtn.remove();

    // Step 2: Show flashing "Resetting…" text
    const resetSpan = document.createElement('span');
    resetSpan.className = 'flashing';
    resetSpan.textContent = 'Resetting…';
    td.appendChild(resetSpan);

    try {
      // Fetch Mentor Assignments worksheet
      const { headers: maHeaders, rows: maRows } = await fetchMentorAssignmentsData();

      // Locate required columns (case-insensitive)
      const findCol = name => maHeaders.findIndex(h => h.toLowerCase().trim() === name.toLowerCase());
      const nameColIdx        = findCol('name');
      const assignmentsColIdx = findCol('assignments');
      const mentorAssignedIdx = findCol('mentor assigned');

      if (nameColIdx < 0)        throw new Error(`Column "Name" not found. Available: ${maHeaders.join(', ')}`);
      if (assignmentsColIdx < 0) throw new Error(`Column "Assignments" not found. Available: ${maHeaders.join(', ')}`);
      if (mentorAssignedIdx < 0) throw new Error(`Column "Mentor Assigned" not found. Available: ${maHeaders.join(', ')}`);

      // Find the mentor row matching Mentor 1 name
      const nameHeader = maHeaders[nameColIdx];
      const maRow = maRows.find(r => (r[nameHeader] || '').toLowerCase().trim() === mentor1Name.toLowerCase());
      if (!maRow) throw new Error(`Mentor "${mentor1Name}" not found in Mentor Assignments`);

      // Subtract 1 from Assignments (min 0)
      const assignmentsHeader = maHeaders[assignmentsColIdx];
      const currentVal = parseInt(maRow[assignmentsHeader], 10) || 0;
      await updateMentorAssignmentsCell(maRow._rowIndex, colIndexToLetter(assignmentsColIdx), Math.max(0, currentVal - 1));

      // Set Mentor Assigned to 0
      await updateMentorAssignmentsCell(maRow._rowIndex, colIndexToLetter(mentorAssignedIdx), 0);

      // Clear Mentor 1–5 in Client Tracking
      await clearClientMentorColumns(row._rowIndex, allHeaders);

      // Step 3: Fetch updated row data and refresh only this row in the table
      const rawCells = await fetchClientRow(row._rowIndex);
      const updatedRow = { _rowIndex: row._rowIndex };
      allHeaders.forEach((header, i) => {
        updatedRow[header] = rawCells[i] !== undefined ? rawCells[i] : '';
      });
      const allRowsIdx = allRows.findIndex(r => r._rowIndex === row._rowIndex);
      if (allRowsIdx >= 0) allRows[allRowsIdx] = updatedRow;
      const tr = td.closest('tr');
      buildTrCells(tr, updatedRow);

    } catch (err) {
      console.error('[ResetMentor] Failed:', err);
      resetSpan.remove();
      const resetBtn = document.createElement('button');
      resetBtn.className = 'reset-client-btn';
      resetBtn.textContent = 'Reset Mentor';
      resetBtn.addEventListener('click', () => onResetClient(row, resetBtn));
      td.appendChild(resetBtn);
      showClientError(`Reset Mentor failed: ${err.message}`);
    }
  });

  td.appendChild(continueBtn);
  td.appendChild(cancelBtn);
}

// ─── ROW COUNT ────────────────────────────────────────────────────────────────
function updateRowCount(shown, total) {
  const el = document.getElementById('row-count');
  if (el) {
    el.textContent = shown === total
      ? `${total} records`
      : `${shown} of ${total} records`;
  }
}
