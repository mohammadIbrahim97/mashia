import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateConversationDto } from './create-conversation.dto';

const u1 = '11111111-1111-4111-8111-111111111111';
const u2 = '22222222-2222-4222-8222-222222222222';

const validate_ = async (input: unknown) =>
  validate(plainToInstance(CreateConversationDto, input));

const props = (errors: { property: string }[]) => errors.map((e) => e.property);

describe('CreateConversationDto', () => {
  it('passes with two valid uuid participantIds and no optional fields', async () => {
    const errs = await validate_({ participantIds: [u1, u2] });
    expect(errs).toEqual([]);
  });

  it('passes with valid listingId and orderId', async () => {
    const errs = await validate_({
      participantIds: [u1, u2],
      listingId: u1,
      orderId: u2,
    });
    expect(errs).toEqual([]);
  });

  it('rejects when participantIds is missing', async () => {
    const errs = await validate_({});
    expect(props(errs)).toContain('participantIds');
  });

  it('rejects when participantIds has fewer than 2 items', async () => {
    const errs = await validate_({ participantIds: [u1] });
    expect(props(errs)).toContain('participantIds');
  });

  it('rejects when participantIds is not an array', async () => {
    const errs = await validate_({ participantIds: u1 });
    expect(props(errs)).toContain('participantIds');
  });

  it('rejects when any participantId is not a uuid v4', async () => {
    const errs = await validate_({ participantIds: [u1, 'not-a-uuid'] });
    expect(props(errs)).toContain('participantIds');
  });

  it('rejects when listingId is not a uuid v4', async () => {
    const errs = await validate_({
      participantIds: [u1, u2],
      listingId: 'nope',
    });
    expect(props(errs)).toContain('listingId');
  });

  it('rejects when orderId is not a uuid v4', async () => {
    const errs = await validate_({
      participantIds: [u1, u2],
      orderId: 'nope',
    });
    expect(props(errs)).toContain('orderId');
  });
});
