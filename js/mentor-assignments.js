// ─── STATE ────────────────────────────────────────────────────────────────────
let maHeaders = [];
let maRows = [];

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
async function loadMentorAssignmentsData() {
  const { headers, rows } = await fetchMentorAssignmentsData();
  maHeaders = headers;
  maRows = rows;
  renderMentorAssignmentsTable(headers, rows);
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderMentorAssignmentsTable(headers, rows) {
  const table = document.getElementById('ma-table');
  table.innerHTML = '';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = headers.length;
    td.className = 'no-results';
    td.textContent = 'No assignment data found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';
      headers.forEach(h => {
        const td = document.createElement('td');
        td.textContent = row[h] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);

  document.getElementById('ma-table-wrap').classList.remove('hidden');
  document.getElementById('ma-loading').classList.add('hidden');
}
