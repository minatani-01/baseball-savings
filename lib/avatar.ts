import type { SupabaseClient } from '@supabase/supabase-js'
import { MEMBER_AVATAR_BUCKET, MEMBER_AVATAR_SIZE } from '@/lib/constants'

/** 読み込みを試す上限。これを超えるものは変換前に断る（デコードで固まらせないため） */
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024

/**
 * 選んだ画像を正方形の JPEG に変換する。
 *
 * そのまま上げると数MBの写真が並ぶことになるが、表示は最大40pxなので意味がない。
 * 中央で正方形に切り出してから 256px へ縮める。
 * Image 要素を経由するのは、canvas に描くときに EXIF の向きが反映されるため
 * （createImageBitmap は環境によって回転が落ちる）。
 */
export async function toSquareJpeg(file: File, size = MEMBER_AVATAR_SIZE): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('画像を読み込めませんでした'))
      el.src = url
    })

    const side = Math.min(image.naturalWidth, image.naturalHeight)
    if (side === 0) throw new Error('画像を読み込めませんでした')

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画像を変換できませんでした')

    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    )

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('画像を変換できませんでした'))),
        'image/jpeg',
        0.85
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 受け取ったファイルが扱えるものか確かめる。駄目なら理由を返す */
export function rejectReason(file: File): string | null {
  if (!file.type.startsWith('image/')) return '画像ファイルを選んでください'
  if (file.size > MAX_AVATAR_SOURCE_BYTES) return '画像が大きすぎます（20MBまで）'
  return null
}

/**
 * 変換した画像をアップロードし、保存先のパスを返す。
 *
 * パスに時刻を入れて毎回別名にするのは、同じ名前で上書きすると
 * 端末やCDNに残った古い画像がそのまま出ることがあるため。
 * 先頭フォルダを userId にするのは Storage の RLS（0010）に合わせるため。
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  prefix: string,
  file: File
): Promise<string> {
  const blob = await toSquareJpeg(file)
  const path = `${userId}/${prefix}-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from(MEMBER_AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('写真のアップロードに失敗しました')
  return path
}

/** 参照されなくなったファイルを消す。失敗しても画面の表示は正しいままなので投げない */
export async function removeAvatarFile(supabase: SupabaseClient, path: string | null) {
  if (!path) return
  await supabase.storage.from(MEMBER_AVATAR_BUCKET).remove([path])
}
