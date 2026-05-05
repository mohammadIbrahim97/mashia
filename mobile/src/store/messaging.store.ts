import { create } from 'zustand';
import { ConversationItem, Message, messagingService } from '../services/messaging.service';

type MessagingState = {
  conversations: ConversationItem[];
  convsLoading: boolean;
  loadConversations: () => Promise<void>;

  messages: Record<string, Message[]>;
  messagesLoading: boolean;
  loadMessages: (conversationId: string, reset?: boolean) => Promise<void>;
  appendMessage: (conversationId: string, msg: Message) => void;
};

export const useMessaging = create<MessagingState>((set, get) => ({
  conversations: [],
  convsLoading: false,

  async loadConversations() {
    set({ convsLoading: true });
    try {
      const convs = await messagingService.listConversations();
      set({ conversations: convs, convsLoading: false });
    } catch {
      set({ convsLoading: false });
    }
  },

  messages: {},
  messagesLoading: false,

  async loadMessages(conversationId: string, reset = false) {
    const { messagesLoading, messages } = get();
    if (messagesLoading) return;
    set({ messagesLoading: true });
    const existing = messages[conversationId] ?? [];
    const before = reset || existing.length === 0 ? undefined : existing[0].createdAt;
    try {
      const fetched = await messagingService.listMessages(conversationId, 50, before);
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: reset
            ? fetched
            : [...fetched, ...(s.messages[conversationId] ?? [])],
        },
        messagesLoading: false,
      }));
    } catch {
      set({ messagesLoading: false });
    }
  },

  appendMessage(conversationId: string, msg: Message) {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), msg],
      },
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: {
                body: msg.body,
                type: msg.type,
                createdAt: msg.createdAt,
              },
            }
          : c,
      ),
    }));
  },
}));
