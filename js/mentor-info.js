// ─── SHEET CONFIG ─────────────────────────────────────────────────────────────
const ENGAGE_SHEET = 'Engage';

// ─── STATE ────────────────────────────────────────────────────────────────────
let allMentorCards = [];

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
async function loadMentorInfoData() {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/`;
  const [engageResp, statusResp, assignmentsResp] = await Promise.all([
    apiFetch(base + encodeURIComponent(ENGAGE_SHEET + '!A1:Z')),
    fetchMentorStatusRows(),
    fetchMentorAssignmentsData()
  ]);

  const engage = normalizeValues(engageResp.values || []);

  // Build email → status row lookup
  const statusByEmail = {};
  statusResp.rows.forEach(row => {
    const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
    if (email) statusByEmail[email] = row;
  });

  // Build email → assignments row lookup
  const assignmentsByEmail = {};
  assignmentsResp.rows.forEach(row => {
    const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
    if (email) assignmentsByEmail[email] = row;
  });

  allMentorCards = engage.rows.map(row => {
    const email = (col(row, EMAIL_KEYS) || '').toLowerCase().trim();
    const statusRow = statusByEmail[email] || {};
    const assignmentsRow = assignmentsByEmail[email] || {};
    return buildMentorObj(row, statusRow, assignmentsRow);
  });

  renderMentorCards(allMentorCards);
}

// ─── COLUMN KEY CANDIDATES ────────────────────────────────────────────────────
const EMAIL_KEYS     = ['email', 'score email', 'scorevolunteer email', 'mentor email', 'e-mail'];
const ALT_EMAIL_KEYS = ['alt email', 'personal email', 'alternate email', 'email 2', 'other email'];
const PHONE_KEYS     = ['phone', 'phone number', 'mobile', 'cell', 'telephone'];
const BIO_KEYS       = ['bio', 'biography', 'about', 'description', 'background', 'summary'];
const STATUS_KEYS    = ['status', 'active status', 'mentor status'];
const ROLE_KEYS      = ['role', 'type', 'mentor type', 'volunteer type'];
const NAME_KEYS      = ['name', 'full name', 'mentor name', 'volunteer name'];
const SKILLS_KEYS      = ['expertise', 'skills', 'skill', 'areas of expertise'];
const EXPERIENCE_KEYS  = ['experience', 'work experience', 'background', 'years of experience', 'professional experience'];
const INDUSTRY_KEYS    = ['industries', 'industry', 'industry expertise', 'sectors'];
const ENGAGE_KEYS        = ['engage', 'engage url', 'engage link', 'profile url', 'profile link', 'url', 'link'];
const MENTOR_RESET_KEYS  = ['mentor reset', 'reset'];
const ACTIVITY_KEYS      = ['activity', 'client engagement'];

// Case-insensitive column finder
function col(row, candidates) {
  for (const key of Object.keys(row)) {
    if (key === '_rowIndex') continue;
    if (candidates.some(c => c.toLowerCase() === key.toLowerCase().trim())) {
      return row[key];
    }
  }
  return '';
}

// Parse tag strings — handles comma, semicolon, pipe, or slash separators
function parseTags(val) {
  if (!val) return [];
  return val.split(/[,;|\/]/).map(t => t.trim()).filter(Boolean);
}

// ─── BUILD MENTOR OBJECT ──────────────────────────────────────────────────────
function buildMentorObj(engageRow, statusRow, assignmentsRow) {
  const name             = col(engageRow, NAME_KEYS)       || col(statusRow, NAME_KEYS)       || '';
  const email            = col(engageRow, EMAIL_KEYS)      || col(statusRow, EMAIL_KEYS)      || '';
  const altEmail         = col(engageRow, ALT_EMAIL_KEYS)  || col(statusRow, ALT_EMAIL_KEYS)  || '';
  const phone            = col(engageRow, PHONE_KEYS)      || col(statusRow, PHONE_KEYS)      || '';
  const bio              = col(engageRow, BIO_KEYS)        || col(statusRow, BIO_KEYS)        || '';
  const role             = col(engageRow, ROLE_KEYS)       || col(statusRow, ROLE_KEYS)       || '';
  const skills           = parseTags(col(engageRow, SKILLS_KEYS)     || col(statusRow, SKILLS_KEYS)     || '');
  const experience       = parseTags(col(engageRow, EXPERIENCE_KEYS) || col(statusRow, EXPERIENCE_KEYS) || '');
  const industries       = parseTags(col(engageRow, INDUSTRY_KEYS)   || col(statusRow, INDUSTRY_KEYS)   || '');
  const engageUrl        = col(engageRow, ENGAGE_KEYS)     || col(statusRow, ENGAGE_KEYS)     || '';
  const clientCycle      = col(assignmentsRow, MENTOR_RESET_KEYS) || '';
  const mentorStatus     = col(statusRow, STATUS_KEYS)     || col(engageRow, STATUS_KEYS)     || '';
  const clientEngagement = col(statusRow, ACTIVITY_KEYS)   || col(engageRow, ACTIVITY_KEYS)   || '';

  // Searchable text blob
  const searchText = [name, bio, ...skills, ...experience, ...industries].join(' ').toLowerCase();

  return { name, email, altEmail, phone, bio, role, skills, experience, industries, engageUrl, clientCycle, mentorStatus, clientEngagement, searchText };
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────────────
function renderMentorCards(mentors) {
  const grid = document.getElementById('mentor-info-grid');
  const count = document.getElementById('mentor-info-count');
  grid.innerHTML = '';

  const visible = mentors.filter(m => m.name);
  count.textContent = `${visible.length} mentor${visible.length !== 1 ? 's' : ''}`;

  if (visible.length === 0) {
    grid.innerHTML = '<p class="mi-no-results">No mentors match your search.</p>';
    return;
  }

  visible.forEach(m => grid.appendChild(buildCard(m)));
}

// ─── BUILD A SINGLE CARD ──────────────────────────────────────────────────────
function buildCard(m) {
  const card = document.createElement('div');
  card.className = 'mi-card';

  // ── Name + badges
  const nameRow = document.createElement('div');
  nameRow.className = 'mi-name-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'mi-name';
  nameEl.textContent = m.name;
  nameRow.appendChild(nameEl);

  if (m.status) {
    const badge = document.createElement('span');
    badge.className = 'mi-badge mi-badge-status';
    badge.textContent = m.status.toUpperCase();
    nameRow.appendChild(badge);
  }
  if (m.role) {
    const badge = document.createElement('span');
    badge.className = 'mi-badge mi-badge-role';
    badge.textContent = m.role.toUpperCase();
    nameRow.appendChild(badge);
  }
  card.appendChild(nameRow);

  // ── Engage link
  if (m.engageUrl) {
    const engageLink = document.createElement('a');
    engageLink.className = 'mi-engage-link';
    engageLink.href = m.engageUrl;
    engageLink.target = '_blank';
    engageLink.rel = 'noopener';
    engageLink.textContent = 'Engage';
    card.appendChild(engageLink);
  }

  // ── Bio
  if (m.bio) {
    const bioWrap = document.createElement('div');
    bioWrap.className = 'mi-bio-wrap';

    const bioText = document.createElement('p');
    bioText.className = 'mi-bio';
    bioText.textContent = m.bio;
    bioWrap.appendChild(bioText);

    if (m.bio.length > 120) {
      let expanded = false;
      const toggle = document.createElement('button');
      toggle.className = 'read-more-btn';
      toggle.textContent = 'read more';
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        bioText.classList.toggle('mi-bio-expanded', expanded);
        toggle.textContent = expanded ? 'read less' : 'read more';
      });
      bioWrap.appendChild(toggle);
    }

    card.appendChild(bioWrap);
  }

  // ── Contact info
  const contact = document.createElement('div');
  contact.className = 'mi-contact';

  if (m.email)    contact.appendChild(contactRow('✉', m.email,    'mailto:' + m.email));
  if (m.altEmail) contact.appendChild(contactRow('✉', m.altEmail, 'mailto:' + m.altEmail));
  if (m.phone)    contact.appendChild(contactRow('📞', m.phone,   'tel:' + m.phone.replace(/\D/g, '')));

  card.appendChild(contact);

  // ── Mentor Engage (under contact info)
  if (m.clientCycle || m.mentorStatus || m.clientEngagement) {
    const engageSection = document.createElement('div');
    engageSection.className = 'mi-engage-section';

    const lbl = document.createElement('div');
    lbl.className = 'mi-tag-label';
    lbl.textContent = 'MENTOR ENGAGE';
    engageSection.appendChild(lbl);

    if (m.clientCycle)      engageSection.appendChild(engageItem('Client Cycle', m.clientCycle));
    if (m.mentorStatus)     engageSection.appendChild(engageItem('Status', m.mentorStatus));
    if (m.clientEngagement) engageSection.appendChild(engageItem('Client Engagement', m.clientEngagement));

    card.appendChild(engageSection);
  }

  // ── Expertise
  if (m.skills.length) {
    card.appendChild(tagSection('EXPERTISE', m.skills, 'mi-tag-skill'));
  }

  // ── Experience
  if (m.experience.length) {
    card.appendChild(tagSection('EXPERIENCE', m.experience, 'mi-tag-experience'));
  }

  // ── Industries
  if (m.industries.length) {
    card.appendChild(tagSection('INDUSTRIES', m.industries, 'mi-tag-industry'));
  }

  return card;
}

function engageItem(label, value) {
  const item = document.createElement('div');
  item.className = 'mi-engage-item';
  const lbl = document.createElement('span');
  lbl.className = 'mi-engage-item-label';
  lbl.textContent = label + ': ';
  const val = document.createElement('span');
  val.className = 'mi-engage-item-value';
  val.textContent = value;
  item.appendChild(lbl);
  item.appendChild(val);
  return item;
}

function contactRow(icon, text, href) {
  const row = document.createElement('div');
  row.className = 'mi-contact-row';
  const link = document.createElement('a');
  link.href = href;
  link.textContent = icon + ' ' + text;
  link.className = 'mi-contact-link';
  row.appendChild(link);
  return row;
}

function tagSection(label, tags, tagClass) {
  const section = document.createElement('div');
  section.className = 'mi-tag-section';
  const lbl = document.createElement('div');
  lbl.className = 'mi-tag-label';
  lbl.textContent = label;
  section.appendChild(lbl);
  const wrap = document.createElement('div');
  wrap.className = 'mi-tags';
  tags.forEach(t => {
    const span = document.createElement('span');
    span.className = 'mi-tag ' + tagClass;
    span.textContent = t;
    wrap.appendChild(span);
  });
  section.appendChild(wrap);
  return section;
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function searchMentorInfo(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderMentorCards(allMentorCards);
    return;
  }
  const filtered = allMentorCards.filter(m => m.searchText.includes(q));
  renderMentorCards(filtered);
}
