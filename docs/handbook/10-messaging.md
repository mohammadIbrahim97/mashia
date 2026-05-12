# 10 — Messaging

Messaging is the one module that breaks the request/response pattern. It's a Socket.io gateway plus a thin REST surface for history and conversation creation. Real-time push uses the `/chat` namespace.

Authoritative files:

- Entities: `backend/src/modules/messaging/{conversation,message}.entity.ts`
- Service: `backend/src/modules/messaging/messaging.service.ts`
- REST: `backend/src/modules/messaging/messaging.controller.ts`
- Socket: `backend/src/modules/messaging/messaging.gateway.ts`
- Migrations: `1777500000000-CreateConversations`, `1777500001000-CreateMessages`
- Mobile: `mobile/src/services/{messaging.service,socket.service}.ts`, `mobile/src/screens/messaging/{Conversations,Chat}Screen.tsx`

## Data model

```
conversations
  id                uuid
  participant_ids   uuid[]            (sorted ascending — key for find-or-create)
  listing_id        uuid?  → listings.id  ON DELETE SET NULL
  order_id          uuid?  → orders.id    ON DELETE SET NULL
  last_message_at   timestamptz?      (updated in sendMessage)
  created_at, updated_at

messages
  id               uuid
  conversation_id  uuid    → conversations.id  ON DELETE CASCADE
  sender_id        uuid    → users.id          ON DELETE RESTRICT  ← never lose authorship
  content          text    (literal text for TEXT; URL/id for IMAGE / CERTIFICATE)
  type             enum: text | image | certificate | offer  (default: text)
  read_at          timestamptz?  (NULL = unread)
  created_at       timestamptz
```

Indexes:

- `idx_conversations_participant_ids`: GIN on `participant_ids` for `:uid = ANY(...)` lookups.
- `idx_conversations_listing_id`: lookup by listing.
- `idx_messages_conversation_created`: composite `(conversation_id, created_at)` to back paginated history.

## Conversation identity

`participant_ids` is a Postgres `uuid[]`. The service **sorts** the array before insert and before lookup:

```ts
const sortedIds = [...dto.participantIds].sort();
qb.where('c.participant_ids = :ids', { ids: sortedIds });
```

So a chat between A and B always has `participant_ids = [A, B]` regardless of who initiated. Plus a `listing_id` qualifier — A talking to B about *listing X* is a different conversation from A talking to B about *listing Y* (or no listing at all).

`order_id` is captured for context but not used in the uniqueness key. We could revisit that if buyers and sellers end up with one chat per order.

## REST endpoints

| Method | Path | Auth | Effect |
|---|---|---|---|
| `POST` | `/messaging/conversations` | JWT | Find-or-create; returns 200 if found, 201 if created |
| `GET` | `/messaging/conversations?page=&limit=` | JWT | List my conversations with last message + unread count |
| `GET` | `/messaging/conversations/:id/messages?before=&limit=` | JWT | Paginated history (cursor by message id) |

### Create

```ts
{
  participantIds: string[];    // must include the caller's id
  listingId?: string;
  orderId?: string;
}
```

If `dto.participantIds` doesn't include the caller, `400 BadRequestException('Current user must be one of the participants')`. The service then looks for an existing conversation with the same sorted `participant_ids` AND same `listing_id` (NULL-safe). If found, returns it. If not, inserts.

### List

`listConversationsForUser`:

1. Select conversations where `userId = ANY(participant_ids)`, ordered by `last_message_at DESC NULLS LAST, created_at DESC`.
2. For the returned page, run two side-queries in parallel:
   - **Last message**: one query with `DISTINCT ON (conversation_id)` to pluck the latest message per thread.
   - **Unread count**: GROUP BY `conversation_id` over messages where `read_at IS NULL AND sender_id != userId`.
3. Stitch them into the response.

The response shape is in `dto/conversation-list-item.response.ts`. It returns `lastMessage: { content, type, senderId, createdAt } | null` and `unreadCount: number` per row.

### Messages history

```http
GET /messaging/conversations/:id/messages?before=<messageId>&limit=50
```

Cursor pagination: messages with `created_at < (SELECT created_at FROM messages WHERE id = :before)`. Result returns oldest-first within the page (the service reverses after fetching `DESC` to keep the chat scroll natural).

Limit defaults to 50, caps via DTO validator if you need (none today — be careful with unbounded `limit`).

## Socket.io gateway

Namespace: `/chat`. Connect URL on the client: `io(`${API_BASE}/chat`)`.

### Authentication on connect

`MessagingGateway.handleConnection`:

1. Extract token from `socket.handshake.auth.token` (preferred) or `Authorization: Bearer ...` header.
2. Verify with `JWT_SECRET`.
3. Stash `payload.sub` on `socket.data.userId`.
4. Disconnect with no message if anything fails.

There's no separate gateway-level "are you suspended" check — we trust the JWT. If a user is suspended mid-session, their next HTTP request will 401 but the existing socket stays open until they reconnect.

### Events

All three event handlers do the same envelope: parse, validate, check participant membership, do the work, ack. Acks are the third Socket.io callback argument:

```js
socket.emit('joinConversation', { conversationId }, (ack) => { ... });
```

| Event | Payload | Ack |
|---|---|---|
| `joinConversation` | `{ conversationId: uuid }` | `{ ok: true }` or `{ ok: false, error: 'invalid_payload' | 'unauthorized' | 'not_found' | 'forbidden' }` |
| `sendMessage` | `{ conversationId, content, type? }` | as above, plus `message: Message` on success |
| `typing` | `{ conversationId, isTyping: boolean }` | as above; broadcasts `userTyping` |
| `markRead` | `{ conversationId, messageIds[] }` | as above, plus `updated: string[]`, `readAt: Date` |

After a successful `joinConversation`, the socket is added to a room named `conversation:<uuid>`. All subsequent broadcasts for that conversation go to that room.

### Broadcasts

| Event | When | Payload |
|---|---|---|
| `newMessage` | After `sendMessage` succeeds; emitted to other room members | full `Message` entity |
| `userTyping` | After a `typing` event; emitted to other room members | `{ conversationId, userId, isTyping }` |
| `messageRead` | After `markRead` flips messages from unread to read | `{ messageIds: string[], readerId, readAt }` |

Note that the *sender* doesn't receive `newMessage` for their own message — they get the ack back with the saved entity. Other participants get the broadcast.

### Authorisation

`MessagingService.assertIsParticipant(conversationId, userId)` is the single auth check. Every gateway handler runs it and maps the error:

- `NotFoundException` → ack with `error: 'not_found'`.
- `ForbiddenException` → ack with `error: 'forbidden'`.

This same method is called by REST endpoints (`listMessages`, `findOrCreate`'s implicit check via the participant rule). One door, one bouncer.

## Send-message detail

`MessagingService.sendMessage`:

```ts
return this.dataSource.transaction(async (manager) => {
  const saved = await manager.save(Message, { conversationId, senderId, content, type });
  await manager.update(Conversation, conversationId, { lastMessageAt: saved.createdAt });
  return saved;
});
```

Single transaction so the conversation's `last_message_at` never drifts behind the message it points at.

Why we update `last_message_at` instead of recomputing on read: the conversation list query is N-times-a-second, recomputing each time would force a subquery. Storing the timestamp lets the list query be ORDER BY on a column.

## Mark-read mechanics

`markMessagesRead(conversationId, readerId, messageIds[])`:

```sql
UPDATE messages
   SET read_at = $1
 WHERE id = ANY($2)
   AND conversation_id = $3
   AND sender_id != $4              -- never mark own messages as read
   AND read_at IS NULL              -- only flip unreads
RETURNING id;
```

Returns the actually-updated ids and the `read_at` value. The gateway broadcasts `messageRead` only when something was updated, so idempotent re-marks don't spam the room.

## Message types

`MessageType` enum:

- `text` — `content` is the literal text.
- `image` — `content` is an S3 key (or URL). The mobile client resolves it to a presigned URL.
- `certificate` — `content` is a certificate id; mobile renders a card linking to `CertificateDetailScreen`.
- `offer` — reserved for "I offer X SAR per head" structured messages; not implemented client-side yet.

Adding a new type means: add to the enum (TS + migration `ALTER TYPE ADD VALUE`), and ensure the mobile renderer handles it. There's no per-type backend validation today; if you add an `offer` type with structured data, parse it on the server.

## Image attachments

Already works end-to-end as of Phase D (PR around #140):

```
1. Mobile picks an image
2. POST /uploads/presigned-url { purpose: "chat", contentType, fileName }
3. PUT to S3 directly
4. socket.emit('sendMessage', { conversationId, content: <key>, type: 'image' })
5. Backend persists; broadcasts to room
6. Mobile renderer signs the key with /uploads/presigned-url for read, renders <Image>
```

Two-line preview in `ConversationsScreen` shows "📷 Photo" for image messages instead of the raw key.

## Typing indicator

Implemented on the mobile side with:

- Debounced emit while typing (every ~500 ms).
- Auto-stop after 3 s of inactivity in the input.
- Safety auto-clear after 5 s in case `isTyping: false` never arrives.
- Italic line above the input on the receiving end.

The server does not persist typing — it's broadcast-only. Reconnecting starts cleanly.

## Mobile-side socket lifecycle

`mobile/src/services/socket.service.ts` (typical RN Socket.io wrapper):

- Lazily creates the socket on first use.
- Reconnects automatically (Socket.io built-in) with exponential backoff.
- Provides `joinConversation`, `sendMessage`, `markRead`, `typing` as promise-returning helpers.
- Auth: passes `{ auth: { token: <access> } }` on connect. On token rotation (refresh-on-401), the socket is *not* reconnected automatically — that's a small gap; reconnecting on visibility change or app-resume is a decent workaround.

## Error handling at the gateway

Every handler maps known service errors to ack errors and re-throws unknown ones. The gateway uses class-validator on the body via `plainToInstance`:

```ts
const dto = plainToInstance(SendMessageDto, payload) ?? new SendMessageDto();
const errors = await validate(dto);
if (errors.length > 0) return { ok: false, error: 'invalid_payload' };
```

This means malformed payloads (missing fields, wrong types) come back as `invalid_payload`, while business-rule failures come back as `not_found` / `forbidden`. The client can decide whether to surface the error or retry.

## Smoke tests

Two CLI smoke scripts that connect a real Socket.io client to a running backend:

- `backend/scripts/smoke-join-conversation.js` — exercises `joinConversation` and `sendMessage` round-trip.
- `backend/scripts/smoke-mark-read.js` — checks `markRead` returns updated ids.

Run them against `npm run start:dev` when you tweak gateway internals.

## Scaling notes

- Today the gateway is in-process. If you scale to multiple backend replicas, room broadcasts won't reach sockets on the other replicas. **Add the Socket.io Redis adapter** (`@socket.io/redis-adapter`) using the same Redis instance — minimal config change in `main.ts`.
- The `participant_ids = ANY(:id)` query on `conversations` is GIN-indexed; performant at moderate scale. At >10M conversations consider materialising per-user inbox tables.

## Cross-references

- [02 — Architecture](02-architecture.md) — module boundaries; messaging is the most self-contained.
- [13 — API reference](13-api-reference.md) — REST endpoints for messaging.
- [14 — Mobile app](14-mobile-app.md) — chat screen wiring.
