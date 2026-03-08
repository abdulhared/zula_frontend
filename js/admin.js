/* ════════════════════════════════════════════════════════════
   GAU IMS — admin.js
   Authentication flow:
     1. POST /api/auth/login  → receive JWT access_token
     2. Store token in sessionStorage
     3. Attach token as  Authorization: Bearer <token>  on every
        protected API call (/tickets/list, /tickets/actions)
     4. On 401 → clear token and redirect to login screen
   ════════════════════════════════════════════════════════════ */

'use strict';

const API = 'http://localhost:5000/api';

// ── Token helpers ────────────────────────────────────────────
const TOKEN_KEY = 'gau_admin_jwt';

function saveToken(token)  { sessionStorage.setItem(TOKEN_KEY, token); }
function getToken()        { return sessionStorage.getItem(TOKEN_KEY); }
function clearToken()      { sessionStorage.removeItem(TOKEN_KEY); }

function authHeaders() {
  const token = getToken();
  return token
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ── Screen elements ──────────────────────────────────────────
const loginScreen    = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');

// ── Login form ───────────────────────────────────────────────
const loginForm     = document.getElementById('loginForm');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const togglePw      = document.getElementById('togglePw');
const adminPassword = document.getElementById('adminPassword');
const eyeIcon       = document.getElementById('eyeIcon');

// ── Dashboard elements ───────────────────────────────────────
const loadingState   = document.getElementById('loadingState');
const emptyState     = document.getElementById('emptyState');
const tableContainer = document.getElementById('tableContainer');
const ticketsBody    = document.getElementById('ticketsBody');
const searchInput    = document.getElementById('searchInput');
const refreshBtn     = document.getElementById('refreshBtn');
const logoutBtn      = document.getElementById('logoutBtn');

const statTotal    = document.getElementById('statTotal');
const statOpen     = document.getElementById('statOpen');
const statResolved = document.getElementById('statResolved');
const statToday    = document.getElementById('statToday');
const statRate     = document.getElementById('statRate');

// ── Modal ────────────────────────────────────────────────────
const modalBackdrop     = document.getElementById('modalBackdrop');
const modalClose        = document.getElementById('modalClose');
const btnEmail          = document.getElementById('btnEmail');
const btnNotifyResolved = document.getElementById('btnNotifyResolved');
const btnResolve        = document.getElementById('btnResolve');
const modalFeedback     = document.getElementById('modalFeedback');

// ── Toast ────────────────────────────────────────────────────
const toast      = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMsg   = document.getElementById('toastMsg');
const toastIW    = document.getElementById('toastIconWrap');

// ── State ────────────────────────────────────────────────────
let allTickets    = [];
let activeFilter  = 'all';
let searchQuery   = '';
let currentTicket = null;
let adminName     = '';

/* ══════════════════════════════════════════════════════════════
   BOOT — verify existing token or show login
══════════════════════════════════════════════════════════════ */
(async function boot() {
  const token = getToken();
  if (!token) return showLogin();

  // Verify token is still valid against the server
  try {
    const res = await fetch(`${API}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      adminName = data.admin?.name || 'Admin';
      enterDashboard();
    } else {
      clearToken();
      showLogin();
    }
  } catch {
    // Server offline — still allow demo access if token looks like a JWT
    if (token.split('.').length === 3) {
      adminName = 'Admin';
      enterDashboard();
    } else {
      clearToken();
      showLogin();
    }
  }
})();

/* ══════════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════════ */
function showLogin() {
  loginScreen.hidden    = false;
  adminDashboard.hidden = true;
}

// Toggle password visibility
togglePw.addEventListener('click', () => {
  const isHidden = adminPassword.type === 'password';
  adminPassword.type = isHidden ? 'text' : 'password';
  eyeIcon.innerHTML = isHidden
    ? `<ellipse cx="8" cy="8" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
       <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`
    : `<ellipse cx="8" cy="8" rx="6" ry="4" stroke="currentColor" stroke-width="1.4"/>
       <circle cx="8" cy="8" r="1.5" fill="currentColor"/>`;
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();

  const email    = document.getElementById('adminEmail').value.trim();
  const password = adminPassword.value;

  // Client-side presence check
  let valid = true;
  if (!email) {
    document.getElementById('err-adminEmail').textContent = 'Please enter your email.';
    document.getElementById('adminEmail').classList.add('is-invalid');
    valid = false;
  }
  if (!password) {
    document.getElementById('err-adminPassword').textContent = 'Please enter your password.';
    adminPassword.classList.add('is-invalid');
    valid = false;
  }
  if (!valid) return;

  setLoginLoading(true);
  loginError.hidden = true;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ Real JWT received from the server — store it
      saveToken(data.access_token);
      adminName = data.name || email.split('@')[0];
      setLoginLoading(false);
      enterDashboard();
    } else {
      // ❌ Server explicitly rejected credentials
      setLoginLoading(false);
      loginErrorMsg.textContent = data.error || 'Invalid email or password.';
      loginError.hidden = false;
      document.getElementById('adminEmail').classList.add('is-invalid');
      adminPassword.classList.add('is-invalid');
    }
  } catch {
    // Server offline — fall into demo mode only
    setLoginLoading(false);
    loginErrorMsg.textContent = 'Cannot reach the server. Check that the backend is running.';
    loginError.hidden = false;
  }
});

function setLoginLoading(on) {
  loginBtn.disabled = on;
  loginBtn.querySelector('.btn-label').hidden    = on;
  loginBtn.querySelector('.btn-icon').hidden     = on;
  loginBtn.querySelector('.btn-spinner').hidden  = !on;
}

['adminEmail', 'adminPassword'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById(id).classList.remove('is-invalid');
    document.getElementById('err-' + id).textContent = '';
    loginError.hidden = true;
  });
});

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════ */
function enterDashboard() {
  loginScreen.hidden    = true;
  adminDashboard.hidden = false;

  document.getElementById('adminNameDisplay').textContent = adminName;
  document.getElementById('adminAvatar').textContent      = adminName.charAt(0).toUpperCase();

  loadTickets();
}

// ── Logout ──────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  // Tell server (fire-and-forget; JWT is stateless so this is optional)
  try {
    await fetch(`${API}/auth/logout`, { method: 'POST', headers: authHeaders() });
  } catch { /* ignore */ }

  clearToken();
  allTickets = [];
  adminDashboard.hidden = true;
  loginScreen.hidden    = false;
  loginForm.reset();
  loginError.hidden = true;
});

// ── Protected fetch wrapper ──────────────────────────────────
// Automatically handles 401 → logout
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    clearToken();
    showLoginExpired();
    throw new Error('token_expired');
  }
  return res;
}

function showLoginExpired() {
  clearToken();
  adminDashboard.hidden = true;
  loginScreen.hidden    = false;
  loginForm.reset();
  loginErrorMsg.textContent = 'Your session has expired. Please sign in again.';
  loginError.hidden = false;
}

/* ══════════════════════════════════════════════════════════════
   TICKET LOADING & RENDERING
══════════════════════════════════════════════════════════════ */
async function loadTickets() {
  showLoading(true);
  try {
    const res = await apiFetch(`${API}/tickets/list`);
    if (!res.ok) throw new Error('API error');
    const raw = await res.json();
    allTickets = Array.isArray(raw) ? raw.map(normalise) : [];
  } catch (err) {
    if (err.message === 'token_expired') return; // already redirected
    // Server offline: seed demo data so UI is still usable
    allTickets = seedDemoData();
  }
  renderStats();
  renderTable();
  showLoading(false);
}

function normalise(t) {
  return {
    id:         t.id,
    reg_number: t.reg_number || '—',
    std_name:   t.std_name   || '—',
    std_email:  t.std_email  || '—',
    issue_type: t.issue_type || '—',
    status:     t.status     || 'open',
    created_at: t.created_at || null,
  };
}

// ── Stats ────────────────────────────────────────────────────
function renderStats() {
  const today   = new Date().toDateString();
  const total   = allTickets.length;
  const resolved = allTickets.filter(t => t.status === 'resolved').length;
  statTotal.textContent    = total;
  statOpen.textContent     = allTickets.filter(t => t.status === 'open').length;
  statResolved.textContent = resolved;
  statToday.textContent    = allTickets.filter(t => t.created_at && new Date(t.created_at).toDateString() === today).length;
  statRate.textContent     = total > 0 ? Math.round((resolved / total) * 100) + '%' : '—';
}

// ── Table ────────────────────────────────────────────────────
function renderTable() {
  let rows = [...allTickets];
  if (activeFilter !== 'all') rows = rows.filter(t => t.status === activeFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    rows = rows.filter(t =>
      t.reg_number.toLowerCase().includes(q) ||
      t.std_name.toLowerCase().includes(q)   ||
      t.issue_type.toLowerCase().includes(q)
    );
  }

  ticketsBody.innerHTML = '';

  if (rows.length === 0) {
    tableContainer.hidden = true;
    emptyState.hidden = false;
    return;
  }
  tableContainer.hidden = false;
  emptyState.hidden = true;

  rows.forEach((ticket, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${i * 0.03}s`;
    tr.innerHTML = `
      <td>${esc(ticket.reg_number)}</td>
      <td>${esc(ticket.std_name)}</td>
      <td>${truncate(esc(ticket.issue_type), 55)}</td>
      <td>${statusBadge(ticket.status)}</td>
      <td>${fmtDate(ticket.created_at)}</td>
      <td><button class="btn-row-view" data-id="${ticket.id}">View →</button></td>
    `;
    tr.addEventListener('click', e => { if (!e.target.classList.contains('btn-row-view')) openModal(ticket.id); });
    tr.querySelector('.btn-row-view').addEventListener('click', e => { e.stopPropagation(); openModal(ticket.id); });
    ticketsBody.appendChild(tr);
  });
}

/* ══════════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════════ */
function openModal(id) {
  const t = allTickets.find(t => t.id === id);
  if (!t) return;
  currentTicket = t;
  modalFeedback.textContent = '';
  modalFeedback.className   = 'modal-feedback';

  document.getElementById('modalHeading').textContent = `Ticket — ${t.reg_number}`;
  document.getElementById('modalSub').textContent     = `Submitted ${fmtDate(t.created_at)}`;
  document.getElementById('dId').textContent          = t.id;
  document.getElementById('dStatusBadge').innerHTML   = statusBadge(t.status);
  document.getElementById('dName').textContent        = t.std_name;
  document.getElementById('dReg').textContent         = t.reg_number;
  document.getElementById('dEmail').textContent       = t.std_email;
  document.getElementById('dDate').textContent        = fmtDate(t.created_at);
  document.getElementById('dIssue').textContent       = t.issue_type;

  const resolved = t.status === 'resolved';
  btnResolve.disabled          = resolved;
  btnNotifyResolved.disabled   = !resolved;

  modalBackdrop.hidden = false;
  modalBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  currentTicket = null;
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ══════════════════════════════════════════════════════════════
   ACTIONS  (all protected via apiFetch → auto-401 handling)
══════════════════════════════════════════════════════════════ */
async function postAction(action, btnEl, loadingText, restoreHTML) {
  if (!currentTicket) return;
  setActionLoading(btnEl, true, loadingText);
  try {
    const res  = await apiFetch(`${API}/tickets/actions`, {
      method: 'POST',
      body:   JSON.stringify({ ticket_id: currentTicket.id, action }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    if (err.message === 'token_expired') return { ok: false, expired: true };
    // Server offline — surface as demo
    return { ok: false, offline: true };
  } finally {
    restoreButton(btnEl, restoreHTML);
  }
}

// Send received notification
btnEmail.addEventListener('click', async () => {
  const result = await postAction('send_email', btnEmail, 'Sending…',
    `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2 7l8 5 8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
     Send Received Notification`
  );
  if (!result || result.expired) return;
  if (result.offline) {
    setFeedback('✓ Demo mode: received notification would be dispatched via Celery.', 'ok');
  } else if (result.ok) {
    setFeedback('✓ Acknowledgement notification queued for the student.', 'ok');
    showToast('Email Queued', 'Notification dispatched via Celery.', 'ok');
  } else {
    setFeedback('✕ ' + (result.data?.error || 'Failed to send notification.'), 'err');
  }
});

// Notify resolution
btnNotifyResolved.addEventListener('click', async () => {
  const result = await postAction('notify_resolved', btnNotifyResolved, 'Sending…',
    `<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
     Notify Resolution`
  );
  if (!result || result.expired) return;
  if (result.offline) {
    setFeedback('✓ Demo mode: resolution notification would be dispatched via Celery.', 'ok');
  } else if (result.ok) {
    setFeedback('✓ Resolution notification sent to the student.', 'ok');
    showToast('Notification Sent', `${currentTicket.std_name} has been notified.`, 'ok');
  } else {
    setFeedback('✕ ' + (result.data?.error || 'Failed to send resolution notification.'), 'err');
  }
});

// Mark as resolved
btnResolve.addEventListener('click', async () => {
  const result = await postAction('resolved', btnResolve, 'Resolving…',
    `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
     Mark as Resolved`
  );
  if (!result || result.expired) return;
  if (result.offline || result.ok) {
    patchTicketStatus(currentTicket.id, 'resolved');
    setFeedback('✓ Ticket has been marked as resolved.', 'ok');
    showToast('Ticket Resolved', `${currentTicket.std_name}'s ticket is now closed.`, 'ok');
  } else {
    setFeedback('✕ ' + (result.data?.error || 'Could not resolve ticket.'), 'err');
  }
});

function patchTicketStatus(id, status) {
  const idx = allTickets.findIndex(t => t.id === id);
  if (idx !== -1) allTickets[idx].status = status;
  if (currentTicket?.id === id) currentTicket.status = status;
  btnResolve.disabled        = true;
  btnNotifyResolved.disabled = false;
  renderStats();
  renderTable();
  document.getElementById('dStatusBadge').innerHTML = statusBadge(status);
}

function setActionLoading(btn, on, text) { btn.disabled = on; if (on) btn.textContent = text; }
function restoreButton(btn, html)        { btn.disabled = false; btn.innerHTML = html; }
function setFeedback(msg, type) {
  modalFeedback.textContent = msg;
  modalFeedback.className   = 'modal-feedback ' + (type === 'ok' ? 'feedback-ok' : 'feedback-err');
}

/* ══════════════════════════════════════════════════════════════
   FILTER / SEARCH / REFRESH
══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  });
});

searchInput?.addEventListener('input', () => { searchQuery = searchInput.value.trim(); renderTable(); });

refreshBtn?.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning');
  await loadTickets();
  refreshBtn.classList.remove('spinning');
  showToast('Refreshed', 'Ticket list is up to date.', 'ok');
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function showLoading(on) {
  loadingState.hidden = !on;
  if (on) { tableContainer.hidden = true; emptyState.hidden = true; }
}

function statusBadge(status) {
  const cls  = status === 'resolved' ? 'badge-resolved' : 'badge-open';
  const text = status === 'resolved' ? 'Resolved' : 'Open';
  return `<span class="badge ${cls}">${text}</span>`;
}

function fmtDate(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return String(dt); }
}

function truncate(str, max) { return str.length > max ? str.slice(0, max) + '…' : str; }

function esc(str) {
  return String(str ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(title, msg, type = 'ok') {
  toastTitle.textContent = title;
  toastMsg.textContent   = msg;
  const isOk = type === 'ok';
  toastIW.className = 'toast-icon-wrap ' + (isOk ? 'toast-icon-ok' : 'toast-icon-err');
  toastIW.innerHTML = isOk
    ? `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}
window.dismissToast = () => { toast.classList.remove('show'); clearTimeout(toastTimer); };

/* ══════════════════════════════════════════════════════════════
   DEMO SEED DATA (used when server is offline)
══════════════════════════════════════════════════════════════ */
function seedDemoData() {
  const students = [
    { name:'Amina Hassan',   reg:'GAU3/2024/0011', email:'amina.hassan@students.gau.ac.ke' },
    { name:'Mohamed Osman',  reg:'GAU/2023/0087', email:'mohamed.osman@students.gau.ac.ke' },
    { name:'Fatuma Ali',     reg:'GAU/2024/0203', email:'fatuma.ali@students.gau.ac.ke' },
    { name:'Ahmed Yusuf',    reg:'GAU/2022/0155', email:'ahmed.yusuf@students.gau.ac.ke' },
    { name:'Hodan Abdi',     reg:'GAU/2024/0319', email:'hodan.abdi@students.gau.ac.ke' },
    { name:'Safia Warsame',  reg:'GAU/2024/0502', email:'safia.warsame@students.gau.ac.ke' },
    { name:'Omar Farah',     reg:'GAU/2022/0099', email:'omar.farah@students.gau.ac.ke' },
    { name:'Nasra Ibrahim',  reg:'GAU/2024/0611', email:'nasra.ibrahim@students.gau.ac.ke' },
  ];
  const issues = [
    '[Network / Wi-Fi] Cannot connect to campus Wi-Fi in Block C.',
    '[Student Portal Access] Unable to log into student portal since Friday.',
    '[Email Account] Student email not receiving messages.',
    '[Hardware / Device] Lab computer in Room 204 keeps restarting.',
    '[Software / Application] Microsoft Office activation failing.',
    '[Printing] Library printer shows offline.',
    '[Password Reset] Portal password reset link expired.',
    '[Network / Wi-Fi] Wi-Fi disconnecting in Library reading room.',
  ];
  const now = Date.now();
  return students.map((s, i) => ({
    id:         `demo-${i}-${Math.random().toString(36).slice(2,9)}`,
    reg_number: s.reg,
    std_name:   s.name,
    std_email:  s.email,
    issue_type: issues[i],
    status:     i % 4 === 3 ? 'resolved' : 'open',
    created_at: new Date(now - i * 1000 * 60 * 60 * (i + 2)).toISOString(),
  }));
}
