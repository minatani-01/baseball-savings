import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getSessionUser } from '@/lib/queries'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return <AppShell>{children}</AppShell>
}
