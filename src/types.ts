export interface ReplyToPayload {
  id: string;
  alias: string;
  uid: string;
  text: string;
}

export interface Message {
  id: string;
  room: string;
  text: string;
  alias: string;
  uid: string;
  createdAt: number;
  isQ: boolean;
  qid: string | null;
  replyTo: ReplyToPayload | null;
  pending?: boolean;
}

export interface PeerPresence {
  uid: string;
  alias: string;
  room: string;
  updatedAt: number;
}

export interface Store {
  live: boolean;
  onAll: (cb: (msgs: Message[]) => void) => () => void;
  onQuestions: (cb: (questions: Message[]) => void) => () => void;
  onThread: (id: string, cb: (thread: Message[]) => void) => () => void;
  send: (msg: Omit<Message, 'id'>) => Promise<void>;
  setPresence: (p: { room: string; alias: string }) => void;
  onPeers: (cb: (peers: any[]) => void) => () => void;
}
