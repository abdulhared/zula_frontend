/* ════════════════════════════════════════════════════
   GAU IMS — submit.js
   Handles: validation, POST /api/tickets, toast
   ════════════════════════════════════════════════════ */

'use strict';

const API = 'http://localhost:5000/api';

/* ── DOM refs ─────────────────────────────────────── */
const form        = document.getElementById('ticketForm');
const submitBtn   = document.getElementById('submitBtn');
const btnLabel    = submitBtn.querySelector('.btn-label');
const btnIcon     = submitBtn.querySelector('.btn-icon');
const btnSpinner  = submitBtn.querySelector('.btn-spinner');
const descField   = document.getElementById('issueDescription');
const charCount   = document.getElementById('charCount');
const toast       = document.getElementById('toast');
const toastTitle  = document.getElementById('toastTitle');
const toastMsg    = document.getElementById('toastMsg');
const toastIW     = document.getElementById('toastIconWrap');

/* ── Character counter ────────────────────────────── */
descField.addEventListener('input', () => {
  const n = descField.value.length;
  charCount.textContent = n;
  const lbl = document.querySelector('label[for="issueDescription"] .char-counter');
  if (lbl) {
    lbl.classList.toggle('warn', n > 400 && n <= 490);
    lbl.classList.toggle('over', n > 490);
  }
});

/* ── Field validation rules ───────────────────────── */
const rules = {
  stdName:          { test: v => v.trim().length >= 2,                          msg: 'Please enter your full name (at least 2 characters).' },
  regNumber:        { test: v => v.trim().length >= 4,                          msg: 'Please enter a valid registration number.' },
  stdEmail:         { test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: 'Please enter a valid email address.' },
  issueCategory:    { test: v => v !== '',                                      msg: 'Please select an issue category.' },
  issueDescription: { test: v => v.trim().length >= 15,                        msg: 'Please describe your issue in at least 15 characters.' },
};

function validateField(id) {
  const el  = document.getElementById(id);
  const err = document.getElementById('err-' + id);
  const rule = rules[id];
  if (!rule) return true;

  const valid = rule.test(el.value);
  el.classList.toggle('is-invalid', !valid);
  if (err) err.textContent = valid ? '' : rule.msg;
  return valid;
}

function validateAll() {
  return Object.keys(rules).map(validateField).every(Boolean);
}

// Clear errors on input
Object.keys(rules).forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      el.classList.remove('is-invalid');
      const err = document.getElementById('err-' + id);
      if (err) err.textContent = '';
    });
  }
});

/* ── Form submit ──────────────────────────────────── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!validateAll()) return;

  setLoading(true);

  // The backend expects: stdName, stdEmail, regNumber, issueDescription
  // We combine category + description into issueDescription (matching the model's issue_type field)
  const category = document.getElementById('issueCategory').value;
  const description = descField.value.trim();

  const payload = {
    stdName:          document.getElementById('stdName').value.trim(),
    stdEmail:         document.getElementById('stdEmail').value.trim(),
    regNumber:        document.getElementById('regNumber').value.trim(),
    issueDescription: `[${category}] ${description}`,
  };

  try {
    const res  = await fetch(`${API}/tickets`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      form.reset();
      charCount.textContent = '0';
      const shortId = (data.ticket_id || '').slice(0, 8).toUpperCase();
      showToast(
        'Ticket Submitted!',
        `Ticket #${shortId} has been logged. Check your student email for confirmation.`,
        'ok'
      );
    } else {
      showToast('Submission Failed', data.error || 'Something went wrong. Please try again.', 'err');
    }
  } catch {
    // No server running — demo feedback
    form.reset();
    charCount.textContent = '0';
    showToast(
      'Demo Mode',
      'Connect the Flask server to submit live tickets. Form data was valid!',
      'ok'
    );
  } finally {
    setLoading(false);
  }
});

/* ── Helpers ──────────────────────────────────────── */
function setLoading(on) {
  submitBtn.disabled = on;
  btnLabel.hidden    = on;
  btnIcon.hidden     = on;
  btnSpinner.hidden  = !on;
}

let toastTimer;

function showToast(title, msg, type = 'ok') {
  toastTitle.textContent = title;
  toastMsg.textContent   = msg;

  // Icon
  const isOk = type === 'ok';
  toastIW.className = 'toast-icon-wrap ' + (isOk ? 'toast-icon-ok' : 'toast-icon-err');
  toastIW.innerHTML = isOk
    ? `<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 6000);
}

window.dismissToast = () => {
  toast.classList.remove('show');
  clearTimeout(toastTimer);
};
