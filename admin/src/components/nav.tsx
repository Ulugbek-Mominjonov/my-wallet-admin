'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Xulosa' },
  { href: '/months', label: 'Oylar' },
  { href: '/incomes', label: 'Daromadlar' },
  { href: '/expenses', label: 'Xarajatlar' },
  { href: '/personal-fund', label: '👤 Fond' },
  { href: '/savings', label: "🏦 Jamg'arma" },
  { href: '/debts', label: '💳 Qarzlar' },
  { href: '/goals', label: '🎯 Maqsadlar' },
  { href: '/settings/recurring', label: 'Doimiy' },
  { href: '/settings/limits', label: 'Limitlar' },
  { href: '/settings/income-rules', label: 'Qoidalar' },
  { href: '/tools/health', label: '🩺 Tekshiruv' },
  { href: '/tools/export', label: 'Eksport' },
  { href: '/tools/audit', label: 'Audit' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? 'bg-[var(--color-brand-500)] text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
