import { redirect } from 'next/navigation'
import SplitClient from '@/components/split/SplitClient'
import { getSessionUser, getSplitMembers, getSplitRecords } from '@/lib/queries'

export default async function SplitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [records, members] = await Promise.all([
    getSplitRecords(user.id),
    getSplitMembers(user.id),
  ])

  return <SplitClient userId={user.id} records={records} members={members} />
}
