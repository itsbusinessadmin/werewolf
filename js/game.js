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

/** returns { [playerId]: role } */
export function assignRoles(ids, wolves, rnd = Math.random) {
  const order = shuffle(ids, rnd);
  const roles = {};
  order.forEach((id, i) => {
    if (i < wolves) roles[id] = 'werewolf';
    else if (i === wolves) roles[id] = 'doctor';
    else if (i === wolves + 1) roles[id] = 'seer';
    else roles[id] = 'villager';
  });
  return roles;
}

const isAlive = (players, id) => !!players.find(p => p.id === id && p.alive);

/**
 * Work out what happened during the night.
 * actions: [{ uid, type: 'kill'|'protect'|'inspect'|'suspect', target }]
 */
export function resolveNight({ players, roles, actions, lastProtected, rnd = Math.random }) {
  const valid = actions.filter(a => isAlive(players, a.uid) && isAlive(players, a.target));
  const wolfPicks = valid
    .filter(a => a.type === 'kill' && roles[a.uid] === 'werewolf' && roles[a.target] !== 'werewolf')
    .map(a => a.target);
  const doc = valid.find(a => a.type === 'protect' && roles[a.uid] === 'doctor' && a.target !== lastProtected);

  // two different picks → the moon decides (random one of the picks)
  const victim = wolfPicks.length ? wolfPicks[Math.floor(rnd() * wolfPicks.length)] : null;
  const protectedId = doc ? doc.target : null;
  const saved = !!victim && victim === protectedId;
  return { victim: saved ? null : victim, attacked: victim, saved, protectedId, wolfPicks };
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
