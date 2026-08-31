// P1-05: single declarative state store for the online HUD.
// The online page (astro) writes state here; React renders it. React-owned
// DOM is never mutated imperatively. Nicknames are player-controlled data and
// only ever pass through React text nodes.

export type OnlineConnection = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'lost';

export interface OnlineHudState {
  hudVisible: boolean;
  selfNick: string;
  selfSeat: 0 | 1;
  oppNick: string | null;
  connection: OnlineConnection;
  pingMs: number | null;
}

const initial: OnlineHudState = {
  hudVisible: false,
  selfNick: '',
  selfSeat: 0,
  oppNick: null,
  connection: 'idle',
  pingMs: null,
};

let state: OnlineHudState = initial;
const listeners = new Set<() => void>();

export function getOnlineHud(): OnlineHudState {
  return state;
}

export function setOnlineHud(patch: Partial<OnlineHudState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function resetOnlineHud() {
  state = { ...initial, selfNick: state.selfNick };
  for (const l of listeners) l();
}

export function subscribeOnlineHud(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
