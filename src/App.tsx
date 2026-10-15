import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Background3D } from './components/Background3D';
import { Message, Store } from './types';
import { createLocalStorageStore } from './store/localStorageStore';
import { createFirebaseStore } from './store/firebaseStore';

const CATS = [
  'Contracts',
  'Startups and companies',
  'Property',
  'Family',
  'Employment',
  'Criminal',
  'Tax',
  'Privacy and data',
  'Other',
];

const ADJ = ['Quiet', 'Amber', 'Brisk', 'Patient', 'Wry', 'Steady', 'Curious', 'Candid'];
const ANI = ['Heron', 'Lynx', 'Otter', 'Falcon', 'Fox', 'Owl', 'Ibis', 'Marten'];

function generateAlias(): string {
  const adj = ADJ[(Math.random() * ADJ.length) | 0];
  const ani = ANI[(Math.random() * ANI.length) | 0];
  const num = 10 + ((Math.random() * 90) | 0);
  return `${adj} ${ani} ${num}`;
}

function generateUid(): string {
  return 'u' + Date.now() + ((Math.random() * 1e6) | 0);
}

function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return ((s / 60) | 0) + ' min ago';
  if (s < 86400) return ((s / 3600) | 0) + ' h ago';
  return ((s / 86400) | 0) + ' d ago';
}

function plural(n: number): string {
  return n + (n === 1 ? ' answer' : ' answers');
}

function hash(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) {
    x = (x * 31 + s.charCodeAt(i)) % 1000;
  }
  return x;
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [allMsgs, setAllMsgs] = useState<Message[]>([]);
  const [qs, setQs] = useState<Message[]>([]);
  const [peers, setPeers] = useState<any[]>([]);

  // User Identity
  const [alias, setAlias] = useState<string>('');
  const [uid, setUid] = useState<string>('');

  // UI state
  const [activeCat, setActiveCat] = useState<string>('All');
  const [activeFilt, setActiveFilt] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Ask form
  const [askText, setAskText] = useState<string>('');
  const [askCat, setAskCat] = useState<string>(CATS[0]);

  // Dossier drawer
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState<string>('');

  // Animations & Toast
  const [toastMsg, setToastMsg] = useState<string>('');
  const [stampActive, setStampActive] = useState<boolean>(false);
  const [seenCards, setSeenCards] = useState<Record<string, boolean>>({});

  const toastTimerRef = useRef<any>(null);
  const lastSendRef = useRef<number>(0);
  const lastClickedCardIdRef = useRef<string | null>(null);
  const progRef = useRef<HTMLDivElement | null>(null);
  const sealRef = useRef<SVGSVGElement | null>(null);
  const dlRef = useRef<HTMLDivElement | null>(null);
  const daRef = useRef<HTMLTextAreaElement | null>(null);
  const dxRef = useRef<HTMLButtonElement | null>(null);
  const unsubThreadRef = useRef<(() => void) | null>(null);
  const isFirstDossierRender = useRef<boolean>(true);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg('');
    }, 2800);
  }, []);

  // Initialize Anonymous Identity & Store
  useEffect(() => {
    let savedAlias = '';
    let savedUid = '';
    try {
      savedAlias = sessionStorage.getItem('unsigned:me') || '';
      if (!savedAlias) {
        savedAlias = generateAlias();
        sessionStorage.setItem('unsigned:me', savedAlias);
      }
      savedUid = sessionStorage.getItem('unsigned:uid') || '';
      if (!savedUid) {
        savedUid = generateUid();
        sessionStorage.setItem('unsigned:uid', savedUid);
      }
    } catch {
      savedAlias = generateAlias();
      savedUid = generateUid();
    }
    setAlias(savedAlias);
    setUid(savedUid);

    // Initialize Store: Try Firebase first, fallback to LocalStorage
    let unsubAll: (() => void) | null = null;
    let unsubQs: (() => void) | null = null;
    let unsubPeers: (() => void) | null = null;

    const attachStore = (s: Store) => {
      setStore(s);
      unsubAll = s.onAll((msgs) => setAllMsgs(msgs));
      unsubQs = s.onQuestions((questions) => setQs(questions));
      unsubPeers = s.onPeers((activePeers) => setPeers(activePeers));
      s.setPresence({ room: 'wall', alias: savedAlias });
    };

    createFirebaseStore(savedAlias, savedUid, (errText) => {
      showToast(errText);
    })
      .then((fbStore) => {
        if (fbStore) {
          attachStore(fbStore);
        } else {
          attachStore(createLocalStorageStore());
        }
      })
      .catch(() => {
        attachStore(createLocalStorageStore());
      });

    return () => {
      if (unsubAll) unsubAll();
      if (unsubQs) unsubQs();
      if (unsubPeers) unsubPeers();
      if (unsubThreadRef.current) unsubThreadRef.current();
    };
  }, [showToast]);

  // Scroll Progress and Wax Seal Rotation / Fade
  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onScroll = () => {
      const y = window.scrollY;
      const H = window.innerHeight;
      const mx = document.documentElement.scrollHeight - H;
      if (progRef.current) {
        progRef.current.style.transform = `scaleX(${mx > 0 ? y / mx : 0})`;
      }
      if (sealRef.current) {
        sealRef.current.style.opacity = String(
          Math.max(0, 1 - y / (H * 0.7)) * (window.innerWidth < 700 ? 0.3 : 1)
        );
        if (!rm) {
          sealRef.current.style.rotate = `${y * 0.2}deg`;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal elements on scroll (IntersectionObserver for beat sections, ask form, etc.)
  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in2');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    const elements = document.querySelectorAll('.beat > *, .ask, .tools, .stats');
    elements.forEach((el) => {
      el.classList.add('rv');
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Answer Counts Calculation
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    allMsgs.forEach((m) => {
      if (m.qid) {
        map[m.qid] = (map[m.qid] || 0) + 1;
      }
    });
    if (activeThread) {
      map[activeThread.id] = Math.max(map[activeThread.id] || 0, threadMsgs.length);
    }
    return map;
  }, [allMsgs, activeThread, threadMsgs]);

  const unansweredCount = useMemo(() => {
    return qs.filter((q) => !counts[q.id]).length;
  }, [qs, counts]);

  // Throttling helper (800ms)
  const isThrottled = useCallback(() => {
    if (!store) {
      showToast('Still connecting. Try again in a moment.');
      return true;
    }
    const now = Date.now();
    if (now - lastSendRef.current < 800) {
      showToast('Slow down a little.');
      return true;
    }
    lastSendRef.current = now;
    return false;
  }, [store, showToast]);

  // Stamp trigger helper
  const triggerStamp = useCallback(() => {
    setStampActive(false);
    requestAnimationFrame(() => {
      setStampActive(true);
    });
  }, []);

  // Handle Ask Form Submission
  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = askText.trim();
    if (text.length < 15) {
      showToast('Add a little more detail so people can answer.');
      return;
    }
    if (isThrottled() || !store) return;

    triggerStamp();
    setAskText('');
    setActiveCat('All');
    setActiveFilt('all');
    setSearchTerm('');

    try {
      await store.send({
        room: askCat,
        text,
        alias,
        uid,
        createdAt: Date.now(),
        isQ: true,
        qid: null,
        replyTo: null,
      });
      showToast("Slipped under the door. It's on the wall.");
    } catch {
      showToast('That could not be sent. Try again.');
    }

    setTimeout(() => {
      const wallEl = document.getElementById('wall');
      if (wallEl) {
        wallEl.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    }, 150);
  };

  // Open Dossier Drawer
  const openDossier = (q: Message) => {
    lastClickedCardIdRef.current = q.id;
    if (unsubThreadRef.current) {
      unsubThreadRef.current();
      unsubThreadRef.current = null;
    }
    setActiveThread(q);
    setThreadMsgs([]);
    setReplyingTo(null);
    setReplyText('');
    isFirstDossierRender.current = true;
    document.body.style.overflow = 'hidden';

    if (store) {
      store.setPresence({ room: q.room, alias });
      unsubThreadRef.current = store.onThread(q.id, (replies) => {
        setThreadMsgs(replies);
      });
    }

    setTimeout(() => {
      if (dxRef.current) dxRef.current.focus();
    }, 50);
  };

  // Close Dossier Drawer
  const closeDossier = () => {
    if (unsubThreadRef.current) {
      unsubThreadRef.current();
      unsubThreadRef.current = null;
    }
    const closedId = activeThread?.id;
    setActiveThread(null);
    setThreadMsgs([]);
    setReplyingTo(null);
    setReplyText('');
    document.body.style.overflow = '';

    if (store) {
      store.setPresence({ room: 'wall', alias });
    }

    if (closedId) {
      const cardEl = document.querySelector(`[data-id="${closedId}"]`) as HTMLElement;
      if (cardEl) cardEl.focus();
    }
  };

  // Auto-scroll dossier messages
  useEffect(() => {
    if (!activeThread || !dlRef.current) return;
    const dl = dlRef.current;
    const st = dl.scrollTop;
    const isAtBottom =
      isFirstDossierRender.current ||
      dl.scrollHeight - st - dl.clientHeight < 80 ||
      (threadMsgs.length > 0 && threadMsgs[threadMsgs.length - 1].uid === uid);
    isFirstDossierRender.current = false;

    if (isAtBottom) {
      dl.scrollTop = dl.scrollHeight;
    }
  }, [threadMsgs, activeThread, uid]);

  // Handle Esc key to close dossier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeThread) {
        closeDossier();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeThread]);

  // Reply Submit
  const handleReplySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = replyText.trim();
    if (!text || !activeThread || isThrottled() || !store) return;

    const r = replyingTo || activeThread;
    const threadId = activeThread.id;
    const roomName = activeThread.room;

    setReplyText('');
    setReplyingTo(null);

    try {
      await store.send({
        room: roomName,
        text,
        alias,
        uid,
        createdAt: Date.now(),
        isQ: false,
        qid: threadId,
        replyTo: {
          id: r.id,
          alias: r.alias,
          uid: r.uid,
          text: r.text.slice(0, 200),
        },
      });
    } catch {
      showToast('That could not be sent. Try again.');
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReplySubmit();
    }
  };

  // Filter questions for the wall
  const filteredQuestions = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    return qs
      .slice()
      .reverse()
      .filter((q) => {
        const n = counts[q.id] || 0;
        const matchesCategory = activeCat === 'All' || q.room === activeCat;
        const matchesStatus =
          activeFilt === 'all' || (activeFilt === 'un' ? !n : n > 0);
        const matchesSearch =
          !t || `${q.text} ${q.room}`.toLowerCase().indexOf(t) >= 0;
        return matchesCategory && matchesStatus && matchesSearch;
      });
  }, [qs, counts, activeCat, activeFilt, searchTerm]);

  // 3D Card tilt
  const handleCardPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = e.currentTarget;
    const b = card.getBoundingClientRect();
    card.style.setProperty(
      '--tx',
      `${-((e.clientY - b.top) / b.height - 0.5) * 10}deg`
    );
    card.style.setProperty(
      '--ty',
      `${((e.clientX - b.left) / b.width - 0.5) * 12}deg`
    );
  };

  const handleCardPointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    const card = e.currentTarget;
    card.style.setProperty('--tx', '0deg');
    card.style.setProperty('--ty', '0deg');
  };

  return (
    <>
      <div className="prog" id="prog" ref={progRef} />
      <Background3D />
      <a className="mark" href="#top">
        Signed <i>&amp;</i> Sealed
      </a>

      <main id="top">
        <section className="hero">
          <p className="kick">Signed &amp; Sealed</p>
          <h1>
            Ask the law.
            <br />
            <i>Sign nothing.</i>
          </h1>
          <p className="lede">
            Post a legal question with no name attached. Anyone can answer it.
          </p>
          <div className="btns">
            <a className="btn" href="#room">
              Open the wall
            </a>
          </div>
          <svg
            className="seal-big"
            ref={sealRef}
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <defs>
              <path
                id="cp"
                d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"
              />
            </defs>
            <circle cx="100" cy="100" r="97" fill="var(--seal)" />
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="#fff"
              strokeOpacity=".5"
              strokeWidth="2"
              strokeDasharray="3 5"
            />
            <text fontSize="13" fontWeight="700" fill="#fff">
              <textPath href="#cp" textLength="440" lengthAdjust="spacing">
                SIGNED · SEALED · ANONYMOUS · DELIVERED ·
              </textPath>
            </text>
            <text
              x="100"
              y="130"
              textAnchor="middle"
              fontFamily="Bodoni Moda,Georgia,serif"
              fontSize="92"
              fontWeight="700"
              fill="#fff"
            >
              &amp;
            </text>
          </svg>
          <span className="hint">Scroll to fly through the questions</span>
        </section>

        <div className="mq" aria-hidden="true">
          <div className="mt2">
            <span>Contracts</span>
            <span>Startups &amp; companies</span>
            <span>Property</span>
            <span>Family</span>
            <span>Employment</span>
            <span>Criminal</span>
            <span>Tax</span>
            <span>Privacy &amp; data</span>
            <span>M&amp;A</span>
            <span>Private equity</span>
            <span>Venture capital</span>
            <span>Contracts</span>
            <span>Startups &amp; companies</span>
            <span>Property</span>
            <span>Family</span>
            <span>Employment</span>
            <span>Criminal</span>
            <span>Tax</span>
            <span>Privacy &amp; data</span>
            <span>M&amp;A</span>
            <span>Private equity</span>
            <span>Venture capital</span>
          </div>
        </div>

        <section className="room" id="room">
          <p className="kick">Unsigned &middot; the question wall</p>
          <h2>
            Every question,
            <br />
            <i>pinned to the wall.</i>
          </h2>
          <div className="stats">
            <span>
              <b id="sQ">{qs.length}</b>questions
            </span>
            <span>
              <b id="sU">{unansweredCount}</b>need an answer
            </span>
            <span className="live" id="lv" hidden={!store?.live}>
              <i />
              <b id="sP">{Math.max(peers.length, 1)}</b>here now
            </span>
          </div>

          <form className="ask panel" id="askF" onSubmit={handleAskSubmit}>
            <label htmlFor="aq">Slip a question under the door</label>
            <textarea
              id="aq"
              maxLength={600}
              placeholder="My landlord kept my deposit after I moved out. What can I do?"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
            />
            <div className="ar">
              <select
                id="ac"
                aria-label="Category"
                value={askCat}
                onChange={(e) => setAskCat(e.target.value)}
              >
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="note">
                Posting as <b id="me">{alias}</b>
              </span>
              <button className="btn" type="submit">
                Slip it in
              </button>
            </div>
          </form>

          <div className="tools">
            <input
              type="text"
              id="sq"
              placeholder="Search the wall"
              aria-label="Search questions"
              autoComplete="off"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="chips" id="drawers">
              {['All', ...CATS].map((c) => (
                <button
                  key={c}
                  className="chip"
                  type="button"
                  aria-pressed={activeCat === c}
                  onClick={() => setActiveCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="chips" id="st">
              {[
                ['all', 'Everything'],
                ['un', 'Needs an answer'],
                ['an', 'Answered'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className="chip"
                  type="button"
                  aria-pressed={activeFilt === key}
                  onClick={() => setActiveFilt(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="wall" id="wall">
            {filteredQuestions.length === 0 ? (
              <p className="empty">
                {qs.length
                  ? 'Nothing pinned here. Try another drawer.'
                  : 'The wall is empty. Slip the first question under the door.'}
              </p>
            ) : (
              filteredQuestions.map((q, i) => {
                const n = counts[q.id] || 0;
                const isNewDrop = q.uid === uid && Date.now() - q.createdAt < 4000;
                const rotDeg = (hash(q.id) % 50) / 10 - 2.5;

                return (
                  <button
                    key={q.id}
                    data-id={q.id}
                    className={`card ${isNewDrop ? 'drop' : ''}`}
                    type="button"
                    style={{
                      ['--r' as any]: `${rotDeg}deg`,
                      animationDelay: `${(i % 3) * 90}ms`,
                    }}
                    onClick={() => openDossier(q)}
                    onPointerMove={handleCardPointerMove}
                    onPointerLeave={handleCardPointerLeave}
                  >
                    <span className={`seal ${n ? '' : 'ask'}`}>{n || '?'}</span>
                    <span className="cat">{q.room}</span>
                    <span className="qx">{q.text}</span>
                    <span className="cf">
                      {q.alias} &middot; {ago(q.createdAt)} &middot;{' '}
                      {n ? plural(n) : 'needs an answer'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <p className="note">
            Everything here is anonymous. Click a card to read its answers or add
            yours. Not legal advice.
          </p>
        </section>

        <section className="beat">
          <div className="n">1</div>
          <h2>You ask, without a name</h2>
          <p>
            Write the question the way you would say it. We attach a random alias,
            never your identity.
          </p>
        </section>

        <section className="beat r">
          <div className="n">2</div>
          <h2>Anyone can answer</h2>
          <p>
            Lawyers, students and people who have been through the same thing all
            reply in one room.
          </p>
        </section>

        <section className="beat">
          <div className="n">3</div>
          <h2>Replies stay in the thread</h2>
          <p>
            Quote any message to answer it directly, so the conversation stays easy
            to follow.
          </p>
        </section>

        <footer>
          Signed &amp; Sealed is an anonymous legal community. Nothing here
          creates a lawyer-client relationship. For anything urgent, speak to a
          licensed lawyer in your jurisdiction.
        </footer>
      </main>

      {/* Dossier drawer dialog */}
      <div
        className="dos"
        id="dos"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dq"
        hidden={!activeThread}
      >
        <div className="dsc" onClick={closeDossier} />
        {activeThread && (
          <article className="dpap">
            <button
              className="dx"
              id="dx"
              ref={dxRef}
              type="button"
              aria-label="Close"
              onClick={closeDossier}
            >
              &#10005;
            </button>
            <span className="cat" id="dc">
              {activeThread.room}
            </span>
            <h3 id="dq">{activeThread.text}</h3>
            <p className="note" id="dm">
              Asked by {activeThread.alias} &middot; {ago(activeThread.createdAt)} &middot;{' '}
              {plural(threadMsgs.length)}
            </p>

            <div className="dl" id="dl" ref={dlRef}>
              {threadMsgs.length === 0 ? (
                <p className="empty">No answers yet. You could be the first.</p>
              ) : (
                threadMsgs.map((m) => {
                  const isMine = m.uid === uid;
                  return (
                    <div
                      key={m.id}
                      className={`slip ${isMine ? 'me' : ''}`}
                    >
                      {m.replyTo && m.replyTo.id !== activeThread.id && (
                        <div
                          className="quo"
                          onClick={() => {
                            setReplyingTo({
                              id: m.replyTo!.id,
                              alias: m.replyTo!.alias,
                              uid: m.replyTo!.uid,
                              text: m.replyTo!.text,
                              room: activeThread.room,
                              createdAt: Date.now(),
                              isQ: false,
                              qid: activeThread.id,
                              replyTo: null,
                            });
                            if (daRef.current) daRef.current.focus();
                          }}
                        >
                          <b>{m.replyTo.uid === uid ? 'You' : m.replyTo.alias}</b>
                          <span>{m.replyTo.text}</span>
                        </div>
                      )}
                      <p>{m.text}</p>
                      <div className="sf">
                        <span>
                          {(isMine ? 'You' : m.alias) + ' \u00b7 ' + ago(m.createdAt)}
                        </span>
                        <button
                          className="lnk"
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            if (daRef.current) daRef.current.focus();
                          }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="rbar" id="rb" hidden={!replyingTo}>
              <div>
                <b id="rbn">{replyingTo?.uid === uid ? 'You' : replyingTo?.alias}</b>
                <span id="rbt">{replyingTo?.text.slice(0, 90)}</span>
              </div>
              <button
                type="button"
                id="rbx"
                aria-label="Cancel reply"
                onClick={() => setReplyingTo(null)}
              >
                &#10005;
              </button>
            </div>

            <form className="comp" id="dF" onSubmit={handleReplySubmit}>
              <label className="sr" htmlFor="da">
                Your answer
              </label>
              <textarea
                id="da"
                ref={daRef}
                rows={2}
                maxLength={800}
                placeholder="Write your answer"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
              />
              <button className="send" type="submit" aria-label="Send answer">
                &#10148;
              </button>
            </form>
          </article>
        )}
      </div>

      {/* Red "SEALED" stamp slam animation */}
      <div
        className={`stamp ${stampActive ? 'go' : ''}`}
        id="stamp"
        aria-hidden="true"
        onAnimationEnd={() => setStampActive(false)}
      >
        Sealed
      </div>

      {/* Toast notification */}
      <div className={`toast ${toastMsg ? 'on' : ''}`} id="toast" role="status">
        {toastMsg}
      </div>
    </>
  );
}
