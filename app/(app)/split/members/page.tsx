import { redirect } from 'next/navigation'

/**
 * メンバー管理はマイページ配下（/me/members）へ移した。
 * 割り勘タブの下にあると、下部ナビが「割り勘」を点灯したままになってしまうため。
 * 以前のURLを開いても迷子にならないよう、ここは転送だけ行う。
 */
export default function LegacyMembersPage() {
  redirect('/me/members')
}
