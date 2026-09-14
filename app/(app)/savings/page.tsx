import { redirect } from 'next/navigation'
import SavingsClient from '@/components/savings/SavingsClient'
import {
  getMonthlySavings,
  getProfile,
  getRecentGames,
  getSavingEntries,
  getSavingRules,
  getSessionUser,
  getSharedGoals,
} from '@/lib/queries'

export default async function SavingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, monthlySavings, rules, goals, profile, games] = await Promise.all([
    getSavingEntries(user.id),
    getMonthlySavings(user.id),
    getSavingRules(),
    getSharedGoals(),
    getProfile(user.id),
    // 共通の試合。自分がまだ積み立てていないものを拾うために使う
    getRecentGames(400),
  ])

  return (
    <SavingsClient
      userId={user.id}
      entries={entries}
      monthlySavings={monthlySavings}
      rules={rules}
      goals={goals}
      isMaster={profile?.is_master ?? false}
      games={games}
    />
  )
}
