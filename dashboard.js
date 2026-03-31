// ══════════════════════════════════════════
// DASHBOARD — Messages + Visites
// ══════════════════════════════════════════

let allMessages   = [];
let allVisits     = [];
let currentFilter = 'all';
let currentMsgId  = null;
let visitsChart   = null;
let currentRange  = 7;

// ── Utilitaire fetch Supabase (réutilise la clé de config.js) ──
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...opts.headers
    },
    ...opts
  });
  return res;
}

// ══════════════════════════════════════════
// NAVIGATION ONGLETS
// ══════════════════════════════════════════

function switchTab(tab) {
  console.log('switchTab appelé avec:', tab);
  const tabMessages = document.getElementById('tab-messages');
  const tabVisits   = document.getElementById('tab-visits');
  const btnMessages = document.getElementById('tab-messages-btn');
  const btnVisits   = document.getElementById('tab-visits-btn');

  if (tab === 'messages') {
    tabMessages.style.display = 'block';
    tabVisits.style.display   = 'none';
    btnMessages.classList.add('active');
    btnVisits.classList.remove('active');
  } else {
    tabMessages.style.display = 'none';
    tabVisits.style.display   = 'block';
    btnMessages.classList.remove('active');
    btnVisits.classList.add('active');
    // Charger les visites seulement la première fois
    console.log('allVisits.length:', allVisits.length);
    if (allVisits.length === 0) {
      console.log('Chargement des visites depuis switchTab...');
      loadVisits();
    }
  }
}

// ══════════════════════════════════════════
// INITIALISATION
// ══════════════════════════════════════════

function initDashboard() {
  // Vérifier l'authentification
  const savedAdmin = sessionStorage.getItem('adminUser');
  if (!savedAdmin) {
    // Si on n'est pas connecté et qu'on est à la racine, rediriger vers login
    if (window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
      window.location.href = 'index.html';
    } else {
      window.location.href = 'index.html';
    }
    return;
  }
  
  try {
    // Si la donnée est déjà un objet (cas rare), l'utiliser directement
    let adminData;
    if (typeof savedAdmin === 'object') {
      adminData = savedAdmin;
    } else {
      adminData = JSON.parse(savedAdmin);
    }
    
    document.getElementById('admin-name-badge').textContent = adminData.username;
  } catch (e) {
    console.error('Erreur session:', e);
    sessionStorage.removeItem('adminUser');
    window.location.href = 'index.html';
    return;
  }
  
  loadMessages();
}

// Vérifier l'authentification au chargement
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  initDashboard();
});

// ══════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════

async function loadMessages() {
  document.getElementById('messages-list').innerHTML =
    '<div class="loading-spinner"></div>';

  try {
    const res  = await sbFetch('messages?select=*&order=created_at.desc');
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error(data?.message || 'Réponse inattendue');

    allMessages = data;
    updateMessageStats();
    renderMessages();
  } catch (e) {
    document.getElementById('messages-list').innerHTML =
      `<div class="empty-state"><p>Erreur de chargement : ${e.message}</p></div>`;
  }
}

function updateMessageStats() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  const total     = allMessages.length;
  const unread    = allMessages.filter(m => !m.lu).length;
  const thisMonth = allMessages.filter(m => {
    const d = new Date(m.created_at);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-unread').innerHTML  = `${unread} <span>nouveau</span>`;
  document.getElementById('stat-month').textContent = thisMonth;
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('#tab-messages .filter-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMessages();
}

function renderMessages() {
  const q = (document.getElementById('search-input').value || '').toLowerCase();

  const list = allMessages.filter(m => {
    if (currentFilter === 'unread' &&  m.lu) return false;
    if (currentFilter === 'read'   && !m.lu) return false;
    if (q && !`${m.nom} ${m.email} ${m.sujet} ${m.message}`
      .toLowerCase().includes(q)) return false;
    return true;
  });

  const container = document.getElementById('messages-list');

  if (list.length === 0) {
    container.innerHTML =
      `<div class="empty-state"><p>Aucun message trouvé.</p></div>`;
    return;
  }

  container.innerHTML = list.map((m, i) => `
    <div class="msg-row ${m.lu ? '' : 'unread'}"
         style="animation-delay:${i * 0.04}s"
         onclick="openModal(${m.id})">
      <div>${m.lu ? '' : '<div class="msg-unread-dot"></div>'}</div>
      <div class="msg-name">${escHtml(m.nom)}</div>
      <div class="msg-email">${escHtml(m.email)}</div>
      <div class="msg-sujet">${escHtml(m.sujet || '—')}</div>
      <div class="msg-date">${fmtDate(m.created_at)}</div>
      <div>
        <span class="badge-lu ${m.lu ? 'read' : 'unread'}">
          ${m.lu ? 'Lu' : 'Nouveau'}
        </span>
      </div>
    </div>
  `).join('');
}

// ── Modal message ──
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

  const btnMark = document.getElementById('btn-mark');
  btnMark.textContent = m.lu ? '↩ Marquer non lu' : '✓ Marquer comme lu';

  document.getElementById('modal-overlay').classList.add('open');

  // Marquer automatiquement comme lu à l'ouverture si non lu
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
    await sbFetch(`messages?id=eq.${id}`, {
      method:  'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ lu })
    });
    const m = allMessages.find(x => x.id === id);
    if (m) m.lu = lu;
    updateMessageStats();
    renderMessages();
  } catch (e) {
    console.error('Erreur markLu :', e);
  }
}

async function deleteMessage() {
  if (!currentMsgId) return;
  if (!confirm('Supprimer ce message définitivement ?')) return;

  try {
    await sbFetch(`messages?id=eq.${currentMsgId}`, { method: 'DELETE' });
    allMessages = allMessages.filter(m => m.id !== currentMsgId);
    closeModalDirect();
    updateMessageStats();
    renderMessages();
  } catch (e) {
    console.error('Erreur deleteMessage :', e);
  }
}

// ══════════════════════════════════════════
// VISITES
// ══════════════════════════════════════════

async function loadVisits() {
  console.log('loadVisits() appelé');
  const visitsList = document.getElementById('visits-list');
  if (!visitsList) {
    console.error('Element visits-list non trouvé');
    return;
  }
  
  visitsList.innerHTML = '<div class="loading-spinner"></div>';

  try {
    console.log('Appel sbFetch pour visits...');
    // Test d'abord avec une requête plus simple pour vérifier les permissions
    const res  = await sbFetch('visits?select=id&limit=1');
    console.log('Réponse sbFetch (test simple):', res.status, res.statusText);
    const testData = await res.json();
    console.log('Données test (simple):', testData);
    
    // Si le test fonctionne, faire la requête complète
    const fullRes  = await sbFetch('visits?select=*&order=visited_at.desc&limit=500');
    console.log('Réponse sbFetch (complète):', fullRes.status, fullRes.statusText);
    const data = await fullRes.json();
    console.log('Données reçues:', data);

    if (!Array.isArray(data)) throw new Error(data?.message || 'Réponse inattendue');

    allVisits = data;
    console.log('allVisits mis à jour, longueur:', allVisits.length);
    updateVisitStats();
    renderVisitsChart(currentRange);
    renderVisits();

    // Badge sur l'onglet
    const badge = document.getElementById('tab-visits-badge');
    if (badge) {
      badge.textContent   = allVisits.length;
      badge.style.display = 'inline-block';
    }
  } catch (e) {
    console.error('Erreur dans loadVisits:', e);
    document.getElementById('visits-list').innerHTML =
      `<div class="empty-state"><p>Erreur : ${e.message}</p></div>`;
  }
}

function updateVisitStats() {
  const now        = new Date();
  const today      = now.toDateString();
  const weekAgo    = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  document.getElementById('v-stat-total').textContent =
    allVisits.length;

  document.getElementById('v-stat-today').textContent =
    allVisits.filter(v => new Date(v.visited_at).toDateString() === today).length;

  document.getElementById('v-stat-week').textContent =
    allVisits.filter(v => new Date(v.visited_at) >= weekAgo).length;

  document.getElementById('v-stat-month').textContent =
    allVisits.filter(v => new Date(v.visited_at) >= monthStart).length;
}

// ── Changer la plage du graphe ──
function setRange(days, btn) {
  currentRange = days;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderVisitsChart(days);
}

// ── Graphe linéaire Chart.js ──
function renderVisitsChart(days) {
  // Construire les N derniers jours avec compte à 0 par défaut
  const labels = [];
  const counts = {};

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    labels.push(key);
    counts[key] = 0;
  }

  // Compter les visites par jour
  allVisits.forEach(v => {
    const key = v.visited_at.split('T')[0];
    if (counts[key] !== undefined) counts[key]++;
  });

  const dataPoints    = labels.map(l => counts[l]);
  const displayLabels = labels.map(l => {
    const d = new Date(l + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  const ctx = document.getElementById('visits-chart').getContext('2d');

  if (visitsChart) { visitsChart.destroy(); visitsChart = null; }

  visitsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   displayLabels,
      datasets: [{
        label:                'Visites',
        data:                 dataPoints,
        borderColor:          '#E07A52',
        backgroundColor:      'rgba(224,122,82,0.08)',
        borderWidth:          2,
        pointBackgroundColor: '#E07A52',
        pointBorderColor:     '#FFFDFB',
        pointBorderWidth:     2,
        pointRadius:          days <= 30 ? 4 : 2,
        pointHoverRadius:     6,
        fill:                 true,
        tension:              0.4
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2C1A0E',
          titleColor:      '#FFD9C4',
          bodyColor:       '#B88C7A',
          borderColor:     '#FFD9C4',
          borderWidth:     1,
          padding:         10,
          callbacks: {
            title: items => items[0].label,
            label: item  => ` ${item.raw} visite${item.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        x: {
          grid:   { color: '#FFD9C4', lineWidth: 0.5 },
          ticks:  {
            color:         '#B88C7A',
            font:          { family: 'DM Sans', size: 11 },
            maxTicksLimit: days <= 7 ? 7 : days <= 30 ? 10 : 12,
            maxRotation:   0
          },
          border: { color: '#FFD9C4' }
        },
        y: {
          grid:        { color: '#FFD9C4', lineWidth: 0.5 },
          ticks:       { color: '#B88C7A', font: { family: 'DM Sans', size: 11 }, stepSize: 1, precision: 0 },
          border:      { color: '#FFD9C4' },
          beginAtZero: true
        }
      }
    }
  });
}

// ── Liste des visites ──
function renderVisits() {
  const q = (document.getElementById('visits-search').value || '').toLowerCase();

  const list = allVisits.filter(v => {
    if (!q) return true;
    return `${v.referrer || ''} ${v.page || ''} ${v.user_agent || ''}`
      .toLowerCase().includes(q);
  });

  const container = document.getElementById('visits-list');

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Aucune visite trouvée.</p></div>`;
    return;
  }

  container.innerHTML = list.slice(0, 200).map((v, i) => `
    <div class="visit-row" style="animation-delay:${i * 0.02}s">
      <div class="visit-date">${fmtDateLong(v.visited_at)}</div>
      <div><span class="visit-page">${escHtml(v.page || '/')}</span></div>
      <div class="visit-referrer">${escHtml(v.referrer || '— Direct')}</div>
      <div class="visit-ua">${parseUA(v.user_agent)}</div>
    </div>
  `).join('');
}

// ── Détection navigateur / OS depuis User-Agent ──
function parseUA(ua) {
  if (!ua)                          return '—';
  if (/iPhone/i.test(ua))           return '📱 iPhone';
  if (/iPad/i.test(ua))             return '📱 iPad';
  if (/Android.*Mobile/i.test(ua))  return '📱 Android Mobile';
  if (/Android/i.test(ua))          return '📱 Android Tablette';
  if (/Firefox/i.test(ua))          return '🦊 Firefox';
  if (/Edg\//i.test(ua))            return '🌐 Edge';
  if (/OPR|Opera/i.test(ua))        return '🔴 Opera';
  if (/Chrome/i.test(ua))           return '🟡 Chrome';
  if (/Safari/i.test(ua))           return '🧭 Safari';
  return ua.substring(0, 45) + '…';
}

// ══════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: '2-digit'
  });
}

function fmtDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
  }) + ' à ' + d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });
}