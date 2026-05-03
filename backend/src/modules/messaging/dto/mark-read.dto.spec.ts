import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarkReadDto } from './mark-read.dto';

const conversationId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';

const validate_ = async (input: unknown) =>
  validate(plainToInstance(MarkReadDto, input));

const props = (errors: { property: string }[]) => errors.map((e) => e.property);

describe('MarkReadDto', () => {
  it('passes with valid conversationId and messageIds', async () => {
    const errs = await validate_({ conversationId, messageIds: [messageId] });
    expect(errs).toEqual([]);
  });

  it('rejects when conversationId is missing', async () => {
    const errs = await validate_({ messageIds: [messageId] });
    expect(props(errs)).toContain('conversationId');
  });

  it('rejects when conversationId is not a uuid v4', async () => {
    const errs = await validate_({
      conversationId: 'not-a-uuid',
      messageIds: [messageId],
    });
    expect(props(errs)).toContain('conversationId');
  });

  it('rejects when messageIds is missing', async () => {
    const errs = await validate_({ conversationId });
    expect(props(errs)).toContain('messageIds');
  });

  it('rejects when messageIds is empty', async () => {
    const errs = await validate_({ conversationId, messageIds: [] });
    expect(props(errs)).toContain('messageIds');
  });

  it('rejects when messageIds contains a non-uuid value', async () => {
    const errs = await validate_({
      conversationId,
      messageIds: [messageId, 'not-a-uuid'],
    });
    expect(props(errs)).toContain('messageIds');
  });

  it('rejects when messageIds has more than 200 entries', async () => {
    const errs = await validate_({
      conversationId,
      messageIds: Array.from(
        { length: 201 },
        (_, i) => `${i.toString().padStart(8, '0')}-2222-4222-8222-222222222222`,
      ),
    });
    expect(props(errs)).toContain('messageIds');
  });

  it('accepts exactly 200 message ids', async () => {
    const errs = await validate_({
      conversationId,
      messageIds: Array.from(
        { length: 200 },
        (_, i) => `${i.toString().padStart(8, '0')}-2222-4222-8222-222222222222`,
      ),
    });
    expect(errs).toEqual([]);
  });
});
