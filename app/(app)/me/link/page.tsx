import { redirect } from 'next/navigation'
import LinkClient from '@/components/link/LinkClient'
import {
  getLinkMonthlyCompare,
  getMarineLinks,
  getMonthSavingTotal,
  getProfile,
  getSessionUser,
} from '@/lib/queries'
import { currentMonth } from '@/lib/format'

export default async function MarineLinkPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const month = currentMonth()
  const [profile, links] = await Promise.all([getProfile(user.id), getMarineLinks(user.id)])
  // 月間比較は接続相手が確定してからでないと引けないので、links の後に取る
  const [compare, myMonthTotal] = await Promise.all([
    getLinkMonthlyCompare(links, month),
    getMonthSavingTotal(user.id, month),
  ])

  return (
    <LinkClient
      userId={user.id}
      marineId={profile?.marine_id ?? ''}
      initialLinks={links}
      month={month}
      myMonthTotal={myMonthTotal}
      compare={compare}
    />
  )
}
