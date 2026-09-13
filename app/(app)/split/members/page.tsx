import { redirect } from 'next/navigation'
import MembersClient from '@/components/split/MembersClient'
import { getMemberSettings, getSessionUser } from '@/lib/queries'

export default async function MembersPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const settings = await getMemberSettings(user.id)
  return <MembersClient userId={user.id} settings={settings} />
}
