// Demo backend: no internet or Firebase needed.
// Every browser TAB is a different player, and tabs talk to each other
// through localStorage + BroadcastChannel. Great for testing on one computer.

const KEY = 'moonhollow-demo-db';

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  if (value === undefined) delete o[parts.at(-1)];
  else o[parts.at(-1)] = value;
}

export function createLocalBackend() {
  let db = safe(() => JSON.parse(localStorage.getItem(KEY) || '{}'), {});
  const docWatchers = new Set();   // { path, cb, last }
  const colWatchers = new Set();
  const chan = safe(() => new BroadcastChannel(KEY), null);

  let uid = safe(() => sessionStorage.getItem('moonhollow-uid'), null);
  if (!uid) {
    uid = 'u' + Math.random().toString(36).slice(2, 10);
    safe(() => sessionStorage.setItem('moonhollow-uid', uid));
  }

  const clone = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
  const isChild = (col, path) => path.startsWith(col + '/') && !path.slice(col.length + 1).includes('/');

  function notify() {
    for (const w of docWatchers) {
      const s = JSON.stringify(db[w.path] ?? null);
      if (s !== w.last) { w.last = s; w.cb(clone(db[w.path])); }
    }
    for (const w of colWatchers) {
      const list = Object.keys(db).filter(p => isChild(w.path, p)).sort()
        .map(p => ({ id: p.split('/').pop(), ...db[p] }));
      const s = JSON.stringify(list);
      if (s !== w.last) { w.last = s; w.cb(clone(list)); }
    }
  }
  function commit() {
    safe(() => localStorage.setItem(KEY, JSON.stringify(db)));
    safe(() => chan && chan.postMessage('changed'));
    queueMicrotask(notify);
  }
  function reload() {
    db = safe(() => JSON.parse(localStorage.getItem(KEY) || '{}'), db);
    notify();
  }
  if (chan) chan.onmessage = reload;
  safe(() => addEventListener('storage', (e) => { if (e.key === KEY) reload(); }));

  const api = {
    mode: 'demo',
    uid,
    async init() { return uid; },
    async get(path) { return clone(db[path]); },
    async set(path, data, opts = {}) {
      db[path] = opts.merge ? { ...(db[path] || {}), ...clone(data) } : clone(data);
      commit();
    },
    async update(path, patch) {
      if (!db[path]) throw new Error('No document at ' + path);
      for (const [k, v] of Object.entries(patch)) setDeep(db[path], k, clone(v) ?? undefined);
      commit();
    },
    async del(path) { delete db[path]; commit(); },
    async batch(ops) {
      for (const op of ops) {
        if (op.type === 'set') db[op.path] = op.merge ? { ...(db[op.path] || {}), ...clone(op.data) } : clone(op.data);
        else if (op.type === 'update') { db[op.path] ||= {}; for (const [k, v] of Object.entries(op.data)) setDeep(db[op.path], k, clone(v) ?? undefined); }
        else if (op.type === 'delete') delete db[op.path];
      }
      commit();
    },
    watch(path, cb) {
      const w = { path, cb, last: undefined };
      docWatchers.add(w);
      queueMicrotask(notify);
      return () => docWatchers.delete(w);
    },
    watchCol(path, cb) {
      const w = { path, cb, last: undefined };
      colWatchers.add(w);
      queueMicrotask(notify);
      return () => colWatchers.delete(w);
    },
  };
  return api;
}
