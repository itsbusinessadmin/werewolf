// Pure game rules — no screens, no database. Easy to read & test.

export const ROLES = {
  werewolf: { name: 'Werewolf', team: 'wolves', color: '#7B6FD0',
    blurb: 'Each night, pick a villager to gobble up. By day, act innocent and blame someone else!' },
  doctor:   { name: 'Doctor',   team: 'village', color: '#3DBF95',
    blurb: 'Each night, protect one person (even yourself). Not the same person two nights in a row.' },
  seer:     { name: 'Seer',     team: 'village', color: '#8E6CF0',
    blurb: 'Each night, peek at one player to learn if they are a werewolf. Share wisely — the wolves are listening!' },
  villager: { name: 'Villager', team: 'village', color: '#F2A541',
    blurb: 'You have no powers, just your brain. Listen, ask questions, and vote out the werewolves!' },
};

export const MIN_PLAYERS = 4;

export function suggestWolves(n) {
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  if (n <= 15) return 3;
  return 4;
}

export function maxWolves(n) {
  // werewolves must start out-numbered by everyone else
  return Math.max(1, Math.min(4, Math.floor((n - 1) / 2)));
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** what the app suggests for a group of n players */
export function suggestRoles(n) {
  return { werewolf: suggestWolves(n), doctor: 1, seer: 1 };
}

/** '' when the moderator's numbers work, otherwise a friendly reason */
export function validateRoles(n, { werewolf = 1, doctor = 0, seer = 0 } = {}) {
  if (n < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players (you have ${n}).`;
  if (werewolf < 1) return 'You need at least 1 werewolf.';
  if (werewolf + doctor + seer > n) return `That's ${werewolf + doctor + seer} special roles but only ${n} players.`;
  if (werewolf >= n - werewolf) return `Too many werewolves: they must start out-numbered (max ${maxWolves(n)} for ${n} players).`;
  return '';
}

/**
 * Randomly deal roles. `counts` = { werewolf, doctor, seer } chosen by the
 * moderator; everyone else becomes a villager. (A plain number = wolves,
 * with 1 doctor and 1 seer, for older callers.)
 * returns { [playerId]: role }
 */
export function assignRoles(ids, counts, rnd = Math.random) {
  if (typeof counts === 'number') counts = { werewolf: counts, doctor: 1, seer: 1 };
  const { werewolf = 1, doctor = 0, seer = 0 } = counts;
  const deck = [
    ...Array(werewolf).fill('werewolf'),
    ...Array(doctor).fill('doctor'),
    ...Array(seer).fill('seer'),
  ];
  const order = shuffle(ids, rnd);
  const roles = {};
  order.forEach((id, i) => { roles[id] = deck[i] || 'villager'; });
  return roles;
}

const isAlive = (players, id) => !!players.find(p => p.id === id && p.alive);

/**
 * Work out what happened during the night.
 * actions: [{ uid, type: 'kill'|'protect'|'inspect'|'suspect', target }]
 */
export function resolveNight({ players, roles, actions, lastProtected = {}, rnd = Math.random }) {
  const last = typeof lastProtected === 'string' ? {} : (lastProtected || {});
  const valid = actions.filter(a => isAlive(players, a.uid) && isAlive(players, a.target));
  const wolfPicks = valid
    .filter(a => a.type === 'kill' && roles[a.uid] === 'werewolf' && roles[a.target] !== 'werewolf')
    .map(a => a.target);
  // every doctor protects one person (never the same person they protected last night)
  const protectedBy = {};
  for (const a of valid) {
    if (a.type === 'protect' && roles[a.uid] === 'doctor' && a.target !== last[a.uid]) protectedBy[a.uid] = a.target;
  }
  const protectedIds = [...new Set(Object.values(protectedBy))];

  // two different picks → the moon decides (random one of the picks)
  const victim = wolfPicks.length ? wolfPicks[Math.floor(rnd() * wolfPicks.length)] : null;
  const saved = !!victim && protectedIds.includes(victim);
  return { victim: saved ? null : victim, attacked: victim, saved, protectedBy, protectedIds, protectedId: protectedIds[0] || null, wolfPicks };
}

/**
 * votes: [{ uid, targets: [ids] }] — each player may have several votes
 * (moderator setting), but only one per person they vote for.
 * → { out, tie, counts } — a tie for the most votes means nobody is out
 */
export function tallyVotes(votes, players) {
  const counts = {};
  for (const v of votes) {
    if (!isAlive(players, v.uid)) continue;
    const targets = [...new Set(v.targets || (v.target ? [v.target] : []))];
    for (const t of targets) if (isAlive(players, t)) counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { out: null, tie: false, counts, noVotes: true };
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return { out: null, tie: true, counts };
  return { out: entries[0][0], tie: false, counts };
}

/** how many votes each player really gets (can't vote for yourself) */
export function votesAllowed(setting, aliveCount) {
  return Math.max(1, Math.min(setting || 1, aliveCount - 1));
}

/** 'village' | 'wolves' | null */
export function checkWinner(players, roles) {
  const alive = players.filter(p => p.alive && roles[p.id]);
  const wolves = alive.filter(p => roles[p.id] === 'werewolf').length;
  const others = alive.length - wolves;
  if (wolves === 0) return 'village';
  if (wolves >= others) return 'wolves';
  return null;
}

/** what a test bot does at night */
export function botNightAction(bot, role, players, roles, lastProtected, rnd = Math.random) {
  const alive = players.filter(p => p.alive);
  const pick = (list) => list.length ? list[Math.floor(rnd() * list.length)].id : null;
  if (role === 'werewolf') return { type: 'kill', target: pick(alive.filter(p => roles[p.id] !== 'werewolf')) };
  if (role === 'doctor') return { type: 'protect', target: pick(alive.filter(p => p.id !== lastProtected)) };
  if (role === 'seer') return { type: 'inspect', target: pick(alive.filter(p => p.id !== bot.id)) };
  return { type: 'suspect', target: pick(alive.filter(p => p.id !== bot.id)) };
}

export function botVote(bot, role, players, roles, count = 1, rnd = Math.random) {
  let options = players.filter(p => p.alive && p.id !== bot.id);
  if (role === 'werewolf') {
    const nonWolves = options.filter(p => roles[p.id] !== 'werewolf');
    if (nonWolves.length) options = nonWolves;
  }
  return shuffle(options, rnd).slice(0, count).map(p => p.id);
}

export function actionTypeFor(role) {
  return { werewolf: 'kill', doctor: 'protect', seer: 'inspect' }[role] || 'suspect';
}

export function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += L[Math.floor(Math.random() * L.length)];
  return s;
}

/**
 * 🤔 Village hunch (optional): an anonymous count of last night's
 * "Who do you suspect?" taps. Only counts living tappers & living suspects.
 * → { ids: [most suspected], count, total } or null
 */
export function villageHunch(actions, players) {
  const counts = {};
  let total = 0;
  for (const a of actions) {
    if (a.type !== 'suspect' || !isAlive(players, a.uid) || !isAlive(players, a.target)) continue;
    counts[a.target] = (counts[a.target] || 0) + 1;
    total++;
  }
  const max = Math.max(0, ...Object.values(counts));
  if (!max) return null;
  return { ids: Object.keys(counts).filter((id) => counts[id] === max), count: max, total };
}

/**
 * 🗝️ Rumor (optional): one random living villager hears a small, TRUE clue:
 * "One of these 3 people is a werewolf." Exactly one of them is a wolf,
 * and the person hearing it is never in the list.
 * → { to, ids } or null
 */
export function makeRumor(players, roles, rnd = Math.random) {
  const living = players.filter((p) => p.alive);
  const wolves = living.filter((p) => roles[p.id] === 'werewolf');
  let hearers = living.filter((p) => roles[p.id] === 'villager');
  if (!hearers.length) hearers = living.filter((p) => roles[p.id] && roles[p.id] !== 'werewolf');
  if (!wolves.length || !hearers.length) return null;
  const to = hearers[Math.floor(rnd() * hearers.length)];
  const innocents = shuffle(living.filter((p) => roles[p.id] !== 'werewolf' && p.id !== to.id), rnd).slice(0, 2);
  if (!innocents.length) return null;   // a clue with only the wolf in it would give the game away
  const wolf = wolves[Math.floor(rnd() * wolves.length)];
  return { to: to.id, ids: shuffle([wolf, ...innocents], rnd).map((p) => p.id) };
}
