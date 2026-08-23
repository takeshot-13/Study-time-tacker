// Shared across Home, Study Time Tracker, and Dashboard.
// Requires the Supabase JS SDK to already be loaded on the page via:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

window.STTAuth = (function () {
  // TODO: swap these two placeholders for the real values from
  // Supabase Dashboard -> Settings -> API, then this whole app goes live.
  // The anon key is a public client-side key by design — Row Level
  // Security (see supabase-schema.sql) is what actually protects data,
  // not secrecy of this key.
  const SUPABASE_URL = 'https://ollkbekmtmjszdldhtor.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbGtiZWttdG1qc3pkbGRodG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDY5NDUsImV4cCI6MjEwMjk4Mjk0NX0.xQ50Ja-fZya7zGurrdOF5CbCgxGXaboiGuR_YEsGFqk';

  const isConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

  let client = null;
  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('[STTAuth] Supabase is not configured yet — sign-in is disabled until SUPABASE_URL / SUPABASE_ANON_KEY are set in auth.js.');
  }

  async function signInWithGoogle() {
    if (!client) return alert('Sign-in isn\'t configured yet.');
    const redirectTo = window.location.origin + window.location.pathname.replace(/[^/]*$/, 'dashboard.html');
    await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    window.location.href = 'index.html';
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  function onAuthChange(callback) {
    if (!client) return;
    client.auth.onAuthStateChange((_event, session) => callback(session));
  }

  // Wires up the shared nav markup (see styles.css / any page's <header>):
  // expects #navSignIn, #navUserChip, #navUserAvatar, #navUserName,
  // #navSignOut, #navDashboardLink to exist. Safe to call on pages that
  // omit some of these — each lookup is guarded.
  async function mountNavAuth() {
    const signInBtn = document.getElementById('navSignIn');
    const userChip = document.getElementById('navUserChip');
    const userAvatar = document.getElementById('navUserAvatar');
    const userName = document.getElementById('navUserName');
    const signOutBtn = document.getElementById('navSignOut');
    const dashboardLink = document.getElementById('navDashboardLink');

    function render(session) {
      const loggedIn = !!session;
      const user = session && session.user;
      if (signInBtn) signInBtn.style.display = loggedIn ? 'none' : '';
      if (userChip) userChip.style.display = loggedIn ? '' : 'none';
      if (dashboardLink) dashboardLink.style.display = loggedIn ? '' : 'none';
      if (loggedIn && user) {
        const meta = user.user_metadata || {};
        if (userName) userName.textContent = meta.full_name || meta.name || user.email || 'Signed in';
        if (userAvatar) {
          if (meta.avatar_url) {
            userAvatar.src = meta.avatar_url;
            userAvatar.style.display = '';
          } else {
            userAvatar.style.display = 'none';
          }
        }
      }
    }

    if (signInBtn) signInBtn.addEventListener('click', signInWithGoogle);
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);

    render(await getSession());
    onAuthChange(render);
  }

  return { client, isConfigured, signInWithGoogle, signOut, getSession, onAuthChange, mountNavAuth };
})();
