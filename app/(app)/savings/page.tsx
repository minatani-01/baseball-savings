import { redirect } from 'next/navigation'
import SavingsClient from '@/components/savings/SavingsClient'
import {
  getMonthlySavings,
  getProfile,
  getSavingEntries,
  getSavingRules,
  getSessionUser,
  getSharedGoals,
} from '@/lib/queries'

export default async function SavingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, monthlySavings, rules, goals, profile] = await Promise.all([
    getSavingEntries(user.id),
    getMonthlySavings(user.id),
    getSavingRules(user.id),
    getSharedGoals(),
    getProfile(user.id),
  ])

  return (
    <SavingsClient
      userId={user.id}
      entries={entries}
      monthlySavings={monthlySavings}
      rules={rules}
      goals={goals}
      isMaster={profile?.is_master ?? false}
    />
  )
}
