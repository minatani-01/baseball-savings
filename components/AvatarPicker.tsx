'use client'

import { Avatar } from '@/components/ui'
import { IconCamera } from '@/components/icons'

/**
 * タップすると端末の画像選択が開くアイコン。
 * ラベルで隠しファイル入力を包んでいるので、アイコン全体が選択ボタンになる。
 * アップロードそのものは呼び出し側が行う（書き込み先のテーブルが画面ごとに違うため）。
 */
export default function AvatarPicker({
  name,
  src,
  hasPhoto,
  size = 40,
  selected = false,
  disabled = false,
  onFile,
}: {
  name: string
  src: string | null
  hasPhoto: boolean
  size?: number
  selected?: boolean
  disabled?: boolean
  onFile: (file: File) => void
}) {
  return (
    <label
      className={`relative shrink-0 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      title={hasPhoto ? '写真を変更' : '写真を追加'}
    >
      <Avatar name={name} src={src} size={size} selected={selected} />
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -bottom-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-ink text-fg-mute"
      >
        <IconCamera size={11} />
      </span>
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        className="sr-only"
        aria-label={`${name} の写真を選ぶ`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          // 同じファイルを選び直しても change が起きるように空にしておく
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}
