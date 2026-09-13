'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { IconHistory, IconHome, IconSavings, IconSplit, IconUser } from '@/components/icons'
import { APP_NAME } from '@/lib/constants'

const TABS = [
  { href: '/', label: 'ホーム', Icon: IconHome },
  { href: '/savings', label: '貯金', Icon: IconSavings },
  { href: '/split', label: '割り勘', Icon: IconSplit },
  { href: '/history', label: '履歴', Icon: IconHistory },
  { href: '/me', label: 'マイページ', Icon: IconUser },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AppShell({
  children,
  title,
  right,
}: {
  children: ReactNode
  title?: string
  right?: ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex min-w-0 flex-col leading-none">
            <span className="eyebrow">{APP_NAME}</span>
            <span className="mt-1 truncate text-[15px] font-semibold tracking-wide">
              {title ?? 'MARINE WALLET'}
            </span>
          </Link>
          {right}
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] transition-colors ${
                  active ? 'text-marine' : 'text-fg-mute hover:text-fg-dim'
                }`}
              >
                <Icon size={21} />
                <span className="text-[10px] tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
