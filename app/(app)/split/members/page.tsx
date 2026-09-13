import { redirect } from 'next/navigation'
import MembersClient from '@/components/split/MembersClient'
import { getSessionUser, getSplitMembers } from '@/lib/queries'

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const members = await getSplitMembers(user.id)
  return <MembersClient userId={user.id} members={members} />
}
