import { redirect } from 'next/navigation'
import HistoryClient from '@/components/history/HistoryClient'
import { getSavingEntries, getSessionUser, getSplitRecords } from '@/lib/queries'

export default async function HistoryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [entries, records] = await Promise.all([
    getSavingEntries(user.id),
    getSplitRecords(user.id),
  ])

  return <HistoryClient entries={entries} records={records} />
}
