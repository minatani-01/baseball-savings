import { redirect } from 'next/navigation'
import RulesClient from '@/components/savings/RulesClient'
import { canEditSavingRules, getSavingRules, getSessionUser } from '@/lib/queries'

export default async function SavingRulesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // ルールは全アカウント共通。変更できるかは人によって違う
  const [rules, canEdit] = await Promise.all([getSavingRules(), canEditSavingRules()])

  return <RulesClient userId={user.id} initialRules={rules} canEdit={canEdit} />
}
