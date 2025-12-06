import { create } from 'zustand';
import { ChatMessageData } from '@shared/types';

interface ChatStore {
  messages: ChatMessageData[];
  unreadCount: number;
  isChatOpen: boolean;

  addMessage: (message: ChatMessageData) => void;
  clearMessages: () => void;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,
  isChatOpen: false,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.isChatOpen ? 0 : state.unreadCount + 1,
    })),

  clearMessages: () => set({ messages: [] }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  toggleChat: () =>
    set((state) => ({
      isChatOpen: !state.isChatOpen,
      unreadCount: !state.isChatOpen ? 0 : state.unreadCount,
    })),

  openChat: () => set({ isChatOpen: true, unreadCount: 0 }),

  closeChat: () => set({ isChatOpen: false }),

  reset: () => set({ messages: [], unreadCount: 0, isChatOpen: false }),
}));
