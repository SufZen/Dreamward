import { create } from 'zustand';

interface AssistantState {
  open: boolean;
  /** when set, the panel pins to this conversation; null = a fresh chat */
  conversationId: string | null;
  /** wider focus layout for the weekly-review ritual */
  focusMode: boolean;
  /** a message to auto-send once when the session mounts (consumed once) */
  autoSend: string | null;
  openPanel: (opts?: { conversationId?: string | null; focusMode?: boolean; autoSend?: string }) => void;
  close: () => void;
  setConversationId: (id: string | null) => void;
  consumeAutoSend: () => string | null;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  conversationId: null,
  focusMode: false,
  autoSend: null,
  openPanel: (opts) =>
    set({
      open: true,
      conversationId: opts?.conversationId ?? null,
      focusMode: opts?.focusMode ?? false,
      autoSend: opts?.autoSend ?? null,
    }),
  close: () => set({ open: false, focusMode: false, autoSend: null }),
  setConversationId: (id) => set({ conversationId: id }),
  consumeAutoSend: () => {
    const v = get().autoSend;
    if (v) set({ autoSend: null });
    return v;
  },
}));
