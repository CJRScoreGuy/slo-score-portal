// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CLIENT_MEETINGS_CALENDAR_NAME = 'Slo Score Office';

// ─── FETCH NEXT 2 MONTHS OF CLIENT MEETING EVENTS ────────────────────────────
async function fetchClientMeetings() {
  // Find the calendar ID by name
  const listData = await apiFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  const calendar = (listData.items || []).find(c => c.summary === CLIENT_MEETINGS_CALENDAR_NAME);
  if (!calendar) {
    throw new Error(`Calendar "${CLIENT_MEETINGS_CALENDAR_NAME}" not found. Make sure it is shared with this Google account.`);
  }

  // Fetch events for the next 2 months
  const now = new Date();
  const twoMonthsOut = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`
    + `?timeMin=${encodeURIComponent(now.toISOString())}`
    + `&timeMax=${encodeURIComponent(twoMonthsOut.toISOString())}`
    + `&maxResults=250`
    + `&orderBy=startTime`
    + `&singleEvents=true`;

  const data = await apiFetch(url);
  return data.items || [];
}

// ─── RENDER CLIENT MEETINGS GRID ──────────────────────────────────────────────
function renderClientMeetings(events) {
  const wrap = document.getElementById('client-meetings-wrap');
  wrap.innerHTML = '';

  if (!events.length) {
    const p = document.createElement('p');
    p.className = 'cm-empty';
    p.textContent = 'No upcoming events in the next two months.';
    wrap.appendChild(p);
    wrap.classList.remove('hidden');
    return;
  }

  const table = document.createElement('table');
  table.id = 'client-meetings-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Date', 'Time', 'Subject', 'Location', 'Mentors and Clients'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  events.forEach((event, i) => {
    const { date, time } = formatEventStart(event);
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'cm-row-even' : 'cm-row-odd';

    appendTextCell(tr, date);
    appendTextCell(tr, time);
    appendTextCell(tr, event.summary || '(No title)');
    appendLocationCell(tr, event.location);
    appendGuestsCell(tr, event.attendees);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  wrap.classList.remove('hidden');
}

// ─── CELL BUILDERS ────────────────────────────────────────────────────────────
function appendTextCell(tr, text) {
  const td = document.createElement('td');
  td.textContent = text;
  tr.appendChild(td);
}

function appendLocationCell(tr, location) {
  const td = document.createElement('td');
  if (!location) {
    td.textContent = '—';
  } else if (location.startsWith('http://') || location.startsWith('https://')) {
    const a = document.createElement('a');
    a.href = location;
    a.textContent = location;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'cm-location-link';
    td.appendChild(a);
  } else {
    td.textContent = location;
  }
  tr.appendChild(td);
}

function appendGuestsCell(tr, attendees) {
  const td = document.createElement('td');
  if (!attendees || !attendees.length) {
    td.textContent = '—';
  } else {
    const sorted = [...attendees].sort((a, b) => {
      const aDomain = (a.email || '').split('@')[1] || '';
      const bDomain = (b.email || '').split('@')[1] || '';
      const aIsMentor = aDomain === 'scorevolunteer.org' ? 0 : 1;
      const bIsMentor = bDomain === 'scorevolunteer.org' ? 0 : 1;
      return aIsMentor - bIsMentor;
    });
    sorted.forEach((a, i) => {
      if (i > 0) td.appendChild(document.createElement('br'));
      const email  = a.email || '';
      const domain = email.split('@')[1] || '';
      const span   = document.createElement('span');
      if (domain === 'scorevolunteer.org') {
        span.textContent = `Mentor: ${email}`;
      } else {
        span.textContent = `Client: ${a.displayName || email}`;
      }
      td.appendChild(span);
    });
  }
  tr.appendChild(td);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatEventStart(event) {
  if (event.start.dateTime) {
    const d = new Date(event.start.dateTime);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  }
  // All-day event — start.date is YYYY-MM-DD; parse without timezone shift
  const [y, m, day] = event.start.date.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: 'All day'
  };
}
