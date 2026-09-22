import { LayoutDashboard } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { navSectionsFor, type NavSection } from '@/features/app-shell/navigation'

const SECTIONS: NavSection[] = [
  {
    id: 'overview',
    titleKey: 'nav.overview',
    items: [{ to: '/h/$householdId', labelKey: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'settings',
    titleKey: 'nav.overview',
    items: [
      {
        to: '/h/$householdId',
        labelKey: 'nav.dashboard',
        icon: LayoutDashboard,
        permission: 'manage',
      },
    ],
  },
]

describe('navSectionsFor (E21-T03)', () => {
  it("owner/admin — hamma bo'limlar", () => {
    expect(navSectionsFor('owner', SECTIONS).map((s) => s.id)).toEqual(['overview', 'settings'])
    expect(navSectionsFor('admin', SECTIONS).map((s) => s.id)).toEqual(['overview', 'settings'])
  })

  it("member/viewer — boshqaruv bandlari va bo'sh bo'lim yashirinadi", () => {
    expect(navSectionsFor('member', SECTIONS).map((s) => s.id)).toEqual(['overview'])
    expect(navSectionsFor('viewer', SECTIONS).map((s) => s.id)).toEqual(['overview'])
  })

  it('standart menyu — viewer ham Xulosani ko‘radi', () => {
    expect(navSectionsFor('viewer')[0]?.items.map((i) => i.labelKey)).toEqual(['nav.dashboard'])
  })
})
