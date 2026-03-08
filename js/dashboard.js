/* ════════════════════════════════════════════════════
   GAU IMS — dashboard.js
   Handles:
     GET  /api/tickets/list
     POST /api/tickets/actions  { ticket_id, action }
       action: 'send_email' | 'resolved'
   ════════════════════════════════════════════════════ */

'use strict';

const API = 'http://localhost:5000/api';

/* ── State ────────────────────────────────────────── */
let allTickets   = [];
let activeFilter = 'all';
let searchQuery  = '';
let currentTicket = null;

/* ── DOM refs ─────────────────────────────────────── */
const loadingState  = document.getElementById('loadingState');
const emptyState    = document.getElementById('emptyState');
const tableContainer = document.getElementById('tableContainer');
const ticketsBody   = document.getElementById('ticketsBody');
const searchInput   = document.getElementById('searchInput');
const refreshBtn    = document.getElementById('refreshBtn');
const refreshIcon   = document.getElementById('refreshIcon');

// Stats
const statTotal    = document.getElementById('statTotal');
const statOpen     = document.getElementById('statOpen');
const statResolved = document.getElementById('statResolved');
const statToday    = document.getElementById('statToday');

// Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const btnEmail      = document.getElementById('btnEmail');
const btnResolve    = document.getElementById('btnResolve');
const modalFeedback = document.getElementById('modalFeedback');

// Toast
const toast     = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMsg   = document.getElementById('toastMsg');
const toastIW    = document.getElementById('toastIconWrap');

/* ── Initialise ───────────────────────────────────── */
loadTickets();

/* ── Load tickets from API ────────────────────────── */
async function loadTickets() {
  showLoading(true);

  try {
    const res  = await fetch(`${API}/tickets/list`);
    if (!res.ok) throw new Error('API error');
    const raw  = await res.json();

    // API returns: { id, reg_number, issue_type, created_at }
    // We adapt to also carry std_name / std_email if present
    allTickets = Array.isArray(raw) ? raw.map(t => ({
      id:          t.id,
      reg_number:  t.reg_number || '—',
      std_name:    t.std_name   || '—',
      std_email:   t.std_email  || '—',
      issue_type:  t.issue_type || '—',
      status:      t.status     || 'open',
      created_at:  t.created_at || null,
    })) : [];
  } catch {
    // Demo mode — seed realistic fake data
    allTickets = seedDemoData();
  }

  renderStats();
  renderTable();
  showLoading(false);
}

/* ── Render stats ─────────────────────────────────── */
function renderStats() {
  const today = new Date().toDateString();
  const todayCount = allTickets.filter(t => t.created_at && new Date(t.created_at).toDateString() === today).length;

  statTotal.textContent    = allTickets.length;
  statOpen.textContent     = allTickets.filter(t => t.status === 'open').length;
  statResolved.textContent = allTickets.filter(t => t.status === 'resolved').length;
  statToday.textContent    = todayCount;
}

/* ── Render table ─────────────────────────────────── */
function renderTable() {
  let rows = [...allTickets];

  if (activeFilter !== 'all') {
    rows = rows.filter(t => t.status === activeFilter);
  }

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

    // Click anywhere on row to open modal
    tr.addEventListener('click', e => {
      if (!e.target.classList.contains('btn-row-view')) openModal(ticket.id);
    });
    tr.querySelector('.btn-row-view').addEventListener('click', e => {
      e.stopPropagation();
      openModal(ticket.id);
    });

    ticketsBody.appendChild(tr);
  });
}

/* ── Modal ────────────────────────────────────────── */
function openModal(id) {
  const t = allTickets.find(t => t.id === id);
  if (!t) return;
  currentTicket = t;
  modalFeedback.textContent = '';
  modalFeedback.className = 'modal-feedback';

  document.getElementById('modalHeading').textContent = `Ticket — ${t.reg_number}`;
  document.getElementById('modalSub').textContent     = `Submitted ${fmtDate(t.created_at)}`;
  document.getElementById('dId').textContent          = t.id;
  document.getElementById('dStatusBadge').innerHTML   = statusBadge(t.status);
  document.getElementById('dName').textContent        = t.std_name;
  document.getElementById('dReg').textContent         = t.reg_number;
  document.getElementById('dEmail').textContent       = t.std_email;
  document.getElementById('dDate').textContent        = fmtDate(t.created_at);
  document.getElementById('dIssue').textContent       = t.issue_type;

  btnResolve.disabled = t.status === 'resolved';

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

/* ── Actions ──────────────────────────────────────── */
btnEmail.addEventListener('click', async () => {
  if (!currentTicket) return;
  setActionLoading(btnEmail, true, 'Sending…');

  try {
    const res  = await fetch(`${API}/tickets/actions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticket_id: currentTicket.id, action: 'send_email' }),
    });
    const data = await res.json();

    if (res.ok) {
      setFeedback('✓ Email notification queued and will be sent to the student.', 'ok');
      showToast('Email Sent', 'Notification dispatched via Celery.', 'ok');
    } else {
      setFeedback('✕ ' + (data.error || 'Failed to send notification.'), 'err');
    }
  } catch {
    setFeedback('✓ Demo mode: email task would be dispatched to Celery worker.', 'ok');
  } finally {
    setActionLoading(btnEmail, false, null, `
      <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M2 7l8 5 8-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Send Email Notification
    `);
  }
});

btnResolve.addEventListener('click', async () => {
  if (!currentTicket) return;
  setActionLoading(btnResolve, true, 'Resolving…');

  try {
    const res  = await fetch(`${API}/tickets/actions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticket_id: currentTicket.id, action: 'resolved' }),
    });
    const data = await res.json();

    if (res.ok) {
      patchTicketStatus(currentTicket.id, 'resolved');
      setFeedback('✓ Ticket has been marked as resolved.', 'ok');
      showToast('Ticket Resolved', `Ticket for ${currentTicket.std_name} is now closed.`, 'ok');
    } else {
      setFeedback('✕ ' + (data.error || 'Could not resolve ticket.'), 'err');
      setActionLoading(btnResolve, false, null, restoreResolveLabel());
    }
  } catch {
    // Demo mode
    patchTicketStatus(currentTicket.id, 'resolved');
    setFeedback('✓ Demo mode: ticket marked as resolved.', 'ok');
    showToast('Ticket Resolved', `Demo: ${currentTicket.std_name}'s ticket closed.`, 'ok');
  }
});

function patchTicketStatus(id, status) {
  const idx = allTickets.findIndex(t => t.id === id);
  if (idx !== -1) allTickets[idx].status = status;
  if (currentTicket && currentTicket.id === id) currentTicket.status = status;
  btnResolve.disabled = true;
  renderStats();
  renderTable();
  document.getElementById('dStatusBadge').innerHTML = statusBadge(status);
}

function restoreResolveLabel() {
  return `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Mark as Resolved`;
}

function setActionLoading(btn, on, loadingText, restoreHTML) {
  btn.disabled = on;
  if (on && loadingText) btn.textContent = loadingText;
  if (!on && restoreHTML) btn.innerHTML = restoreHTML;
}

function setFeedback(msg, type) {
  modalFeedback.textContent = msg;
  modalFeedback.className = 'modal-feedback ' + (type === 'ok' ? 'feedback-ok' : 'feedback-err');
}

/* ── Filters & search ─────────────────────────────── */
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTable();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderTable();
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.classList.add('spinning');
  await loadTickets();
  refreshBtn.classList.remove('spinning');
  showToast('Refreshed', 'Ticket list is up to date.', 'ok');
});

/* ── UI state helpers ─────────────────────────────── */
function showLoading(on) {
  loadingState.hidden  = !on;
  if (on) {
    tableContainer.hidden = true;
    emptyState.hidden     = true;
  }
}

/* ── Utility helpers ──────────────────────────────── */
function statusBadge(status) {
  const cls  = status === 'resolved' ? 'badge-resolved' : 'badge-open';
  const text = status === 'resolved' ? 'Resolved' : 'Open';
  return `<span class="badge ${cls}">${text}</span>`;
}

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(dt); }
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function esc(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Toast ────────────────────────────────────────── */
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

window.dismissToast = () => {
  toast.classList.remove('show');
  clearTimeout(toastTimer);
};

/* ── Demo data seed ───────────────────────────────── */
function seedDemoData() {
  const students = [
    { name: 'Amina Hassan',     reg: 'GAU/2024/0011', email: 'amina.hassan@students.gau.ac.ke' },
    { name: 'Mohamed Osman',    reg: 'GAU/2023/0087', email: 'mohamed.osman@students.gau.ac.ke' },
    { name: 'Fatuma Ali',       reg: 'GAU/2024/0203', email: 'fatuma.ali@students.gau.ac.ke' },
    { name: 'Ahmed Yusuf',      reg: 'GAU/2022/0155', email: 'ahmed.yusuf@students.gau.ac.ke' },
    { name: 'Hodan Abdi',       reg: 'GAU/2024/0319', email: 'hodan.abdi@students.gau.ac.ke' },
    { name: 'Abdirahman Nur',   reg: 'GAU/2023/0044', email: 'abdirahman.nur@students.gau.ac.ke' },
    { name: 'Safia Warsame',    reg: 'GAU/2024/0502', email: 'safia.warsame@students.gau.ac.ke' },
    { name: 'Omar Farah',       reg: 'GAU/2022/0099', email: 'omar.farah@students.gau.ac.ke' },
    { name: 'Nasra Ibrahim',    reg: 'GAU/2024/0611', email: 'nasra.ibrahim@students.gau.ac.ke' },
    { name: 'Yahya Hassan',     reg: 'GAU/2023/0278', email: 'yahya.hassan@students.gau.ac.ke' },
  ];

  const issues = [
    '[Network / Wi-Fi] Cannot connect to campus Wi-Fi in Block C. Error says "authentication failed" even with correct password.',
    '[Student Portal Access] Unable to log into student portal since Friday. Password reset link sends no email.',
    '[Email Account] My student email is not receiving any messages. Last received on Monday morning.',
    '[Hardware / Device] Computer in Lab Room 204 keeps restarting every 10–15 minutes during use.',
    '[Software / Application] Microsoft Office activation failing on my laptop. Shows "product not found" error.',
    '[Printing] Library printer shows offline in the print queue even though it appears powered on.',
    '[Password Reset] Forgot portal password. Reset link expired before I could use it.',
    '[Network / Wi-Fi] Wi-Fi disconnects every few minutes in the Library reading room only.',
    '[Student Portal Access] Cannot view my exam timetable — portal loads but the timetable section is blank.',
    '[Email Account] Sent a large file and got a bounce-back saying mailbox storage exceeded.',
  ];

  const now = Date.now();
  return students.map((s, i) => ({
    id:          `demo-${i}-${Math.random().toString(36).slice(2, 9)}`,
    reg_number:  s.reg,
    std_name:    s.name,
    std_email:   s.email,
    issue_type:  issues[i],
    status:      i % 4 === 3 ? 'resolved' : 'open',
    created_at:  new Date(now - i * 1000 * 60 * 60 * (i + 2)).toISOString(),
  }));
}
