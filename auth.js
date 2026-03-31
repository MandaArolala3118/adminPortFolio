// ══════════════════════════════════════════
// AUTHENTIFICATION ADMIN
// ══════════════════════════════════════════

// ── Hash SHA-256 ──
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── LOGIN ──
async function handleLogin() {
  const username = document.getElementById('inp-username').value.trim();
  const password = document.getElementById('inp-password').value;
  const btn      = document.getElementById('btn-login');
  const errEl    = document.getElementById('login-error');

  if (!username || !password) return;

  btn.disabled    = true;
  btn.textContent = 'Connexion…';
  errEl.style.display = 'none';

  try {
    const password_hash = await sha256(password);

    const res  = await fetch(`${API_BASE}/admin/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password_hash })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Stocker le token admin et les infos utilisateur
      sessionStorage.setItem('adminToken', data.admin_token);
      sessionStorage.setItem('adminUser',  JSON.stringify(data.admin));
      window.location.href = 'messages.html';
    } else {
      errEl.textContent   = data.error || 'Identifiants incorrects.';
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = 'Se connecter';
    }
  } catch (e) {
    errEl.textContent   = 'Erreur réseau. Vérifiez votre connexion.';
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.textContent     = 'Se connecter';
  }
}

// ── LOGOUT ──
function handleLogout() {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminUser');
  window.location.href = 'index.html';
}

// ── Vérifier le statut d'authentification ──
function checkAuthStatus() {
  const token     = sessionStorage.getItem('adminToken');
  const savedAdmin = sessionStorage.getItem('adminUser');

  if (token && savedAdmin) {
    if (window.location.pathname.includes('index.html') ||
        window.location.pathname === '/' ||
        window.location.pathname.endsWith('/')) {
      window.location.href = 'messages.html';
    }
  }
}

// ── Event listeners ──
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  const btnLogin    = document.getElementById('btn-login');
  const btnLogout   = document.getElementById('btn-logout');
  const inpPassword = document.getElementById('inp-password');

  if (btnLogin)    btnLogin.addEventListener('click', handleLogin);
  if (btnLogout)   btnLogout.addEventListener('click', handleLogout);
  if (inpPassword) inpPassword.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
});