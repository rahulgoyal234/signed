import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import { Message, Store, PeerPresence } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  currentUser: User | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error:', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

function getFirebaseConfig(): any | null {
  const configModules = import.meta.glob('/firebase-applet-config.json', { eager: true });
  if (configModules['/firebase-applet-config.json']) {
    const raw = (configModules['/firebase-applet-config.json'] as any).default || configModules['/firebase-applet-config.json'];
    if (raw && (raw.apiKey || raw.projectId)) return raw;
  }
  if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
    };
  }
  return null;
}

export async function createFirebaseStore(
  userAlias: string,
  userUid: string,
  onFatalError?: (msg: string) => void
): Promise<Store | null> {
  const config = getFirebaseConfig();
  if (!config) {
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    const db: Firestore = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    const auth = getAuth(app);

    // Ensure signed in anonymously
    let authUser: User | null = auth.currentUser;
    if (!authUser) {
      try {
        const cred = await signInAnonymously(auth);
        authUser = cred.user;
      } catch (authErr) {
        console.warn('Anonymous auth failed:', authErr);
        return null;
      }
    }

    const effectiveUid = authUser.uid || userUid;
    let currentPresence = { room: 'wall', alias: userAlias };
    let heartbeatTimer: any = null;

    const messagesCol = collection(db, 'messages');
    const presenceCol = collection(db, 'presence');

    // Heartbeat function
    const sendHeartbeat = async () => {
      try {
        await setDoc(doc(presenceCol, effectiveUid), {
          uid: effectiveUid,
          alias: currentPresence.alias,
          room: currentPresence.room,
          updatedAt: Date.now(),
        });
      } catch (err) {
        // Presence heartbeat silent fail
      }
    };

    // Initial heartbeat and interval every 20s
    await sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, 20000);

    // Clean up presence on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        deleteDoc(doc(presenceCol, effectiveUid)).catch(() => {});
      });
    }

    return {
      live: true,

      onAll(cb) {
        const q = query(messagesCol, orderBy('createdAt', 'desc'), limit(1000));
        return onSnapshot(
          q,
          (snap) => {
            const list: Message[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                room: data.room,
                text: data.text,
                alias: data.alias,
                uid: data.uid,
                createdAt: data.createdAt,
                isQ: !!data.isQ,
                qid: data.qid || null,
                replyTo: data.replyTo || null,
                pending: d.metadata.hasPendingWrites,
              };
            });
            // Reverse results client-side so they display oldest-first
            cb(list.reverse());
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, 'messages', auth.currentUser);
            if (onFatalError) onFatalError('Lost connection to the room.');
          }
        );
      },

      onQuestions(cb) {
        const q = query(
          messagesCol,
          where('isQ', '==', true),
          orderBy('createdAt', 'desc'),
          limit(500)
        );
        return onSnapshot(
          q,
          (snap) => {
            const list: Message[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                room: data.room,
                text: data.text,
                alias: data.alias,
                uid: data.uid,
                createdAt: data.createdAt,
                isQ: true,
                qid: null,
                replyTo: null,
                pending: d.metadata.hasPendingWrites,
              };
            });
            cb(list.reverse());
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, 'messages', auth.currentUser);
            if (onFatalError) onFatalError('Lost connection to the room.');
          }
        );
      },

      onThread(id, cb) {
        const q = query(
          messagesCol,
          where('qid', '==', id),
          orderBy('createdAt', 'desc'),
          limit(500)
        );
        return onSnapshot(
          q,
          (snap) => {
            const list: Message[] = snap.docs.map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                room: data.room,
                text: data.text,
                alias: data.alias,
                uid: data.uid,
                createdAt: data.createdAt,
                isQ: false,
                qid: data.qid,
                replyTo: data.replyTo || null,
                pending: d.metadata.hasPendingWrites,
              };
            });
            cb(list.reverse());
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `messages?qid=${id}`, auth.currentUser);
            if (onFatalError) onFatalError('Lost connection to the thread.');
          }
        );
      },

      async send(m) {
        try {
          const docData = {
            room: m.room,
            text: m.text,
            alias: m.alias,
            uid: effectiveUid,
            createdAt: m.createdAt || Date.now(),
            isQ: !!m.isQ,
            qid: m.qid || null,
            replyTo: m.replyTo || null,
          };
          await addDoc(messagesCol, docData);
        } catch (err) {
          throw handleFirestoreError(err, OperationType.CREATE, 'messages', auth.currentUser);
        }
      },

      setPresence(p) {
        currentPresence = { room: p.room, alias: p.alias };
        sendHeartbeat();
      },

      onPeers(cb) {
        let lastPeers: PeerPresence[] = [];
        const filterAndNotify = (docs: any[]) => {
          const now = Date.now();
          const active = docs
            .map((d) => (typeof d.data === 'function' ? d.data() : d) as PeerPresence)
            .filter((p) => p && typeof p.updatedAt === 'number' && now - p.updatedAt < 60000);
          lastPeers = active;
          cb(active);
        };

        const unsub = onSnapshot(
          presenceCol,
          (snap) => {
            filterAndNotify(snap.docs);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, 'presence', auth.currentUser);
          }
        );

        // Periodic sweep every 10s to expire inactive peers even without snapshot event
        const sweepTimer = setInterval(() => {
          filterAndNotify(lastPeers);
        }, 10000);

        return () => {
          unsub();
          clearInterval(sweepTimer);
        };
      },
    };
  } catch (err) {
    console.warn('Firebase initialization failed, falling back to local storage:', err);
    return null;
  }
}
