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

  const initials = (m.nom || '?')[0].toUpperCase();

  // En-tête (caché visuellement, gardé pour accessibilité)
  document.getElementById('modal-avatar').textContent      = initials;
  document.getElementById('modal-name').textContent        = m.nom;
  document.getElementById('modal-email-modal').textContent = m.email;
  document.getElementById('modal-sujet').textContent       = m.sujet || '(sans sujet)';
  document.getElementById('modal-date').textContent        = fmtDateLong(m.created_at);

  // Thread — message client
  document.getElementById('thread-avatar-client').textContent = initials;
  document.getElementById('thread-sender-name').textContent   = m.nom;
  document.getElementById('thread-msg-date').textContent      = fmtDateLong(m.created_at);
  document.getElementById('modal-message').textContent        = m.message;

  // Bloc réponse
  document.getElementById('reply-to-chip').textContent   = `${m.nom} <${m.email}>`;
  document.getElementById('reply-subject').value         = `Réponse : ${m.sujet || 'votre message'}`;
  document.getElementById('reply-message').value         = '';

  // Message original cité
  document.getElementById('quoted-body').innerHTML =
    `<div class="quoted-meta">De : <strong>${escHtml(m.nom)}</strong> &lt;${escHtml(m.email)}&gt;</div>` +
    `<div class="quoted-meta">Envoyé le : ${fmtDateLong(m.created_at)}</div>` +
    `<div class="quoted-meta">Sujet : ${escHtml(m.sujet || '(sans sujet)')}</div>` +
    `<div class="quoted-text">${escHtml(m.message)}</div>`;

  document.getElementById('btn-mark').textContent = m.lu ? '↩ Marquer non lu' : '✓ Marquer comme lu';

  document.getElementById('modal-overlay').classList.add('open');

  if (!m.lu) markLu(id, true);
}

function toggleQuote(btn) {
  const body = document.getElementById('quoted-body');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  btn.classList.toggle('active', !open);
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
    await apiFetch(`messages?id=${id}`, {
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
    await apiFetch(`messages?id=${currentMsgId}`, { method: 'DELETE' });
    allMessages = allMessages.filter(m => m.id !== currentMsgId);
    closeModalDirect();
    updateMessageStats();
    renderMessages();
  } catch (e) { console.error('Erreur deleteMessage :', e); }
}

// ── Envoi de la réponse ──
async function sendReply() {
  if (!currentMsgId) return;

  const m = allMessages.find(x => x.id === currentMsgId);
  if (!m) return;

  const subject      = document.getElementById('reply-subject').value.trim();
  const replyMessage = document.getElementById('reply-message').value.trim();

  if (!subject || !replyMessage) {
    alert('Veuillez remplir le sujet et le message.');
    return;
  }

  // Email HTML simple et lisible
  const formattedMessage = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#2C1A0E;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <tr>
      <td>

        <!-- Message de réponse -->
        <div style="font-size:15px;line-height:1.8;color:#2C1A0E;white-space:pre-wrap;">${escHtmlEmail(replyMessage)}</div>

        <!-- Signature -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;padding-top:20px;border-top:1px solid #e8e0da;">
          <tr>
            <td>
              <div style="font-size:14px;font-weight:500;color:#2C1A0E;">ANDRIANINA Manda Arolala</div>
              <div style="margin-top:6px;">
                <a href="https://mandaarolala.com" style="font-size:13px;color:#E07A52;text-decoration:none;">Portfolio — ANDRIANINA Manda Arolala</a>
              </div>
            </td>
          </tr>
        </table>

        <!-- Message original cité -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
          <tr>
            <td style="border-top:1px solid #e8e0da;padding-top:24px;">
              <div style="font-size:11px;color:#B88C7A;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em;">Message original</div>
              <div style="font-size:12px;color:#B88C7A;line-height:1.6;margin-bottom:4px;">De : ${escHtmlEmail(m.nom)} &lt;${escHtmlEmail(m.email)}&gt;</div>
              <div style="font-size:12px;color:#B88C7A;line-height:1.6;margin-bottom:4px;">Date : ${fmtDateLong(m.created_at)}</div>
              <div style="font-size:12px;color:#B88C7A;line-height:1.6;margin-bottom:12px;">Sujet : ${escHtmlEmail(m.sujet || '(sans sujet)')}</div>
              <div style="font-size:13px;color:#7A5543;line-height:1.75;white-space:pre-wrap;border-left:3px solid #FFBFA0;padding-left:14px;">${escHtmlEmail(m.message)}</div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const btn = document.querySelector('.btn-send-primary');
  btn.disabled   = true;
  btn.innerHTML  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Envoi…';

  try {
    const response = await fetch('https://backportfolio-six.vercel.app/api/admin/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + sessionStorage.getItem('adminToken')
      },
      body: JSON.stringify({
        email:   m.email,
        subject: subject,
        message: formattedMessage
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de l\'envoi');
    }

    // Feedback succès visuel
    btn.innerHTML  = '✓ Réponse envoyée';
    btn.style.background = '#6baa75';
    setTimeout(() => {
      cancelReply();
      closeModalDirect();
    }, 1200);

  } catch (error) {
    console.error('Erreur sendReply:', error);
    alert('Erreur lors de l\'envoi : ' + error.message);
    btn.disabled  = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer';
  }
}

function cancelReply() {
  document.getElementById('reply-subject').value = '';
  document.getElementById('reply-message').value = '';
  const body = document.getElementById('quoted-body');
  body.style.display = 'none';
  document.querySelector('.quoted-toggle')?.classList.remove('active');
}

// ── Utilitaires ──
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escHtmlEmail(str) {
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