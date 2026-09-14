import { redirect } from 'next/navigation'
import MembersClient from '@/components/me/MembersClient'
import {
  getLinkMonthlyCompare,
  getMarineLinks,
  getMonthSavingTotal,
  getProfile,
  getSessionUser,
  getSharedGoals,
  getSplitMembers,
} from '@/lib/queries'
import { currentMonth } from '@/lib/format'

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const month = currentMonth()
  const [members, profile, links] = await Promise.all([
    getSplitMembers(user.id),
    getProfile(user.id),
    getMarineLinks(user.id),
  ])
  // 月間比較は接続相手が確定してからでないと引けないので、links の後に取る
  const [compare, myMonthTotal, goals] = await Promise.all([
    getLinkMonthlyCompare(links, members, month),
    getMonthSavingTotal(user.id, month),
    getSharedGoals(),
  ])

  return (
    <MembersClient
      userId={user.id}
      marineId={profile?.marine_id ?? ''}
      isMaster={profile?.is_master ?? false}
      members={members}
      links={links}
      month={month}
      myMonthTotal={myMonthTotal}
      compare={compare}
      goals={goals}
    />
  )
}
