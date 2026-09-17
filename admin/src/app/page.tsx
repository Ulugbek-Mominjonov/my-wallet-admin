import { redirect } from 'next/navigation';

import { SignInButton } from '@/components/sign-in';
import { currentUser } from '@/lib/session';

/** Kirish sahifasi — Google orqali. */
export default async function LoginPage() {
  if (await currentUser()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-4xl">💰</p>
        <h1 className="mt-4 text-xl font-bold">Oylik byudjet — admin</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Telefon ilovasi kundalik foydalanish uchun. Bu panel — jadval,
          tahlil va import/eksport uchun.
        </p>
        <div className="mt-6">
          <SignInButton />
        </div>
      </div>
    </main>
  );
}
