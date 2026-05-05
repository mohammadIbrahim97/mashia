import { api, unwrap } from './api';

export type ConversationParticipant = {
  id: string;
  fullName: string;
};

export type LastMessage = {
  body: string;
  type: string;
  createdAt: string;
};

export type ConversationItem = {
  id: string;
  listingId: string | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
  otherParticipant: ConversationParticipant;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};

export const messagingService = {
  async listConversations(page = 1, limit = 20): Promise<ConversationItem[]> {
    const res = await api.get('/messaging/conversations', { params: { page, limit } });
    return unwrap<ConversationItem[]>(res);
  },

  async listMessages(
    conversationId: string,
    limit = 50,
    before?: string,
  ): Promise<Message[]> {
    const res = await api.get(
      `/messaging/conversations/${conversationId}/messages`,
      { params: { limit, ...(before ? { before } : {}) } },
    );
    return unwrap<Message[]>(res);
  },

  async createOrGetConversation(
    listingId: string,
    recipientId: string,
  ): Promise<{ id: string }> {
    const res = await api.post('/messaging/conversations', {
      listingId,
      recipientId,
    });
    return unwrap<{ id: string }>(res);
  },
};
