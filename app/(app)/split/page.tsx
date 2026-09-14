import { redirect } from 'next/navigation'
import SplitClient from '@/components/split/SplitClient'
import {
  getSessionUser,
  getSharedSplitRecords,
  getSplitMembers,
  getSplitRecords,
} from '@/lib/queries'

export default async function SplitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [records, members, shared] = await Promise.all([
    getSplitRecords(user.id),
    getSplitMembers(user.id),
    getSharedSplitRecords(user.id),
  ])

  return <SplitClient userId={user.id} records={records} members={members} shared={shared} />
}
