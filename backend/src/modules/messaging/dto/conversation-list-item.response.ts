import { MessageType } from '@shared/enums';

export interface LastMessagePreview {
  content: string;
  type: MessageType;
  senderId: string;
  createdAt: Date;
}

export interface ConversationListItemResponse {
  id: string;
  participantIds: string[];
  listingId: string | null;
  orderId: string | null;
  lastMessageAt: Date | null;
  lastMessage: LastMessagePreview | null;
  unreadCount: number;
}
