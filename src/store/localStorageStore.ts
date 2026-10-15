import { Message, Store } from '../types';

export function createLocalStorageStore(): Store {
  const K = 'unsigned:msgs3';
  const sa: ((msgs: Message[]) => void)[] = [];
  const sq: ((qs: Message[]) => void)[] = [];
  const st: { id: string; cb: (replies: Message[]) => void }[] = [];

  function get(): Message[] {
    try {
      return JSON.parse(localStorage.getItem(K) || '[]');
    } catch {
      return [];
    }
  }

  function fire() {
    const a = get();
    sa.forEach((f) => f(a));
    const q = a.filter((m) => m.isQ);
    sq.forEach((f) => f(q));
    st.forEach((s) => s.cb(a.filter((m) => m.qid === s.id)));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === K) fire();
    });
  }

  function un<T>(arr: T[], x: T) {
    return () => {
      const i = arr.indexOf(x);
      if (i >= 0) arr.splice(i, 1);
    };
  }

  return {
    live: false,
    onAll(cb) {
      sa.push(cb);
      cb(get());
      return un(sa, cb);
    },
    onQuestions(cb) {
      sq.push(cb);
      cb(get().filter((m) => m.isQ));
      return un(sq, cb);
    },
    onThread(id, cb) {
      const s = { id, cb };
      st.push(s);
      cb(get().filter((m) => m.qid === id));
      return un(st, s);
    },
    send(m) {
      const fullMsg: Message = {
        ...m,
        id: 'm' + Date.now() + ((Math.random() * 1e3) | 0),
      };
      let a = get();
      a.push(fullMsg);
      a = a.slice(-400);
      try {
        localStorage.setItem(K, JSON.stringify(a));
      } catch {
        // Ignore storage write errors
      }
      fire();
      return Promise.resolve();
    },
    setPresence() {},
    onPeers() {
      return () => {};
    },
  };
}
