import { firebaseConfig } from './config.js';
import { createLocalBackend } from './backend-local.js';
import { AVATAR_COUNT, avatarName, avatarSVG, ROLE_ART, ghostSVG, werewolfSVG, villagerSVG, moonSceneSVG, ICON, biteSVG } from './art.js';
import * as G from './game.js';
import * as SND from './sound.js';

// ═════════════════════════ state ═════════════════════════
const $app = document.getElementById('app');
const PAGE = document.body.dataset.page === 'admin' ? 'admin' : 'play';
const DEFAULT_BRAND = { name: 'Werewolf', village: 'Moonhollow', tagline: 'A cozy game of secrets & fibs for your Teams calls.', icon: { type: 'art', id: 'werewolf' } };
const S = {
  be: null, uid: null, view: 'loading', brand: { ...DEFAULT_BRAND }, brandLoaded: false,
  code: null, isMod: false,
  room: null, players: [], votes: [], actions: [], secret: null, myAction: null, mod: null,
  ui: { code: '', name: '', avatar: null, flipped: false, sheet: null, confettiFor: null, draft: null, pin: '', pin2: '', newPin: '', chat: '' },
  lastRoom: null,
  subs: [], actionSub: null, actionKey: null, joinSub: null, joinPlayers: [],
  chat: [], chatSub: null, chatKey: null,
  busy: false, resolving: null, seerPending: null,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_SVG = Object.fromEntries(Object.entries(ROLE_ART).map(([k, f]) => [k, f()]));
const GHOST = ghostSVG();
const AV_CACHE = {};
const PHASES = ['lobby', 'roles', 'night', 'morning', 'day', 'vote', 'verdict'];
const PHASE_LABEL = { lobby: 'Lobby', roles: 'Roles', night: 'Night', morning: 'Morning', day: 'Debate', vote: 'Vote', verdict: 'Verdict', ended: 'Game over' };

const store = {
  get area() { return S.be?.mode === 'demo' ? sessionStorage : localStorage; },
  key: `moonhollow-session-${PAGE}${window.name ? '-' + window.name : ''}`,
  get() { try { return JSON.parse(this.area.getItem(this.key)); } catch { return null; } },
  set(v) { try { this.area.setItem(this.key, JSON.stringify(v)); } catch {} },
  clear() { try { this.area.removeItem(this.key); } catch {} },
};

// ═════════════════════════ helpers ═════════════════════════
const room = () => S.room || {};
const curKey = () => `${room().game}_${room().round}`;
const me = () => S.players.find((p) => p.id === S.uid);
const pl = (id) => S.players.find((p) => p.id === id);
const pname = (id) => esc(pl(id)?.name || 'someone');
const alive = () => S.players.filter((p) => p.alive);
const nowVotes = () => S.votes.filter((v) => v.game === room().game && v.round === room().round);
const nowActions = () => S.actions.filter((a) => a.game === room().game && a.round === room().round);
const roleOf = (id) => (S.isMod ? S.mod?.roles?.[id] : id === S.uid ? S.secret?.role : pl(id)?.role);
const RC = (r) => G.ROLES[r]?.color || '#999';

function av(i, size = 56, { dead = false, role = null } = {}) {
  const svg = (AV_CACHE[i] ||= avatarSVG(i ?? 0));
  const badge = dead ? `<div class="ghostbadge">${GHOST}</div>` : role ? `<div class="rolebadge">${ROLE_SVG[role]}</div>` : '';
  return `<div class="av ${dead ? 'dead' : ''}" ${size ? `style="--s:${size}px"` : ''}>${svg}${badge}</div>`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// Every phase has a timer the admin sets. In automatic mode the app moves on by itself.
const TIMERS = [
  { k: 'roles',   label: 'Look at roles', icon: 'cards', opts: [10, 20, 30, 45],    def: 20 },
  { k: 'night',   label: 'Night',          icon: 'moon', opts: [30, 45, 60, 90],    def: 45 },
  { k: 'morning', label: 'Morning news',   icon: 'sun', opts: [5, 10, 15, 20],     def: 10 },
  { k: 'day',     label: 'Debate',         icon: 'chat', opts: [60, 120, 180, 300], def: 120 },
  { k: 'vote',    label: 'Voting',         icon: 'vote', opts: [30, 45, 60, 90],    def: 45 },
  { k: 'verdict', label: 'Verdict',        icon: 'scale', opts: [5, 10, 15, 20],     def: 10 },
];
const NEXT_NAME = { roles: 'Night', night: 'Morning', morning: 'Debate', day: 'Voting', vote: 'Verdict', verdict: 'Night' };
const NEXT_SAY = { roles: 'Night falls in', morning: 'Debate starts in', day: 'Voting opens in', vote: 'Voting closes in', verdict: 'Night falls in' };
const isAuto = (st = room().settings || {}) => st.auto !== false;           // automatic by default
function timeFor(phase, st = room().settings || {}) {
  if (phase === 'night') return st.times?.night ?? st.nightSeconds ?? 45;
  return st.times?.[phase] ?? TIMERS.find((t) => t.k === phase)?.def ?? 0;
}
const fmt = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`);
// when the next phase should end (manual mode only times the night)
const endsFor = (phase) => (isAuto() || phase === 'night' ? Date.now() + timeFor(phase) * 1000 : null);

function secsLeft() {
  if (room().pausedLeft != null) return Math.ceil(room().pausedLeft / 1000);
  const end = room().phaseEndsAt ?? room().nightEndsAt;
  return end ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : 0;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
}

// always points at the PUBLIC player page (index.html), even when used from admin.html
const inviteLink = () => new URL(`./?room=${S.code}`, location.href).href;

// ═════════════════════════ rendering ═════════════════════════
// A tiny DOM "morph": instead of replacing the whole screen on every update,
// only change what's different. Elements stay alive, so CSS transitions
// (selection rings, card flips, press states) actually play, and inputs keep focus.
const seenKeys = new Set();
function morph(from, to) {
  const a = [...from.childNodes];
  const b = [...to.childNodes];
  b.forEach((n, i) => {
    const o = a[i];
    if (!o) { from.appendChild(n); arrive(n); return; }
    const key = (x) => (x.nodeType === 1 ? x.getAttribute('data-key') : null);
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName || key(o) !== key(n)) {
      from.replaceChild(n, o); arrive(n); return;
    }
    if (o.isEqualNode(n)) return;             // identical subtree (e.g. an unchanged avatar SVG): native check, skip the walk
    if (o.nodeType !== 1) {
      if (o.nodeValue !== n.nodeValue) {
        o.nodeValue = n.nodeValue;
        const pop = o.parentElement?.closest('[data-pop]');
        if (pop) pop.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
      return;
    }
    for (const { name } of [...o.attributes]) {
      if (!n.hasAttribute(name) && !(name === 'open' && o.tagName === 'DETAILS')) o.removeAttribute(name);
    }
    for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
    if (o.tagName === 'INPUT' || o.tagName === 'TEXTAREA') {
      if (document.activeElement !== o && o.type !== 'file') o.value = n.getAttribute('value') ?? '';
      return;
    }
    morph(o, n);
  });
  for (let i = a.length - 1; i >= b.length; i--) a[i].remove();
}
// a keyed element we've never shown before (new player, new log line) fades in gently
function arrive(n) {
  if (n.nodeType !== 1 || $app.classList.contains('enter')) return;
  const k = n.getAttribute('data-key');
  if (!k || seenKeys.has(k)) return;
  seenKeys.add(k);
  n.animate([{ opacity: 0, transform: 'translateY(6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}
function rememberKeys() { $app.querySelectorAll('[data-key]').forEach((el) => seenKeys.add(el.getAttribute('data-key'))); }

function toggle(key, title, desc, on) {
  return `<button class="toggle ${on ? 'on' : ''}" data-act="toggleSetting" data-k="${key}" role="switch" aria-checked="${!!on}">
    <span class="tg-text"><b>${title}</b><span>${desc}</span></span><span class="switch"><i></i></span></button>`;
}

function extrasNote() {
  const st = room().settings || {};
  const on = [st.hunch && 'Village hunch', st.rumor && 'Rumors'].filter(Boolean);
  const plan = planned(st);
  return (plan && room().phase === 'lobby' ? `<p class="small" style="opacity:.85"><b>${S.players.length} of ${plan}</b> players have joined</p>` : '')
    + `<p class="small" style="opacity:.85">This game: <b>${roleSummary(roleCounts(st), plan ?? S.players.length)}</b></p>`
    + (killsSetting(st) > 1 ? `<p class="small" style="opacity:.85">Wolves can take up to <b>${killsSetting(st)} people</b> a night</p>` : '')
    + (on.length ? `<p class="small" style="opacity:.85">Extra clues: <b>${on.join(' · ')}</b></p>` : '');
}

function hunchCard() {
  const h = room().morning?.hunch;
  if (!room().settings?.hunch || !h) return '';
  const names = h.ids.map((id) => `<b>${pname(id)}</b>`);
  return `<div class="clue hunch">
    <div class="clue-avs">${h.ids.slice(0, 3).map((id) => av(pl(id)?.avatar, 44, { dead: !pl(id)?.alive })).join('')}</div>
    <div><small>${ICON.hunch} Village hunch</small><p>Last night the village suspected ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0]} the most <span class="muted">(${h.count} of ${h.total} taps)</span>.</p></div>
  </div>`;
}

function rumorCard() {
  const ids = S.secret?.rumor?.[room().round];
  if (!room().settings?.rumor || !ids || !me()?.alive) return '';
  return `<div class="clue rumor">
    <div><small>${ICON.key} A rumor reached only you</small>
      <p>A little bird whispered: <b>one of these is a werewolf.</b> Share it carefully!</p></div>
    <div class="clue-row">${ids.map((id) => `<div class="clue-who">${av(pl(id)?.avatar, 48, { dead: !pl(id)?.alive })}<span>${pname(id)}</span></div>`).join('')}</div>
  </div>`;
}

function ringHTML(extra = '') {
  const total = timeFor('night');
  const left = secsLeft();
  return `<div class="ring ${left <= 5 ? 'urgent' : ''}" data-ring ${extra}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="44"/><circle class="prog" cx="50" cy="50" r="44" pathLength="100" style="stroke-dashoffset:${100 - (left / total) * 100}"/></svg>
    <span data-countdown aria-label="${left} seconds left">${left}</span></div>`;
}

const waiting = (t) => `<div class="waiting muted">${t}<span class="dots"><i></i><i></i><i></i></span></div>`;
let raf = null;
function render() {
  if (raf) return;
  raf = setTimeout(() => { raf = null; draw(); }, 16); // setTimeout (not rAF) so background tabs keep updating
}

function draw() {
  let html = '';
  let theme = 'night';

  if (S.view === 'loading') html = `<div class="center" style="padding-top:30vh"><div class="hero"><div class="wolf">${brandIcon(S.brand.icon)}</div></div><p class="muted">Waking up the village…</p></div>`;
  else if (S.view === 'error') html = viewError();
  else if (S.view === 'home') html = viewHome();
  else if (S.view === 'join') html = viewJoin();
  else if (S.view === 'adminSetup' || S.view === 'adminLogin') { html = viewAdminGate(); }
  else if (S.view === 'adminHome') { html = viewAdminHome(); theme = 'day'; }
  else if (S.view === 'game') {
    const ph = room().phase;
    theme = ['morning', 'day', 'vote', 'verdict'].includes(ph) ? 'day' : ph === 'ended' ? (room().winner === 'wolves' ? 'night' : 'day') : 'night';
    if (S.isMod) theme = 'day';
    html = S.isMod ? viewMod() : viewPlayer();
  }
  document.body.className = `theme-${theme}`;
  $app.classList.toggle('wide', (S.view === 'game' && S.isMod) || S.view === 'adminHome');
  $app.classList.toggle('with-chat', S.view === 'game' && !S.isMod && html.includes('class="pgrid"'));
  // background music follows the game: spooky at night, cheerful by day
  const ph = room().phase;
  SND.music(S.view === 'game'
    ? (['morning', 'day', 'vote', 'verdict'].includes(ph) || (ph === 'ended' && room().winner !== 'wolves') ? 'day' : 'night')
    : PAGE === 'admin' ? null : 'night');
  // play the pop-in animation only when the screen actually changes (not on every vote/update)
  const screen = `${S.view}|${S.isMod}|${room().phase}|${room().round}`;
  if (screen !== draw.last) {
    draw.last = screen;
    $app.classList.add('enter');
    clearTimeout(draw.t);
    draw.t = setTimeout(() => $app.classList.remove('enter'), 900);
  }
  // Most database updates (someone else's vote or night pick) don't change what THIS
  // screen shows. If the markup is identical, skip the parse + compare entirely.
  const full = html + (S.ui.sheet ? viewSheet() : '') + (S.ui.confirm ? viewConfirm() : '');
  if (full === draw.lastHtml && $app.firstChild) { tick(); return; }
  draw.lastHtml = full;
  const next = document.createElement('div');
  next.innerHTML = full;
  morph($app, next);
  if (S.view === 'join') drawAvGrid();
  if (S.view === 'adminHome') drawBrandPreview();
  rememberKeys();
  tick();
}

// ───────── home ─────────
function viewHome() {
  return `
  <div class="topbar" style="justify-content:flex-end;margin-bottom:0">${soundBtn()}</div>
  <div class="home">
  <section class="hero stack">
    <div class="wolf anim">${brandIcon(S.brand.icon)}</div>
    <div class="title"><small>${esc(S.brand.village)}</small><h1>${esc(S.brand.name)}</h1></div>
    <p class="muted">${esc(S.brand.tagline)}</p>
    <div class="face-strip">${[0, 4, 7, 9, 11, 2, 14].map((i) => av(i, 46)).join('')}</div>
  </section>
  <div class="home-side">
    <button class="btn sun" data-act="goJoin">${ICON.users} Join a game</button>
  <details class="card glass">
    <summary>How to play <span class="muted">· 30 seconds</span></summary>
    <div class="stack small" style="margin-top:12px">
      <p><b>Two secret teams.</b> A few players are werewolves. Everyone else is the village.</p>
      <p><b>Night.</b> the wolves pick someone to gobble, the doctor protects someone, and the seer peeks at someone's role. Everyone taps their phone, so nobody can tell who's who.</p>
      <p><b>Day.</b> talk on Teams! Accuse, defend, bluff. Then everyone votes on their phone to kick someone out.</p>
      <p><b>Winning.</b> the village wins when all wolves are gone. The wolves win when there are as many wolves as villagers.</p>
    </div>
  </details>
  ${S.be?.mode === 'demo' ? `<p class="banner"><b>Demo mode.</b> Every browser tab is a separate player. Add your Firebase settings in <b>js/config.js</b> to play online with friends.</p>` : ''}
  </div></div>`;
}

function viewError() {
  return `<div class="card stack center" style="margin-top:20vh"><h2>Can't reach the village</h2><p class="muted">${esc(S.error)}</p><button class="btn" data-act="reload">${ICON.refresh} Try again</button></div>`;
}

// ───────── join ─────────
function viewJoin() {
  return `
  <div class="topbar"><button class="iconbtn" data-act="home" aria-label="Back">${ICON.back}</button><h3>Join the village</h3></div>
  <div class="card stack">
    <div class="field"><label for="f-code">Room code</label>
      <input id="f-code" class="input code" data-bind="code" maxlength="5" autocomplete="off" autocapitalize="characters" placeholder="ABCDE" value="${esc(S.ui.code)}"/></div>
    <div class="field"><label for="f-name">Your name</label>
      <input id="f-name" class="input" data-bind="name" maxlength="16" autocomplete="nickname" placeholder="e.g. Jordan" value="${esc(S.ui.name)}"/></div>
    <div class="field"><label>Pick your villager</label><div class="avpick" id="avgrid"></div>
      <button class="btn ghost small avmore" id="avmore" data-act="moreAv" hidden>${ICON.refresh} Show other villagers</button></div>
    <button class="btn mint" data-act="join">${ICON.arrow} Join game</button>
  </div>`;
}

// Avatars: 18 hand-drawn villagers, then generated ones (see art.js), so even 100+ players
// each get their own face. The picker shows one page of free villagers at a time.
const AV_PAGE = 24;
const freeAvatars = (taken) => Array.from({ length: AVATAR_COUNT }, (_, i) => i).filter((i) => !taken.has(i));
function drawAvGrid() {
  const el = document.getElementById('avgrid');
  if (!el) return;
  const taken = new Set(S.joinPlayers.filter((p) => p.id !== S.uid).map((p) => p.avatar));
  const free = freeAvatars(taken);
  if (S.ui.avatar == null || taken.has(S.ui.avatar)) {
    const firstPage = free.slice(0, AV_PAGE);
    S.ui.avatar = firstPage.length ? firstPage[Math.floor(Math.random() * firstPage.length)] : 0;
  }
  const pages = Math.max(1, Math.ceil(free.length / AV_PAGE));
  const page = (S.ui.avPage || 0) % pages;
  const shown = free.slice(page * AV_PAGE, page * AV_PAGE + AV_PAGE);
  if (!shown.includes(S.ui.avatar)) shown.unshift(S.ui.avatar);     // keep your pick in view
  el.innerHTML = shown.map((i) => `
    <button class="${i === S.ui.avatar ? 'on' : ''}" data-act="pickAv" data-i="${i}" title="${esc(avatarName(i))}" aria-label="${esc(avatarName(i))}" aria-pressed="${i === S.ui.avatar}">${av(i, 0)}</button>`).join('');
  const more = document.getElementById('avmore');
  if (more) more.hidden = pages < 2;
}

function watchJoinRoom() {
  S.joinSub?.(); S.joinSub = null; S.joinPlayers = [];
  if (S.ui.code.length === 5) {
    S.joinSub = S.be.watchCol(`rooms/${S.ui.code}/players`, (list) => { S.joinPlayers = list; drawAvGrid(); });
  }
  drawAvGrid();
}

// ───────── player screens ─────────
function phaseBar() {
  const r = room();
  if (r.phase === 'lobby' && r.autoStartAt && r.pausedLeft == null) {
    return `<div class="phasebar go"><span>Everyone's here. The game starts in <b data-timer data-end="${r.autoStartAt}">${fmt(Math.max(0, Math.ceil((r.autoStartAt - Date.now()) / 1000)))}</b></span></div>`;
  }
  if (!NEXT_SAY[r.phase]) return '';
  if (r.pausedLeft != null) return `<div class="phasebar paused"><span>${ICON.pause} Paused by the moderator</span></div>`;
  if (!r.phaseEndsAt) return '';
  const total = timeFor(r.phase), left = secsLeft();
  return `<div class="phasebar"><span>${NEXT_SAY[r.phase]} <b data-timer data-end="${r.phaseEndsAt}">${fmt(left)}</b></span>
    <div class="pb"><i data-tbar data-end="${r.phaseEndsAt}" data-total="${total}" style="transform:scaleX(${Math.min(1, left / total)})"></i></div></div>`;
}

function viewPlayer() {
  if (!S.room || !S.playersLoaded) return `<div class="center muted" style="padding-top:30vh">Finding your village…</div>`;
  const r = room(); const m = me();
  if (!m) return `<div class="card center stack" style="margin-top:20vh"><h2>You left the village</h2><button class="btn" data-act="leave">Back home</button></div>`;
  const role = S.secret?.role;
  const showRole = role && r.phase !== 'lobby';
  const top = `
  <div class="topbar">
    <span class="chip status"><b class="code">${esc(S.code)}</b><i></i>${['night', 'roles', 'lobby'].includes(r.phase) ? ICON.moon : ICON.sun}${PHASE_LABEL[r.phase] || ''}${r.round && r.phase !== 'ended' ? ` ${r.round}` : ''}</span>
    <span class="spacer"></span>
    ${showRole ? `<button class="chip role" data-act="peek">${ICON.eye} Role</button>` : ''}
    ${soundBtn()}
  </div>`;
  const body = {
    lobby: pLobby, roles: pRoles, night: pNight, morning: pMorning,
    day: pDay, vote: pVote, verdict: pVerdict, ended: pEnded,
  }[r.phase] || (() => '');
  // wolves get their chat beside the game (on the right on wide screens, below on phones)
  const chat = wolfChat();
  return top + phaseBar() + (chat ? `<div class="pgrid"><div class="pmain">${body()}</div><aside class="pside">${chat}</aside></div>` : body());
}

function tiles(list, { pick = false, sel = null, disabled = () => false, tag = () => '', counts = null, color = null } = {}) {
  // big groups: a name search above the grid you pick from
  let search = '';
  if (pick && list.length > 24) {
    const q = (S.ui.find || '').trim().toLowerCase();
    search = `<div class="find"><input class="input" type="search" data-bind="find" autocomplete="off" placeholder="Find a villager by name…" aria-label="Find a villager by name" value="${esc(S.ui.find || '')}"/></div>`;
    if (q) {
      const picked = new Set(Array.isArray(sel) ? sel : [sel]);
      list = list.filter((p) => p.name.toLowerCase().includes(q) || picked.has(p.id));
      if (!list.length) return `${search}<p class="center muted small">Nobody called “${esc(S.ui.find)}”.</p>`;
    }
  }
  return `${search}<div class="grid">${list.map((p) => {
    const dead = !p.alive;
    const t = tag(p);
    const el = pick ? 'button' : 'div';
    const c = counts?.[p.id];
    const on = Array.isArray(sel) ? sel.includes(p.id) : sel === p.id;
    return `<${el} data-key="t-${p.id}" class="tile ${on ? 'on' : ''}" ${pick ? `data-act="pick" data-id="${p.id}"` : ''} ${pick && disabled(p) ? 'disabled' : ''} ${color ? `style="--pick:${color}"` : ''}>
      ${c ? `<span class="count" data-pop>${c}</span>` : ''}
      ${av(p.avatar, 62, { dead, role: dead && p.role ? p.role : null })}
      <span class="name">${esc(p.name)}${p.id === S.uid ? ' (you)' : ''}</span>
      ${t ? `<span class="tag">${t}</span>` : ''}
    </${el}>`;
  }).join('')}</div>`;
}

function pLobby() {
  const m = me();
  return `
  <div class="card stack center">
    <div style="margin:0 auto">${av(m.avatar, 110)}</div>
    <h2>You're in, ${esc(m.name)}!</h2>
    <p class="muted">${isAuto() && planned() ? 'Hang tight. The game starts by itself as soon as everyone is in.' : 'Hang tight. The game starts as soon as the moderator deals the roles.'} Keep this page open next to Teams.</p>
    ${extrasNote()}
  </div>
  <h3 class="section-title">Villagers here <span>${S.players.length}</span></h3>
  ${tiles(S.players)}
  <button class="btn ghost small" style="margin:22px auto 0;display:flex" data-act="leave">Leave game</button>`;
}

function roleBack(role) {
  const R = G.ROLES[role];
  const partners = (S.secret?.partners || []).map(pname);
  return `<div class="stack" style="--rc:${R.color}">
    <div class="art anim">${ROLE_SVG[role]}</div>
    <div><span class="teampill" style="--rc:${R.team === 'village' ? '#3DBF95' : R.color}">${R.team === 'wolves' ? 'Team Wolves' : R.team === 'jester' ? 'On your own' : 'Team Village'}</span></div>
    <div class="rolename" style="--rc:${R.color}">${R.name}</div>
    <p class="muted">${R.blurb}</p>
    ${role === 'werewolf' ? `<p><b>${partners.length ? `Your fellow wolf${partners.length > 1 ? 'ves' : ''}: ${partners.join(', ')}` : 'You are the lone wolf!'}</b></p>` : ''}
  </div>`;
}

function pRoles() {
  const role = S.secret?.role;
  if (!role) return `<div class="card center"><p>Shuffling the role cards…</p></div>`;
  return `
  <div class="flip ${S.ui.flipped ? 'open' : ''}" data-act="flip">
    <div class="flip-inner">
      <div class="face front"><div><div class="moonbig"></div><h2>Your secret role</h2><p style="opacity:.8;margin-top:8px">Keep your screen to yourself.</p><span class="tap-hint">Tap to reveal</span></div></div>
      <div class="face back">${roleBack(role)}</div>
    </div>
  </div>
  ${waiting(S.ui.flipped ? 'Tap the card to hide it. Waiting for night' : 'Waiting for night')}`;
}

function ghostCard(extra = '') {
  return `<div class="card glass center stack">
    <div style="width:110px;margin:0 auto;animation:bob 2.4s ease-in-out infinite">${GHOST}</div>
    <h2>You're a ghost now</h2>
    <p class="muted">You can watch, but please stay quiet on Teams and don't give hints!</p>${extra}</div>`;
}

function pNight() {
  const m = me(); const role = S.secret?.role;
  const ring = ringHTML();
  if (!m.alive) return `<div class="stack">${ring}${ghostCard()}</div>`;
  const r = room();
  const type = G.actionTypeFor(role);
  const sel = S.myAction?.target || null;
  const seerResult = role === 'seer' ? S.secret?.seer?.[r.round] : null;
  const partners = new Set(S.secret?.partners || []);
  let title, hint, list, disabled = () => false, tag = () => '', color;
  const others = alive().filter((p) => p.id !== S.uid);
  switch (role) {
    case 'werewolf':
      title = 'Who will you gobble up tonight?'; color = '#FF6F91';
      hint = wolfKills() > 1
        ? `Tonight the wolves can take up to ${wolfKills()}. Pick different people to take more than one.`
        : 'If the wolves pick different people, the moon decides at random. Agree in the wolf chat!';
      list = alive(); disabled = (p) => p.id === S.uid || partners.has(p.id);
      tag = (p) => (p.id === S.uid || partners.has(p.id) ? 'wolf' : '');
      break;
    case 'doctor':
      title = 'Who will you protect tonight?'; color = '#3DBF95';
      hint = 'You can protect yourself, just not the same person two nights in a row.';
      list = alive(); disabled = (p) => p.id === S.secret?.lastProtected;
      tag = (p) => (p.id === S.secret?.lastProtected ? 'last night' : '');
      break;
    case 'seer':
      title = 'Whose secret will you uncover?'; color = '#8E6CF0';
      hint = 'You get one peek per night. Choose carefully!';
      list = others; disabled = () => !!seerResult;
      break;
    default:
      title = 'Who do you suspect?'; color = '#FFC94D';
      hint = 'Everyone taps something at night so nobody can tell who has powers.';
      list = others;
  }
  const picked = seerResult ? seerResult.target : sel;
  return `
  <div class="stack">
    ${ring}
    <div class="center"><h2>${title}</h2><p class="muted small" style="margin-top:6px">${hint}</p></div>
    ${seerResult ? `<div class="result ${seerResult.isWolf ? 'wolf' : 'safe'}">
        ${av(pl(seerResult.target)?.avatar, 64)}
        <div><b style="font-size:18px">${pname(seerResult.target)}</b><br/>${seerResult.isWolf ? 'is a <b>werewolf</b>.' : 'is <b>not</b> a werewolf.'}</div>
      </div>` : ''}
    ${tiles(list, { pick: true, sel: picked, disabled, tag, color })}
    <p class="center muted small">${seerResult ? 'That’s your vision for tonight.' : picked ? `You picked <b>${pname(picked)}</b>. ${role === 'seer' ? '' : 'You can change until the moon sets.'}` : 'Tap someone to choose.'}</p>
  </div>`;
}

function pMorning() {
  const mo = room().morning || {};
  const vs = victimsOf(mo);
  if (!vs.length) return `
    <div class="card announce">
      <div class="rays"></div>
      <div class="big-art anim">${villagerSVG()}</div>
      <h2>A quiet night</h2>
      <p class="muted" style="margin-top:8px">Everyone woke up safe and sound. Maybe the doctor saved someone…</p>
    </div>${rumorCard()}${hunchCard()}${waiting('Waiting for the debate')}`;
  const isMe = vs.includes(S.uid);
  const names = vs.map((id) => (id === S.uid ? 'you' : esc(pl(id)?.name)));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  const title = vs.length === 1 ? (isMe ? 'Oh no, it was you!' : `${list} was gobbled up!`) : `${list[0].toUpperCase()}${list.slice(1)} were gobbled up!`;
  return `
    <div class="card announce">
      <div class="rays" style="--ray:#ECE6FF"></div>
      <div class="big-av victims">${vs.map((id, i) => `<div class="bitten" style="--i:${i}">${av(pl(id)?.avatar, vs.length > 1 ? 92 : 120, { dead: true })}${BITE}</div>`).join('')}</div>
      <h2>${title}</h2>
      <p class="muted" style="margin-top:6px">The village found ${vs.length > 1 ? 'them' : isMe ? 'you' : 'them'} at sunrise.</p>
      <div class="stamps">${vs.map((id) => { const role = pl(id)?.role; return role ? `<div class="stamp" style="--rc:${RC(role)}">${vs.length > 1 ? `${esc(pl(id)?.name)}: ` : 'They were a '}${G.ROLES[role].name}</div>` : ''; }).join('')}</div>
      ${isMe ? `<p style="margin-top:14px"><b>You're a ghost now.</b> Watch quietly, no hints.</p>` : ''}
    </div>${rumorCard()}${hunchCard()}${waiting('Waiting for the debate')}`;
}

function graveyard() {
  const dead = S.players.filter((p) => !p.alive);
  if (!dead.length) return '';
  return `<h3 class="section-title">Ghosts <span>${dead.length}</span></h3>${tiles(dead, { tag: (p) => (p.role ? G.ROLES[p.role].name : '') })}`;
}

function pDay() {
  return `
  <div class="card stack center">
    <div class="day-art anim" style="width:140px;margin:0 auto">${villagerSVG()}</div>
    <h2>Talk it out</h2>
    <p class="muted">Unmute on Teams and talk it out. Who was acting fishy? Who's defending who?</p>
  </div>
  ${rumorCard()}${hunchCard()}
  <h3 class="section-title">Still standing <span>${alive().length}</span></h3>
  ${tiles(alive())}
  ${graveyard()}`;
}

function myVotes() {
  return nowVotes().find((v) => v.uid === S.uid)?.targets || [];
}
// who died in the night (older rooms only stored one victim)
const victimsOf = (mo) => mo?.victims || (mo?.victim ? [mo.victim] : []);
// the moderator's "wolf kills per night" (1 by default), never above the number of wolves
const killsSetting = (st = room().settings || {}) => Math.max(1, Math.min(st.killsPerNight ?? 1, st.wolves ?? 2));
// what the wolves can actually take tonight: also capped by the living pack
const wolfKills = () => Math.max(1, Math.min(killsSetting(), 1 + (S.secret?.partners || []).filter((id) => pl(id)?.alive).length));
const BITE = biteSVG();
const votesEach = () => G.votesAllowed(room().settings?.votesPerPlayer, alive().length);

function pVote() {
  const m = me();
  const votes = nowVotes();
  const mine = myVotes();
  const n = votesEach();
  const counts = {};
  votes.forEach((v) => { if (pl(v.uid)?.alive) (v.targets || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }); });
  const voters = alive().length;
  const done = votes.filter((v) => pl(v.uid)?.alive && (v.targets || []).length).length;
  return `
  <div class="stack">
    <div class="center"><h2>${m.alive ? 'Who should leave the village?' : 'The village is voting…'}</h2>
      <p class="muted small" style="margin-top:6px">${m.alive
        ? (n > 1 ? `You have <b>${n} votes</b>, one per person. Tap to add or remove.` : 'Tap to vote.') + ' You can change your mind until the moderator closes voting.'
        : 'Ghosts can watch, but not vote.'}</p></div>
    <div class="row" style="justify-content:center;flex-wrap:wrap">
      <span class="chip" data-pop>${ICON.vote} ${done} of ${voters} voted</span>
      ${m.alive ? `<span class="chip votes-left">${Array.from({ length: n }, (_, i) => `<i class="pip ${i < mine.length ? 'used' : ''}"></i>`).join('')} ${n - mine.length} left</span>` : ''}
    </div>
    ${tiles(alive().filter((p) => p.id !== S.uid || !m.alive), { pick: m.alive, sel: mine, counts, color: '#FF6F91', disabled: (p) => p.id === S.uid })}
    ${graveyard()}
  </div>`;
}

function pVerdict() {
  const vd = room().verdict || {};
  if (!vd.out) return `
    <div class="card announce">
      <div class="tie-art" aria-hidden="true">${ICON.scale}</div>
      <h2>${vd.noVotes ? 'Nobody voted!' : "It's a tie!"}</h2>
      <p class="muted" style="margin-top:6px">Nobody leaves the village today.</p>
    </div>${waiting('Night is coming')}`;
  const v = pl(vd.out); const role = v?.role;
  return `
    <div class="card announce">
      <div class="rays" style="--ray:${role === 'werewolf' ? '#FFE7A8' : '#ECE6FF'}"></div>
      <div class="big-av">${av(v?.avatar, 120, { dead: true })}</div>
      <h2>The village voted out ${vd.out === S.uid ? 'you' : esc(v?.name)}!</h2>
      ${role ? `<div class="stamp" style="--rc:${RC(role)}">${role === 'werewolf' ? 'A werewolf!' : `Oops, a ${G.ROLES[role].name}`}</div>` : ''}
    </div>${waiting('Night is coming')}`;
}

function winHero() {
  const w = room().winner;
  if (w === 'jester') {
    const j = S.players.find((p) => p.role === 'jester' || roleOf(p.id) === 'jester');
    return `<div class="card win stack">
    <div class="art anim">${ROLE_SVG.jester}</div>
    <h1 style="font-size:36px">${j ? `${esc(j.name)} the Jester wins` : 'The Jester wins'}</h1>
    <p class="muted">${j?.id === S.uid ? 'You tricked the whole village into voting you out. Take a bow!' : 'The village voted out the Jester, which was exactly their plan. Everyone else loses!'}</p>
  </div>`;
  }
  return `<div class="card win stack">
    <div class="art anim">${w === 'wolves' ? ROLE_SVG.werewolf : ROLE_SVG.villager}</div>
    <h1 style="font-size:36px">${w === 'wolves' ? 'The werewolves win' : 'The village wins'}</h1>
    <p class="muted">${w === 'wolves' ? 'The wolves out-numbered the village. Awoooo!' : 'Every werewolf has been found. Moonhollow is safe!'}</p>
  </div>`;
}

function rolesList() {
  return `<div class="plist">${S.players.map((p) => {
    const role = roleOf(p.id) || p.role;
    return `<div class="prow ${p.alive ? '' : 'dead'}">${av(p.avatar, 42, { dead: !p.alive })}
      <div class="who"><b>${esc(p.name)}${p.id === S.uid ? ' (you)' : ''}</b><span>${p.alive ? 'Survived' : 'Ghost'}</span></div>
      ${role ? `<span class="rtag" style="--rc:${RC(role)}">${G.ROLES[role].name}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

function pEnded() {
  confetti();
  return `<div class="stack">${winHero()}
    <div class="card stack"><h3>Everyone's secret roles</h3>${rolesList()}</div>
    <p class="center muted">The moderator can start a new game. Stay here!</p>
    <button class="btn ghost small" style="margin:0 auto;display:flex" data-act="leave">Leave</button></div>`;
}

// ── in-app "are you sure?" dialog (the browser's confirm() is blocked in some viewers) ──
function askConfirm(opts) {
  return new Promise((resolve) => {
    S.ui.confirm = opts;
    S.confirmResolve = resolve;
    render();
    setTimeout(() => document.querySelector('.confirm [data-act=confirmCancel]')?.focus(), 60);
  });
}
function closeConfirm(answer) {
  const done = () => {
    const resolve = S.confirmResolve;
    S.ui.confirm = null; S.confirmResolve = null;
    render(); resolve?.(answer);
  };
  const bg = document.querySelector('.confirm-bg');
  if (!bg || bg.classList.contains('closing')) return done();
  bg.classList.add('closing');                    // exit is quicker than the entrance
  setTimeout(done, 150);
}
function viewConfirm() {
  const c = S.ui.confirm;
  return `<div class="confirm-bg" data-act="confirmCancel">
    <div class="confirm" data-act="noop" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d">
      <div class="cf-ico" aria-hidden="true">${ICON[c.icon] || ICON.alert}</div>
      <h3 id="cf-t">${c.title}</h3>
      <p id="cf-d">${c.text}</p>
      <div class="cf-btns">
        <button class="btn ghost small" data-act="confirmCancel">${c.cancel || 'Cancel'}</button>
        <button class="btn small ${c.danger ? 'pink' : ''}" data-act="confirmOk">${c.ok}</button>
      </div>
    </div></div>`;
}

function viewSheet() {
  const role = S.secret?.role;
  if (!role) return '';
  return `<div class="sheet-bg" data-act="closeSheet"><div class="sheet">${roleBack(role)}
    <p class="muted small" style="margin-top:12px">Tap anywhere to hide</p></div></div>`;
}

// ───────── moderator screens ─────────
function viewMod() {
  const r = room();
  const idx = PHASES.indexOf(r.phase);
  const steps = PHASES.map((p, i) => `<span class="${r.phase === p ? 'on' : i < idx || r.phase === 'ended' ? 'done' : ''}">${PHASE_LABEL[p]}</span>`).join('');
  return `
  <div class="topbar">
    <button class="iconbtn" data-act="leave" aria-label="Admin home" title="Admin home">${ICON.back}</button>
    <span class="chip" style="background:var(--purple);color:#fff">${ICON.crown} Moderator</span>
    <span class="chip">${r.round ? `Round ${r.round}` : 'Setting up'}</span>
    <span class="spacer"></span>
    ${soundBtn()}
  </div>
  <div class="modgrid">
    <div class="stack">
      <div class="card stack">
        <div class="row wrap">
          <div><p class="muted small" style="font-weight:800">ROOM CODE</p><div class="codebig">${esc(S.code)}</div></div>
          <span class="spacer"></span>
          <div class="row wrap">
            <button class="btn small" data-act="copyInvite">${ICON.copy} Copy invite for Teams</button>
            ${S.be.mode === 'demo' ? `<button class="btn small sun" data-act="openTab">${ICON.users} Open player tab</button>` : ''}
          </div>
        </div>
        <p class="muted small">Paste the invite into the Teams meeting chat. Players join on their phones.</p>
      </div>
      <div class="card stack">
        <div class="steps">${steps}</div>
        ${modControl()}
      </div>
      <div class="card stack">
        <div class="row"><h3>Players (${S.players.length}${planned() && r.phase === 'lobby' ? ` of ${planned()}` : ''})</h3><span class="spacer"></span>
          ${r.phase === 'lobby' ? `<button class="btn small mint" data-act="addBot">${ICON.bot} Add test bot</button>` : ''}</div>
        ${modPlayers()}
      </div>
    </div>
    <div class="stack">
      <p class="banner">${ICON.lock} Only you can see this screen. Keep this tab open: it runs the game. Don't share your screen on Teams!</p>
      ${S.chat.length ? `<div class="card stack"><h3>${ICON.paw} Wolf chat</h3><p class="muted small">Only the wolves and you can see this.</p>${chatLog()}</div>` : ''}
      <div class="card stack"><h3>Moderator log</h3>
        <div class="log">${(S.mod?.log || []).slice().reverse().map((l) => `<div data-key="log-${l.t}">${l.text}</div>`).join('') || '<p class="muted small">Things that happen will show up here.</p>'}</div>
      </div>
    </div>
  </div>`;
}

// ───────── wolf pack chat ─────────
// Only the wolves of the current deal (and the moderator) can read it; the database rules
// enforce that too. Living wolves can write while roles are shown and at night.
const CHAT_PHASES = ['roles', 'night'];
const isLivingWolf = () => !S.isMod && S.secret?.role === 'werewolf' && !!me()?.alive;

function watchWolfChat() {
  const deal = room().dealtAt;
  const want = deal && (S.isMod || S.secret?.role === 'werewolf') ? `${S.code}|${deal}` : null;
  if (want === S.chatKey) return;
  S.chatSub?.(); S.chatSub = null; S.chat = []; S.chatKey = want;
  if (!want) return;
  S.chatSub = S.be.watchCol(`rooms/${S.code}/wolfchat`, (list) => {
    const before = S.chat.length;
    S.chat = list.filter((m) => m.deal === deal).sort((a, b) => a.t - b.t);
    const fresh = S.chat.slice(before);
    // no sound: a ping on a Teams call would give a wolf away. A short buzz is enough.
    if (before && fresh.some((m) => m.uid !== S.uid)) navigator.vibrate?.(30);
    render();
    setTimeout(() => document.querySelectorAll('.chatlog').forEach((el) => { el.scrollTop = el.scrollHeight; }), 40);
  }, ['deal', deal]);
}

function chatLog() {
  return `<div class="chatlog" role="log" aria-live="polite">${S.chat.slice(-60).map((m) => {
    const mine = m.uid === S.uid;
    return `<div class="msg ${mine ? 'mine' : ''}" data-key="m-${m.id}">${mine ? '' : `<b>${pname(m.uid)}</b>`}<span>${esc(m.text)}</span></div>`;
  }).join('') || '<p class="muted small chat-empty">Say hi to your fellow wolves and agree who to visit tonight.</p>'}</div>`;
}

function wolfChat() {
  if (!isLivingWolf() || !CHAT_PHASES.includes(room().phase)) return '';
  const wolves = (S.secret?.partners || []).filter((id) => pl(id)?.alive);
  return `<section class="card glass wolfchat" aria-label="Wolf chat">
    <div class="wc-head"><h3>${ICON.paw} Wolf chat</h3><span class="small">${ICON.lock} Only wolves see this</span></div>
    ${wolves.length ? `<p class="wc-who small">With ${wolves.map((id) => `<b>${pname(id)}</b>`).join(', ')}</p>${chatLog()}` : '<p class="muted small">You are the only wolf left. Nobody to chat with.</p>'}
    ${wolves.length ? `<div class="wc-send">
      <input class="input" data-bind="chat" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="Whisper to the wolves…" aria-label="Message the other wolves" value="${esc(S.ui.chat)}"/>
      <button class="btn small" data-act="sendChat" aria-label="Send">${ICON.arrow}</button></div>` : ''}
  </section>`;
}

async function sendWolfChat() {
  const text = (S.ui.chat || '').trim().slice(0, 200);
  if (!text || !isLivingWolf() || !CHAT_PHASES.includes(room().phase)) return;
  S.ui.chat = '';
  const input = document.querySelector('[data-bind="chat"]');
  if (input) input.value = '';
  const t = Date.now();
  try {
    await S.be.set(`rooms/${S.code}/wolfchat/${t}_${S.uid}`, { uid: S.uid, text, t, deal: room().dealtAt });
  } catch (e) {
    S.ui.chat = text; if (input) input.value = text;
    toast("Couldn't send: " + e.message);
  }
}

function script(t) { return `<div class="script">${t}</div>`; }

// how many of each special role the moderator chose (everyone else = villager)
function roleCounts(st = room().settings || {}) {
  return { werewolf: st.wolves ?? 2, doctor: st.doctors ?? 1, seer: st.seers ?? 1, jester: st.jesters ?? 0 };
}
// everyone who isn't a plain villager
const specialCount = (c) => c.werewolf + c.doctor + c.seer + (c.jester || 0);
const WIN_LOG = { wolves: 'Werewolves win.', village: 'Village wins.', jester: 'The Jester wins!' };
// optional: the moderator plans the player count in advance (null = use whoever joined)
const MAX_PLAYERS = 200;   // a Firestore batch holds 500 writes; dealing or revealing 200 players stays well inside
const planned = (st = room().settings || {}) => (Number.isInteger(st.plannedPlayers) ? st.plannedPlayers : null);
const planN = () => planned() ?? S.players.length;

function roleSummary(c, n) {
  const v = Math.max(0, n - specialCount(c));
  const part = (k, one, many, x) => (x ? `${x} ${x === 1 ? one : many}` : '');
  return [part('w', 'werewolf', 'werewolves', c.werewolf), part('d', 'doctor', 'doctors', c.doctor), part('s', 'seer', 'seers', c.seer), part('j', 'jester', 'jesters', c.jester), part('v', 'villager', 'villagers', v)].filter(Boolean).join(' · ');
}
function roleStepper(key, label, value, color, art) {
  return `<div class="rolestep" style="--rc:${color}">
    <div class="rs-art">${art}</div>
    <b class="rs-name">${label}</b>
    <div class="stepper"><button data-act="roleCount" data-k="${key}" data-d="-1" aria-label="fewer ${label}">−</button><b>${value}</b><button data-act="roleCount" data-k="${key}" data-d="1" aria-label="more ${label}">+</button></div>
  </div>`;
}

function autoControls() {
  const r = room();
  const paused = r.pausedLeft != null;
  const total = timeFor(r.phase), left = secsLeft();
  const next = NEXT_NAME[r.phase];
  return `<div class="autobar ${paused ? 'paused' : ''}">
    <div class="ab-time"><small>${paused ? 'Paused' : `${next} starts automatically in`}</small>
      <b ${paused ? '' : `data-timer data-end="${r.phaseEndsAt}"`}>${fmt(left)}</b></div>
    <div class="pb"><i ${paused ? '' : `data-tbar data-end="${r.phaseEndsAt}" data-total="${total}"`} style="transform:scaleX(${Math.min(1, left / total)})"></i></div>
    <div class="ab-btns">
      <button class="btn small ghost" data-act="${paused ? 'resume' : 'pause'}">${paused ? `${ICON.play} Resume` : `${ICON.pause} Pause`}</button>
      <button class="btn small ghost" data-act="extend">+30s</button>
      <button class="btn small" data-act="skip">${ICON.skip} Skip to ${next}</button>
    </div></div>`;
}
const ctl = (manualButtons) => (isAuto() ? autoControls() : manualButtons);

function timersField() {
  const r = room();
  const rows = (isAuto() ? TIMERS : TIMERS.filter((t) => t.k === 'night'));
  return `<div class="field"><label>Timers</label>
    ${toggle('auto', 'Automatic mode', 'The app runs every phase by itself (roles → night → morning → debate → vote → verdict) using these timers, until someone wins. You can still pause, add time or skip.', isAuto())}
    <div class="timers">${rows.map((t) => `<div class="trow"><span>${ICON[t.icon]}${t.label}</span>
      <div class="seg">${t.opts.map((o) => `<button class="${timeFor(t.k) === o ? 'on' : ''}" data-act="timer" data-k="${t.k}" data-s="${o}">${fmt(o)}</button>`).join('')}</div></div>`).join('')}</div>
    ${isAuto() ? toggle('voteEarly', 'End voting early', 'Close the vote as soon as every living player has used all their votes.', r.settings?.voteEarly !== false) : ''}
  </div>`;
}

function modControl() {
  const r = room();
  const n = S.players.length;
  const c = roleCounts();
  const w = c.werewolf;
  switch (r.phase) {
    case 'lobby': {
      const plan = planned();
      const N = planN();                                   // the number the roles are planned for
      const joined = n;
      let problem = G.validateRoles(N, c);
      let note = '';
      if (!problem && plan) {
        if (joined < plan) problem = `Waiting for ${plan - joined} more player${plan - joined === 1 ? '' : 's'} (${joined} of ${plan} joined).`;
        else if (joined > plan) {
          problem = G.validateRoles(joined, c);
          note = `${joined - plan} more joined than planned. They'll be extra villagers.`;
        }
      }
      const sug = G.suggestRoles(N);
      const isSug = sug.werewolf === c.werewolf && sug.doctor === c.doctor && sug.seer === c.seer && sug.jester === c.jester;
      const villagers = Math.max(0, N - specialCount(c));
      return `
        <h2>Set up the game</h2>
        ${toggle('plan', 'Plan the player count', 'Set how many players you expect, so you can plan exactly how many villagers, doctors, seers and werewolves before anyone joins. The game waits until everyone is in.', !!plan)}
        ${plan ? `<div class="planrow">
            <div class="field"><label>Players expected</label>
              <div class="stepper"><button data-act="planned" data-d="-1" aria-label="fewer players">−</button><b>${plan}</b><button data-act="planned" data-d="1" aria-label="more players">+</button></div></div>
            <div class="joinbar" aria-label="${joined} of ${plan} joined"><div style="transform:scaleX(${Math.min(1, joined / plan)})"></div></div>
            <span class="small"><b>${joined}</b> of ${plan} joined</span>
          </div>` : ''}
        <div class="field"><div class="row"><label>Roles for ${N} player${N === 1 ? '' : 's'}</label><span class="spacer"></span>
          ${N >= G.MIN_PLAYERS && !isSug ? `<button class="btn small ghost" data-act="suggestRoles">Use suggested for ${N}</button>` : ''}</div>
          <div class="rolesteps">
            ${roleStepper('wolves', 'Werewolves', c.werewolf, G.ROLES.werewolf.color, ROLE_SVG.werewolf)}
            ${roleStepper('doctors', 'Doctors', c.doctor, G.ROLES.doctor.color, ROLE_SVG.doctor)}
            ${roleStepper('seers', 'Seers', c.seer, G.ROLES.seer.color, ROLE_SVG.seer)}
            ${roleStepper('jesters', 'Jester', c.jester, G.ROLES.jester.color, ROLE_SVG.jester)}
            ${plan ? roleStepper('villagers', 'Villagers', villagers, G.ROLES.villager.color, ROLE_SVG.villager)
                   : `<div class="rolestep auto" style="--rc:${G.ROLES.villager.color}">
              <div class="rs-art">${ROLE_SVG.villager}</div>
              <b class="rs-name">Villagers</b>
              <div class="rs-auto"><b>${villagers}</b><span>everyone else</span></div>
            </div>`}
          </div>
          ${note ? `<p class="banner">${note}</p>` : ''}
          <p class="muted small">When you deal, the app shuffles everyone and hands out these roles at random. Nobody (not even you) chooses who gets what.</p>
        </div>
        <div class="row wrap" style="gap:24px">
          <div class="field"><label>Votes per player</label>
            <div class="stepper"><button data-act="vpp" data-d="-1" aria-label="fewer votes">−</button><b>${r.settings?.votesPerPlayer ?? 1}</b><button data-act="vpp" data-d="1" aria-label="more votes">+</button></div>
            <span class="muted small">each morning vote</span></div>
          <div class="field"><label>Wolf kills per night</label>
            <div class="stepper"><button data-act="kills" data-d="-1" aria-label="fewer kills">−</button><b>${killsSetting()}</b><button data-act="kills" data-d="1" aria-label="more kills">+</button></div>
            <span class="muted small">${killsSetting() >= c.werewolf && c.werewolf > 1 ? 'one per wolf' : killsSetting() === 1 ? 'the wolves share one' : `up to ${killsSetting()} a night`}</span></div>
        </div>
        ${timersField()}
        <div class="field"><label>Extra clues for the village</label>
          ${toggle('hunch', 'Village hunch', 'Each morning, everyone sees who got the most “Who do you suspect?” taps last night. The count is anonymous.', r.settings?.hunch)}
          ${toggle('rumor', 'Rumors', 'Each morning, one random villager secretly hears a true clue: “One of these 3 people is a werewolf.” Makes the game easier for the village.', r.settings?.rumor)}
        </div>
        ${problem ? `<p class="banner">${problem}</p>` : ''}
        ${!problem && r.autoStartAt ? `<p class="banner go">Everyone's here. Starting automatically in <b data-timer data-end="${r.autoStartAt}">${fmt(Math.max(0, Math.ceil((r.autoStartAt - Date.now()) / 1000)))}</b></p>` : ''}
        ${isAuto() && plan && !r.autoStartAt ? `<p class="muted small">The game will start by itself 10 seconds after all ${plan} players have joined.</p>` : ''}
        <button class="btn" data-act="deal" ${problem ? 'disabled' : ''}>${ICON.dice} ${isAuto() ? (r.autoStartAt ? 'Start now' : 'Deal roles & start') : 'Deal random roles'}</button>`;
    }
    case 'roles':
      return `<h2>Roles are dealt</h2>
        <p class="muted small">${roleSummary(roleCounts(), S.players.length)}</p>
        ${script('“Check your phone and tap the card to see your secret role. Don’t show anyone!”')}
        <button class="btn ghost small" data-act="reshuffle">${ICON.dice} Reshuffle roles</button>
        ${ctl(`<button class="btn" data-act="night">${ICON.moon} Start Night ${r.round + 1}</button>`)}`;
    case 'night': {
      const acted = new Set(nowActions().map((a) => a.uid));
      const al = alive();
      return `<div class="row">${ringHTML('style="margin:0"')}
          <div><h2>Night ${r.round}</h2><p class="muted">${al.filter((p) => acted.has(p.id)).length} of ${al.length} players have chosen</p></div></div>
        ${script('“Night falls on Moonhollow… Everyone mute and turn your camera off. Make your choice on your phone.”')}
        ${ctl(`<button class="btn pink" data-act="endNight">${ICON.skip} End night now</button>`)}`;
    }
    case 'morning': {
      const vs = victimsOf(r.morning);
      const was = (id) => `<b>${pname(id)}</b> was a <b>${G.ROLES[S.mod?.roles?.[id]]?.name}</b>`;
      return `<h2>Morning</h2>
        ${vs.length === 1 ? script(`“As the sun rose… the village found <b>${pname(vs[0])}</b> gobbled up! They were a <b>${G.ROLES[S.mod?.roles?.[vs[0]]]?.name}</b>.”`)
          : vs.length ? script(`“As the sun rose… the wolves struck ${vs.length} times! ${vs.map(was).join(', and ')}.”`)
            : script('“Good news! Nobody died last night. Someone must have been protected…”')}
        ${r.morning?.hunch ? script(`“The village’s hunch… most of you suspected <b>${r.morning.hunch.ids.map(pname).join(' and ')}</b> last night. Hmm…”`) : ''}
        ${r.morning?.rumor ? `<p class="banner">Rumor sent privately to <b>${pname(r.morning.rumor)}</b>. Don't say who!</p>` : ''}
        ${ctl(`<button class="btn sun" data-act="day">${ICON.sun} Start the debate</button>`)}`;
    }
    case 'day':
      return `<h2>Debate</h2>
        ${script('“Unmute and talk! Who’s acting suspicious? When you’re ready, we vote.”')}
        <div class="row wrap"><div class="field"><label>Votes per player this round</label>
          <div class="stepper"><button data-act="vpp" data-d="-1" aria-label="fewer votes">−</button><b>${r.settings?.votesPerPlayer ?? 1}</b><button data-act="vpp" data-d="1" aria-label="more votes">+</button></div></div>
          <p class="muted small" style="flex:1;min-width:180px">Each player can vote for up to this many different people. Most votes is out, and a tie means nobody is out.</p></div>
        ${ctl(`<button class="btn" data-act="openVote">${ICON.vote} Open voting</button>`)}`;
    case 'vote': {
      const votes = nowVotes().filter((v) => pl(v.uid)?.alive && (v.targets || []).length);
      return `<h2>Voting</h2>
        <p class="muted">${votes.length} of ${alive().length} have voted · ${votesEach()} vote${votesEach() > 1 ? 's' : ''} each</p>
        ${script(votesEach() > 1 ? `“Voting is open on your phones! Everyone gets ${votesEach()} votes. Choose wisely!”` : '“Voting is open on your phones. Choose wisely!”')}
        ${ctl(`<button class="btn pink" data-act="closeVote">${ICON.check} Close voting</button>`)}`;
    }
    case 'verdict': {
      const vd = r.verdict || {};
      return `<h2>Verdict</h2>
        ${vd.out ? script(`“The village has spoken… <b>${pname(vd.out)}</b> is out! They were a <b>${G.ROLES[S.mod?.roles?.[vd.out]]?.name}</b>.”`)
                 : script(vd.noVotes ? '“Nobody voted, so nobody leaves today.”' : '“It’s a tie! Nobody leaves the village today.”')}
        ${ctl(`<button class="btn" data-act="night">${ICON.moon} Start Night ${r.round + 1}</button>`)}`;
    }
    case 'ended':
      return `${winHero()}<button class="btn mint" data-act="again">${ICON.refresh} Play again with same players</button>`;
    default: return '';
  }
}

function modPlayers() {
  const r = room();
  const acts = Object.fromEntries(nowActions().map((a) => [a.uid, a]));
  const votes = Object.fromEntries(nowVotes().map((v) => [v.uid, v.targets || []]));
  const verb = { kill: 'attacks', protect: 'protects', inspect: 'checks', suspect: 'suspects' };
  if (!S.players.length) return `<p class="muted">Nobody yet. Share the invite in the Teams chat.</p>`;
  return `<div class="plist">${S.players.map((p) => {
    const role = S.mod?.roles?.[p.id];
    let activity = p.alive ? 'Alive' : 'Ghost';
    if (p.bot) activity += ' · bot';
    if (r.phase === 'night' && p.alive) activity = acts[p.id] ? `${verb[acts[p.id].type]} ${pname(acts[p.id].target)}` : 'choosing…';
    if (r.phase === 'vote' && p.alive) activity = votes[p.id]?.length ? `votes ${votes[p.id].map(pname).join(', ')}` : 'thinking…';
    return `<div class="prow ${p.alive ? '' : 'dead'}">${av(p.avatar, 42, { dead: !p.alive })}
      <div class="who"><b>${esc(p.name)}</b><span>${activity}</span></div>
      ${role && r.phase !== 'lobby' ? `<span class="rtag" style="--rc:${RC(role)}">${G.ROLES[role].name}</span>` : ''}
      ${r.phase === 'lobby' ? `<button class="xbtn" data-act="kick" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">${ICON.x}</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ═════════════════════════ branding & sound buttons ═════════════════════════
const ICON_CHOICES = [
  { type: 'art', id: 'werewolf' }, { type: 'art', id: 'seer' }, { type: 'art', id: 'doctor' },
  { type: 'art', id: 'villager' }, { type: 'art', id: 'ghost' },
  ...[0, 4, 2, 9, 11, 3, 7].map((i) => ({ type: 'avatar', id: i })),
];
const sameIcon = (a, b) => a && b && a.type === b.type && a.id === b.id && a.data === b.data;

function iconSVG(icon) {
  if (!icon || icon.type === 'art') return icon?.id === 'ghost' ? GHOST : ROLE_SVG[icon?.id] || ROLE_SVG.werewolf;
  if (icon.type === 'avatar') return AV_CACHE[icon.id] ||= avatarSVG(icon.id);
  return '';
}
function brandIcon(icon) {
  if (icon?.type === 'image' && icon.data) return `<img class="bimg" src="${esc(icon.data)}" alt="App icon"/>`;
  return iconSVG(icon);
}
function applyBrand() {
  const b = S.brand;
  document.title = b.name + (PAGE === 'admin' ? ' · Admin' : '');
  const href = b.icon?.type === 'image' ? b.icon.data : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSVG(b.icon));
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.append(link); }
  link.href = href;
}

function soundBtn() {
  const m = SND.getMode();
  const icon = m === 'all' ? ICON.soundAll : m === 'sfx' ? ICON.soundSfx : ICON.soundOff;
  const label = m === 'all' ? 'Music and sounds on' : m === 'sfx' ? 'Sound effects only' : 'Muted';
  return `<button class="iconbtn" data-act="sound" aria-label="${label}" title="${label}">${icon}</button>`;
}

async function fileToIcon(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = 192;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
    let d = c.toDataURL('image/webp', 0.85);
    if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/png');
    return d;
  } finally { URL.revokeObjectURL(url); }
}

// ═════════════════════════ admin page ═════════════════════════
function viewAdminGate() {
  const setup = S.view === 'adminSetup';
  return `
  <div class="topbar" style="justify-content:flex-end;margin-bottom:0">${soundBtn()}</div>
  <section class="hero stack">
    <div class="wolf" style="width:150px">${brandIcon(S.brand.icon)}</div>
    <div class="title"><small>${esc(S.brand.village)} · Admin</small><h1>${esc(S.brand.name)}</h1></div>
  </section>
  <div class="card stack" style="margin-top:18px">
    <h3>${setup ? 'First-time setup' : 'Moderator sign-in'}</h3>
    <p class="muted small">${setup
      ? 'Create an admin PIN. Anyone who wants to moderate a game will need it, so keep it secret!'
      : 'Enter the admin PIN to run games and change the app’s look. You only need to do this once per device.'}</p>
    <div class="field"><label for="f-pin">${setup ? 'New admin PIN (at least 4 characters)' : 'Admin PIN'}</label>
      <input id="f-pin" class="input code" type="password" data-bind="pin" maxlength="20" autocomplete="off" value="${esc(S.ui.pin)}"/></div>
    ${setup ? `<div class="field"><label for="f-pin2">Type it again</label>
      <input id="f-pin2" class="input code" type="password" data-bind="pin2" maxlength="20" autocomplete="off" value="${esc(S.ui.pin2)}"/></div>` : ''}
    <button class="btn" data-act="${setup ? 'adminSetup' : 'adminLogin'}">${ICON.lock} ${setup ? 'Create PIN & continue' : 'Unlock'}</button>
    ${setup ? '' : `<button class="btn ghost small" style="margin:0 auto" data-act="showSetup">First time? Set up a PIN</button>`}
  </div>`;
}

const playerLink = () => new URL('./', location.href).href;

function viewAdminHome() {
  const d = S.ui.draft ||= JSON.parse(JSON.stringify(S.brand));
  const last = S.lastRoom;
  return `
  <div class="topbar">
    <div class="av" style="--s:44px">${brandIcon(S.brand.icon)}</div>
    <h3>${esc(S.brand.name)}</h3>
    <span class="chip" style="background:var(--purple);color:#fff">${ICON.crown} Admin</span>
    <span class="spacer"></span>${soundBtn()}
  </div>
  <div class="modgrid">
    <div class="stack">
      <div class="card stack">
        <h2>Start a game</h2>
        <p class="muted">You'll be the moderator. You run the game but don't play.</p>
        <button class="btn" data-act="create">${ICON.sparkle} Create a new game</button>
        ${last ? `<button class="btn sun" data-act="resumeGame">${ICON.play} Resume game ${esc(last.code)} <span class="small" style="opacity:.75">(${PHASE_LABEL[last.phase] || last.phase})</span></button>` : ''}
      </div>
      <div class="card stack">
        <h3>${ICON.link} Player link</h3>
        <p class="muted small">This is the public link. It only lets people <b>join</b> a game. This admin page has its own separate link, so keep it to yourself.</p>
        <div class="urlbox"><span>${esc(playerLink())}</span><button class="btn small" data-act="copyLink">${ICON.copy} Copy</button></div>
      </div>
      <div class="card stack">
        <h3>${ICON.lock} Security</h3>
        <div class="row wrap"><input class="input" style="flex:1;min-width:160px" type="password" data-bind="newPin" placeholder="New admin PIN" maxlength="20" value="${esc(S.ui.newPin)}"/>
          <button class="btn small" data-act="changePin">Change PIN</button></div>
        <button class="btn ghost small" data-act="lockDevice">Sign this device out of admin</button>
      </div>
    </div>
    <div class="stack">
      <div class="card stack">
        <h2>${ICON.gear} App look</h2>
        <p class="muted small">Change the name and icon everyone sees on the join page, the browser tab and the home-screen icon.</p>
        <div id="brandPreview" class="brandprev"></div>
        <div class="field"><label for="b-name">App name</label><input id="b-name" class="input" data-bind="brand.name" maxlength="24" value="${esc(d.name)}"/></div>
        <div class="field"><label for="b-village">Small title above the name</label><input id="b-village" class="input" data-bind="brand.village" maxlength="24" value="${esc(d.village)}"/></div>
        <div class="field"><label for="b-tag">Tagline</label><input id="b-tag" class="input" data-bind="brand.tagline" maxlength="70" value="${esc(d.tagline)}"/></div>
        <div class="field"><label>Icon</label>
          <div class="iconpick">
            ${ICON_CHOICES.map((c, i) => `<button class="${sameIcon(c, d.icon) ? 'on' : ''}" data-act="pickIcon" data-i="${i}" aria-label="Icon ${i + 1}">${iconSVG(c)}</button>`).join('')}
            ${d.icon?.type === 'image' ? `<button class="on" aria-label="Your picture"><img class="bimg" src="${esc(d.icon.data)}" alt=""/></button>` : ''}
            <label class="upload" title="Upload your own picture">${ICON.upload}<span>Upload</span><input type="file" accept="image/*" data-file="icon" hidden/></label>
          </div></div>
        <div class="row"><button class="btn ghost small" data-act="resetBrand">Reset to default</button><span class="spacer"></span>
          <button class="btn mint small" data-act="saveBrand">${ICON.check} Save look</button></div>
      </div>
    </div>
  </div>`;
}

function drawBrandPreview() {
  const el = document.getElementById('brandPreview');
  const d = S.ui.draft;
  if (!el || !d) return;
  el.innerHTML = `<div class="bp-icon">${brandIcon(d.icon)}</div>
    <div><small>${esc(d.village)}</small><b>${esc(d.name)}</b><span>${esc(d.tagline)}</span></div>`;
}

async function loadLastRoom() {
  const sess = store.get();
  S.lastRoom = null;
  if (!sess?.code) return;
  try {
    const r = await S.be.get(`rooms/${sess.code}`);
    if (r && r.moderatorUid === S.uid && !r.closed) S.lastRoom = { code: sess.code, phase: r.phase };
  } catch {}
  render();
}

async function adminSetup() {
  const pin = S.ui.pin.trim();
  if (pin.length < 4) return toast('Use at least 4 characters');
  if (pin !== S.ui.pin2.trim()) return toast("The two PINs don't match");
  let existing = null;
  try { existing = await S.be.get('app/secret'); } catch {}
  if (existing) { S.view = 'adminLogin'; return toast('A PIN already exists. Please sign in with it.'); }
  try { await S.be.set('app/secret', { pin }); }
  catch { S.view = 'adminLogin'; return toast('A PIN already exists. Please sign in with it.'); }
  await S.be.set(`admins/${S.uid}`, { pin, at: Date.now() });
  if (!S.brandLoaded) await S.be.set('app/branding', { ...DEFAULT_BRAND });
  S.ui.pin = S.ui.pin2 = '';
  S.view = 'adminHome'; SND.play('join');
}

async function adminLogin() {
  const pin = S.ui.pin.trim();
  if (!pin) return toast('Type the admin PIN');
  let secret = null;
  try { secret = await S.be.get('app/secret'); } catch {}           // Firebase never lets anyone read it
  if (secret && secret.pin !== pin) return toast('Wrong PIN');      // (demo mode checks here instead)
  if (S.be.mode === 'demo' && !secret) return toast('No PIN set up yet. Tap "First time?" below.');
  try { await S.be.set(`admins/${S.uid}`, { pin, at: Date.now() }); }
  catch { return toast('Wrong PIN'); }
  S.ui.pin = '';
  S.view = 'adminHome'; SND.play('join');
  loadLastRoom();
}

async function saveBrand() {
  const d = S.ui.draft;
  const clean = {
    name: (d.name || '').trim() || DEFAULT_BRAND.name,
    village: (d.village || '').trim(),
    tagline: (d.tagline || '').trim(),
    icon: d.icon || DEFAULT_BRAND.icon,
  };
  await S.be.set('app/branding', clean);
  S.ui.draft = null;
  toast('Saved. Everyone will see the new look.');
}

// ═════════════════════════ automatic game master ═════════════════════════
// Runs in the moderator's browser (there is no server). It checks the clock a
// few times a second and moves the game on when a phase's time is up.
const STEP = { roles: () => startNight(), night: () => resolveNightNow(), morning: () => startDay(), day: () => openVote(), vote: () => closeVote(), verdict: () => startNight() };

async function advance(r, why) {
  const key = `${r.game}|${r.round}|${r.phase}|${r.dealtAt || ''}`;
  if (S.advanced === key) return;
  S.advanced = key;
  try { await STEP[r.phase]?.(); }
  catch (e) { S.advanced = null; console.error('auto', why, e); }
}

async function autoStep() {
  const r = room();
  if (!S.isMod || !S.mod || S.busy || S.autoBusy || r.pausedLeft != null) return;
  S.autoBusy = true;
  try {
    if (r.phase === 'lobby') return await autoStart(r);
    if (r.phase === 'ended' || !r.phaseEndsAt) return;
    let due = Date.now() >= r.phaseEndsAt;
    if (!due && r.phase === 'vote' && isAuto() && r.settings?.voteEarly !== false) {
      const need = votesEach();
      const al = alive();
      due = al.length > 0 && al.every((p) => (nowVotes().find((v) => v.uid === p.id)?.targets || []).length >= need);
    }
    if (!due || (!isAuto() && r.phase !== 'night')) return;
    await advance(r, 'timer');
  } finally { S.autoBusy = false; }
}

// with a planned player count, the game starts itself 10s after everyone joins
async function autoStart(r) {
  const plan = planned();
  if (!isAuto() || !plan) { if (r.autoStartAt) await S.be.update(P(), { autoStartAt: null }); return; }
  const ready = S.players.length >= plan && !G.validateRoles(S.players.length, roleCounts());
  if (ready && !r.autoStartAt) return S.be.update(P(), { autoStartAt: Date.now() + 10000 });
  if (!ready && r.autoStartAt) return S.be.update(P(), { autoStartAt: null });
  if (ready && Date.now() >= r.autoStartAt) {
    const key = `${r.game}|start`;
    if (S.advanced === key) return;
    S.advanced = key;
    await dealRoles();
  }
}

// a clock in a Web Worker keeps ticking even when the moderator's tab is in the
// background (browsers slow down normal timers in hidden tabs)
function startClock() {
  if (S.clock) return;
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 500)'], { type: 'text/javascript' }));
    S.clock = new Worker(url);
    S.clock.onmessage = () => tick();
  } catch { /* the normal timer still works */ }
}

// ═════════════════════════ timer ═════════════════════════
function tick() {
  if (S.view !== 'game') return;
  const r = room();
  if (r.phase === 'night') {
    const left = secsLeft();
    const total = timeFor('night');
    document.querySelectorAll('[data-ring]').forEach((el) => {
      const num = el.querySelector('[data-countdown]');
      if (num.textContent !== String(left)) {
        num.textContent = left;
        if (left <= 5 && left > 0) num.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
      el.querySelector('.prog').style.strokeDashoffset = 100 - Math.max(0, left / total) * 100;
      el.classList.toggle('urgent', left <= 5);
    });
    if (left > 0 && left <= 5 && left !== S.lastTick) { S.lastTick = left; SND.play('tick'); }
  }
  // every other countdown on screen (timer text + progress bars)
  const now = Date.now();
  document.querySelectorAll('[data-timer][data-end]').forEach((el) => {
    const t = fmt(Math.max(0, Math.ceil((+el.dataset.end - now) / 1000)));
    if (el.textContent !== t) el.textContent = t;
  });
  document.querySelectorAll('[data-tbar]').forEach((el) => {
    const left = Math.max(0, (+el.dataset.end - now) / 1000);
    el.style.transform = `scaleX(${Math.min(1, left / (+el.dataset.total || 1))})`;
  });
  if (S.isMod) autoStep();
}
setInterval(tick, 250);

function confetti() {
  const key = `${S.code}-${room().game}`;
  if (S.ui.confettiFor === key) return;
  S.ui.confettiFor = key;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#FF6F91', '#FFC94D', '#3DBF95', '#7B6FD0', '#9CD3FF'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 2.2 + Math.random() * 2.4 + 's';
    c.style.animationDelay = Math.random() * 0.8 + 's';
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 6000);
}

// ═════════════════════════ room lifecycle ═════════════════════════
function unsubAll() {
  S.subs.forEach((u) => u()); S.subs = [];
  S.actionSub?.(); S.actionSub = null; S.actionKey = null;
  S.joinSub?.(); S.joinSub = null;
  S.chatSub?.(); S.chatSub = null; S.chatKey = null; S.chat = [];
}

function enterRoom(code, isMod) {
  unsubAll();
  Object.assign(S, { code, isMod, view: 'game', playersLoaded: false, room: null, players: [], votes: [], actions: [], secret: null, myAction: null, mod: null });
  S.ui.flipped = false; S.ui.sheet = null;
  store.set({ code, isMod });
  const base = `rooms/${code}`;
  S.subs.push(S.be.watch(base, (d) => {
    if (!d || d.closed) { toast('This game was closed.'); leave(); return; }
    const prev = S.room;
    S.room = d;
    if (prev && prev.phase === 'roles' && d.phase === 'roles' && prev.dealtAt !== d.dealtAt) {
      S.ui.flipped = false;                       // the moderator reshuffled: show the new card face-down
      SND.play('flip');
      if (!isMod) toast('Roles were reshuffled. Tap your card to see your new role.');
    }
    if (prev && prev.phase !== d.phase) {
      S.ui.find = '';
      phaseSound(d);
      if (d.phase === 'roles') S.ui.flipped = false;
      S.ui.sheet = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigator.vibrate?.(60);
    }
    if (!isMod) watchMyAction();
    watchWolfChat();
    render();
  }));
  S.subs.push(S.be.watchCol(`${base}/players`, (list) => {
    S.players = list.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    S.playersLoaded = true;
    render();
  }));
  S.subs.push(S.be.watchCol(`${base}/votes`, (list) => { S.votes = list; render(); }));
  if (isMod) {
    startClock();
    S.subs.push(S.be.watchCol(`${base}/actions`, (list) => { S.actions = list; processSeer(); render(); }));
    S.subs.push(S.be.watch(`${base}/secrets/_mod`, (d) => { S.mod = d; render(); }));
  } else {
    S.subs.push(S.be.watch(`${base}/secrets/${S.uid}`, (d) => {
      const had = S.secret?.seer?.[room().round];
      S.secret = d;
      watchWolfChat();
      if (!had && d?.seer?.[room().round]) SND.play('seer');
      render();
    }));
  }
  render();
}

function watchMyAction() {
  const key = `${room().game}_${room().round}_${S.uid}`;
  if (key === S.actionKey) return;
  S.actionSub?.();
  S.actionKey = key; S.myAction = null;
  S.actionSub = S.be.watch(`rooms/${S.code}/actions/${key}`, (d) => { S.myAction = d; render(); });
}

function leave(keepSession = false) {
  unsubAll();
  if (!keepSession) store.clear();
  Object.assign(S, { view: PAGE === 'admin' ? 'adminHome' : 'home', code: null, isMod: false, room: null, players: [] });
  history.replaceState(null, '', location.pathname);
  if (PAGE === 'admin') loadLastRoom();
  render();
}

function phaseSound(d) {
  const myTeam = G.ROLES[S.secret?.role]?.team;
  const fx = {
    roles: 'join', night: 'howl', day: 'day', vote: 'vote',
    morning: d.morning?.victim ? 'death' : 'morning',
    verdict: d.verdict?.out ? 'gong' : 'day',
    ended: S.isMod ? (d.winner === 'village' ? 'win' : 'lose') : (myTeam === d.winner ? 'win' : 'lose'),
  }[d.phase];
  if (fx) SND.play(fx);
}

// ═════════════════════════ moderator logic ═════════════════════════
const P = (rest = '') => `rooms/${S.code}${rest}`;
// keep a local copy right away so quick back-to-back writes never lose a line
const logAdd = (text) => {
  const log = [...(S.mod?.log || []), { t: Date.now(), text }].slice(-80);
  if (S.mod) S.mod.log = log;
  return log;
};

async function guarded(fn) {
  if (S.busy) return;
  S.busy = true;
  try { await fn(); } catch (e) { console.error(e); toast('Something went wrong: ' + e.message); }
  finally { S.busy = false; render(); }
}

async function createRoom() {
  const prev = store.get()?.code;
  if (prev) {
    try {
      const old = await S.be.get(`rooms/${prev}`);
      if (old && old.moderatorUid === S.uid && !old.closed) {
        if (old.phase !== 'ended' && old.phase !== 'lobby') {
          const yes = await askConfirm({
            icon: 'alert',
            title: 'End the game in progress?',
            text: `Room <b>${prev}</b> is still running. Starting a new game closes it, and its players go back to the home screen.`,
            ok: 'Close it & start new', cancel: 'Keep it', danger: true,
          });
          if (!yes) return;
        }
        await S.be.update(`rooms/${prev}`, { closed: true, closedAt: Date.now() });
      }
    } catch {}
  }
  let code;
  for (let i = 0; i < 6; i++) { code = G.makeCode(); if (!(await S.be.get(`rooms/${code}`))) break; }
  await S.be.set(`rooms/${code}`, {
    moderatorUid: S.uid, phase: 'lobby', game: 1, round: 0, createdAt: Date.now(),
    settings: { wolves: 2, doctors: 1, seers: 1, votesPerPlayer: 1, hunch: false, rumor: false, auto: true, voteEarly: true,
      times: { roles: 20, night: 45, morning: 10, day: 120, vote: 45, verdict: 10 } },
  });
  await S.be.set(`rooms/${code}/secrets/_mod`, { roles: {}, log: [{ t: Date.now(), text: 'Room created. Waiting for villagers…' }] });
  enterRoom(code, true);
}

async function dealRoles() {
  const r = room(); const ps = S.players;
  const counts = roleCounts(r.settings);
  const plan = planned(r.settings);
  if (plan && ps.length < plan) return toast(`Waiting for ${plan - ps.length} more player(s) to join.`);
  const problem = G.validateRoles(ps.length, counts);   // extra players beyond the plan simply become villagers
  if (problem) return toast(problem);
  const roles = G.assignRoles(ps.map((p) => p.id), counts);
  const wolves = ps.filter((p) => roles[p.id] === 'werewolf').map((p) => p.id);
  const ops = [];
  for (const p of ps) {
    ops.push({ type: 'set', path: P(`/secrets/${p.id}`), data: { role: roles[p.id], partners: roles[p.id] === 'werewolf' ? wolves.filter((x) => x !== p.id) : [], seer: {} } });
    ops.push({ type: 'update', path: P(`/players/${p.id}`), data: { alive: true, role: null } });
  }
  const names = (role) => ps.filter((p) => roles[p.id] === role).map((p) => esc(p.name)).join(', ');
  ops.push({ type: 'set', path: P('/secrets/_mod'), data: { roles, lastProtected: {}, seer: {}, log: [
    { t: Date.now(), text: `Roles dealt at random. Wolves: <b>${names('werewolf')}</b> · Doctor: <b>${names('doctor') || 'none'}</b> · Seer: <b>${names('seer') || 'none'}</b>` }] } });
  ops.push({ type: 'update', path: P(), data: { phase: 'roles', round: 0, morning: null, verdict: null, winner: null, dealtAt: Date.now(), phaseEndsAt: endsFor('roles'), pausedLeft: null, autoStartAt: null } });
  await S.be.batch(ops);
}

async function startNight() {
  const r = room();
  const round = r.round + 1;
  const ops = [{ type: 'update', path: P(), data: { phase: 'night', round, phaseEndsAt: endsFor('night'), pausedLeft: null, nightEndsAt: null, morning: null, verdict: null } }];
  const roles = S.mod?.roles || {};
  for (const b of S.players.filter((p) => p.bot && p.alive)) {
    const a = G.botNightAction(b, roles[b.id], S.players, roles, lastFor(b.id));
    if (a.target) ops.push({ type: 'set', path: P(`/actions/${r.game}_${round}_${b.id}`), data: { game: r.game, round, uid: b.id, ...a, at: Date.now() } });
  }
  ops.push({ type: 'update', path: P('/secrets/_mod'), data: { log: logAdd(`Night ${round} begins.`) } });
  S.resolving = null;
  await S.be.batch(ops);
}

// the doctor memory used to be a single id; now it's { doctorId: lastTarget }
function lastFor(id) {
  const lp = S.mod?.lastProtected;
  return lp && typeof lp === 'object' ? lp[id] : undefined;
}

async function processSeer() {
  const r = room();
  if (!S.isMod || r.phase !== 'night' || !S.mod) return;
  const roles = S.mod.roles || {};
  const seers = Object.keys(roles).filter((id) => roles[id] === 'seer' && pl(id)?.alive);
  S.seerPending ||= new Set();
  for (const seerId of seers) {
    const key = `${curKey()}_${seerId}`;
    if (S.mod.seer?.[key] || S.seerPending.has(key)) continue;
    const a = nowActions().find((x) => x.uid === seerId && x.type === 'inspect' && pl(x.target)?.alive);
    if (!a) continue;
    S.seerPending.add(key);
    S.mod.seer = { ...(S.mod.seer || {}), [key]: a.target };
    const isWolf = roles[a.target] === 'werewolf';
    const who = seers.length > 1 ? ` (${pname(seerId)})` : '';
    await S.be.batch([
      { type: 'update', path: P(`/secrets/${seerId}`), data: { [`seer.${r.round}`]: { target: a.target, isWolf } } },
      { type: 'update', path: P('/secrets/_mod'), data: { [`seer.${key}`]: a.target, log: logAdd(`Seer${who} checked <b>${pname(a.target)}</b>: ${isWolf ? 'WEREWOLF' : 'not a werewolf'}.`) } },
    ]).catch((e) => { S.seerPending.delete(key); console.error(e); });
  }
}

function revealAllOps(roles, extra = {}) {
  return S.players.map((p) => ({ type: 'update', path: P(`/players/${p.id}`), data: { role: roles[p.id], ...(extra[p.id] || {}) } }));
}

async function resolveNightNow() {
  const r = room();
  if (r.phase !== 'night' || !S.mod || S.resolving === curKey()) return;
  S.resolving = curKey();
  try {
    await processSeer();
    const roles = S.mod.roles || {};
    const lastMap = S.mod.lastProtected && typeof S.mod.lastProtected === 'object' ? S.mod.lastProtected : {};
    const st = r.settings || {};
    const res = G.resolveNight({ players: S.players, roles, actions: nowActions(), lastProtected: lastMap, kills: killsSetting(st) });
    const dead = new Set(res.victims);
    const after = S.players.map((p) => (dead.has(p.id) ? { ...p, alive: false } : p));
    const winner = G.checkWinner(after, roles);
    const doctorIds = Object.keys(roles).filter((id) => roles[id] === 'doctor');
    const picks = [...new Set(res.wolfPicks)];
    let text = `Night ${r.round}: wolves picked ${picks.length ? picks.map(pname).map((n) => `<b>${n}</b>`).join(' & ') : 'nobody'}`;
    if (picks.length > res.attackedIds.length) text += ` (the moon chose <b>${res.attackedIds.map(pname).join(' & ')}</b>)`;
    if (doctorIds.length) {
      const prot = res.protectedIds.map((id) => `<b>${pname(id)}</b>`).join(' & ');
      text += prot ? `. Doctor${doctorIds.length > 1 ? 's' : ''} protected ${prot}.` : `. Doctor${doctorIds.length > 1 ? 's' : ''} protected nobody.`;
    } else text += '.';
    if (res.savedIds.length) text += ` The attack on <b>${res.savedIds.map(pname).join(' & ')}</b> failed.`;
    if (res.victims.length) text += ` <b>${res.victims.map(pname).join(' & ')}</b> died.`;

    const ops = [];
    // optional clues for the village
    const hunch = st.hunch && !winner ? G.villageHunch(nowActions(), after) : null;
    const rumor = st.rumor && !winner ? G.makeRumor(after, roles) : null;
    if (hunch) text += ` Hunch: ${hunch.ids.map(pname).join(' & ')} (${hunch.count}/${hunch.total}).`;
    if (rumor) {
      ops.push({ type: 'update', path: P(`/secrets/${rumor.to}`), data: { [`rumor.${r.round}`]: rumor.ids } });
      text += ` Rumor to <b>${pname(rumor.to)}</b>: one of ${rumor.ids.map(pname).join(', ')}.`;
    }
    for (const id of res.victims) ops.push({ type: 'update', path: P(`/players/${id}`), data: { alive: false, role: roles[id] } });
    const newLast = {};
    for (const id of doctorIds) {
      newLast[id] = res.protectedBy[id] || null;
      ops.push({ type: 'update', path: P(`/secrets/${id}`), data: { lastProtected: res.protectedBy[id] || null } });
    }
    if (winner) ops.push(...revealAllOps(roles, Object.fromEntries(res.victims.map((id) => [id, { alive: false }]))));
    S.mod.lastProtected = newLast;
    ops.push({ type: 'update', path: P('/secrets/_mod'), data: { lastProtected: newLast, log: logAdd(text + (winner ? ` ${WIN_LOG[winner]}` : '')) } });
    ops.push({ type: 'update', path: P(), data: { phase: winner ? 'ended' : 'morning', morning: { victim: res.victim, victims: res.victims, round: r.round, hunch: hunch || null, rumor: rumor?.to || null }, winner: winner || null, nightEndsAt: null, phaseEndsAt: winner ? null : endsFor('morning'), pausedLeft: null } });
    await S.be.batch(ops);
  } catch (e) {
    S.resolving = null;
    console.error(e); toast('Could not end the night: ' + e.message);
  }
}

async function startDay() {
  await S.be.update(P(), { phase: 'day', phaseEndsAt: endsFor('day'), pausedLeft: null });
}

async function openVote() {
  const r = room(); const roles = S.mod?.roles || {};
  const ops = [{ type: 'update', path: P(), data: { phase: 'vote', phaseEndsAt: endsFor('vote'), pausedLeft: null } }];
  for (const b of S.players.filter((p) => p.bot && p.alive)) {
    const targets = G.botVote(b, roles[b.id], S.players, roles, votesEach());
    if (targets.length) ops.push({ type: 'set', path: P(`/votes/${r.game}_${r.round}_${b.id}`), data: { game: r.game, round: r.round, uid: b.id, targets } });
  }
  await S.be.batch(ops);
}

async function closeVote() {
  const r = room(); const roles = S.mod?.roles || {};
  const t = G.tallyVotes(nowVotes(), S.players);
  const after = S.players.map((p) => (p.id === t.out ? { ...p, alive: false } : p));
  const winner = G.jesterVotedOut(t.out, roles) ? 'jester' : G.checkWinner(after, roles);
  const tally = Object.entries(t.counts).map(([id, c]) => `${pname(id)} ${c}`).join(', ') || 'no votes';
  const text = `Day ${r.round} vote (${tally}): ${t.out ? `<b>${pname(t.out)}</b> voted out. They were a ${G.ROLES[roles[t.out]].name}.` : t.tie ? 'tie, nobody out.' : 'nobody voted.'}`;
  const ops = [];
  if (t.out) ops.push({ type: 'update', path: P(`/players/${t.out}`), data: { alive: false, role: roles[t.out] } });
  if (winner) ops.push(...revealAllOps(roles, t.out ? { [t.out]: { alive: false } } : {}));
  ops.push({ type: 'update', path: P('/secrets/_mod'), data: { log: logAdd(text + (winner ? ` ${WIN_LOG[winner]}` : '')) } });
  ops.push({ type: 'update', path: P(), data: { phase: winner ? 'ended' : 'verdict', verdict: { out: t.out, tie: t.tie, noVotes: !!t.noVotes, round: r.round }, winner: winner || null, phaseEndsAt: winner ? null : endsFor('verdict'), pausedLeft: null } });
  await S.be.batch(ops);
}

async function playAgain() {
  const r = room();
  const ops = S.players.map((p) => ({ type: 'update', path: P(`/players/${p.id}`), data: { alive: true, role: null } }));
  ops.push({ type: 'set', path: P('/secrets/_mod'), data: { roles: {}, seer: {}, lastProtected: {}, log: [{ t: Date.now(), text: `New game #${r.game + 1}. Same villagers, new secrets.` }] } });
  ops.push({ type: 'update', path: P(), data: { phase: 'lobby', game: r.game + 1, round: 0, morning: null, verdict: null, winner: null, phaseEndsAt: null, pausedLeft: null, autoStartAt: null } });
  await S.be.batch(ops);
}

const BOT_NAMES = ['Bonnie', 'Barnaby', 'Clover', 'Dash', 'Echo', 'Fizz', 'Gus', 'Hazel', 'Iggy', 'Juniper', 'Kip', 'Luna'];
async function addBot() {
  const usedNames = new Set(S.players.map((p) => p.name));
  const name = 'Bot ' + (BOT_NAMES.find((n) => !usedNames.has('Bot ' + n)) || Math.floor(Math.random() * 99));
  const taken = new Set(S.players.map((p) => p.avatar));
  const free = freeAvatars(taken);
  const avatar = free.length ? free[Math.floor(Math.random() * Math.min(free.length, AV_PAGE))] : Math.floor(Math.random() * AVATAR_COUNT);
  const id = 'bot_' + Math.random().toString(36).slice(2, 8);
  await S.be.set(P(`/players/${id}`), { name, avatar, alive: true, joinedAt: Date.now(), bot: true });
}

// ═════════════════════════ player actions ═════════════════════════
async function joinGame() {
  const code = S.ui.code.trim().toUpperCase();
  const name = S.ui.name.trim();
  if (code.length !== 5) return toast('Room codes have 5 letters');
  if (!name) return toast('Tell the village your name');
  const r = await S.be.get(`rooms/${code}`);
  if (!r) return toast("Can't find that room. Check the code.");
  if (r.moderatorUid === S.uid) return toast('This device is the moderator of that game. Use another phone to play.');
  const existing = await S.be.get(`rooms/${code}/players/${S.uid}`);
  if (existing) return enterRoom(code, false);
  if (r.phase !== 'lobby') return toast('That game already started. Wait for the next one.');
  await S.be.set(`rooms/${code}/players/${S.uid}`, { name, avatar: S.ui.avatar ?? 0, alive: true, joinedAt: Date.now() });
  SND.play('join');
  enterRoom(code, false);
}

async function pickTarget(id) {
  const r = room(); const m = me();
  if (!m?.alive) return;
  if (r.phase === 'night') {
    const role = S.secret?.role;
    if (role === 'seer' && S.secret?.seer?.[r.round]) return;
    if (role === 'seer' && S.myAction?.target) return; // waiting for vision
    const key = `${r.game}_${r.round}_${S.uid}`;
    S.myAction = { target: id }; render();
    SND.play('select');
    await S.be.set(P(`/actions/${key}`), { game: r.game, round: r.round, uid: S.uid, type: G.actionTypeFor(role), target: id, at: Date.now() });
    navigator.vibrate?.(30);
  } else if (r.phase === 'vote') {
    const n = votesEach();
    let mine = myVotes();
    if (mine.includes(id)) { mine = mine.filter((x) => x !== id); SND.play('unselect'); }
    else if (n === 1) { mine = [id]; SND.play('cast'); }
    else if (mine.length >= n) { SND.play('tick'); return toast(`You've used all ${n} votes. Tap someone to take a vote back.`); }
    else { mine = [...mine, id]; SND.play('cast'); }
    await S.be.set(P(`/votes/${r.game}_${r.round}_${S.uid}`), { game: r.game, round: r.round, uid: S.uid, targets: mine });
    navigator.vibrate?.(30);
  }
}

// ═════════════════════════ events ═════════════════════════
const ACT = {
  goJoin: () => { S.view = 'join'; render(); watchJoinRoom(); },
  home: () => { S.joinSub?.(); S.joinSub = null; S.view = 'home'; render(); },
  reload: () => location.reload(),
  create: () => guarded(createRoom),
  join: () => guarded(joinGame),
  pickAv: (d) => { S.ui.avatar = +d.i; drawAvGrid(); },
  moreAv: () => { S.ui.avPage = (S.ui.avPage || 0) + 1; drawAvGrid(); },
  leave: async () => {
    if (S.isMod) {
      const r = room();
      if (!['lobby', 'ended'].includes(r.phase)) {
        // the admin page runs the game: leaving it would freeze everyone's screens
        const timed = !!r.phaseEndsAt && r.pausedLeft == null;
        const yes = await askConfirm({
          icon: 'alert',
          title: 'Leave the running game?',
          text: `Your admin page runs this game, so nothing moves on while you're on Admin home.${timed ? ' The game will be <b>paused</b> for everyone.' : ''} Press <b>Resume game</b> on Admin home to come back.`,
          ok: timed ? 'Pause & leave' : 'Leave game',
          cancel: 'Stay in the game',
          danger: true,
        });
        if (!yes) return;
        if (timed) { try { await S.be.update(P(), { pausedLeft: Math.max(0, r.phaseEndsAt - Date.now()), phaseEndsAt: null }); } catch {} }
      }
      return leave(true);
    }
    if (room().phase === 'lobby' && me()) { try { await S.be.del(P(`/players/${S.uid}`)); } catch {} }
    leave();
  },
  flip: () => { S.ui.flipped = !S.ui.flipped; SND.play('flip'); render(); },
  sound: () => {
    const m = SND.cycleMode();
    toast({ all: 'Music & sounds on', sfx: 'Sound effects only', off: 'Muted' }[m]);
    render();
  },
  showSetup: () => { S.view = 'adminSetup'; render(); },
  adminSetup: () => guarded(adminSetup),
  adminLogin: () => guarded(adminLogin),
  resumeGame: () => S.lastRoom && enterRoom(S.lastRoom.code, true),
  copyLink: async () => { await copy(playerLink()); toast('Player link copied'); },
  pickIcon: (d) => { S.ui.draft.icon = ICON_CHOICES[+d.i]; render(); },
  resetBrand: () => { S.ui.draft = JSON.parse(JSON.stringify(DEFAULT_BRAND)); render(); },
  saveBrand: () => guarded(saveBrand),
  changePin: () => guarded(async () => {
    const pin = S.ui.newPin.trim();
    if (pin.length < 4) return toast('Use at least 4 characters');
    await S.be.update('app/secret', { pin });
    S.ui.newPin = ''; toast('PIN changed');
  }),
  lockDevice: async () => {
    const live = S.lastRoom && !['lobby', 'ended'].includes(S.lastRoom.phase);
    const yes = await askConfirm({
      icon: 'lock',
      title: 'Sign out of admin on this device?',
      text: `You'll need the <b>admin PIN</b> to sign back in.${live ? ` Your game <b>${esc(S.lastRoom.code)}</b> is still in progress and stays frozen until you sign back in and press <b>Resume game</b>.` : ''}`,
      ok: 'Sign out',
      cancel: 'Stay signed in',
      danger: true,
    });
    if (!yes) return;
    // keep the session so "Resume game" is still there after signing back in
    guarded(async () => { await S.be.del(`admins/${S.uid}`); S.view = 'adminLogin'; });
  },
  confirmOk: () => closeConfirm(true),
  confirmCancel: () => closeConfirm(false),
  noop: () => {},
  kills: (d) => {
    const st = room().settings || {};
    const max = Math.max(1, st.wolves ?? 2);
    const v = Math.min(max, Math.max(1, killsSetting(st) + +d.d));
    if (v === killsSetting(st)) return toast(v === max ? `Max ${max}: one per wolf` : 'At least 1');
    guarded(() => S.be.update(P(), { 'settings.killsPerNight': v }));
  },
  sendChat: () => sendWolfChat(),
  vpp: (d) => {
    const v = Math.min(3, Math.max(1, (room().settings?.votesPerPlayer ?? 1) + +d.d));
    guarded(() => S.be.update(P(), { 'settings.votesPerPlayer': v }));
  },
  peek: () => { S.ui.sheet = 'role'; render(); },
  closeSheet: () => {
    const bg = document.querySelector('.sheet-bg');
    if (!bg || bg.classList.contains('closing')) return;
    bg.classList.add('closing');                   // exit is faster than enter (200ms vs 380ms)
    setTimeout(() => { S.ui.sheet = null; render(); }, 200);
  },
  pick: (d) => pickTarget(d.id).catch((e) => toast(e.message)),
  copyInvite: async () => {
    await copy(`Join our Werewolf game in Moonhollow!\n1) Open ${inviteLink()} on your phone\n2) Room code: ${S.code}`);
    toast('Invite copied. Paste it in the Teams chat.');
  },
  openTab: () => window.open(inviteLink(), '_blank'),
  addBot: () => guarded(addBot),
  kick: (d) => guarded(() => S.be.del(P(`/players/${d.id}`))),
  togglePlan: () => {
    if (planned()) return guarded(() => S.be.update(P(), { 'settings.plannedPlayers': null }));
    const c = roleCounts();
    const start = Math.max(S.players.length, G.MIN_PLAYERS, specialCount(c) + c.werewolf, 8);
    guarded(() => S.be.update(P(), { 'settings.plannedPlayers': Math.min(MAX_PLAYERS, start) }));
  },
  planned: (d) => {
    const c = roleCounts();
    const minN = Math.max(G.MIN_PLAYERS, specialCount(c));
    const next = Math.min(MAX_PLAYERS, Math.max(minN, planN() + +d.d));
    if (next === planN()) return toast(+d.d < 0 ? `Can't go below ${minN}: lower a role first` : `Max ${MAX_PLAYERS} players`);
    guarded(() => S.be.update(P(), { 'settings.plannedPlayers': next }));
  },
  roleCount: (d) => {
    const key = d.k;                                           // wolves | doctors | seers | jesters | villagers
    if (key === 'villagers') return ACT.planned(d);            // villagers = expected players − special roles
    const cur = roleCounts();
    const now = { wolves: cur.werewolf, doctors: cur.doctor, seers: cur.seer, jesters: cur.jester }[key];
    const min = key === 'wolves' ? 1 : 0;
    const max = key === 'wolves' ? 40 : key === 'jesters' ? 1 : 12;
    const next = Math.min(max, Math.max(min, now + +d.d));
    if (next === now) return toast(next === min ? (key === 'wolves' ? 'You need at least 1 werewolf' : 'Already at 0') : `Max ${max} here`);
    guarded(() => S.be.update(P(), { [`settings.${key}`]: next }));
  },
  suggestRoles: () => {
    const s = G.suggestRoles(planN());
    guarded(() => S.be.update(P(), { 'settings.wolves': s.werewolf, 'settings.doctors': s.doctor, 'settings.seers': s.seer, 'settings.jesters': s.jester }));
  },
  reshuffle: () => guarded(async () => {
    await dealRoles();
    toast('Roles reshuffled. Players will see a new card.');
  }),
  wolves: (d) => {
    const n = S.players.length;
    const w = Math.min(4, Math.max(1, (room().settings?.wolves ?? 2) + +d.d));
    if (w > G.maxWolves(n) && +d.d > 0 && n >= G.MIN_PLAYERS) toast(`Max ${G.maxWolves(n)} werewolves for ${n} players`);
    guarded(() => S.be.update(P(), { 'settings.wolves': w }));
  },
  nightSecs: (d) => guarded(() => S.be.update(P(), { 'settings.times.night': +d.s })),
  toggleSetting: (d) => {
    if (d.k === 'plan') return ACT.togglePlan();
    const onByDefault = ['auto', 'voteEarly'].includes(d.k);
    const cur = onByDefault ? room().settings?.[d.k] !== false : !!room().settings?.[d.k];
    const ops = { [`settings.${d.k}`]: !cur };
    // switching to automatic mid-game: give the current phase a fresh timer
    if (d.k === 'auto' && !cur && NEXT_NAME[room().phase] && !room().phaseEndsAt) ops.phaseEndsAt = Date.now() + timeFor(room().phase) * 1000;
    guarded(() => S.be.update(P(), ops));
  },
  timer: (d) => guarded(() => S.be.update(P(), { [`settings.times.${d.k}`]: +d.s })),
  pause: () => S.code && guarded(() => {
    const r = room();
    if (!r.phaseEndsAt) return;
    return S.be.update(P(), { pausedLeft: Math.max(0, r.phaseEndsAt - Date.now()), phaseEndsAt: null });
  }),
  resume: () => S.code && guarded(() => S.be.update(P(), { phaseEndsAt: Date.now() + (room().pausedLeft || 0), pausedLeft: null })),
  extend: () => S.code && guarded(() => {
    const r = room();
    if (r.pausedLeft != null) return S.be.update(P(), { pausedLeft: r.pausedLeft + 30000 });
    return S.be.update(P(), { phaseEndsAt: (r.phaseEndsAt || Date.now()) + 30000 });
  }),
  skip: () => S.code && guarded(async () => {
    const r = room();
    if (r.pausedLeft != null) await S.be.update(P(), { pausedLeft: null });
    await advance({ ...r, pausedLeft: null }, 'skip');
  }),
  deal: () => guarded(dealRoles),
  night: () => guarded(startNight),
  endNight: () => guarded(resolveNightNow),
  day: () => guarded(startDay),
  openVote: () => guarded(openVote),
  closeVote: () => guarded(closeVote),
  again: () => guarded(playAgain),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!['pick', 'flip', 'sound', 'pickAv', 'closeSheet', 'noop'].includes(el.dataset.act)) SND.play('tap');
  if (el.dataset.act === 'pickAv') SND.play('select');
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('input', (e) => {
  const k = e.target.dataset?.bind;
  if (!k) return;
  if (k.startsWith('brand.')) {
    S.ui.draft[k.slice(6)] = e.target.value;
    drawBrandPreview();
    return;
  }
  if (k === 'code') {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    e.target.value = v; S.ui.code = v; watchJoinRoom();
  } else S.ui[k] = e.target.value;
  if (k === 'find') render();
});
document.addEventListener('change', async (e) => {
  if (e.target.dataset?.file !== 'icon' || !e.target.files?.[0]) return;
  try {
    S.ui.draft.icon = { type: 'image', data: await fileToIcon(e.target.files[0]) };
    render();
  } catch { toast("Couldn't read that picture"); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.ui.confirm) { closeConfirm(false); return; }
  if (e.key === 'Enter' && e.target.matches('input')) {
    if (e.target.dataset.bind === 'chat') { e.preventDefault(); ACT.sendChat(); return; }
    if (S.view === 'join') ACT.join();
    if (S.view === 'adminLogin') ACT.adminLogin();
    if (S.view === 'adminSetup') ACT.adminSetup();
  }
});

// ═════════════════════════ boot ═════════════════════════
async function boot() {
  render();
  try {
    if (firebaseConfig && firebaseConfig.apiKey) {
      const { createFirebaseBackend } = await import('./backend-firebase.js');
      S.be = await createFirebaseBackend(firebaseConfig);
    } else {
      S.be = createLocalBackend();
    }
    S.uid = await S.be.init();
  } catch (e) {
    console.error(e);
    S.error = 'Could not connect to the game server. Check your internet, or the Firebase settings in js/config.js. (' + e.message + ')';
    S.view = 'error'; return render();
  }

  // the app's name & icon (set by the admin) — live for everyone
  await new Promise((resolve) => {
    let first = true;
    S.subs0 = S.be.watch('app/branding', (d) => {
      S.brandLoaded = !!d;
      S.brand = { ...DEFAULT_BRAND, ...(d || {}) };
      applyBrand();
      render();
      if (first) { first = false; resolve(); }
    });
    setTimeout(resolve, 2500);
  });

  const sess = store.get();
  if (PAGE === 'admin') {
    let isAdmin = false;
    try { isAdmin = !!(await S.be.get(`admins/${S.uid}`)); } catch {}
    if (!isAdmin) { S.view = S.brandLoaded ? 'adminLogin' : 'adminSetup'; return render(); }
    if (sess?.code) {
      try {
        const r = await S.be.get(`rooms/${sess.code}`);
        if (r && r.moderatorUid === S.uid && r.phase !== 'ended' && !r.closed) return enterRoom(sess.code, true);
      } catch {}
    }
    S.view = 'adminHome';
    render();
    return loadLastRoom();
  }

  S.ui.code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 5);
  if (sess?.code && (!S.ui.code || S.ui.code === sess.code)) {
    try {
      const r = await S.be.get(`rooms/${sess.code}`);
      if (r && !r.closed && (await S.be.get(`rooms/${sess.code}/players/${S.uid}`))) return enterRoom(sess.code, false);
    } catch {}
  }
  if (sess?.code) store.clear();
  S.view = S.ui.code ? 'join' : 'home';
  render();
  if (S.view === 'join') watchJoinRoom();
}
boot();
