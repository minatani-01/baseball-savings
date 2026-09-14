import { redirect } from 'next/navigation'
import MeClient from '@/components/MeClient'
import { getProfile, getSessionUser, signAvatarUrl } from '@/lib/queries'

export default async function MePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  // アイコンは非公開バケットにあるので、表示のたびに署名付きURLを発行する
  const avatarUrl = await signAvatarUrl(profile?.avatar_path ?? null)

  return (
    <MeClient
      userId={user.id}
      email={user.email ?? ''}
      initialProfile={profile}
      avatarUrl={avatarUrl}
    />
  )
}
