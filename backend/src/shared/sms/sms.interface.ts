export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}

export const SMS_SERVICE = 'SMS_SERVICE';
