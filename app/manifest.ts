import type { MetadataRoute } from 'next'

/**
 * ホーム画面に追加するための manifest。
 *
 * iOS は、ホーム画面に追加した PWA からでないと Web Push を受け取れない
 * （iOS 16.4 以降）。Safari のタブのままでは通知の許可も求められないので、
 * 通知を使うにはこの manifest と Service Worker の両方が要る。
 *
 * display を standalone にすると、アイコンから起動したときに
 * ブラウザのアドレスバーが出ない。iOS が PWA と見なす条件でもある。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Marine Wallet',
    short_name: 'Marine Wallet',
    description:
      'マリーンズを応援する毎日を、記録し、つなぎ、未来へ積み立てる。貯金・割り勘・観戦記録を1つに統合する個人利用アプリ。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05070b',
    theme_color: '#05070b',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
