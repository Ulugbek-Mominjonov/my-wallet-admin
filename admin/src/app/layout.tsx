import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Nav } from '@/components/nav';
import { currentUser } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oylik byudjet — admin',
  description: 'Katta ekran uchun: jadval, tahlil, import/eksport',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="uz">
      <body>
        {user ? (
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="text-xl">💰</span>
                <span className="font-semibold">Oylik byudjet</span>
              </div>
              <Nav />
              <form action="/api/auth/session" method="post">
                <input type="hidden" name="_method" value="delete" />
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {user.email ?? user.uid} · Chiqish
                </button>
              </form>
            </div>
            {children}
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
