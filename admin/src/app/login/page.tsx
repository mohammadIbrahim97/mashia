'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+966 50 123 4567');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const onSignIn = () => {
    document.cookie = 'access_token=mock-foundation; path=/; max-age=86400';
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-parchment relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 30%, rgba(0,115,57,0.06) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,151,74,0.07) 0, transparent 40%)',
        }}
      />
      <div className="relative w-[380px] bg-paper border border-hairline rounded-md p-8 shadow-1">
        <div className="font-display text-4xl font-light tracking-tight text-ink">
          Mash
          <em className="italic text-gold">ia</em>
          <span className="text-gold">.</span>
        </div>
        <div className="font-mono text-[10px] tracking-mono-xwide uppercase text-muted mt-1">
          ADMIN · SIGN IN
        </div>

        <div className="mt-7">
          {step === 'phone' ? (
            <>
              <Overline>Phone number</Overline>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full px-3.5 py-3 font-mono text-sm bg-parchment border border-hairline rounded outline-none focus:border-mashia-600"
              />
              <div className="text-xs text-muted mt-2.5">
                We&apos;ll text you a 6-digit code.
              </div>
              <div className="mt-4">
                <Button onClick={() => setStep('otp')} className="w-full">
                  Send code →
                </Button>
              </div>
            </>
          ) : (
            <>
              <Overline>Verification code</Overline>
              <div className="flex gap-2 mt-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    maxLength={1}
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && i > 0)
                        inputs.current[i - 1]?.focus();
                    }}
                    className="w-11 h-13 text-center font-display text-[22px] bg-parchment border border-hairline rounded outline-none focus:border-mashia-600"
                    style={{ height: 52 }}
                  />
                ))}
              </div>
              <div className="text-xs text-muted mt-2.5">
                Sent to {phone.replace(/(\d{3})\d{4}$/, '••• $1').slice(-12)} · resend in 24s
              </div>
              <div className="mt-4 flex justify-between">
                <Button kind="ghost" onClick={() => setStep('phone')}>
                  ← Back
                </Button>
                <Button onClick={onSignIn}>Sign in →</Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-hairline font-mono text-[10px] tracking-mono uppercase text-muted text-center">
          v1.0 · me-south-1
        </div>
      </div>
    </div>
  );
}
