// ─── ADMINISTRATION TAB ───────────────────────────────────────────────────────

let allAdminMentors = [];
let allAdminClients = [];
let adminStatusHeaders = [];
let adminAssignmentsHeaders = [];
let adminClientHeaders = [];
let adminActiveMentorNames = [];
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
  document.getElementById('admin-client-list').innerHTML = '';

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

    // Active mentors available for client assignment (Status = "Active with profile", Activity = "Any")
    adminActiveMentorNames = statusResp.rows
      .filter(row =>
        (col(row, STATUS_KEYS)   || '').trim() === 'Active with profile' &&
        (col(row, ACTIVITY_KEYS) || '').trim() === 'Any'
      )
      .map(row => (col(row, NAME_KEYS) || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    adminClientHeaders = clientResp.headers;
    allAdminClients = clientResp.rows
      .filter(row => col(row, NAME_KEYS))
      .sort((a, b) => col(a, NAME_KEYS).localeCompare(col(b, NAME_KEYS)));

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

// ─── RE-FETCH CLIENTS AFTER SAVE ──────────────────────────────────────────────
async function reloadAdminClients() {
  const clientResp = await fetchSheetData();
  adminClientHeaders = clientResp.headers;
  allAdminClients = clientResp.rows
    .filter(row => col(row, NAME_KEYS))
    .sort((a, b) => col(a, NAME_KEYS).localeCompare(col(b, NAME_KEYS)));

  const q = (document.getElementById('admin-client-search').value || '').trim().toLowerCase();
  const filtered = q ? allAdminClients.filter(row => {
    const text = [col(row, NAME_KEYS), col(row, EMAIL_KEYS), col(row, PHONE_KEYS)].join(' ').toLowerCase();
    return text.includes(q);
  }) : allAdminClients;
  renderAdminClients(filtered);
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

    [m.email, m.phone].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val || '';
      tr.appendChild(td);
    });

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

// ─── RENDER CLIENTS ───────────────────────────────────────────────────────────
function renderAdminClients(clients) {
  const list  = document.getElementById('admin-client-list');
  const count = document.getElementById('admin-client-count');
  list.innerHTML = '';
  count.textContent = `${clients.length} client${clients.length !== 1 ? 's' : ''}`;

  if (clients.length === 0) {
    list.innerHTML = '<p class="mi-no-results">No clients match your search.</p>';
    return;
  }

  const singleResult = clients.length === 1;
  const mentor1H    = adminClientHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
  const respondedH  = adminClientHeaders.find(h => { const n = h.toLowerCase().trim(); return n === 'responded' || n === 'date responded'; });
  const needMentorH = adminClientHeaders.find(h => h.toLowerCase().trim() === 'need mentor');
  const responseH   = adminClientHeaders.find(h => h.toLowerCase().trim() === 'response');

  const table = document.createElement('table');
  table.className = 'admin-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Name', 'Email', 'Phone', 'Lead Mentor', 'Date Responded', 'Need Mentor', 'Response']
    .forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  clients.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';

    // Name cell with optional EDIT / Reset Mentor buttons
    const nameTd = document.createElement('td');
    nameTd.className = 'admin-name-cell';
    if (singleResult) {
      const editBtn = document.createElement('button');
      editBtn.className = 'admin-edit-btn';
      editBtn.textContent = 'EDIT';
      editBtn.addEventListener('click', () => startAdminClientEdit(tr, row, editBtn));
      nameTd.appendChild(editBtn);

      const resetBtn = document.createElement('button');
      resetBtn.className = 'admin-reset-btn';
      resetBtn.textContent = 'Reset Mentor';
      resetBtn.addEventListener('click', () => startAdminClientReset(nameTd, row, resetBtn, editBtn));
      nameTd.appendChild(resetBtn);

      const getMentorBtn = document.createElement('button');
      getMentorBtn.className = 'get-mentor-btn';
      getMentorBtn.textContent = 'Get Mentor';
      getMentorBtn.addEventListener('click', () => onAdminGetMentor(row, getMentorBtn, nameTd));
      nameTd.appendChild(getMentorBtn);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = col(row, NAME_KEYS) || '';
    nameTd.appendChild(nameSpan);
    tr.appendChild(nameTd);

    // Read-only: email, phone
    [col(row, EMAIL_KEYS), col(row, PHONE_KEYS)].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val || '';
      tr.appendChild(td);
    });

    // Editable cells
    const mentor1Val    = mentor1H    ? (row[mentor1H]                || '') : '';
    const respondedVal  = respondedH  ? (row[respondedH] || '') : '';
    const needMentorVal = needMentorH ? (row[needMentorH] || '')                : '';
    const responseVal   = responseH   ? (row[responseH]   || '')                : '';

    [
      { key: 'mentor1',    val: mentor1Val },
      { key: 'responded',  val: respondedVal },
      { key: 'needMentor', val: needMentorVal },
      { key: 'response',   val: responseVal }
    ].forEach(({ key, val }) => {
      const td = document.createElement('td');
      td.dataset.editKey = key;
      td.textContent = val;
      if (key === 'response') td.className = 'admin-response-cell';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

// ─── MENTOR INLINE EDIT ───────────────────────────────────────────────────────
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

  const maVal = m.mentorAssigned === '1' ? 'True' : 'False';
  const controls = {
    status:         makeAdminSelect(['Active with profile', 'Resigned', 'Inactive', 'Paused'], m.mentorStatus),
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
      console.error('[AdminEdit] Mentor save failed:', err);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      showAdminEditError(tr.querySelector('.admin-name-cell'), err.message);
    }
  });
}

// ─── CLIENT INLINE EDIT ───────────────────────────────────────────────────────
function startAdminClientEdit(tr, row, editBtn) {
  editBtn.classList.add('hidden');

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'admin-confirm-btn';
  confirmBtn.textContent = '✓';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'admin-cancel-btn';
  cancelBtn.textContent = '✗';

  editBtn.parentNode.appendChild(confirmBtn);
  editBtn.parentNode.appendChild(cancelBtn);

  const mentor1H    = adminClientHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
  const respondedH  = adminClientHeaders.find(h => { const n = h.toLowerCase().trim(); return n === 'responded' || n === 'date responded'; });
  const needMentorH = adminClientHeaders.find(h => h.toLowerCase().trim() === 'need mentor');
  const responseH   = adminClientHeaders.find(h => h.toLowerCase().trim() === 'response');

  const mentor1Sel = makeAdminSelect(adminActiveMentorNames, mentor1H ? (row[mentor1H] || '') : '');

  const respondedInp = document.createElement('input');
  respondedInp.type = 'text';
  respondedInp.value = respondedH ? (row[respondedH] || '') : '';
  respondedInp.className = 'admin-edit-input';
  respondedInp.placeholder = 'e.g. October 24, 2026';

  const needMentorSel = makeAdminSelect(['YES', 'NO', 'Direct'], needMentorH ? (row[needMentorH] || '') : '');

  const responseArea = document.createElement('textarea');
  responseArea.value = responseH ? (row[responseH] || '') : '';
  responseArea.className = 'admin-edit-textarea';
  responseArea.rows = 3;

  const controls = { mentor1: mentor1Sel, responded: respondedInp, needMentor: needMentorSel, response: responseArea };

  tr.querySelectorAll('[data-edit-key]').forEach(td => {
    const ctrl = controls[td.dataset.editKey];
    if (ctrl) { td.innerHTML = ''; td.appendChild(ctrl); }
  });

  cancelBtn.addEventListener('click', () => {
    searchAdminClients(document.getElementById('admin-client-search').value);
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await saveAdminClientEdits(row, {
        mentor1:    mentor1Sel.value,
        responded:  respondedInp.value.trim(),
        needMentor: needMentorSel.value,
        response:   responseArea.value
      });
      await reloadAdminClients();
    } catch (err) {
      console.error('[AdminEdit] Client save failed:', err);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      showAdminEditError(tr.querySelector('.admin-name-cell'), err.message);
    }
  });
}

// ─── CLIENT RESET MENTOR ──────────────────────────────────────────────────────
function startAdminClientReset(nameTd, row, resetBtn, editBtn) {
  resetBtn.classList.add('hidden');
  editBtn.classList.add('hidden');

  const continueBtn = document.createElement('button');
  continueBtn.className = 'admin-confirm-btn';
  continueBtn.textContent = 'Continue?';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'admin-cancel-btn';
  cancelBtn.textContent = 'Cancel?';

  nameTd.appendChild(continueBtn);
  nameTd.appendChild(cancelBtn);

  cancelBtn.addEventListener('click', () => {
    searchAdminClients(document.getElementById('admin-client-search').value);
  });

  continueBtn.addEventListener('click', async () => {
    continueBtn.disabled = true;
    cancelBtn.disabled = true;
    continueBtn.textContent = 'Resetting…';

    try {
      const mentor1H    = adminClientHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
      const needMentorH = adminClientHeaders.find(h => h.toLowerCase().trim() === 'need mentor');
      const mentor1Name = mentor1H ? (row[mentor1H] || '').trim() : '';

      // Decrement mentor's assignment count and clear Mentor Assigned flag
      if (mentor1Name) {
        const assignData = await fetchMentorAssignmentsData();
        const aHeaders   = assignData.headers;
        const mentorRow  = assignData.rows.find(r => (col(r, NAME_KEYS) || '').trim().toLowerCase() === mentor1Name.toLowerCase());
        if (mentorRow) {
          const maIdx     = aHeaders.findIndex(h => h.toLowerCase().trim() === 'mentor assigned');
          const assignIdx = aHeaders.findIndex(h => h.toLowerCase().trim() === 'assignments');
          const saves = [];
          if (maIdx >= 0)
            saves.push(updateMentorAssignmentsCell(mentorRow._rowIndex, colIndexToLetter(maIdx), 0));
          if (assignIdx >= 0) {
            const current = parseInt(mentorRow[aHeaders[assignIdx]] || '0', 10);
            saves.push(updateMentorAssignmentsCell(mentorRow._rowIndex, colIndexToLetter(assignIdx), Math.max(0, current - 1)));
          }
          await Promise.all(saves);
        }
      }

      // Clear Mentor 1–5 from client row, then set Need Mentor = YES
      await clearClientMentorColumns(row._rowIndex, adminClientHeaders);
      if (needMentorH) {
        const needMentorIdx = adminClientHeaders.indexOf(needMentorH);
        if (needMentorIdx >= 0)
          await updateClientCell(row._rowIndex, colIndexToLetter(needMentorIdx), 'YES');
      }

      await reloadAdminClients();
    } catch (err) {
      console.error('[AdminReset] Client reset failed:', err);
      continueBtn.disabled = false;
      cancelBtn.disabled = false;
      continueBtn.textContent = 'Continue?';
      showAdminEditError(nameTd, err.message);
    }
  });
}

// ─── ADMIN GET MENTOR ─────────────────────────────────────────────────────────
async function onAdminGetMentor(row, btn, nameTd) {
  btn.disabled = true;
  btn.textContent = 'Getting a mentor';
  btn.classList.add('flashing');

  const mentor1H      = adminClientHeaders.find(h => h.toLowerCase().trim() === 'mentor 1');
  const mentor1ColIdx = mentor1H ? adminClientHeaders.indexOf(mentor1H) : -1;

  // Reserve the row to prevent concurrent updates
  try {
    if (mentor1ColIdx < 0) throw new Error('"Mentor 1" column not found in sheet headers');
    await updateClientTrackingCell(row._rowIndex, colIndexToLetter(mentor1ColIdx), 'UPDATING WIP');
  } catch (err) {
    console.error('[AdminGetMentor] Failed to write UPDATING WIP:', err);
    btn.disabled = false;
    btn.textContent = 'Get Mentor';
    btn.classList.remove('flashing');
    showAdminEditError(nameTd, `Could not reserve row for update: ${err.message}`);
    return;
  }

  try {
    const emailH      = adminClientHeaders.find(h => h.toLowerCase().trim() === 'email');
    const clientEmail = emailH ? (row[emailH] || '').trim() : '';
    if (!clientEmail) throw new Error('No email address found for this client row');
    const result = await runGetMentorScript(clientEmail);

    if (result.error) {
      const errMsg = result.error.details?.[0]?.errorMessage || result.error.message || 'Script error';
      throw new Error(errMsg);
    }

    const scriptResult = result.response?.result;
    if (typeof scriptResult === 'string' && scriptResult.toLowerCase().startsWith('error')) {
      throw new Error(scriptResult);
    }

    await reloadAdminClients();
  } catch (err) {
    console.error('[AdminGetMentor] Script failed:', err);

    if (mentor1ColIdx >= 0) {
      await updateClientTrackingCell(row._rowIndex, colIndexToLetter(mentor1ColIdx), '').catch(
        e => console.error('[AdminGetMentor] Failed to clear UPDATING WIP:', e)
      );
    }

    btn.disabled = false;
    btn.textContent = 'Get Mentor';
    btn.classList.remove('flashing');
    showAdminEditError(nameTd, `Get Mentor failed: ${err.message}`);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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

function showAdminEditError(nameTd, message) {
  let errSpan = nameTd.querySelector('.admin-edit-error');
  if (!errSpan) {
    errSpan = document.createElement('span');
    errSpan.className = 'admin-edit-error';
    nameTd.appendChild(errSpan);
  }
  errSpan.textContent = `Save failed: ${message}`;
}

// ─── SAVE MENTOR EDITS ────────────────────────────────────────────────────────
async function saveAdminMentorEdits(m, values) {
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

// ─── SAVE CLIENT EDITS ────────────────────────────────────────────────────────
async function saveAdminClientEdits(row, values) {
  const findCol = name => adminClientHeaders.findIndex(h => h.toLowerCase().trim() === name);

  const mentor1Idx    = findCol('mentor 1');
  const respondedIdx  = adminClientHeaders.findIndex(h => { const n = h.toLowerCase().trim(); return n === 'responded' || n === 'date responded'; });
  const needMentorIdx = findCol('need mentor');
  const responseIdx   = findCol('response');

  const saves = [];
  if (mentor1Idx >= 0)
    saves.push(updateClientCell(row._rowIndex, colIndexToLetter(mentor1Idx), values.mentor1));
  if (respondedIdx >= 0)
    saves.push(updateClientCell(row._rowIndex, colIndexToLetter(respondedIdx), values.responded));
  if (needMentorIdx >= 0)
    saves.push(updateClientCell(row._rowIndex, colIndexToLetter(needMentorIdx), values.needMentor));
  if (responseIdx >= 0)
    saves.push(updateClientCell(row._rowIndex, colIndexToLetter(responseIdx), values.response));

  await Promise.all(saves);
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
