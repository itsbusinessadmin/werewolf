// Real backend: Firebase (free "Spark" plan is enough).
// Uses Anonymous sign-in so nobody needs an account, and Firestore for live game data.

const V = '11.0.2';

export async function createFirebaseBackend(config) {
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = fs.getFirestore(app);
  const ref = (path) => fs.doc(db, path);

  const api = {
    mode: 'firebase',
    uid: null,
    async init() {
      const user = await new Promise((resolve, reject) => {
        const stop = onAuthStateChanged(auth, (u) => {
          if (u) { stop(); resolve(u); }
        }, reject);
        signInAnonymously(auth).catch(reject);
      });
      api.uid = user.uid;
      return user.uid;
    },
    async get(path) {
      const s = await fs.getDoc(ref(path));
      return s.exists() ? s.data() : null;
    },
    set: (path, data, opts = {}) => fs.setDoc(ref(path), data, opts.merge ? { merge: true } : {}),
    update: (path, patch) => fs.updateDoc(ref(path), mapDeletes(patch)),
    del: (path) => fs.deleteDoc(ref(path)),
    async batch(ops) {
      // Firestore batches hold at most 500 writes. Bigger ones (dealing to 200+ players) are
      // sent in order as several batches, so the final write (the phase change) still lands last.
      for (let i = 0; i < ops.length; i += 450) {
        const b = fs.writeBatch(db);
        for (const op of ops.slice(i, i + 450)) {
          if (op.type === 'set') b.set(ref(op.path), op.data, op.merge ? { merge: true } : {});
          else if (op.type === 'update') b.update(ref(op.path), mapDeletes(op.data));
          else if (op.type === 'delete') b.delete(ref(op.path));
        }
        await b.commit();
      }
    },
    watch(path, cb) {
      return fs.onSnapshot(ref(path), (s) => cb(s.exists() ? s.data() : null), (e) => console.warn('watch', path, e.message));
    },
    // where = optional [field, value]: only docs whose field equals value (security rules may require it)
    watchCol(path, cb, where = null) {
      const col = fs.collection(db, path);
      return fs.onSnapshot(where ? fs.query(col, fs.where(where[0], '==', where[1])) : col,
        (qs) => cb(qs.docs.map(d => ({ id: d.id, ...d.data() }))),
        (e) => console.warn('watchCol', path, e.message));
    },
  };

  // `null` in an update means "remove this field"
  function mapDeletes(patch) {
    const out = {};
    for (const [k, v] of Object.entries(patch)) out[k] = v === null ? fs.deleteField() : v;
    return out;
  }
  return api;
}
