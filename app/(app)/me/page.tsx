import { redirect } from 'next/navigation'
import MeClient from '@/components/MeClient'
import { getProfile, getSessionUser } from '@/lib/queries'

export default async function MePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  return <MeClient userId={user.id} email={user.email ?? ''} initialProfile={profile} />
}
