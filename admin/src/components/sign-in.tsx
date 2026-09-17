'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { signInWithGoogle } from '@/lib/firebase-client';

export function SignInButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? 'Kirish rad etildi');
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Xato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-xl bg-[var(--color-brand-500)] px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Kirilmoqda…' : 'Google bilan kirish'}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-[var(--color-negative)]">{error}</p>
      ) : null}
    </div>
  );
}
