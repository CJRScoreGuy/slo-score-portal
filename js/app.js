// ─── CIC GROUP STATE ─────────────────────────────────────────────────────────
let isCICMember = false;
let signedInEmail = '';

// ─── ADD CLIENT STATE ─────────────────────────────────────────────────────────
let clientHeaders = [];
const REQUIRED_CLIENT_FIELDS = ['email', 'name', 'phone', 'preferred contact', 'date submitted'];

// ─── APP ENTRY POINT ─────────────────────────────────────────────────────────
function initApp() {
  initAuth(onSignedIn);

  document.getElementById('signin-btn').addEventListener('click', signIn);
  document.getElementById('signout-btn').addEventListener('click', signOut);
  document.getElementById('refresh-btn').addEventListener('click', refreshCurrentTab);
  document.getElementById('add-client-btn').addEventListener('click', startAddClient);
  document.getElementById('commit-client-btn').addEventListener('click', commitClient);
  document.getElementById('cancel-client-btn').addEventListener('click', cancelClient);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ─── AFTER SUCCESSFUL SIGN-IN ────────────────────────────────────────────────
async function onSignedIn(userInfo) {
  signedInEmail = userInfo.email || '';
  document.getElementById('user-email').textContent = signedInEmail;

  // Reset tab-load flags so CIC status is re-evaluated on every sign-in
  mentorLoaded = false;
  mentorInfoLoaded = false;
  clientMeetingsLoaded = false;

  // Show app and load client data immediately — don't block on CIC check
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  switchTab('clients');

  // CIC check runs in background; update dependent UI when done
  try {
    isCICMember = await checkCICMembership(signedInEmail);
  } catch (err) {
    console.warn('[CIC] Membership check failed, defaulting to non-CIC:', err);
    isCICMember = false;
  }

  // Update Add Client button with the now-known CIC status
  document.getElementById('add-client-controls')?.classList.toggle('hidden', !isCICMember);

  // If Mentor Calendar loaded before CIC check completed, force a fresh render
  if (mentorLoaded) {
    mentorLoaded = false;
    if (currentTab === 'mentor-calendar') loadMentorData();
  }
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
let currentTab = 'clients';
let mentorLoaded = false;
let mentorInfoLoaded = false;
let clientMeetingsLoaded = false;

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.tab !== tab);
  });

  if (tab === 'clients') {
    loadClientData();
  } else if (tab === 'mentor-calendar') {
    if (!mentorLoaded) loadMentorData();
  } else if (tab === 'mentor-info') {
    if (!mentorInfoLoaded) loadMentorInfoTab();
  } else if (tab === 'client-meetings') {
    if (!clientMeetingsLoaded) loadClientMeetingsTab();
  }
}

function refreshCurrentTab() {
  if (currentTab === 'clients') {
    loadClientData();
  } else if (currentTab === 'mentor-calendar') {
    mentorLoaded = false;
    loadMentorData();
  } else if (currentTab === 'mentor-info') {
    mentorInfoLoaded = false;
    loadMentorInfoTab();
  } else if (currentTab === 'client-meetings') {
    clientMeetingsLoaded = false;
    loadClientMeetingsTab();
  }
}

// ─── CLIENT TRACKING DATA ────────────────────────────────────────────────────
async function loadClientData() {
  showClientLoading(true);
  clearClientError();

  try {
    const { headers, rows } = await fetchSheetData();
    clientHeaders = headers;
    renderTable(headers, rows);
    // Show Add Client controls for CIC members and reset to initial button state
    document.getElementById('add-client-controls')?.classList.toggle('hidden', !isCICMember);
    document.getElementById('add-client-btn').classList.remove('hidden');
    document.getElementById('commit-client-btn').classList.add('hidden');
    document.getElementById('cancel-client-btn').classList.add('hidden');
    document.getElementById('refresh-btn').disabled = false;
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      showClientError('Your session expired. Please use the Sign Out button to sign in again.');
    } else {
      showClientError(`Failed to load data: ${err.message}`);
      console.error(err);
    }
  } finally {
    showClientLoading(false);
  }
}

function showClientLoading(loading) {
  document.getElementById('loading').classList.toggle('hidden', !loading);
  document.getElementById('table-wrap').classList.toggle('hidden', loading);
}

function clearClientError() {
  document.getElementById('data-error').classList.add('hidden');
}

function showClientError(msg) {
  const el = document.getElementById('data-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── ADD CLIENT HANDLERS ──────────────────────────────────────────────────────
async function startAddClient() {
  const addBtn = document.getElementById('add-client-btn');
  addBtn.disabled = true;

  try {
    await insertBlankClientRow();
  } catch (err) {
    showClientError(`Failed to add row: ${err.message}`);
    addBtn.disabled = false;
    return;
  }

  // Inserting row 2 shifts all existing rows down — update in-memory indices
  allRows.forEach(row => { row._rowIndex++; });

  // Switch to Commit/Cancel mode and disable Refresh to avoid stale-index issues
  addBtn.classList.add('hidden');
  addBtn.disabled = false;
  document.getElementById('commit-client-btn').classList.remove('hidden');
  document.getElementById('cancel-client-btn').classList.remove('hidden');
  document.getElementById('refresh-btn').disabled = true;

  // Prepend editable row at top of table
  const tbody = document.querySelector('#data-table tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.id = 'new-client-row';
  tr.className = 'new-client-row';
  clientHeaders.forEach((header, i) => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    const norm = header.toLowerCase().trim();
    input.type = norm.includes('date') ? 'date' : 'text';
    input.placeholder = header;
    input.className = 'new-client-input';
    input.dataset.colIndex = i;
    if (REQUIRED_CLIENT_FIELDS.includes(norm)) input.dataset.required = 'true';
    td.appendChild(input);
    tr.appendChild(td);
  });
  tbody.prepend(tr);
  const firstInput = tr.querySelector('input');
  if (firstInput) firstInput.focus();
}

async function commitClient() {
  const tr = document.getElementById('new-client-row');
  if (!tr) return;

  // Clear previous error state
  tr.querySelectorAll('.new-client-input').forEach(inp => inp.classList.remove('input-error'));
  clearClientError();

  // Validate required fields
  const missing = [...tr.querySelectorAll('input[data-required="true"]')]
    .filter(inp => !inp.value.trim());
  if (missing.length) {
    missing.forEach(inp => inp.classList.add('input-error'));
    showClientError(`Required: ${missing.map(inp => inp.placeholder).join(', ')}`);
    return;
  }

  const values = [...tr.querySelectorAll('input')].map(inp => inp.value.trim());

  const commitBtn = document.getElementById('commit-client-btn');
  const cancelBtn = document.getElementById('cancel-client-btn');
  commitBtn.disabled = true;
  cancelBtn.disabled = true;

  try {
    await writeClientRow(values);
  } catch (err) {
    showClientError(`Failed to save: ${err.message}`);
    commitBtn.disabled = false;
    cancelBtn.disabled = false;
    return;
  }

  loadClientData();
}

async function cancelClient() {
  document.getElementById('commit-client-btn').disabled = true;
  document.getElementById('cancel-client-btn').disabled = true;

  try {
    await deleteClientRow();
  } catch (err) {
    console.error('[AddClient] Failed to delete row on cancel:', err);
  }

  loadClientData();
}

// ─── MENTOR INFORMATION DATA ───────────────────────────────────────────────────
async function loadMentorInfoTab() {
  const loading = document.getElementById('mentor-info-loading');
  const error   = document.getElementById('mentor-info-error');
  const grid    = document.getElementById('mentor-info-grid');

  loading.classList.remove('hidden');
  error.classList.add('hidden');
  grid.innerHTML = '';

  // Wire up search input (once)
  const searchInput = document.getElementById('mentor-info-search');
  searchInput.addEventListener('input', () => searchMentorInfo(searchInput.value));

  try {
    await loadMentorInfoData();
    mentorInfoLoaded = true;
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      error.textContent = 'Your session expired. Please use the Sign Out button to sign in again.';
    } else {
      error.textContent = `Failed to load mentor information: ${err.message}`;
      console.error(err);
    }
    error.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

// ─── MENTOR CALENDAR DATA ─────────────────────────────────────────────────────
async function loadMentorData() {
  document.getElementById('mentor-loading').classList.remove('hidden');
  document.getElementById('mentor-table-wrap').classList.add('hidden');
  document.getElementById('mentor-error').classList.add('hidden');

  try {
    const [{ headers, rows, hiddenCols }, assignmentsResp] = await Promise.all([
      fetchMentorData(),
      fetchMentorAssignmentsData()
    ]);

    // Build email → assignments row lookup
    const assignedByEmail = {};
    assignmentsResp.rows.forEach(row => {
      const email = col(row, EMAIL_KEYS);
      if (email) assignedByEmail[email.toLowerCase().trim()] = row;
    });

    // Override Availability display for rows where Availability = "Available"
    const emailHeader = headers.find(h => h.toLowerCase().trim() === 'email');
    const availHeader = headers.find(h => h.toLowerCase().trim() === 'availability');
    if (emailHeader && availHeader) {
      rows.forEach(row => {
        if ((row[availHeader] || '').trim() !== 'Available') return;

        const email = (row[emailHeader] || '').toLowerCase().trim();
        const aRow = assignedByEmail[email] || {};
        const mentorAssigned = String(col(aRow, ['mentor assigned']) || '').trim() === '1';
        const status   = (col(row, STATUS_KEYS)   || '').trim();
        const activity = (col(row, ACTIVITY_KEYS) || '').trim();

        if (status === 'Active with profile' && activity === 'Any') {
          if (mentorAssigned) row[availHeader] = 'Assigned';
          // else leave as "Available"
        } else if (status === 'Active with profile' && activity !== 'Any') {
          row[availHeader] = activity || 'WIP';
        } else if (status === 'Provisional' && activity === 'Any') {
          row[availHeader] = status; // "Provisional"
        } else {
          row[availHeader] = 'WIP';
        }
      });
    }

    renderMentorTable(headers, rows, hiddenCols);
    mentorLoaded = true;
  } catch (err) {
    document.getElementById('mentor-loading').classList.add('hidden');
    if (err.message === 'SESSION_EXPIRED') {
      showMentorError('Your session expired. Please use the Sign Out button to sign in again.');
    } else {
      showMentorError(`Failed to load mentor data: ${err.message}`);
      console.error(err);
    }
  }
}
