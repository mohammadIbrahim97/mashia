import { Test, TestingModule } from "@nestjs/testing";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { User } from "../users/user.entity";
import { Conversation } from "./conversation.entity";
import { Message } from "./message.entity";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { ListConversationsQueryDto } from "./dto/list-conversations-query.dto";
import { ListMessagesQueryDto } from "./dto/list-messages-query.dto";
import { ConversationListItemResponse } from "./dto/conversation-list-item.response";
import { HttpStatus } from "@nestjs/common";
import { Response } from "express";
import {
  UserRole,
  KycStatus,
  PreferredLanguage,
  MessageType,
} from "@shared/enums";

describe("MessagingController", () => {
  let controller: MessagingController;
  let service: jest.Mocked<MessagingService>;

  const mockUser: User = {
    id: "11111111-1111-1111-1111-111111111111",
    role: UserRole.BUYER,
    fullName: "Test User",
    phone: "+1234567890",
    email: "test@example.com",
    country: "SA",
    city: "Riyadh",
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.EN,
    passwordHash: null,
    totpSecret: null,
    totpEnabled: false,
    suspended: false,
    kycRejectionReason: null,
    kycReviewedAt: null,
    kycReviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConversationId = "22222222-2222-2222-2222-222222222222";

  const mockConversation: Conversation = {
    id: mockConversationId,
    participantIds: [mockUser.id, "33333333-3333-3333-3333-333333333333"],
    listing: null,
    listingId: null,
    order: null,
    orderId: null,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      listConversationsForUser: jest.fn(),
      listMessages: jest.fn(),
      findOrCreateConversation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: MessagingService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
    service = module.get(MessagingService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("listConversations", () => {
    it("calls service.listConversationsForUser with correct args and defaults", async () => {
      const mockResponse: ConversationListItemResponse[] = [
        {
          id: mockConversationId,
          participantIds: mockConversation.participantIds,
          listingId: null,
          orderId: null,
          lastMessageAt: new Date(),
          lastMessage: {
            content: "Hello",
            type: MessageType.TEXT,
            senderId: "33333333-3333-3333-3333-333333333333",
            createdAt: new Date(),
          },
          unreadCount: 0,
        },
      ];

      service.listConversationsForUser.mockResolvedValue(mockResponse);

      const query: ListConversationsQueryDto = {};
      const result = await controller.listConversations(mockUser, query);

      expect(service.listConversationsForUser).toHaveBeenCalledWith(
        mockUser.id,
        1,
        20,
      );
      expect(result).toEqual(mockResponse);
    });

    it("calls service.listConversationsForUser with provided pagination", async () => {
      service.listConversationsForUser.mockResolvedValue([]);

      const query: ListConversationsQueryDto = { page: 2, limit: 10 };
      const result = await controller.listConversations(mockUser, query);

      expect(service.listConversationsForUser).toHaveBeenCalledWith(
        mockUser.id,
        2,
        10,
      );
      expect(result).toEqual([]);
    });
  });

  describe("listMessages", () => {
    it("calls service.listMessages with correct args and defaults", async () => {
      const mockMessages: Message[] = [
        {
          id: "55555555-5555-5555-5555-555555555555",
          conversationId: mockConversationId,
          conversation: mockConversation,
          senderId: "33333333-3333-3333-3333-333333333333",
          sender: {} as User,
          content: "Hello",
          type: MessageType.TEXT,
          readAt: null,
          createdAt: new Date(),
        },
      ];

      service.listMessages.mockResolvedValue(mockMessages);

      const query: ListMessagesQueryDto = {};
      const result = await controller.listMessages(
        mockUser,
        mockConversationId,
        query,
      );

      expect(service.listMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockUser.id,
        {
          before: undefined,
          limit: 50,
        },
      );
      expect(result).toEqual(mockMessages);
    });

    it("calls service.listMessages with provided query params", async () => {
      service.listMessages.mockResolvedValue([]);

      const query: ListMessagesQueryDto = {
        limit: 10,
        before: "55555555-5555-5555-5555-555555555555",
      };
      const result = await controller.listMessages(
        mockUser,
        mockConversationId,
        query,
      );

      expect(service.listMessages).toHaveBeenCalledWith(
        mockConversationId,
        mockUser.id,
        {
          before: query.before,
          limit: 10,
        },
      );
      expect(result).toEqual([]);
    });
  });

  describe("createConversation", () => {
    it("sets status to 201 CREATED and returns conversation when created is true", async () => {
      service.findOrCreateConversation.mockResolvedValue({
        created: true,
        conversation: mockConversation,
      });

      const dto: CreateConversationDto = {
        participantIds: [mockUser.id, "33333333-3333-3333-3333-333333333333"],
      };

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.createConversation(mockUser, dto, res);

      expect(service.findOrCreateConversation).toHaveBeenCalledWith(
        mockUser.id,
        dto,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockConversation);
    });

    it("sets status to 200 OK and returns conversation when created is false", async () => {
      service.findOrCreateConversation.mockResolvedValue({
        created: false,
        conversation: mockConversation,
      });

      const dto: CreateConversationDto = {
        participantIds: [mockUser.id, "33333333-3333-3333-3333-333333333333"],
      };

      const res = {
        status: jest.fn(),
      } as unknown as Response;

      const result = await controller.createConversation(mockUser, dto, res);

      expect(service.findOrCreateConversation).toHaveBeenCalledWith(
        mockUser.id,
        dto,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockConversation);
    });
  });
});
