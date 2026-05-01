import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MessageType } from '@shared/enums';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Entity('messages')
@Index('idx_messages_conversation_created', ['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
