import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MessageType } from '@shared/enums';
import { SendMessageDto } from './send-message.dto';

const conversationId = '11111111-1111-4111-8111-111111111111';

const validate_ = async (input: unknown) =>
  validate(plainToInstance(SendMessageDto, input));

const props = (errors: { property: string }[]) => errors.map((e) => e.property);

describe('SendMessageDto', () => {
  it('passes with all required fields', async () => {
    const errs = await validate_({
      conversationId,
      content: 'hello',
      type: MessageType.TEXT,
    });
    expect(errs).toEqual([]);
  });

  it('rejects when conversationId is missing', async () => {
    const errs = await validate_({ content: 'hi', type: MessageType.TEXT });
    expect(props(errs)).toContain('conversationId');
  });

  it('rejects when conversationId is not a uuid v4', async () => {
    const errs = await validate_({
      conversationId: 'not-a-uuid',
      content: 'hi',
      type: MessageType.TEXT,
    });
    expect(props(errs)).toContain('conversationId');
  });

  it('rejects when content is empty string', async () => {
    const errs = await validate_({
      conversationId,
      content: '',
      type: MessageType.TEXT,
    });
    expect(props(errs)).toContain('content');
  });

  it('rejects when content is missing', async () => {
    const errs = await validate_({ conversationId, type: MessageType.TEXT });
    expect(props(errs)).toContain('content');
  });

  it('rejects when content exceeds 4000 chars', async () => {
    const errs = await validate_({
      conversationId,
      content: 'a'.repeat(4001),
      type: MessageType.TEXT,
    });
    expect(props(errs)).toContain('content');
  });

  it('accepts content of exactly 4000 chars', async () => {
    const errs = await validate_({
      conversationId,
      content: 'a'.repeat(4000),
      type: MessageType.TEXT,
    });
    expect(errs).toEqual([]);
  });

  it('rejects when type is not a MessageType value', async () => {
    const errs = await validate_({
      conversationId,
      content: 'hi',
      type: 'pizza',
    });
    expect(props(errs)).toContain('type');
  });

  it.each([
    MessageType.TEXT,
    MessageType.IMAGE,
    MessageType.CERTIFICATE,
    MessageType.OFFER,
  ])('accepts type=%s', async (type) => {
    const errs = await validate_({ conversationId, content: 'hi', type });
    expect(errs).toEqual([]);
  });
});
