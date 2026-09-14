import { redirect } from 'next/navigation'
import SavingsClient from '@/components/savings/SavingsClient'
import {
  getMonthlySavings,
  getSavingEntries,
  getSavingRules,
  getSessionUser,
  getSharedGoals,
} from '@/lib/queries'

export default async function SavingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, monthlySavings, rules, goals] = await Promise.all([
    getSavingEntries(user.id),
    getMonthlySavings(user.id),
    getSavingRules(user.id),
    getSharedGoals(),
  ])

  return (
    <SavingsClient
      userId={user.id}
      entries={entries}
      monthlySavings={monthlySavings}
      rules={rules}
      goals={goals}
    />
  )
}
