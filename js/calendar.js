// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const CLIENT_MEETINGS_CALENDAR_NAME = 'Slo Score Office';

// ─── FETCH NEXT 5 CLIENT MEETING EVENTS ──────────────────────────────────────
async function fetchClientMeetings() {
  // Find the calendar ID by name
  const listData = await apiFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  const calendar = (listData.items || []).find(c => c.summary === CLIENT_MEETINGS_CALENDAR_NAME);
  if (!calendar) {
    throw new Error(`Calendar "${CLIENT_MEETINGS_CALENDAR_NAME}" not found. Make sure it is shared with this Google account.`);
  }

  // Fetch the next 5 upcoming events
  const now = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`
    + `?timeMin=${encodeURIComponent(now)}&maxResults=5&orderBy=startTime&singleEvents=true`;

  const data = await apiFetch(url);
  return data.items || [];
}

// ─── RENDER CLIENT MEETINGS TABLE ────────────────────────────────────────────
function renderClientMeetings(events) {
  const wrap = document.getElementById('client-meetings-wrap');
  wrap.innerHTML = '';

  if (!events.length) {
    wrap.innerHTML = '<p class="cm-empty">No upcoming events found.</p>';
    wrap.classList.remove('hidden');
    return;
  }

  const table = document.createElement('table');
  table.id = 'client-meetings-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Subject</th>
        <th>Location</th>
        <th>Guests</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const event of events) {
    const { date, time } = formatEventStart(event);
    const subject  = event.summary || '(No title)';
    const location = event.location || '—';
    const guests   = formatGuests(event.attendees);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${subject}</td>
      <td>${location}</td>
      <td>${guests}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  wrap.classList.remove('hidden');
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

function formatGuests(attendees) {
  if (!attendees || !attendees.length) return '—';
  return attendees
    .map(a => a.displayName ? `${a.displayName} (${a.email})` : a.email)
    .join('<br>');
}
