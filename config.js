// ══════════════════════════════════════════
// CONFIGURATION ADMIN
// Seul fichier de config côté admin — pointe vers votre backend
// ══════════════════════════════════════════

const API_BASE = 'https://backportfolio-six.vercel.app/api'; // ← changer en prod

// ── Récupère le token admin stocké après login ──
function getAdminToken() {
    console.log('getAdminToken called');
    console.log('sessionStorage.getItem("adminToken"):', sessionStorage.getItem('adminToken'));
  return sessionStorage.getItem('adminToken') || '';
}

// ── Fetch vers le backend admin (remplace sbFetch) ──
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}/admin/${path}`, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${getAdminToken()}`,
      ...opts.headers
    },
    ...opts
  });
  return res;
}