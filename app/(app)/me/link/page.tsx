import { redirect } from 'next/navigation'

/**
 * Marine Link はメンバー画面に統合した。
 * どちらも同じ相手を Marine ID で指していて、同じ人を2か所に登録することになっていたため。
 * 以前のURLを開いても迷子にならないよう、ここは転送だけ行う。
 */
export default function LegacyLinkPage() {
  redirect('/me/members')
}
