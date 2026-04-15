// ─── CONFIGURATION ───────────────────────────────────────────────────────────
// Client Tracking spreadsheet
const SPREADSHEET_ID = '1iPT1szaBZSNQftM1409-NJYuD4eBBDSCSH-b3i-0fS8';
const SHEET_NAME = 'Client Tracking';
const RANGE = `${SHEET_NAME}!A1:Z`;

// Mentor Information spreadsheet — set this to your Mentor Information spreadsheet ID
// (may be the same as SPREADSHEET_ID if it's a tab in the same file)
const MENTOR_SPREADSHEET_ID = '1E2RtxWQJZrxIREhDwt_uxOpINN4GARh487OCSGqHNpw';
const MENTOR_SHEET_NAME = 'Mentor Status';
const MENTOR_RANGE = `${MENTOR_SHEET_NAME}!A1:BE`;

// ─── SHARED FETCH HELPER ─────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${getAccessToken()}`, ...options.headers }
  });
  if (response.status === 401) {
    try {
      await reAuth();
      response = await fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${getAccessToken()}`, ...options.headers }
      });
    } catch {
      throw new Error('SESSION_EXPIRED');
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
throw new Error(body?.error?.message || `Sheets API error ${response.status}`);
  }
  return response.json();
}

// ─── NORMALIZE RAW SHEET VALUES ───────────────────────────────────────────────
function normalizeValues(rows) {
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim());
  const records = rows.slice(1).map((row, rowIdx) => {
    const obj = { _rowIndex: rowIdx }; // 0-based index into data rows (sheet row = rowIdx + 2)
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
  return { headers, rows: records };
}

// ─── FETCH CLIENT TRACKING ────────────────────────────────────────────────────
async function fetchSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(RANGE)}`;
  const data = await apiFetch(url);
  return normalizeValues(data.values || []);
}

// ─── FETCH MENTOR STATUS ──────────────────────────────────────────────────────
async function fetchMentorData() {
  // Fetch column visibility metadata and values in parallel
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}`
    + `?includeGridData=true&ranges=${encodeURIComponent(MENTOR_SHEET_NAME + '!A1:BE1')}`
    + `&fields=sheets(properties.title,data.columnMetadata)`;

  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${encodeURIComponent(MENTOR_RANGE)}`;

  const [meta, data] = await Promise.all([apiFetch(metaUrl), apiFetch(valuesUrl)]);

  // Build set of hidden column indices
  const sheet = (meta.sheets || []).find(s => s.properties.title === MENTOR_SHEET_NAME);
  const colMeta = sheet?.data?.[0]?.columnMetadata || [];
  const hiddenCols = new Set(
    colMeta.map((col, i) => col.hiddenByUser ? i : -1).filter(i => i >= 0)
  );

  return { ...normalizeValues(data.values || []), hiddenCols };
}

// ─── FETCH SINGLE MENTOR ROW ──────────────────────────────────────────────────
async function fetchMentorRow(dataRowIndex) {
  const sheetRow = dataRowIndex + 2;
  const range = `${MENTOR_SHEET_NAME}!A${sheetRow}:Z${sheetRow}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const data = await apiFetch(url);
  return (data.values || [[]])[0] || [];
}

// ─── WRITE SINGLE MENTOR CELL ─────────────────────────────────────────────────
// rowIndex: 0-based data row index (sheet row = rowIndex + 2)
// colIndex: 0-based column index
// value: true/false (boolean)
async function updateMentorCell(rowIndex, colIndex, value) {
  const sheetRow = rowIndex + 2; // +1 for header row, +1 for 1-based indexing
  const colLetter = colIndexToLetter(colIndex);
  const cellRange = encodeURIComponent(`${MENTOR_SHEET_NAME}!${colLetter}${sheetRow}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${cellRange}?valueInputOption=RAW`;

  await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[value]] })
  });
}

// ─── FETCH MENTOR ASSIGNMENTS ─────────────────────────────────────────────────
async function fetchMentorAssignmentsData() {
  const range = 'Mentor Assignments!A1:Z';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const data = await apiFetch(url);
  return normalizeValues(data.values || []);
}

// ─── WRITE MENTOR ASSIGNMENTS CELL ───────────────────────────────────────────
async function updateMentorAssignmentsCell(rowIndex, colLetter, value) {
  const sheetRow = rowIndex + 2;
  const range = encodeURIComponent(`Mentor Assignments!${colLetter}${sheetRow}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`;
  await apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[value]] })
  });
}

// ─── CLEAR MENTOR 1-5 COLUMNS IN CLIENT TRACKING ─────────────────────────────
async function clearClientMentorColumns(clientRowIndex, headers) {
  const sheetRow = clientRowIndex + 2;
  const mentorColNames = ['Mentor 1', 'Mentor 2', 'Mentor 3', 'Mentor 4', 'Mentor 5'];
  const ranges = mentorColNames
    .map(name => {
      const idx = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase());
      return idx >= 0 ? `${SHEET_NAME}!${colIndexToLetter(idx)}${sheetRow}` : null;
    })
    .filter(Boolean);

  if (!ranges.length) return;
  await apiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchClear`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranges })
    }
  );
}

// ─── FETCH MENTOR STATUS ROWS (for card join) ─────────────────────────────────
async function fetchMentorStatusRows() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/${encodeURIComponent(MENTOR_RANGE)}`;
  const data = await apiFetch(url);
  return normalizeValues(data.values || []);
}

// ─── APPS SCRIPT ──────────────────────────────────────────────────────────────
const APPS_SCRIPT_ID = 'AKfycbzFW55wo6_mlmrOoAycBR6A474NPDgBb_TfFFVz-eIqchbI1NR3yEg0URPcXJKKofE';

async function runGetMentorScript(clientSheetRow) {
  const url = `https://script.googleapis.com/v1/scripts/${APPS_SCRIPT_ID}:run`;
  return await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      function: 'getMentorForClient',
      parameters: [clientSheetRow],
      devMode: false
    })
  });
}

// ─── COLUMN INDEX TO A1 LETTER ────────────────────────────────────────────────
function colIndexToLetter(idx) {
  let letter = '';
  let n = idx + 1; // 1-based
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
