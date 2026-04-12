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
      allHeaders.forEach(header => {
        const td = document.createElement('td');
        const value = row[header] || '';

        if (EXPANDABLE_COLUMNS.includes(header.toLowerCase().trim()) && value.length > 0) {
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
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
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
