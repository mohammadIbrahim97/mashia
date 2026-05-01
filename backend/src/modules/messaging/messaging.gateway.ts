import { WebSocketGateway } from '@nestjs/websockets';
import { MessagingService } from './messaging.service';

@WebSocketGateway({ namespace: '/chat', cors: true })
export class MessagingGateway {
  constructor(private readonly messagingService: MessagingService) {}
}
