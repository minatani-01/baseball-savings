import { redirect } from 'next/navigation'
import SplitClient from '@/components/split/SplitClient'
import {
  getMarineLinks,
  getSessionUser,
  getSharedSplitRecords,
  getSplitMembers,
  getSplitRecords,
} from '@/lib/queries'

export default async function SplitPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // ホームの「割り勘を作成」から来たときは、登録シートを開いた状態で描画する。
  // クライアント側で開くと一度画面が出てから開くことになるので、サーバーで決める。
  const [params, records, members, shared, links] = await Promise.all([
    searchParams,
    getSplitRecords(user.id),
    getSplitMembers(user.id),
    getSharedSplitRecords(user.id),
    // 割り勘を登録したときに、接続している相手へ知らせるために使う
    getMarineLinks(user.id),
  ])

  return (
    <SplitClient
      userId={user.id}
      records={records}
      members={members}
      links={links}
      shared={shared}
      openNew={params.new === '1'}
    />
  )
}
