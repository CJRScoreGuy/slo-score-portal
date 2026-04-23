// ─── CIC GROUP STATE ─────────────────────────────────────────────────────────
let isCICMember = false;
let signedInEmail = '';

// ─── APP ENTRY POINT ─────────────────────────────────────────────────────────
function initApp() {
  initAuth(onSignedIn);

  document.getElementById('signin-btn').addEventListener('click', signIn);
  document.getElementById('signout-btn').addEventListener('click', signOut);
  document.getElementById('refresh-btn').addEventListener('click', refreshCurrentTab);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ─── AFTER SUCCESSFUL SIGN-IN ────────────────────────────────────────────────
async function onSignedIn(userInfo) {
  signedInEmail = userInfo.email || '';
  document.getElementById('user-email').textContent = signedInEmail;

  try {
    isCICMember = await checkCICMembership(signedInEmail);
  } catch (err) {
    console.warn('[CIC] Membership check failed, defaulting to non-CIC:', err);
    isCICMember = false;
  }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  switchTab('clients');
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
let currentTab = 'clients';
let mentorLoaded = false;
let mentorInfoLoaded = false;

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
  }
}

// ─── CLIENT TRACKING DATA ────────────────────────────────────────────────────
async function loadClientData() {
  showClientLoading(true);
  clearClientError();

  try {
    const { headers, rows } = await fetchSheetData();
    renderTable(headers, rows);
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
    const { headers, rows, hiddenCols } = await fetchMentorData();
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
