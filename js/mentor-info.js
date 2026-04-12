// ─── SHEET CONFIG ─────────────────────────────────────────────────────────────
const ENGAGE_SHEET = 'Engage';

// ─── STATE ────────────────────────────────────────────────────────────────────
let allMentorCards = [];

// ─── LOAD DATA ────────────────────────────────────────────────────────────────
async function loadMentorInfoData() {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${MENTOR_SPREADSHEET_ID}/values/`;
  const engageResp = await apiFetch(base + encodeURIComponent(ENGAGE_SHEET + '!A1:Z'));

  // Log column headers so we can map them
  const raw = engageResp.values || [];
  if (raw.length) console.log('Engage columns:', raw[0]);

  const engage = normalizeValues(raw);
  allMentorCards = engage.rows.map(row => buildMentorObj(row, {}));

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
const ENGAGE_KEYS    = ['engage', 'engage url', 'engage link', 'profile url', 'profile link', 'url', 'link'];

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
function buildMentorObj(infoRow, engageRow) {
  const name      = col(infoRow, NAME_KEYS)     || col(engageRow, NAME_KEYS)     || '';
  const email     = col(infoRow, EMAIL_KEYS)    || col(engageRow, EMAIL_KEYS)    || '';
  const altEmail  = col(infoRow, ALT_EMAIL_KEYS)|| col(engageRow, ALT_EMAIL_KEYS)|| '';
  const phone     = col(infoRow, PHONE_KEYS)    || col(engageRow, PHONE_KEYS)    || '';
  const bio       = col(infoRow, BIO_KEYS)      || col(engageRow, BIO_KEYS)      || '';
  const status    = col(infoRow, STATUS_KEYS)   || col(engageRow, STATUS_KEYS)   || '';
  const role      = col(infoRow, ROLE_KEYS)     || col(engageRow, ROLE_KEYS)     || '';
  const skills      = parseTags(col(infoRow, SKILLS_KEYS)     || col(engageRow, SKILLS_KEYS)     || '');
  const experience  = parseTags(col(infoRow, EXPERIENCE_KEYS) || col(engageRow, EXPERIENCE_KEYS) || '');
  const industries  = parseTags(col(infoRow, INDUSTRY_KEYS)   || col(engageRow, INDUSTRY_KEYS)   || '');
  const engageUrl = col(engageRow, ENGAGE_KEYS) || col(infoRow, ENGAGE_KEYS)     || '';

  // Searchable text blob
  const searchText = [name, bio, ...skills, ...experience, ...industries].join(' ').toLowerCase();

  return { name, email, altEmail, phone, bio, status, role, skills, experience, industries, engageUrl, searchText };
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
