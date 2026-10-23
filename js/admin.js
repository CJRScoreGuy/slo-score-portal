// ─── ADMINISTRATION TAB ───────────────────────────────────────────────────────

let allAdminMentors = [];
let allAdminClients = [];
let adminListenersWired = false;

// ─── LOAD ─────────────────────────────────────────────────────────────────────
async function loadAdminTab() {
  const loading = document.getElementById('admin-loading');
  const error   = document.getElementById('admin-error');
  const content = document.getElementById('admin-content');

  loading.classList.remove('hidden');
  error.classList.add('hidden');
  content.classList.add('hidden');

  document.getElementById('admin-mentor-list').innerHTML = '';
  document.getElementById('admin-client-grid').innerHTML = '';

  // Wire search listeners once
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

    const engage = normalizeValues(engageResp.values || []);

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

    allAdminMentors = engage.rows
      .map(row => {
        const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
        const sRow  = statusByEmail[email]      || {};
        const aRow  = assignmentsByEmail[email] || {};
        const m = buildMentorObj(row, sRow, aRow);
        // Extra fields not in buildMentorObj
        m.mentorAssigned = col(aRow, ['mentor assigned']) || '';
        m.assignments    = col(aRow, ['assignments'])     || '';
        // Search restricted to name, email, phone only
        m.adminSearchText = [m.name, m.email, m.phone].join(' ').toLowerCase();
        return m;
      })
      .filter(m => m.name)
      .sort((a, b) => a.name.localeCompare(b.name));

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
    [m.name, m.email, m.phone, m.mentorStatus, m.clientEngagement, m.mentorAssigned, m.assignments, m.clientCycle]
      .forEach(val => {
        const td = document.createElement('td');
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
    const text = [
      col(row, NAME_KEYS),
      col(row, EMAIL_KEYS),
      col(row, PHONE_KEYS)
    ].join(' ').toLowerCase();
    return text.includes(q);
  }));
}
