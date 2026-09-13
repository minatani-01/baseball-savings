'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import Brand from '@/components/Brand'
import {
  IconArrowLeft,
  IconBell,
  IconClock,
  IconHome,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/icons'

const TABS = [
  { href: '/', label: 'ホーム', Icon: IconHome },
  { href: '/savings', label: '貯金', Icon: IconWallet },
  { href: '/split', label: '割り勘', Icon: IconUsers },
  { href: '/history', label: '履歴', Icon: IconClock },
  { href: '/me', label: 'マイページ', Icon: IconUser },
]

/** 各画面のヘッダー表示。タブ直下は中央タイトル、その下の階層は戻る矢印を出す */
const HEADERS: Record<string, { title: string; back?: string }> = {
  '/savings': { title: '貯金' },
  '/savings/rules': { title: '貯金ルール', back: '/savings' },
  '/split': { title: '割り勘' },
  '/split/members': { title: 'メンバー', back: '/split' },
  '/history': { title: '履歴・グラフ' },
  '/me': { title: 'マイページ' },
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const header = HEADERS[pathname]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="grid h-14 grid-cols-[44px_1fr_44px] items-center px-2">
          <div className="flex justify-start">
            {header?.back ? (
              <button
                type="button"
                onClick={() => router.push(header.back!)}
                aria-label="戻る"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-dim transition-colors hover:text-marine"
              >
                <IconArrowLeft size={20} />
              </button>
            ) : null}
          </div>

          <div className="flex min-w-0 justify-center overflow-hidden">
            {header ? (
              <span className="truncate text-[15px] font-semibold tracking-wide">
                {header.title}
              </span>
            ) : (
              <Link href="/" className="min-w-0">
                <Brand />
              </Link>
            )}
          </div>

          <div className="flex justify-end">
            {header ? null : (
              <Link
                href="/me#notifications"
                aria-label="お知らせ"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-dim transition-colors hover:text-marine"
              >
                <IconBell size={19} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 backdrop-blur-xl">
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
