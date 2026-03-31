// ══════════════════════════════════════════
// VISITES — Interface de gestion des visites
// ══════════════════════════════════════════

let allVisits = [];
let visitsChart = null;
let currentRange = 7;


// ── Initialisation ──
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  initVisitesPage();
});

function initVisitesPage() {
  const savedAdmin = sessionStorage.getItem('adminUser');
  if (!savedAdmin) {
    window.location.href = 'index.html';
    return;
  }
  
  try {
    const adminData = JSON.parse(savedAdmin);
    document.getElementById('admin-name-badge').textContent = adminData.username;
  } catch (e) {
    console.error('Erreur session:', e);
    sessionStorage.removeItem('adminUser');
    window.location.href = 'index.html';
    return;
  }
  
  loadVisits();
  loadNavigationBadges();
  
  // Démarrer la surveillance en temps réel
  startRealTimeUpdates();
}

let updateInterval;

function startRealTimeUpdates() {
  // Mettre à jour toutes les 30 secondes
  updateInterval = setInterval(async () => {
    await loadNavigationBadges();
    await loadVisits();
  }, 30000);
}

// Nettoyer l'intervalle quand l'utilisateur quitte la page
window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// ── Charger les badges de navigation ──
async function loadNavigationBadges() {
  try {
    // Charger les messages non lus
    const msgRes = await apiFetch('messages');
    const msgResult = await msgRes.json();
    const messages = msgResult.data || [];
    const unreadCount = Array.isArray(messages) ? messages.filter(m => !m.lu).length : 0;
    
    const unreadBadge = document.getElementById('visites-unread-badge');
    if (unreadCount > 0) {
      const oldValue = parseInt(unreadBadge.textContent) || 0;
      unreadBadge.textContent = unreadCount;
      unreadBadge.style.display = 'inline-block';
      
      // Animation si augmentation
      if (unreadCount > oldValue && oldValue > 0) {
        unreadBadge.style.animation = 'pulse 0.6s ease-in-out';
        setTimeout(() => {
          unreadBadge.style.animation = '';
        }, 600);
      }
    } else {
      unreadBadge.style.display = 'none';
    }
    
    // Charger les visites d'aujourd'hui
    const visitsRes = await apiFetch('visits');
    const visResult = await visitsRes.json();
    const visits = visResult.data || [];
    const today = new Date().toDateString();
    const todayVisits = Array.isArray(visits) ? visits.filter(v => new Date(v.visited_at).toDateString() === today).length : 0;
    
    const todayBadge = document.getElementById('visites-today-badge');
    if (todayVisits > 0) {
      const oldValue = parseInt(todayBadge.textContent) || 0;
      todayBadge.textContent = todayVisits;
      todayBadge.style.display = 'inline-block';
      
      // Animation si augmentation
      if (todayVisits > oldValue && oldValue > 0) {
        todayBadge.style.animation = 'pulse 0.6s ease-in-out';
        setTimeout(() => {
          todayBadge.style.animation = '';
        }, 600);
      }
    } else {
      todayBadge.style.display = 'none';
    }
  } catch (e) {
    console.error('Erreur chargement badges navigation:', e);
  }
}

// ── Chargement des visites ──
async function loadVisits() {
  console.log('loadVisits() appelé');
  const visitsList = document.getElementById('visits-list');
  if (!visitsList) {
    console.error('Element visits-list non trouvé');
    return;
  }
  
  visitsList.innerHTML = '<div class="loading-spinner"></div>';

  try {
    console.log('Appel apiFetch pour visits...');
    const res = await apiFetch('visits');
    console.log('Réponse apiFetch:', res.status, res.statusText);
    const result = await res.json();
    console.log('Données reçues:', result);

    if (!res.ok) throw new Error(result.error || 'Erreur serveur');
    const data = result.data || [];

    if (!Array.isArray(data)) throw new Error(data?.message || 'Réponse inattendue');

    allVisits = data;
    console.log('allVisits mis à jour, longueur:', allVisits.length);
    updateVisitStats();
    renderVisitsChart(currentRange);
    renderVisits();
  } catch (e) {
    console.error('Erreur dans loadVisits:', e);
    document.getElementById('visits-list').innerHTML = `<div class="empty-state"><p>Erreur : ${e.message}</p></div>`;
  }
}

function updateVisitStats() {
  const now = new Date();
  const today = now.toDateString();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  document.getElementById('v-stat-total').textContent = allVisits.length;
  document.getElementById('v-stat-today').textContent = allVisits.filter(v => new Date(v.visited_at).toDateString() === today).length;
  document.getElementById('v-stat-week').textContent = allVisits.filter(v => new Date(v.visited_at) >= weekAgo).length;
  document.getElementById('v-stat-month').textContent = allVisits.filter(v => new Date(v.visited_at) >= monthStart).length;
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

  const dataPoints = labels.map(l => counts[l]);
  const displayLabels = labels.map(l => {
    const d = new Date(l + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  const ctx = document.getElementById('visits-chart').getContext('2d');

  if (visitsChart) { visitsChart.destroy(); visitsChart = null; }

  visitsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [{
        label: 'Visites',
        data: dataPoints,
        borderColor: '#E07A52',
        backgroundColor: 'rgba(224,122,82,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#E07A52',
        pointBorderColor: '#FFFDFB',
        pointBorderWidth: 2,
        pointRadius: days <= 30 ? 4 : 2,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2C1A0E',
          titleColor: '#FFD9C4',
          bodyColor: '#B88C7A',
          borderColor: '#FFD9C4',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => items[0].label,
            label: item => ` ${item.raw} visite${item.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#FFD9C4', lineWidth: 0.5 },
          ticks: {
            color: '#B88C7A',
            font: { family: 'DM Sans', size: 11 },
            maxTicksLimit: days <= 7 ? 7 : days <= 30 ? 10 : 12,
            maxRotation: 0
          },
          border: { color: '#FFD9C4' }
        },
        y: {
          grid: { color: '#FFD9C4', lineWidth: 0.5 },
          ticks: { color: '#B88C7A', font: { family: 'DM Sans', size: 11 }, stepSize: 1, precision: 0 },
          border: { color: '#FFD9C4' },
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
    return `${v.referrer || ''} ${v.page || ''} ${v.user_agent || ''}`.toLowerCase().includes(q);
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
  if (!ua) return '—';
  if (/iPhone/i.test(ua)) return '📱 iPhone';
  if (/iPad/i.test(ua)) return '📱 iPad';
  if (/Android.*Mobile/i.test(ua)) return '📱 Android Mobile';
  if (/Android/i.test(ua)) return '📱 Android Tablette';
  if (/Firefox/i.test(ua)) return '🦊 Firefox';
  if (/Edg\//i.test(ua)) return '🌐 Edge';
  if (/OPR|Opera/i.test(ua)) return '🔴 Opera';
  if (/Chrome/i.test(ua)) return '🟡 Chrome';
  if (/Safari/i.test(ua)) return '🧭 Safari';
  return ua.substring(0, 45) + '…';
}

// ── Utilitaires ──
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
