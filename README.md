# SCORE Client Tracker

A static web app that displays the "Client Tracking" Google Sheet with filtering, secured by Google OAuth (restricted to @scorevolunteer.org accounts).

## Setup

### 1. Fill in your credentials

**`js/auth.js`** — replace the placeholder:
```js
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

**`js/sheets.js`** — replace the placeholder:
```js
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
```
The Spreadsheet ID is the long string in the sheet URL:
`https://docs.google.com/spreadsheets/d/**[THIS PART]**/edit`

### 2. Google Cloud Console setup

1. Create a project at https://console.cloud.google.com
2. Enable the **Google Sheets API**
3. Configure the **OAuth consent screen** (External, add scopes: `email`, `profile`, `spreadsheets.readonly`)
4. Create an **OAuth 2.0 Client ID** → Web application
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://YOUR_GITHUB_USERNAME.github.io` (when ready)

### 3. Run locally

```bash
cd score-tracker
python3 -m http.server 3000
```
Then open http://localhost:3000

### 4. Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Go to repo Settings → Pages → Source: main branch / root
3. Add your GitHub Pages URL to the authorized origins in Google Cloud Console

## Notes

- Access tokens are kept in memory only (never stored in localStorage)
- Domain enforcement is verified server-side via the userinfo endpoint — not just the UI hint
- Token expires after ~1 hour; the app will prompt re-auth automatically
