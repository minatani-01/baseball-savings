import { redirect } from 'next/navigation'
import RulesClient from '@/components/savings/RulesClient'
import { getSavingRules, getSessionUser } from '@/lib/queries'

export default async function SavingRulesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const rules = await getSavingRules(user.id)
  return <RulesClient userId={user.id} initialRules={rules} />
}
