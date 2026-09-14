/**
 * Marine Wallet の Service Worker。
 *
 * 役割は通知の受信と、通知をタップしたときの画面の呼び出しだけ。
 * オフライン対応はしない。金額を扱う画面なので、
 * 古いキャッシュを見せるより、通信できないことを素直に出す方が安全。
 */

// 通知が届いたとき
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // 本文が JSON でないときは、素のテキストを本文として扱う
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Marine Wallet'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // 同じ種類の通知が積み上がらないようにまとめる
    tag: payload.tag || 'marine-wallet',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// 通知をタップしたとき
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // すでに開いているウィンドウがあれば、そこを使う。
      // 新しく開くと、ホーム画面から起動した PWA とは別の窓になってしまう
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(target)
    })()
  )
})

// 新しい Service Worker をすぐ有効にする
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
