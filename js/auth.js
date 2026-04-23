// ─── CONFIGURATION ───────────────────────────────────────────────────────────
// Replace with your actual Google Cloud OAuth 2.0 Client ID
const CLIENT_ID = '637921743502-nhomlvo89oit4o2tjhcc76bsm9pi0r7u.apps.googleusercontent.com';

const ALLOWED_DOMAIN = 'scorevolunteer.org';
const SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/groups'
].join(' ');

// ─── STATE ────────────────────────────────────────────────────────────────────
let tokenClient = null;
let accessToken = null;
let _signedInCallback = null; // callback set by app.js

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initAuth(signedInCallback) {
  _signedInCallback = signedInCallback;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    hd: ALLOWED_DOMAIN, // UI hint — domain enforcement done below via userinfo
    callback: handleTokenResponse,
  });
}

// ─── SIGN IN ──────────────────────────────────────────────────────────────────
function signIn() {
  tokenClient.requestAccessToken({ prompt: '' });
}

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────
function signOut() {
  accessToken = null;
  showLoginScreen();
}

// ─── TOKEN RESPONSE ───────────────────────────────────────────────────────────
async function handleTokenResponse(response) {
  if (response.error) {
    console.error('Auth error:', response.error);
    showError('Sign-in failed: ' + response.error);
    return;
  }

  accessToken = response.access_token;

  // Hide login screen immediately so the user isn't left staring at it
  // while we verify their domain via the userinfo endpoint.
  document.getElementById('login-screen').classList.add('hidden');

  // Verify the user belongs to the allowed domain (security layer — not just UI hint)
  try {
    const userInfo = await fetchUserInfo(accessToken);
    const email = userInfo.email || '';
    const domain = email.split('@')[1] || '';

    if (domain !== ALLOWED_DOMAIN) {
      // Revoke immediately — wrong domain
      google.accounts.oauth2.revoke(accessToken, () => {});
      accessToken = null;
      document.getElementById('login-screen').classList.remove('hidden');
      showError(`Access restricted to @${ALLOWED_DOMAIN} accounts. You signed in as: ${email}`);
      return;
    }

    hideError();
    if (_signedInCallback) _signedInCallback(userInfo);
  } catch (err) {
    accessToken = null;
    document.getElementById('login-screen').classList.remove('hidden');
    showError('Could not verify your account. Please try again.');
    console.error(err);
  }
}

// ─── SILENT RE-AUTH (called when token expires) ───────────────────────────────
function reAuth() {
  return new Promise((resolve, reject) => {
    const original = tokenClient.callback;
    tokenClient.callback = async (response) => {
      tokenClient.callback = original;
      if (response.error) { reject(new Error(response.error)); return; }
      accessToken = response.access_token;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: 'none' });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function fetchUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('userinfo fetch failed');
  return res.json();
}

function getAccessToken() {
  return accessToken;
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('auth-error').classList.add('hidden');
}
