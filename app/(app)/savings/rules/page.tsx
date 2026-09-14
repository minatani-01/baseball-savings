import { redirect } from 'next/navigation'
import RulesClient from '@/components/savings/RulesClient'
import {
  canEditSavingRules,
  getSavingCustomPresets,
  getSavingRules,
  getSessionUser,
} from '@/lib/queries'

export default async function SavingRulesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // ルールは全アカウント共通。変更できるかは人によって違う
  const [rules, presets, canEdit] = await Promise.all([
    getSavingRules(),
    getSavingCustomPresets(),
    canEditSavingRules(),
  ])

  return (
    <RulesClient
      userId={user.id}
      initialRules={rules}
      initialPresets={presets}
      canEdit={canEdit}
    />
  )
}
