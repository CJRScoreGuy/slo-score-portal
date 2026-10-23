// ─── ADMINISTRATION TAB ───────────────────────────────────────────────────────

let allAdminMentors = [];
let allAdminClients = [];
let adminStatusHeaders = [];
let adminAssignmentsHeaders = [];
let adminListenersWired = false;

// ─── BUILD MENTOR LIST (shared by initial load and re-fetch after save) ───────
function buildAdminMentorList(engage, statusResp, assignmentsResp) {
  adminStatusHeaders      = statusResp.headers;
  adminAssignmentsHeaders = assignmentsResp.headers;

  const statusByEmail = {};
  statusResp.rows.forEach(row => {
    const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
    if (email) statusByEmail[email] = row;
  });

  const assignmentsByEmail = {};
  assignmentsResp.rows.forEach(row => {
    const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
    if (email) assignmentsByEmail[email] = row;
  });

  return engage.rows
    .map(row => {
      const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
      const sRow  = statusByEmail[email]      || {};
      const aRow  = assignmentsByEmail[email] || {};
      const m = buildMentorObj(row, sRow, aRow);
      m.mentorAssigned      = col(aRow, ['mentor assigned']) || '';
      m.assignments         = col(aRow, ['assignments'])     || '';
      m.statusRowIndex      = sRow._rowIndex;
      m.assignmentsRowIndex = aRow._rowIndex;
      m.adminSearchText     = [m.name, m.email, m.phone].join(' ').toLowerCase();
      return m;
    })
    .filter(m => m.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── INITIAL LOAD ─────────────────────────────────────────────────────────────
async function loadAdminTab() {
  const loading = document.getElementById('admin-loading');
  const error   = document.getElementById('admin-error');
  const content = document.getElementById('admin-content');

  loading.classList.remove('hidden');
  error.classList.add('hidden');
  content.classList.add('hidden');

  document.getElementById('admin-mentor-list').innerHTML = '';
  document.getElementById('admin-client-grid').innerHTML = '';

  if (!adminListenersWired) {
    const mentorSearch = document.getElementById('admin-mentor-search');
    const clientSearch = document.getElementById('admin-client-search');
    mentorSearch.addEventListener('input', () => searchAdminMentors(mentorSearch.value));
    clientSearch.addEventListener('input', () => searchAdminClients(clientSearch.value));
    adminListenersWired = true;
  }

  try {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/`;
    const [engageResp, statusResp, assignmentsResp, clientResp] = await Promise.all([
      apiFetch(base + encodeURIComponent('Engage!A1:Z')),
      fetchMentorStatusRows(),
      fetchMentorAssignmentsData(),
      fetchSheetData()
    ]);

    allAdminMentors = buildAdminMentorList(normalizeValues(engageResp.values || []), statusResp, assignmentsResp);
    allAdminClients = clientResp.rows;

    renderAdminMentors(allAdminMentors);
    renderAdminClients(allAdminClients);

    content.classList.remove('hidden');
    administrationLoaded = true;
  } catch (err) {
    error.textContent = err.message === 'SESSION_EXPIRED'
      ? 'Your session expired. Please use the Sign Out button to sign in again.'
      : `Failed to load administration data: ${err.message}`;
    error.classList.remove('hidden');
    console.error(err);
  } finally {
    loading.classList.add('hidden');
  }
}

// ─── RE-FETCH MENTORS AFTER SAVE ──────────────────────────────────────────────
async function reloadAdminMentors() {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/`;
  const [engageResp, statusResp, assignmentsResp] = await Promise.all([
    apiFetch(base + encodeURIComponent('Engage!A1:Z')),
    fetchMentorStatusRows(),
    fetchMentorAssignmentsData()
  ]);
  allAdminMentors = buildAdminMentorList(normalizeValues(engageResp.values || []), statusResp, assignmentsResp);

  const q = (document.getElementById('admin-mentor-search').value || '').trim().toLowerCase();
  const filtered = q ? allAdminMentors.filter(m => m.adminSearchText.includes(q)) : allAdminMentors;
  renderAdminMentors(filtered);
}

// ─── RENDER MENTORS ───────────────────────────────────────────────────────────
function renderAdminMentors(mentors) {
  const list  = document.getElementById('admin-mentor-list');
  const count = document.getElementById('admin-mentor-count');
  list.innerHTML = '';
  count.textContent = `${mentors.length} mentor${mentors.length !== 1 ? 's' : ''}`;

  if (mentors.length === 0) {
    list.innerHTML = '<p class="mi-no-results">No mentors match your search.</p>';
    return;
  }

  const singleResult = mentors.length === 1;

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Name', 'Email', 'Phone', 'Status', 'Activity', 'Mentor Assigned', 'Assignments', 'Mentor Reset']
    .forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  mentors.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';

    // Name cell — EDIT button only when exactly one result
    const nameTd = document.createElement('td');
    nameTd.className = 'admin-name-cell';
    if (singleResult) {
      const editBtn = document.createElement('button');
      editBtn.className = 'admin-edit-btn';
      editBtn.textContent = 'EDIT';
      editBtn.addEventListener('click', () => startAdminMentorEdit(tr, m, editBtn));
      nameTd.appendChild(editBtn);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = m.name;
    nameTd.appendChild(nameSpan);
    tr.appendChild(nameTd);

    // Read-only cells
    [m.email, m.phone].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val || '';
      tr.appendChild(td);
    });

    // Editable-target cells (tagged by data-edit-key for later manipulation)
    [
      { key: 'status',         val: m.mentorStatus },
      { key: 'activity',       val: m.clientEngagement },
      { key: 'mentorAssigned', val: m.mentorAssigned === '1' ? 'True' : 'False' },
      { key: 'assignments',    val: m.assignments || '' },
      { key: 'mentorReset',    val: m.clientCycle }
    ].forEach(({ key, val }) => {
      const td = document.createElement('td');
      td.dataset.editKey = key;
      td.textContent = val || '';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

// ─── INLINE EDIT ──────────────────────────────────────────────────────────────
function startAdminMentorEdit(tr, m, editBtn) {
  editBtn.classList.add('hidden');

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'admin-confirm-btn';
  confirmBtn.textContent = '✓';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'admin-cancel-btn';
  cancelBtn.textContent = '✗';

  editBtn.parentNode.appendChild(confirmBtn);
  editBtn.parentNode.appendChild(cancelBtn);

  // Replace each editable cell with the appropriate control
  const maVal = m.mentorAssigned === '1' ? 'True' : 'False';
  const controls = {
    status:         makeAdminSelect(['Active with profile', 'Resigned', 'Inactive'], m.mentorStatus),
    activity:       makeAdminSelect(['Any', 'Co-mentor', 'SME'], m.clientEngagement),
    mentorAssigned: makeAdminSelect(['True', 'False'], maVal),
    assignments:    (() => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.value = m.assignments || '0';
      inp.className = 'admin-edit-input';
      return inp;
    })(),
    mentorReset: makeAdminSelect(['Weekly', 'Biweekly', 'Month'], m.clientCycle)
  };

  tr.querySelectorAll('[data-edit-key]').forEach(td => {
    const ctrl = controls[td.dataset.editKey];
    if (ctrl) { td.innerHTML = ''; td.appendChild(ctrl); }
  });

  cancelBtn.addEventListener('click', () => {
    searchAdminMentors(document.getElementById('admin-mentor-search').value);
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await saveAdminMentorEdits(m, {
        status:         controls.status.value,
        activity:       controls.activity.value,
        mentorAssigned: controls.mentorAssigned.value === 'True' ? 1 : 0,
        assignments:    parseInt(controls.assignments.value, 10) || 0,
        mentorReset:    controls.mentorReset.value
      });
      await reloadAdminMentors();
    } catch (err) {
      console.error('[AdminEdit] Save failed:', err);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      const nameTd = tr.querySelector('.admin-name-cell');
      let errSpan = nameTd.querySelector('.admin-edit-error');
      if (!errSpan) {
        errSpan = document.createElement('span');
        errSpan.className = 'admin-edit-error';
        nameTd.appendChild(errSpan);
      }
      errSpan.textContent = `Save failed: ${err.message}`;
    }
  });
}

function makeAdminSelect(options, current) {
  const sel = document.createElement('select');
  sel.className = 'admin-edit-select';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === current) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

// ─── SAVE TO SHEETS ───────────────────────────────────────────────────────────
async function saveAdminMentorEdits(m, values) {
  // Find column indices using key-list matching (same approach as col())
  const findInStatus = keys => adminStatusHeaders.findIndex(h =>
    keys.some(k => k.toLowerCase() === h.toLowerCase().trim())
  );
  const findInAssign = keys => adminAssignmentsHeaders.findIndex(h =>
    keys.some(k => k.toLowerCase() === h.toLowerCase().trim())
  );

  const statusColIdx   = findInStatus(STATUS_KEYS);
  const activityColIdx = findInStatus(ACTIVITY_KEYS);
  const maColIdx       = findInAssign(['mentor assigned']);
  const assignColIdx   = findInAssign(['assignments']);
  const resetColIdx    = findInAssign(MENTOR_RESET_KEYS);

  const saves = [];

  if (m.statusRowIndex !== undefined) {
    if (statusColIdx >= 0)
      saves.push(updateMentorCell(m.statusRowIndex, statusColIdx, values.status));
    if (activityColIdx >= 0)
      saves.push(updateMentorCell(m.statusRowIndex, activityColIdx, values.activity));
  }
  if (m.assignmentsRowIndex !== undefined) {
    if (maColIdx >= 0)
      saves.push(updateMentorAssignmentsCell(m.assignmentsRowIndex, colIndexToLetter(maColIdx), values.mentorAssigned));
    if (assignColIdx >= 0)
      saves.push(updateMentorAssignmentsCell(m.assignmentsRowIndex, colIndexToLetter(assignColIdx), values.assignments));
    if (resetColIdx >= 0)
      saves.push(updateMentorAssignmentsCell(m.assignmentsRowIndex, colIndexToLetter(resetColIdx), values.mentorReset));
  }

  await Promise.all(saves);
}

// ─── RENDER CLIENTS ───────────────────────────────────────────────────────────
function renderAdminClients(clients) {
  const grid  = document.getElementById('admin-client-grid');
  const count = document.getElementById('admin-client-count');
  grid.innerHTML = '';
  count.textContent = `${clients.length} client${clients.length !== 1 ? 's' : ''}`;

  if (clients.length === 0) {
    grid.innerHTML = '<p class="mi-no-results">No clients match your search.</p>';
    return;
  }

  clients.forEach(row => {
    const name  = col(row, NAME_KEYS)  || '';
    const email = col(row, EMAIL_KEYS) || '';
    const phone = col(row, PHONE_KEYS) || '';

    const card = document.createElement('div');
    card.className = 'mi-card';

    const nameRow = document.createElement('div');
    nameRow.className = 'mi-name-row';
    const nameEl = document.createElement('span');
    nameEl.className = 'mi-name';
    nameEl.textContent = name;
    nameRow.appendChild(nameEl);
    card.appendChild(nameRow);

    const contact = document.createElement('div');
    contact.className = 'mi-contact';
    if (email) contact.appendChild(contactRow('✉', email, 'mailto:' + email));
    if (phone) contact.appendChild(contactRow('📞', phone, 'tel:' + phone.replace(/\D/g, '')));
    card.appendChild(contact);

    grid.appendChild(card);
  });
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function searchAdminMentors(query) {
  const q = query.trim().toLowerCase();
  if (!q) { renderAdminMentors(allAdminMentors); return; }
  renderAdminMentors(allAdminMentors.filter(m => m.adminSearchText.includes(q)));
}

function searchAdminClients(query) {
  const q = query.trim().toLowerCase();
  if (!q) { renderAdminClients(allAdminClients); return; }
  renderAdminClients(allAdminClients.filter(row => {
    const text = [col(row, NAME_KEYS), col(row, EMAIL_KEYS), col(row, PHONE_KEYS)].join(' ').toLowerCase();
    return text.includes(q);
  }));
}
