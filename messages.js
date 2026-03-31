// ══════════════════════════════════════════
// MESSAGES — Interface de gestion
// ══════════════════════════════════════════

let allMessages   = [];
let currentFilter = 'all';
let currentMsgId  = null;

// ── Initialisation ──
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  initMessagesPage();
});

function initMessagesPage() {
  const savedAdmin = sessionStorage.getItem('adminUser');
  if (!savedAdmin || !sessionStorage.getItem('adminToken')) {
    window.location.href = 'index.html';
    return;
  }
  try {
    document.getElementById('admin-name-badge').textContent = JSON.parse(savedAdmin).username;
  } catch {
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  loadMessages();
  loadNavigationBadges();
  startRealTimeUpdates();
}

let updateInterval;
function startRealTimeUpdates() {
  updateInterval = setInterval(async () => {
    await loadNavigationBadges();
    await loadMessages();
  }, 30000);
}
window.addEventListener('beforeunload', () => clearInterval(updateInterval));

// ── Badges navigation ──
async function loadNavigationBadges() {
  try {
    const res      = await apiFetch('messages');
    const result   = await res.json();
    const messages = result.data || [];

    const unread      = messages.filter(m => !m.lu).length;
    const unreadBadge = document.getElementById('messages-unread-badge');
    unreadBadge.textContent   = unread;
    unreadBadge.style.display = unread > 0 ? 'inline-block' : 'none';

    const visRes    = await apiFetch('visits');
    const visResult = await visRes.json();
    const visits    = visResult.data || [];
    const today     = new Date().toDateString();
    const todayCount = visits.filter(v => new Date(v.visited_at).toDateString() === today).length;

    const todayBadge = document.getElementById('messages-today-badge');
    todayBadge.textContent   = todayCount;
    todayBadge.style.display = todayCount > 0 ? 'inline-block' : 'none';
  } catch (e) {
    console.error('Erreur badges:', e);
  }
}

// ── Chargement messages ──
async function loadMessages() {
  document.getElementById('messages-list').innerHTML = '<div class="loading-spinner"></div>';
  try {
    const res    = await apiFetch('messages');
    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Erreur serveur');
    allMessages = result.data || [];
    updateMessageStats();
    renderMessages();
  } catch (e) {
    document.getElementById('messages-list').innerHTML =
      `<div class="empty-state"><p>Erreur : ${e.message}</p></div>`;
  }
}

function updateMessageStats() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  document.getElementById('stat-total').textContent  = allMessages.length;
  document.getElementById('stat-unread').innerHTML   =
    `${allMessages.filter(m => !m.lu).length} <span>nouveau</span>`;
  document.getElementById('stat-month').textContent  =
    allMessages.filter(m => {
      const d = new Date(m.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMessages();
}

function renderMessages() {
  const q    = (document.getElementById('search-input').value || '').toLowerCase();
  const list = allMessages.filter(m => {
    if (currentFilter === 'unread' &&  m.lu)  return false;
    if (currentFilter === 'read'   && !m.lu)  return false;
    if (q && !`${m.nom} ${m.email} ${m.sujet} ${m.message}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const container = document.getElementById('messages-list');
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Aucun message trouvé.</p></div>`;
    return;
  }

  container.innerHTML = list.map((m, i) => `
    <div class="msg-row ${m.lu ? '' : 'unread'}" style="animation-delay:${i * 0.04}s" onclick="openModal(${m.id})">
      <div>${m.lu ? '' : '<div class="msg-unread-dot"></div>'}</div>
      <div class="msg-name">${escHtml(m.nom)}</div>
      <div class="msg-email">${escHtml(m.email)}</div>
      <div class="msg-sujet">${escHtml(m.sujet || '—')}</div>
      <div class="msg-date">${fmtDate(m.created_at)}</div>
      <div><span class="badge-lu ${m.lu ? 'read' : 'unread'}">${m.lu ? 'Lu' : 'Nouveau'}</span></div>
    </div>
  `).join('');
}

// ── Modal ──
function openModal(id) {
  const m = allMessages.find(x => x.id === id);
  if (!m) return;
  currentMsgId = id;

  document.getElementById('modal-avatar').textContent      = (m.nom || '?')[0].toUpperCase();
  document.getElementById('modal-name').textContent        = m.nom;
  document.getElementById('modal-email-modal').textContent = m.email;
  document.getElementById('modal-sujet').textContent       = m.sujet || '(sans sujet)';
  document.getElementById('modal-date').textContent        = fmtDateLong(m.created_at);
  document.getElementById('modal-message').textContent     = m.message;
  document.getElementById('btn-mark').textContent          = m.lu ? '↩ Marquer non lu' : '✓ Marquer comme lu';
  document.getElementById('modal-overlay').classList.add('open');

  if (!m.lu) markLu(id, true);
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentMsgId = null;
}

async function toggleLu() {
  if (!currentMsgId) return;
  const m = allMessages.find(x => x.id === currentMsgId);
  if (!m) return;
  await markLu(currentMsgId, !m.lu);
  closeModalDirect();
}

async function markLu(id, lu) {
  try {
    await apiFetch(`messages/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ lu })
    });
    const m = allMessages.find(x => x.id === id);
    if (m) m.lu = lu;
    updateMessageStats();
    renderMessages();
  } catch (e) { console.error('Erreur markLu :', e); }
}

async function deleteMessage() {
  if (!currentMsgId) return;
  if (!confirm('Supprimer ce message définitivement ?')) return;
  try {
    await apiFetch(`messages/${currentMsgId}`, { method: 'DELETE' });
    allMessages = allMessages.filter(m => m.id !== currentMsgId);
    closeModalDirect();
    updateMessageStats();
    renderMessages();
  } catch (e) { console.error('Erreur deleteMessage :', e); }
}

// ── Utilitaires ──
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' });
}
function fmtDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'long', year:'numeric' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}