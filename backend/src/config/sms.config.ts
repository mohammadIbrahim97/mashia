import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  provider: process.env.SMS_PROVIDER || 'console', // 'console', 'sns', or 'unifonic'

  // AWS SNS
  snsRegion: process.env.AWS_REGION || 'me-south-1',
  snsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  snsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

  // Unifonic
  unifonicAppSid: process.env.UNIFONIC_APP_SID,
  unifonicSenderId: process.env.UNIFONIC_SENDER_ID || 'Mashia',
}));
