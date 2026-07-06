'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import {
  authService,
  isLoginSuccess,
  LoginSuccess,
} from '@/services/auth.service';
import { errorMessage } from '@/services/api';
import { session } from '@/services/session';

type Step = 'credentials' | 'totp';

function persistSession(s: LoginSuccess) {
  session.set(s.accessToken, {
    fullName: s.user.fullName,
    role: s.user.role,
  });
}

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authService.login(email, password);
      if (isLoginSuccess(res)) {
        persistSession(res);
        router.push('/dashboard');
      } else {
        setTicket(res.ticket);
        setStep('totp');
        setTimeout(() => codeRefs.current[0]?.focus(), 0);
      }
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  const handleCodeChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) codeRefs.current[i + 1]?.focus();
  };

  const onTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Enter all 6 digits.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await authService.verifyTotp(ticket, fullCode);
      persistSession(res);
      router.push('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Invalid code.'));
    } finally {
      setBusy(false);
    }
  };

  const onBackToCredentials = () => {
    setStep('credentials');
    setTicket(null);
    setCode(['', '', '', '', '', '']);
    setError(null);
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
          {step === 'credentials' ? (
            <form onSubmit={onCredentialsSubmit}>
              <Overline htmlFor="email">Email</Overline>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="layla@mashia.com"
                className="mt-1.5 w-full px-3.5 py-3 font-body text-sm bg-parchment border border-hairline rounded outline-none focus:border-mashia-600 placeholder:text-muted"
              />
              <div className="mt-4">
                <Overline htmlFor="password">Password</Overline>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full px-3.5 py-3 font-body text-sm bg-parchment border border-hairline rounded outline-none focus:border-mashia-600"
                />
              </div>
              {error && (
                <div className="mt-3 text-xs text-flagged">{error}</div>
              )}
              <div className="mt-5">
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in →'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={onTotpSubmit}>
              <Overline>Authenticator code</Overline>
              <div className="flex gap-2 mt-2" role="group" aria-label="Authenticator code digits">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      codeRefs.current[i] = el;
                    }}
                    aria-label={`Digit ${i + 1}`}
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && i > 0)
                        codeRefs.current[i - 1]?.focus();
                    }}
                    className="w-11 text-center font-display text-[22px] bg-parchment border border-hairline rounded outline-none focus:border-mashia-600"
                    style={{ height: 52 }}
                  />
                ))}
              </div>
              <div className="text-xs text-muted mt-2.5">
                Open your authenticator app and enter the 6-digit code.
              </div>
              {error && (
                <div className="mt-3 text-xs text-flagged">{error}</div>
              )}
              <div className="mt-5 flex justify-between">
                <Button
                  type="button"
                  kind="ghost"
                  onClick={onBackToCredentials}
                  disabled={busy}
                >
                  ← Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Verifying…' : 'Verify →'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-hairline font-mono text-[10px] tracking-mono uppercase text-muted text-center">
          v1.0 · me-south-1
        </div>
      </div>
    </div>
  );
}
