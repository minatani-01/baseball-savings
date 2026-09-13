import { redirect } from 'next/navigation'
import SplitClient from '@/components/split/SplitClient'
import { getMemberSettings, getSessionUser, getSplitRecords } from '@/lib/queries'

export default async function SplitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [records, settings] = await Promise.all([
    getSplitRecords(user.id),
    getMemberSettings(user.id),
  ])

  return <SplitClient userId={user.id} records={records} settings={settings} />
}
