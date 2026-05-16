/* ============================================================
   THE LEGACY CODE JOURNAL — app.js
   Vanilla JS + Supabase v2
   ============================================================ */

'use strict';

// ── Pre-configured Supabase credentials ─────────────────────
// These are baked in so users go straight to login.
localStorage.setItem('sb_url', 'https://umreguyhensnwqafpukv.supabase.co');
localStorage.setItem('sb_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcmVndXloZW5zbndxYWZwdWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTIxNDgsImV4cCI6MjA4OTg4ODE0OH0.F1-5mDb3MeUCj8_U5dl5fEU-996lqZd9Pwc0S-QIfV8');

// ── Constants ────────────────────────────────────────────────
const AFFIRMATION_EXAMPLES = [
  { code: 'LIBERATE', text: 'I release every limitation that held me back, and I move freely toward the abundant life I deserve.' },
  { code: 'EMBODY',   text: 'I own every chapter of my story, and I show up fully as the powerful, capable person I am.' },
  { code: 'GENERATE', text: 'I am a creator — and every day, I generate wealth, opportunity, and impact through my work and my vision.' },
  { code: 'AWAKEN',   text: 'I am awake to the extraordinary opportunities surrounding me, and I act on them with confidence and clarity.' },
  { code: 'CLAIM',    text: 'I claim my worth without apology — I attract clients, partners, and abundance because I know exactly what I bring to the table.' },
  { code: 'YIELD',    text: 'The seeds I have planted are bearing fruit — income, relationships, and opportunities flow to me with ease.' },
  { code: 'CULTIVATE', text: 'I cultivate meaningful connections every single day, and my network is a powerful engine for my success.' },
  { code: 'OWN',      text: 'I own my space in this industry — people seek me out because of the value, expertise, and energy I bring.' },
  { code: 'DECLARE',  text: 'I declare that I am building a legacy that impacts lives and generates abundance every month — and I am already on my way.' },
  { code: 'ELEVATE',  text: 'As I rise, I lift others with me — and the more I give, the more abundance returns to me tenfold.' },
];

const MANTRAS = [
  { code: 'LIBERATE',  letter: 'L', color: '#f0b429', text: 'I release what was never mine to carry, and I step forward unburdened into the life I was always meant to live.' },
  { code: 'EMBODY',    letter: 'E', color: '#f0b429', text: 'I inhabit every chapter of my story — light and shadow alike — because my wholeness is my power.' },
  { code: 'GENERATE',  letter: 'G', color: '#f0b429', text: 'I am a creator by nature, and every thought, word, and action is building the extraordinary life I choose.' },
  { code: 'AWAKEN',    letter: 'A', color: '#f0b429', text: 'I open my eyes to the new beginnings already emerging from everything I have lived, and I am ready.' },
  { code: 'CLAIM',     letter: 'C', color: '#f0b429', text: 'I am the treasure I have been seeking — and today I stop asking for permission to be everything I already am.' },
  { code: 'YIELD',     letter: 'Y', color: '#f0b429', text: 'I open my hands and receive the harvest of every seed my courage, faith, and resilience have planted.' },
  { code: 'CULTIVATE', letter: 'C', color: '#7c3aed', text: 'I grow what matters with intention — my circle, my craft, and my character — and I trust that what I tend with devotion will flourish.' },
  { code: 'OWN',       letter: 'O', color: '#7c3aed', text: 'I own my story, my power, and my space completely — no apology, no permission, no shrinking.' },
  { code: 'DECLARE',   letter: 'D', color: '#7c3aed', text: 'I speak my vision into existence out loud and without hesitation, because my words are not wishes — they are blueprints.' },
  { code: 'ELEVATE',   letter: 'E', color: '#7c3aed', text: 'As I rise, I reach back to lift others, because legacy is not how high I climb — it\'s how many I bring with me.' },
];

// ── State ────────────────────────────────────────────────────
const state = {
  supabase: null,
  user: null,
  profile: null,
  journal: null,          // current 30-day cycle
  weeklyEntries: {},      // { weekNum: entryObject }
  dailyEntries: {},       // { dayNum: entryObject }
  contacts: [],
  currentView: 'dashboard',
  currentDay: 1,
  currentWeek: 1,
  pendingPhotos: [],      // local File objects waiting to upload
  photoUrls: [],          // confirmed URLs for current day
  saveTimer: null,
  wellnessScores: { food: null, exercise: null, journal: null, meditation: null },
};

// ── Supabase Init ────────────────────────────────────────────
function initSupabase() {
  const url = localStorage.getItem('sb_url');
  const key = localStorage.getItem('sb_key');
  if (!url || !key) return false;
  try {
    state.supabase = supabase.createClient(url, key);
    return true;
  } catch (e) {
    return false;
  }
}

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  const ready = initSupabase();
  if (!ready) {
    showView('setup');
    return;
  }

  // Listen for auth changes FIRST — catches PASSWORD_RECOVERY before getSession
  state.supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Store the recovery session so updateUser() works
      state.recoverySession = session;
      showView('auth');
      showPasswordResetForm();
      return;
    }
    // INITIAL_SESSION fires in Supabase v2 for returning users; SIGNED_IN fires on fresh login
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !state.user) {
      await onSignedIn(session.user);
      return;
    }
    // Only redirect to auth if the user was previously loaded — prevents firing during initial boot
    if (event === 'SIGNED_OUT' && state.user) {
      state.user = null;
      showView('auth');
    }
  });

  // Check for recovery token in URL hash (handles direct page load from reset link)
  if (window.location.hash.includes('type=recovery')) {
    showView('auth');
    showPasswordResetForm();
    return;
  }

  // Show success message if coming back from a password reset
  if (localStorage.getItem('pw_reset_success')) {
    localStorage.removeItem('pw_reset_success');
    showView('auth');
    const err = document.getElementById('auth-error');
    err.textContent = '✓ Password updated! Sign in with your new password.';
    err.style.background = 'rgba(16,185,129,0.15)';
    err.style.borderColor = 'rgba(16,185,129,0.3)';
    err.style.color = '#6ee7b7';
    err.classList.remove('hidden');
  }

  // Check existing session — guard with !state.user to avoid double-call if INITIAL_SESSION
  // already fired in onAuthStateChange above
  const { data: { session } } = await state.supabase.auth.getSession();
  if (!session) {
    if (!state.user) showView('auth');
    return;
  }

  if (!state.user) await onSignedIn(session.user);
}

async function onSignedIn(user) {
  if (state.user) return; // re-entrancy guard — prevents double-call from INITIAL_SESSION + getSession()
  try {
    state.user = user;
    // Hide auth/setup with inline styles (beat any CSS rule)
    const authEl = document.getElementById('view-auth');
    const setupEl = document.getElementById('view-setup');
    if (authEl)  { authEl.style.display  = 'none'; authEl.classList.remove('active'); }
    if (setupEl) { setupEl.style.display = 'none'; setupEl.classList.remove('active'); }
    // Show app shell
    const shell = document.getElementById('app-shell');
    if (shell) { shell.style.display = ''; shell.classList.remove('hidden'); }

    await loadProfile();
    await loadOrCreateJournal();

    renderMantras();
    renderAffirmationExamples();
    renderDayStrip();
    renderWeeklyGoalRows();
    renderDailyGoalRows();
    renderWellnessScores();
    populateSettingsForm();
    setCurrentDayFromDate();

    // Show intro on first sign-in of each session; after that go straight to dashboard
    const seenIntro = sessionStorage.getItem('intro_seen');
    sessionStorage.setItem('intro_seen', '1');
    navigate(seenIntro ? 'dashboard' : 'intro');
  } catch (err) {
    console.error('Sign-in error:', err);
    document.getElementById('app-shell').classList.remove('hidden');
    navigate('dashboard');
  }
}

// ── Config Save ──────────────────────────────────────────────
function saveConfig() {
  const url = document.getElementById('cfg-url').value.trim();
  const key = document.getElementById('cfg-key').value.trim();
  const err = document.getElementById('cfg-error');

  if (!url || !key) { showEl(err, 'Please enter both your Supabase URL and anon key.'); return; }
  if (!url.includes('supabase.co')) { showEl(err, 'URL should be your Supabase project URL (*.supabase.co)'); return; }

  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  hideEl(err);

  const ok = initSupabase();
  if (!ok) { showEl(err, 'Could not connect. Check your credentials.'); return; }

  showView('auth');
}

// ── Auth ─────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'signup'));
  });
  toggleEl('auth-login', tab === 'login');
  toggleEl('auth-signup', tab === 'signup');
  hideEl(document.getElementById('auth-error'));
}

async function signIn() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('auth-error');
  const btn   = document.querySelector('#auth-login .btn-primary');
  hideEl(err);

  if (!email || !pass) { showEl(err, 'Please enter your email and password.'); return; }

  // Show loading state immediately
  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }

  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password: pass });

  if (error) {
    if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
    showEl(err, error.message);
    return;
  }

  // Show success message briefly, then reload the page.
  // Supabase has already stored the session in localStorage.
  // On fresh page load, boot() detects the session and opens the app directly —
  // the auth screen never appears at all. This is the most reliable approach.
  err.textContent = '✓ Signed in! Opening your journal…';
  err.style.background = 'rgba(16,185,129,0.15)';
  err.style.borderColor = 'rgba(16,185,129,0.3)';
  err.style.color = '#6ee7b7';
  err.classList.remove('hidden');

  setTimeout(() => window.location.reload(), 700);
}

async function signUp() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-pass').value;
  const err   = document.getElementById('auth-error');
  hideEl(err);

  if (!name || !email || !pass) { showEl(err, 'Please fill in all fields.'); return; }
  if (pass.length < 8) { showEl(err, 'Password must be at least 8 characters.'); return; }

  const { error } = await state.supabase.auth.signUp({
    email, password: pass,
    options: { data: { display_name: name } }
  });
  if (error) { showEl(err, error.message); return; }
  showEl(err, '✓ Account created! Check your email to confirm, then sign in.');
  err.style.background = 'rgba(16,185,129,0.15)';
  err.style.borderColor = 'rgba(16,185,129,0.3)';
  err.style.color = '#6ee7b7';
}

function showPasswordResetForm() {
  // Hide all auth panels, show only the reset form
  const panels = ['auth-login', 'auth-signup', 'auth-forgot'];
  panels.forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('auth-reset').classList.remove('hidden');
  // Hide the tabs — not relevant during reset
  document.querySelector('.auth-tabs').style.display = 'none';
  document.getElementById('auth-hero') && (document.getElementById('auth-hero').querySelector('p').textContent = 'Set your new password below.');
}

async function updatePassword() {
  const pass  = document.getElementById('reset-pass').value;
  const pass2 = document.getElementById('reset-pass2').value;
  const msgEl = document.getElementById('reset-msg');
  msgEl.classList.add('hidden');

  if (!pass || pass.length < 8) {
    msgEl.textContent = 'Password must be at least 8 characters.';
    msgEl.style.background = 'rgba(239,68,68,0.15)';
    msgEl.style.color = '#fca5a5';
    msgEl.style.border = '1px solid rgba(239,68,68,0.3)';
    msgEl.classList.remove('hidden');
    return;
  }
  if (pass !== pass2) {
    msgEl.textContent = 'Passwords do not match.';
    msgEl.style.background = 'rgba(239,68,68,0.15)';
    msgEl.style.color = '#fca5a5';
    msgEl.style.border = '1px solid rgba(239,68,68,0.3)';
    msgEl.classList.remove('hidden');
    return;
  }

  const { error } = await state.supabase.auth.updateUser({ password: pass });
  if (error) {
    msgEl.textContent = error.message;
    msgEl.style.background = 'rgba(239,68,68,0.15)';
    msgEl.style.color = '#fca5a5';
    msgEl.style.border = '1px solid rgba(239,68,68,0.3)';
    msgEl.classList.remove('hidden');
    return;
  }

  // Success — store a flag and reload cleanly to the sign-in page
  msgEl.textContent = '✓ Password updated! Taking you to sign in…';
  msgEl.style.background = 'rgba(16,185,129,0.15)';
  msgEl.style.color = '#6ee7b7';
  msgEl.style.border = '1px solid rgba(16,185,129,0.3)';
  msgEl.classList.remove('hidden');
  await state.supabase.auth.signOut();
  localStorage.setItem('pw_reset_success', '1');
  setTimeout(() => {
    window.location.href = window.location.origin;
  }, 1500);
}

function showForgotPassword(show = true) {
  const loginForm   = document.getElementById('auth-login');
  const forgotForm  = document.getElementById('auth-forgot');
  const errorEl     = document.getElementById('auth-error');
  const forgotMsg   = document.getElementById('forgot-msg');
  hideEl(errorEl);
  hideEl(forgotMsg);
  if (show) {
    hideEl(loginForm);
    showEl(forgotForm);
    // Pre-fill email if already typed
    const email = document.getElementById('login-email').value.trim();
    if (email) document.getElementById('forgot-email').value = email;
  } else {
    showEl(loginForm);
    hideEl(forgotForm);
  }
}

async function sendPasswordReset() {
  const email   = document.getElementById('forgot-email').value.trim();
  const msgEl   = document.getElementById('forgot-msg');
  msgEl.classList.add('hidden');

  if (!email) {
    msgEl.textContent = 'Please enter your email address.';
    msgEl.style.background = 'rgba(239,68,68,0.15)';
    msgEl.style.color = '#fca5a5';
    msgEl.style.border = '1px solid rgba(239,68,68,0.3)';
    msgEl.classList.remove('hidden');
    return;
  }

  const { error } = await state.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin   // Supabase appends #access_token=...&type=recovery
  });

  if (error) {
    msgEl.textContent = error.message;
    msgEl.style.background = 'rgba(239,68,68,0.15)';
    msgEl.style.color = '#fca5a5';
    msgEl.style.border = '1px solid rgba(239,68,68,0.3)';
  } else {
    msgEl.textContent = '✓ Reset link sent! Check your email inbox.';
    msgEl.style.background = 'rgba(16,185,129,0.15)';
    msgEl.style.color = '#6ee7b7';
    msgEl.style.border = '1px solid rgba(16,185,129,0.3)';
  }
  msgEl.classList.remove('hidden');
}

async function signOut() {
  await state.supabase.auth.signOut();
  // Reload the page — clean slate, Supabase session is cleared, auth screen will appear
  window.location.reload();
}

// ── Profile ──────────────────────────────────────────────────
async function loadProfile() {
  const { data } = await state.supabase
    .from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  state.profile = data || {};
  if (state.profile.anthropic_key) localStorage.setItem('anthropic_key', state.profile.anthropic_key);
}

async function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  const { error } = await state.supabase
    .from('profiles').upsert({ id: state.user.id, display_name: name });
  if (error) { toast('Error saving profile', 'error'); return; }
  state.profile.display_name = name;
  toast('Profile saved ✓', 'success');
}

async function saveApiKey() {
  const key = document.getElementById('settings-apikey').value.trim();
  localStorage.setItem('anthropic_key', key);
  // Optionally save to Supabase profile (encrypted in prod; plain for MVP)
  await state.supabase.from('profiles').upsert({ id: state.user.id, anthropic_key: key });
  toast('API key saved ✓', 'success');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('settings-apikey');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function populateSettingsForm() {
  document.getElementById('settings-email').value = state.user?.email || '';
  document.getElementById('settings-name').value = state.profile?.display_name || '';
  document.getElementById('settings-apikey').value = localStorage.getItem('anthropic_key') || '';
}

// ── Journal (30-day cycle) ───────────────────────────────────
async function loadOrCreateJournal() {
  // Use maybeSingle() instead of single() — returns null instead of error when no rows
  const { data, error } = await state.supabase
    .from('journals')
    .select('*')
    .eq('user_id', state.user.id)
    .order('cycle_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    state.journal = data;
  } else {
    // First-time user — create their first journal cycle
    const { data: newJ, error: insertError } = await state.supabase
      .from('journals')
      .insert({ user_id: state.user.id, cycle_number: 1 })
      .select().single();
    if (insertError) { console.error('Journal create error:', insertError); state.journal = { id: null, cycle_number: 1 }; return; }
    state.journal = newJ;
  }

  // Load all entries for this journal
  if (state.journal) {
    await Promise.all([
      loadWeeklyEntries(),
      loadDailyEntries(),
      loadContacts(),
    ]);
  }
}

async function loadWeeklyEntries() {
  const { data } = await state.supabase
    .from('weekly_entries')
    .select('*')
    .eq('journal_id', state.journal.id);
  state.weeklyEntries = {};
  (data || []).forEach(e => { state.weeklyEntries[e.week_number] = e; });
}

async function loadDailyEntries() {
  const { data } = await state.supabase
    .from('daily_entries')
    .select('*')
    .eq('journal_id', state.journal.id);
  state.dailyEntries = {};
  (data || []).forEach(e => { state.dailyEntries[e.day_number] = e; });
}

async function loadContacts() {
  const { data } = await state.supabase
    .from('contacts')
    .select('*')
    .eq('journal_id', state.journal.id)
    .order('sort_order');
  state.contacts = data || [];
}

async function newCycle() {
  if (!confirm('Start a new 30-day cycle? Your existing journal entries will be preserved.')) return;
  const nextNum = (state.journal?.cycle_number || 0) + 1;
  const { data } = await state.supabase
    .from('journals')
    .insert({ user_id: state.user.id, cycle_number: nextNum })
    .select().single();
  state.journal = data;
  state.weeklyEntries = {};
  state.dailyEntries = {};
  state.contacts = [];
  clearPlanningForm();
  renderDayStrip();
  navigate('planning');
  toast('New cycle started! Set your 30-day plan.', 'success');
}

// ── Planning (30-day) ────────────────────────────────────────
function populatePlanningForm() {
  if (!state.journal) return;
  const j = state.journal;
  setValue('plan-name', j.owner_name);
  setValue('plan-start', j.start_date);
  setValue('plan-end', j.end_date);
  setValue('plan-goals', j.goals);
  setValue('plan-bhag', j.bhag);
  setValue('plan-affirmation', j.affirmation);
  setValue('plan-actions', j.action_plan);
  setValue('plan-gremlins', j.gremlins);
}

function clearPlanningForm() {
  ['plan-name','plan-start','plan-end','plan-goals','plan-bhag','plan-affirmation','plan-actions','plan-gremlins']
    .forEach(id => setValue(id, ''));
}

async function savePlanning() {
  if (!state.journal) return;
  const updates = {
    owner_name:   getValue('plan-name'),
    start_date:   getValue('plan-start') || null,
    end_date:     getValue('plan-end') || null,
    goals:        getValue('plan-goals'),
    bhag:         getValue('plan-bhag'),
    affirmation:  getValue('plan-affirmation'),
    action_plan:  getValue('plan-actions'),
    gremlins:     getValue('plan-gremlins'),
  };
  const { error } = await state.supabase
    .from('journals').update(updates).eq('id', state.journal.id);
  if (error) { toast('Error saving — please try again', 'error'); return; }
  Object.assign(state.journal, updates);
  setCurrentDayFromDate();
  renderDayStrip();
  updateDashboard();
  toast('Plan saved ✓', 'success');
}

function renderAffirmationExamples() {
  const container = document.getElementById('affirmation-examples');
  if (!container) return;
  container.innerHTML = AFFIRMATION_EXAMPLES.map(a => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:var(--bg-base);border-radius:6px;cursor:pointer;"
         onclick="document.getElementById('plan-affirmation').value = '${a.text.replace(/'/g, "\\'")}'; toast('Affirmation selected ✓', 'success');">
      <span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);white-space:nowrap;padding-top:2px;">${a.code}</span>
      <span style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;font-style:italic;">"${a.text}"</span>
    </div>
  `).join('');
}

// ── Contacts (Peopling) ──────────────────────────────────────
function renderContacts() {
  const list = document.getElementById('contacts-list');
  if (!list) return;
  if (!state.contacts.length) {
    list.innerHTML = `<div class="muted" style="padding:8px;font-size:0.875rem;">No contacts yet. Add your first connection below.</div>`;
    return;
  }
  list.innerHTML = state.contacts.map((c, i) => `
    <div class="contact-row" data-idx="${i}">
      <button class="called-btn ${c.called ? 'called' : ''}" onclick="toggleCalled(${i})" title="Mark as called">📞</button>
      <input type="text" placeholder="Name" value="${esc(c.name)}" oninput="state.contacts[${i}].name=this.value">
      <input type="text" class="contact-role" placeholder="Role / relationship" value="${esc(c.role||'')}" oninput="state.contacts[${i}].role=this.value">
      <button onclick="removeContact(${i})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem;padding:4px;" title="Remove">✕</button>
    </div>
  `).join('');
}

function addContact() {
  state.contacts.push({ id: crypto.randomUUID(), name: '', role: '', notes: '', called: false, sort_order: state.contacts.length });
  renderContacts();
  // Focus last name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.contact-row input[type="text"]');
    if (inputs.length) inputs[inputs.length - 2]?.focus();
  }, 50);
}

function removeContact(idx) {
  state.contacts.splice(idx, 1);
  renderContacts();
}

function toggleCalled(idx) {
  state.contacts[idx].called = !state.contacts[idx].called;
  renderContacts();
}

async function saveContacts() {
  if (!state.journal) return;
  const records = state.contacts
    .filter(c => c.name.trim())
    .map((c, i) => ({
      journal_id: state.journal.id,
      user_id: state.user.id,
      name: c.name,
      role: c.role || '',
      notes: c.notes || '',
      called: c.called,
      sort_order: i,
    }));

  // Delete existing and re-insert
  await state.supabase.from('contacts').delete().eq('journal_id', state.journal.id);
  if (records.length) await state.supabase.from('contacts').insert(records);

  await loadContacts();
  updateDashboard();
  toast('Contacts saved ✓', 'success');
}

// ── Weekly ───────────────────────────────────────────────────
function renderWeeklyGoalRows() {
  const container = document.getElementById('weekly-goals-rows');
  if (!container) return;
  container.innerHTML = Array.from({length: 10}, (_, i) => `
    <div class="goal-row">
      <span class="row-num">${i+1}</span>
      <input type="text" class="wk-goal" data-idx="${i}" placeholder="Day / Goal">
      <input type="text" class="wk-task" data-idx="${i}" placeholder="Associated Task">
      <div class="check-done" data-idx="${i}" onclick="toggleWeeklyGoalDone(this, ${i})">☐</div>
    </div>
  `).join('');

  const oppContainer = document.getElementById('weekly-opp-rows');
  if (!oppContainer) return;
  oppContainer.innerHTML = Array.from({length: 6}, (_, i) => `
    <div class="opp-row">
      <span class="row-num">${i+1}.</span>
      <input type="text" class="wk-opp" data-idx="${i}" placeholder="Opportunity or task that appeared...">
    </div>
  `).join('');
}

function toggleWeeklyGoalDone(el, idx) {
  el.classList.toggle('done');
  el.textContent = el.classList.contains('done') ? '✓' : '☐';
}

function populateWeeklyForm(weekNum) {
  const entry = state.weeklyEntries[weekNum] || {};
  const goals = entry.schedule_goals || [];
  const opps  = entry.surprise_opportunities || [];

  document.querySelectorAll('.wk-goal').forEach((inp, i) => {
    inp.value = goals[i]?.goal || '';
  });
  document.querySelectorAll('.wk-task').forEach((inp, i) => {
    inp.value = goals[i]?.task || '';
  });
  document.querySelectorAll('.check-done[data-idx]').forEach((el, i) => {
    const done = goals[i]?.done || false;
    el.classList.toggle('done', done);
    el.textContent = done ? '✓' : '☐';
  });
  document.querySelectorAll('.wk-opp').forEach((inp, i) => {
    inp.value = opps[i] || '';
  });
  setValue('wk-exp-income',   entry.expected_income   || '');
  setValue('wk-unexp-income', entry.unexpected_income || '');
  setValue('wk-exp-exp',      entry.expected_expenses  || '');
  setValue('wk-unexp-exp',    entry.unexpected_expenses || '');
  setValue('wk-unexp-good',   entry.unexpected_good    || '');
  setValue('wk-notes',        entry.notes              || '');
}

function switchWeek(num) {
  state.currentWeek = num;
  document.querySelectorAll('.week-tab').forEach((t, i) => t.classList.toggle('active', i + 1 === num));
  document.getElementById('weekly-title-num').textContent = num;
  updateWeekDatesLabel(num);
  populateWeeklyForm(num);
}

function updateWeekDatesLabel(weekNum) {
  const el = document.getElementById('weekly-dates-label');
  if (!el || !state.journal?.start_date) { if (el) el.textContent = ''; return; }
  const start = new Date(state.journal.start_date + 'T00:00:00');
  const wStart = new Date(start); wStart.setDate(start.getDate() + (weekNum - 1) * 7);
  const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
  el.textContent = `${fmtDate(wStart)} – ${fmtDate(wEnd)}`;
}

async function saveWeekly() {
  if (!state.journal) { toast('Set up your 30-day plan first', 'error'); return; }
  const weekNum = state.currentWeek;

  const schedule_goals = Array.from({length: 10}, (_, i) => ({
    goal: document.querySelectorAll('.wk-goal')[i]?.value || '',
    task: document.querySelectorAll('.wk-task')[i]?.value || '',
    done: document.querySelectorAll('.check-done[data-idx]')[i]?.classList.contains('done') || false,
  }));
  const surprise_opportunities = Array.from({length: 6}, (_, i) =>
    document.querySelectorAll('.wk-opp')[i]?.value || ''
  );

  const record = {
    journal_id: state.journal.id,
    user_id: state.user.id,
    week_number: weekNum,
    schedule_goals,
    surprise_opportunities,
    expected_income:   getValue('wk-exp-income'),
    unexpected_income: getValue('wk-unexp-income'),
    expected_expenses: getValue('wk-exp-exp'),
    unexpected_expenses: getValue('wk-unexp-exp'),
    unexpected_good:   getValue('wk-unexp-good'),
    notes:             getValue('wk-notes'),
  };

  const existing = state.weeklyEntries[weekNum];
  let error;
  if (existing) {
    ({ error } = await state.supabase.from('weekly_entries').update(record).eq('id', existing.id));
  } else {
    const { data, error: e } = await state.supabase.from('weekly_entries').insert(record).select().single();
    error = e;
    if (data) state.weeklyEntries[weekNum] = data;
  }
  if (error) { toast('Error saving — please try again', 'error'); return; }
  if (existing) Object.assign(state.weeklyEntries[weekNum], record);
  toast('Week saved ✓', 'success');
}

// ── Daily ────────────────────────────────────────────────────
function setCurrentDayFromDate() {
  if (!state.journal?.start_date) { state.currentDay = 1; return; }
  const start = new Date(state.journal.start_date + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.floor((today - start) / 86400000) + 1;
  state.currentDay = Math.max(1, Math.min(30, diff));
}

function renderDayStrip() {
  const inner = document.getElementById('day-strip-inner');
  if (!inner) return;
  inner.innerHTML = Array.from({length: 30}, (_, i) => {
    const day = i + 1;
    const done = !!state.dailyEntries[day];
    const active = day === state.currentDay;
    return `
      <div class="day-chip ${active ? 'active' : ''} ${done && !active ? 'done' : ''}" onclick="switchDay(${day})">
        <span class="day-num">${day}</span>
        <span class="day-lbl">${done ? '✓' : 'Day'}</span>
      </div>
    `;
  }).join('');
}

function switchDay(day) {
  state.currentDay = day;
  renderDayStrip();
  populateDailyForm(day);
  document.getElementById('daily-day-num').textContent = day;
  updateDailyDateLabel(day);
}

function updateDailyDateLabel(day) {
  const el = document.getElementById('daily-date-label');
  if (!el) return;
  if (!state.journal?.start_date) { el.textContent = ''; return; }
  const start = new Date(state.journal.start_date + 'T00:00:00');
  const d = new Date(start); d.setDate(start.getDate() + day - 1);
  el.textContent = fmtDate(d);
}

function renderDailyGoalRows() {
  const container = document.getElementById('daily-goals-rows');
  if (!container) return;
  container.innerHTML = Array.from({length: 10}, (_, i) => `
    <div class="goal-row">
      <span class="row-num">${i+1}</span>
      <input type="text" class="d-goal" data-idx="${i}" placeholder="Goal / task">
      <input type="text" class="d-task" data-idx="${i}" placeholder="Associated task">
      <div class="check-done" data-idx="${i}" onclick="toggleDailyGoalDone(this, ${i})">☐</div>
    </div>
  `).join('');
}

function toggleDailyGoalDone(el, idx) {
  el.classList.toggle('done');
  el.textContent = el.classList.contains('done') ? '✓' : '☐';
}

function renderWellnessScores() {
  ['food', 'exercise', 'journal', 'meditation'].forEach(cat => {
    const row = document.getElementById(`${cat}-score-row`);
    if (!row) return;
    row.innerHTML = Array.from({length: 10}, (_, i) => `
      <button class="score-btn" data-cat="${cat}" data-val="${i+1}" onclick="setScore('${cat}', ${i+1})">${i+1}</button>
    `).join('');
  });
}

function setScore(cat, val) {
  state.wellnessScores[cat] = val;
  const row = document.getElementById(`${cat}-score-row`);
  row.querySelectorAll('.score-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val) === val);
  });
  const el = document.getElementById(`${cat}-score-val`);
  if (el) el.textContent = val + '/10';
}

function populateDailyForm(day) {
  const entry = state.dailyEntries[day] || {};

  // Push back task
  setValue('daily-pushback', entry.push_back_task || '');
  const pbBtn = document.getElementById('pb-done-btn');
  if (pbBtn) {
    pbBtn.textContent = entry.push_back_done ? '✓' : '☐';
    pbBtn.style.background = entry.push_back_done ? 'var(--success)' : 'var(--bg-base)';
    pbBtn.style.color = entry.push_back_done ? 'white' : 'var(--text-dim)';
  }

  // Goals
  const goals = entry.schedule_goals || [];
  document.querySelectorAll('.d-goal').forEach((inp, i) => inp.value = goals[i]?.goal || '');
  document.querySelectorAll('.d-task').forEach((inp, i) => inp.value = goals[i]?.task || '');
  document.querySelectorAll('#daily-goals-rows .check-done').forEach((el, i) => {
    const done = goals[i]?.done || false;
    el.classList.toggle('done', done);
    el.textContent = done ? '✓' : '☐';
  });

  // Text fields
  setValue('daily-revenue',      entry.revenue_activities || '');
  setValue('daily-client',       entry.client_tasks       || '');
  setValue('daily-biz',          entry.business_tasks     || '');
  setValue('daily-network',      entry.networking         || '');
  setValue('daily-notes',        entry.notes              || '');
  setValue('d-exp-income',       entry.expected_income    || '');
  setValue('d-unexp-income',     entry.unexpected_income  || '');
  setValue('d-exp-exp',          entry.expected_expenses  || '');
  setValue('d-unexp-exp',        entry.unexpected_expenses || '');
  setValue('d-unexp-good',       entry.unexpected_good    || '');
  setValue('daily-rocked',       entry.rocked_it          || '');
  setValue('daily-improve',      entry.improvements       || '');
  setValue('daily-gratitude',    entry.gratitude          || '');
  setValue('daily-free-journal', entry.free_journal       || '');

  // Wellness scores
  ['food', 'exercise', 'journal', 'meditation'].forEach(cat => {
    const val = entry[`${cat}_score`];
    state.wellnessScores[cat] = val || null;
    const row = document.getElementById(`${cat}-score-row`);
    if (row) row.querySelectorAll('.score-btn').forEach(btn => {
      btn.classList.toggle('active', val && parseInt(btn.dataset.val) === val);
    });
    const valEl = document.getElementById(`${cat}-score-val`);
    if (valEl) valEl.textContent = val ? val + '/10' : '—';
    setValue(`${cat}-notes`, entry[`${cat}_notes`] || '');
  });

  // Photos
  state.pendingPhotos = [];
  state.photoUrls = entry.photo_urls || [];
  renderPhotoThumbs();
  const ocrSection = document.getElementById('ocr-section');
  const ocrResult  = document.getElementById('ocr-result');
  if (ocrSection) ocrSection.classList.toggle('hidden', state.photoUrls.length === 0 && state.pendingPhotos.length === 0);
  if (ocrResult) ocrResult.classList.add('hidden');

  // Affirmation
  updateDailyAffirmationDisplay();
}

function togglePushback() {
  const btn = document.getElementById('pb-done-btn');
  if (!btn) return;
  const isDone = btn.textContent === '✓';
  btn.textContent = isDone ? '☐' : '✓';
  btn.style.background = isDone ? 'var(--bg-base)' : 'var(--success)';
  btn.style.color = isDone ? 'var(--text-dim)' : 'white';
}

function updateDailyAffirmationDisplay() {
  const wrap = document.getElementById('daily-affirmation-wrap');
  const text = document.getElementById('daily-affirmation-text');
  if (!wrap || !text) return;
  const aff = state.journal?.affirmation;
  if (aff && aff.trim()) {
    text.textContent = aff;
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

async function saveDaily() {
  if (!state.journal) { toast('Set up your 30-day plan first', 'error'); return; }
  const day = state.currentDay;

  showSaveIndicator('saving');

  // Upload any pending photos
  const uploadedUrls = await uploadPendingPhotos();
  const allPhotoUrls = [...state.photoUrls, ...uploadedUrls];

  const schedule_goals = Array.from({length: 10}, (_, i) => ({
    goal: document.querySelectorAll('.d-goal')[i]?.value || '',
    task: document.querySelectorAll('.d-task')[i]?.value || '',
    done: document.querySelectorAll('#daily-goals-rows .check-done')[i]?.classList.contains('done') || false,
  }));

  const pbBtn = document.getElementById('pb-done-btn');
  const pushBackDone = pbBtn?.textContent === '✓';

  const record = {
    journal_id: state.journal.id,
    user_id: state.user.id,
    day_number: day,
    entry_date: getDayDate(day),
    push_back_task: getValue('daily-pushback'),
    push_back_done: pushBackDone,
    schedule_goals,
    revenue_activities:  getValue('daily-revenue'),
    client_tasks:        getValue('daily-client'),
    business_tasks:      getValue('daily-biz'),
    networking:          getValue('daily-network'),
    notes:               getValue('daily-notes'),
    food_score:          state.wellnessScores.food,
    food_notes:          getValue('food-notes'),
    exercise_score:      state.wellnessScores.exercise,
    exercise_notes:      getValue('exercise-notes'),
    journal_score:       state.wellnessScores.journal,
    journal_notes:       getValue('journal-notes'),
    meditation_score:    state.wellnessScores.meditation,
    meditation_notes:    getValue('meditation-notes'),
    expected_income:     getValue('d-exp-income'),
    unexpected_income:   getValue('d-unexp-income'),
    expected_expenses:   getValue('d-exp-exp'),
    unexpected_expenses: getValue('d-unexp-exp'),
    unexpected_good:     getValue('d-unexp-good'),
    rocked_it:           getValue('daily-rocked'),
    improvements:        getValue('daily-improve'),
    gratitude:           getValue('daily-gratitude'),
    free_journal:        getValue('daily-free-journal'),
    photo_urls:          allPhotoUrls,
  };

  const existing = state.dailyEntries[day];
  let error;
  if (existing) {
    ({ error } = await state.supabase.from('daily_entries').update(record).eq('id', existing.id));
    if (!error) Object.assign(state.dailyEntries[day], record);
  } else {
    const { data, error: e } = await state.supabase.from('daily_entries').insert(record).select().single();
    error = e;
    if (data) state.dailyEntries[day] = data;
  }

  if (error) { showSaveIndicator('error'); toast('Error saving — please try again', 'error'); return; }

  state.photoUrls = allPhotoUrls;
  state.pendingPhotos = [];
  renderDayStrip();
  updateDashboard();
  showSaveIndicator('saved');
  toast('Day saved ✓', 'success');
}

function getDayDate(day) {
  if (!state.journal?.start_date) return null;
  const start = new Date(state.journal.start_date + 'T00:00:00');
  const d = new Date(start); d.setDate(start.getDate() + day - 1);
  return d.toISOString().split('T')[0];
}

// ── Photo Upload ─────────────────────────────────────────────
function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  state.pendingPhotos = [...state.pendingPhotos, ...files];
  renderPhotoThumbs();
  const ocrSection = document.getElementById('ocr-section');
  if (ocrSection) ocrSection.classList.remove('hidden');
  event.target.value = ''; // reset so same file can be re-selected
}

function renderPhotoThumbs() {
  const container = document.getElementById('photo-thumbs');
  if (!container) return;
  container.innerHTML = '';

  // Pending (local)
  state.pendingPhotos.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    container.innerHTML += `
      <div class="photo-thumb">
        <img src="${url}" alt="Page ${i+1}">
        <button class="del-btn" onclick="removePendingPhoto(${i})">✕</button>
      </div>`;
  });

  // Already saved
  state.photoUrls.forEach((url, i) => {
    container.innerHTML += `
      <div class="photo-thumb">
        <img src="${url}" alt="Page ${i+1}">
        <button class="del-btn" onclick="removeSavedPhoto(${i})">✕</button>
      </div>`;
  });
}

function removePendingPhoto(idx) {
  state.pendingPhotos.splice(idx, 1);
  renderPhotoThumbs();
  if (!state.pendingPhotos.length && !state.photoUrls.length) {
    document.getElementById('ocr-section')?.classList.add('hidden');
  }
}

function removeSavedPhoto(idx) {
  state.photoUrls.splice(idx, 1);
  renderPhotoThumbs();
}

async function uploadPendingPhotos() {
  if (!state.pendingPhotos.length || !state.supabase) return [];
  const urls = [];
  for (const file of state.pendingPhotos) {
    const path = `${state.user.id}/day${state.currentDay}/${Date.now()}_${file.name}`;
    const { data, error } = await state.supabase.storage
      .from('journal-photos').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: { publicUrl } } = state.supabase.storage
        .from('journal-photos').getPublicUrl(path);
      urls.push(publicUrl);
    }
  }
  return urls;
}

// ── Claude OCR ───────────────────────────────────────────────
async function transcribePhotos() {
  const apiKey = localStorage.getItem('anthropic_key');
  if (!apiKey) {
    toast('Add your Anthropic API key in Settings first', 'error');
    navigate('settings');
    return;
  }

  const btn = document.getElementById('transcribe-btn');
  const resultEl = document.getElementById('ocr-result');
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;margin-right:8px;"></div> Transcribing...';
  btn.disabled = true;

  try {
    // Build image content blocks
    const imageBlocks = [];
    for (const file of state.pendingPhotos) {
      const b64 = await fileToBase64(file);
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.type, data: b64.split(',')[1] }
      });
    }
    // Also include saved photo URLs as URL type
    for (const url of state.photoUrls) {
      imageBlocks.push({ type: 'image', source: { type: 'url', url } });
    }

    if (!imageBlocks.length) {
      toast('No photos to transcribe', 'error');
      btn.innerHTML = '✨ Transcribe Handwritten Pages';
      btn.disabled = false;
      return;
    }

    imageBlocks.push({
      type: 'text',
      text: 'These are pages from a handwritten journal. Please transcribe all the handwritten text exactly as written, preserving line breaks and paragraph structure. Do not add commentary or interpretation — just transcribe the text faithfully.'
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: imageBlocks }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API error');
    }

    const data = await response.json();
    const transcription = data.content[0].text;

    resultEl.innerHTML = `
      <div style="font-size:0.75rem;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Transcription</div>
      <div style="font-size:0.875rem;line-height:1.7;white-space:pre-wrap;">${esc(transcription)}</div>
      <button class="btn btn-secondary btn-sm mt-16" onclick="appendTranscription()">Append to Journal Entry</button>
    `;
    resultEl.classList.remove('hidden');
    resultEl.dataset.transcription = transcription;

    toast('Transcribed ✓', 'success');

  } catch (err) {
    toast(`Transcription failed: ${err.message}`, 'error');
    resultEl.innerHTML = `<div style="color:var(--danger);font-size:0.875rem;">Error: ${esc(err.message)}</div>`;
    resultEl.classList.remove('hidden');
  }

  btn.innerHTML = '✨ Transcribe Handwritten Pages';
  btn.disabled = false;
}

function appendTranscription() {
  const resultEl = document.getElementById('ocr-result');
  const transcription = resultEl?.dataset.transcription;
  if (!transcription) return;
  const fj = document.getElementById('daily-free-journal');
  if (!fj) return;
  fj.value = fj.value ? fj.value + '\n\n--- Transcribed ---\n' + transcription : transcription;
  toast('Transcription added to journal entry ✓', 'success');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── AI Review ────────────────────────────────────────────────
async function runReview() {
  const apiKey = localStorage.getItem('anthropic_key');
  if (!apiKey) return;

  document.getElementById('review-ready').classList.add('hidden');
  document.getElementById('review-loading').classList.remove('hidden');
  document.getElementById('review-results').classList.add('hidden');

  try {
    // Gather all journal content
    const content = buildReviewContent();

    const prompt = `You are analyzing a Legacy Code Journal — a 30-day personal and business development journal.
The journal belongs to someone building a legacy business.

Here is all their journal content:
${content}

Please analyze and provide structured insights in exactly this JSON format:
{
  "themes": ["theme 1", "theme 2", "theme 3", "theme 4", "theme 5"],
  "unanswered_questions": ["question 1", "question 2", "question 3"],
  "stuck_points": ["stuck point 1", "stuck point 2", "stuck point 3"],
  "wins": ["win 1", "win 2", "win 3", "win 4"],
  "goals_mentioned": ["goal 1", "goal 2", "goal 3", "goal 4"],
  "summary": "2-3 sentence overview of this person's journey and what stands out most."
}

Be specific and reference actual content from their entries. Be warm and insightful.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API error');
    }

    const data = await response.json();
    let reviewData;
    try {
      const text = data.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      reviewData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      throw new Error('Could not parse AI response');
    }

    renderReviewResults(reviewData);

  } catch (err) {
    document.getElementById('review-loading').classList.add('hidden');
    document.getElementById('review-ready').classList.remove('hidden');
    toast(`Review failed: ${err.message}`, 'error');
  }
}

function buildReviewContent() {
  const j = state.journal || {};
  const parts = [];

  parts.push('=== 30-DAY PLAN ===');
  if (j.goals) parts.push('Goals: ' + j.goals);
  if (j.bhag)  parts.push('BHAG: ' + j.bhag);
  if (j.affirmation) parts.push('Affirmation: ' + j.affirmation);
  if (j.action_plan) parts.push('Action Plan: ' + j.action_plan);
  if (j.gremlins)    parts.push('Gremlins: ' + j.gremlins);

  const days = Object.values(state.dailyEntries).sort((a,b) => a.day_number - b.day_number);
  days.forEach(d => {
    parts.push(`\n=== DAY ${d.day_number} ===`);
    if (d.push_back_task)      parts.push(`Push Back Task: ${d.push_back_task}`);
    if (d.revenue_activities)  parts.push(`Revenue Activities: ${d.revenue_activities}`);
    if (d.client_tasks)        parts.push(`Client Tasks: ${d.client_tasks}`);
    if (d.business_tasks)      parts.push(`Business Tasks: ${d.business_tasks}`);
    if (d.networking)          parts.push(`Networking: ${d.networking}`);
    if (d.rocked_it)           parts.push(`Rocked It: ${d.rocked_it}`);
    if (d.improvements)        parts.push(`Improvements: ${d.improvements}`);
    if (d.gratitude)           parts.push(`Gratitude: ${d.gratitude}`);
    if (d.free_journal)        parts.push(`Journal: ${d.free_journal}`);
  });

  return parts.join('\n');
}

function renderReviewResults(data) {
  document.getElementById('review-loading').classList.add('hidden');
  const container = document.getElementById('review-results');

  const html = `
    ${data.summary ? `
    <div class="review-section" style="background:linear-gradient(135deg,rgba(124,58,237,0.12),var(--bg-card));border-color:rgba(124,58,237,0.25);">
      <h3><span class="review-icon">✨</span> Overview</h3>
      <p style="font-size:0.9rem;color:var(--text);line-height:1.7;">${esc(data.summary)}</p>
    </div>` : ''}

    ${data.themes?.length ? `
    <div class="review-section">
      <h3><span class="review-icon">🌀</span> Key Themes & Patterns</h3>
      <div>${data.themes.map(t => `<span class="theme-tag">${esc(t)}</span>`).join('')}</div>
    </div>` : ''}

    ${data.wins?.length ? `
    <div class="review-section">
      <h3><span class="review-icon">🌟</span> Wins & Momentum</h3>
      ${data.wins.map(w => `
        <div class="insight-item">
          <div class="insight-dot green"></div>
          <div class="insight-text">${esc(w)}</div>
        </div>`).join('')}
    </div>` : ''}

    ${data.goals_mentioned?.length ? `
    <div class="review-section">
      <h3><span class="review-icon">🎯</span> Goals You're Working Toward</h3>
      ${data.goals_mentioned.map(g => `
        <div class="insight-item">
          <div class="insight-dot gold"></div>
          <div class="insight-text">${esc(g)}</div>
        </div>`).join('')}
    </div>` : ''}

    ${data.unanswered_questions?.length ? `
    <div class="review-section">
      <h3><span class="review-icon">❓</span> Unanswered Questions</h3>
      ${data.unanswered_questions.map(q => `
        <div class="insight-item">
          <div class="insight-dot purple"></div>
          <div class="insight-text">${esc(q)}</div>
        </div>`).join('')}
    </div>` : ''}

    ${data.stuck_points?.length ? `
    <div class="review-section">
      <h3><span class="review-icon">🔧</span> Things to Dig Into</h3>
      ${data.stuck_points.map(s => `
        <div class="insight-item">
          <div class="insight-dot red"></div>
          <div class="insight-text">${esc(s)}</div>
        </div>`).join('')}
    </div>` : ''}

    <button class="btn btn-secondary btn-full" onclick="document.getElementById('review-ready').classList.remove('hidden');document.getElementById('review-results').classList.add('hidden');">
      Run New Analysis
    </button>
  `;

  container.innerHTML = html;
  container.classList.remove('hidden');
}

// ── Dashboard Update ─────────────────────────────────────────
function updateDashboard() {
  const j = state.journal || {};  // always run — use empty object if journal not loaded yet
  const doneDays = Object.keys(state.dailyEntries).length;
  const pct = Math.round((doneDays / 30) * 100);

  // Cycle banner
  const title = document.getElementById('dash-cycle-title');
  if (title) title.textContent = j.owner_name ? `${j.owner_name}'s Journey` : 'My Legacy Journey';
  const dates = document.getElementById('dash-cycle-dates');
  if (dates) {
    if (j.start_date && j.end_date) {
      dates.textContent = `${fmtDateShort(j.start_date)} → ${fmtDateShort(j.end_date)}`;
    } else if (j.start_date) {
      dates.textContent = `Started ${fmtDateShort(j.start_date)}`;
    } else {
      dates.textContent = 'Tap to set up your 30-day plan';
    }
  }

  const prog = document.getElementById('dash-progress');
  if (prog) prog.style.width = pct + '%';
  const progLabel = document.getElementById('dash-progress-label');
  if (progLabel) progLabel.textContent = `${doneDays} of 30 days journaled`;

  // Affirmation
  const affWrap = document.getElementById('dash-affirmation-wrap');
  const affText = document.getElementById('dash-affirmation-text');
  if (affWrap && affText) {
    if (j.affirmation) {
      affText.textContent = j.affirmation;
      affWrap.classList.remove('hidden');
    } else {
      affWrap.classList.add('hidden');
    }
  }

  // Stats
  setTextContent('stat-days', doneDays);
  setTextContent('stat-streak', calcStreak());
  setTextContent('stat-contacts', state.contacts.length);

  // Today / Week labels
  setTextContent('dash-today-label', `Day ${state.currentDay}`);
  setTextContent('dash-week-label', `Week ${state.currentWeek}`);

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = state.profile?.display_name || j.owner_name || '';
  setTextContent('dash-greeting', name ? `${greeting}, ${name.split(' ')[0]}` : greeting);
}

function calcStreak() {
  if (!state.journal?.start_date) return 0;
  let streak = 0;
  for (let d = state.currentDay; d >= 1; d--) {
    if (state.dailyEntries[d]) streak++;
    else break;
  }
  return streak;
}

// ── Review Page State ────────────────────────────────────────
function updateReviewPageState() {
  const apiKey = localStorage.getItem('anthropic_key');
  const entryCount = Object.keys(state.dailyEntries).length;

  toggleEl('review-no-key', !apiKey);
  toggleEl('review-no-entries', !!apiKey && entryCount === 0);
  toggleEl('review-ready', !!apiKey && entryCount > 0);
}

// ── Mantras ──────────────────────────────────────────────────
function renderMantras() {
  const list = document.getElementById('mantra-list');
  if (!list) return;
  list.innerHTML = MANTRAS.map(m => `
    <div class="mantra-card">
      <div class="mantra-code" style="color:${m.color};">${m.code}</div>
      <div class="mantra-quote">"${m.text}"</div>
    </div>
  `).join('');
}

// ── Navigation ───────────────────────────────────────────────
const VIEW_HISTORY = [];

function navigate(viewName) {
  const prev = state.currentView;
  if (prev !== viewName) VIEW_HISTORY.push(prev);
  if (VIEW_HISTORY.length > 10) VIEW_HISTORY.shift();
  state.currentView = viewName;

  // Always ensure app-shell is visible and auth/setup are fully hidden.
  // Inline styles beat every CSS rule — no specificity issues.
  const _auth  = document.getElementById('view-auth');
  const _setup = document.getElementById('view-setup');
  const _shell = document.getElementById('app-shell');
  if (_auth)  { _auth.style.display  = 'none'; _auth.classList.remove('active'); }
  if (_setup) { _setup.style.display = 'none'; _setup.classList.remove('active'); }
  if (_shell) { _shell.style.display = ''; _shell.classList.remove('hidden'); }

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Show target
  const el = document.getElementById(`view-${viewName}`);
  if (el) el.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === viewName);
  });

  // Back button
  const back = document.getElementById('header-back');
  const mainViews = ['dashboard','planning','daily','weekly','review','intro'];
  if (back) back.classList.toggle('visible', !mainViews.includes(viewName));

  // View-specific logic
  switch (viewName) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'planning':
      populatePlanningForm();
      break;
    case 'daily':
      renderDayStrip();
      switchDay(state.currentDay);
      break;
    case 'weekly':
      switchWeek(state.currentWeek);
      break;
    case 'peopling':
      renderContacts();
      break;
    case 'review':
      updateReviewPageState();
      break;
    case 'settings':
      populateSettingsForm();
      break;
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  const prev = VIEW_HISTORY.pop() || 'dashboard';
  navigate(prev);
}

function showView(name) {
  // Clear all views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.style.display = ''; // clear any inline style so CSS takes over
  });
  // Hide app-shell
  const shell = document.getElementById('app-shell');
  if (shell) { shell.classList.add('hidden'); shell.style.display = ''; }
  // Show the requested view — force display via inline style so it always appears
  const el = document.getElementById(`view-${name}`);
  if (el) {
    el.classList.add('active');
    el.style.display = (name === 'auth') ? 'flex' : 'block';
  }
}

// ── Save Indicator ───────────────────────────────────────────
function showSaveIndicator(state_str) {
  const ind = document.getElementById('save-indicator');
  const dot = document.getElementById('save-dot');
  const txt = document.getElementById('save-text');
  if (!ind || !dot || !txt) return;
  ind.style.display = 'flex';
  dot.className = 'save-dot ' + state_str;
  txt.textContent = state_str === 'saving' ? 'Saving...' : state_str === 'saved' ? 'Saved' : 'Error';
  if (state_str === 'saved') {
    setTimeout(() => { ind.style.display = 'none'; }, 2000);
  }
}

// ── Toast ────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// ── DOM Utilities ────────────────────────────────────────────
function getValue(id) { return document.getElementById(id)?.value?.trim() || ''; }
function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }
function setTextContent(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function showEl(el, msg) {
  if (!el) return;
  if (msg !== undefined) el.textContent = msg;
  el.classList.remove('hidden');
}
function hideEl(el) { if (el) el.classList.add('hidden'); }
function toggleEl(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !show);
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Date Helpers ─────────────────────────────────────────────
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateShort(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Keyboard shortcuts ───────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    switch (state.currentView) {
      case 'daily':    saveDaily(); break;
      case 'weekly':   saveWeekly(); break;
      case 'planning': savePlanning(); break;
      case 'peopling': saveContacts(); break;
    }
  }
});

// ── Auto-save on blur for text inputs ───────────────────────
let autoSaveTimer;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (state.currentView === 'daily')    saveDaily();
    if (state.currentView === 'planning') savePlanning();
    if (state.currentView === 'weekly')   saveWeekly();
  }, 3000);
}

document.addEventListener('input', (e) => {
  if (e.target.matches('input, textarea, select')) {
    showSaveIndicator('saving');
    scheduleAutoSave();
  }
});

// ── Init ─────────────────────────────────────────────────────
boot();
