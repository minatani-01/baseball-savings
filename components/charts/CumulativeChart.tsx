import { yen } from '@/lib/format'

export type ChartPoint = { label: string; value: number }

/**
 * 累計貯金額の推移。外部チャートライブラリを使わず SVG で描画する。
 * （バンドルを増やさず、Marine Wallet のトンマナに合わせた線幅・発光を直接制御するため）
 *
 * 目盛りは縦に金額、横に年月を置く。線だけだと「何がどれくらい」なのかが読めない。
 * 色は1系列だけなので凡例は置かず、キャプションで何の線かを書く。
 */

/**
 * 目盛りの刻みを切りのいい数にする。
 * 上限だけを丸めると 25,000 を4等分して 6,250 のような刻みになり、かえって読めない。
 * 刻みの方を 1 / 2 / 2.5 / 5 × 10^n から選び、4本以内に収まる一番細かいものを使う。
 */
function niceStep(value: number): number {
  if (value <= 0) return 1
  const digits = Math.floor(Math.log10(value))
  for (let d = digits - 1; d <= digits + 1; d += 1) {
    const base = 10 ** d
    for (const unit of [1, 2, 2.5, 5]) {
      const step = base * unit
      if (step > 0 && value / step <= 4) return step
    }
  }
  return 10 ** (digits + 1)
}

/** 目盛り用の短い金額。万を超えたら「6万」「4.5万」にして横幅を詰める */
function axisAmount(value: number, max: number): string {
  if (max < 10000) return yen(value)
  const man = value / 10000
  const text = Number.isInteger(man) ? String(man) : man.toFixed(1)
  return `${text}万`
}

export default function CumulativeChart({
  points,
  height = 208,
  emptyLabel = '記録がたまるとグラフが表示されます',
}: {
  points: ChartPoint[]
  height?: number
  emptyLabel?: string
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-fg-dim">
        {emptyLabel}
      </div>
    )
  }

  const width = 320
  const padTop = 10
  const padBottom = 22
  // 縦軸のラベルぶんだけ左を空ける。最後の点の丸が切れないよう右も少し空ける
  const padLeft = 34
  const padRight = 8
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom

  const rawMax = Math.max(...points.map((p) => p.value))
  const step = niceStep(rawMax)
  const max = step * Math.max(1, Math.ceil(rawMax / step))

  // 点が1つのときは割り算ができないので、中央に置く（線は引かず丸だけ出す）
  const x = (i: number) =>
    points.length === 1 ? padLeft + innerW / 2 : padLeft + (innerW * i) / (points.length - 1)
  const y = (value: number) => padTop + innerH - (innerH * value) / max
  const baseY = padTop + innerH

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
    .join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(2)},${baseY.toFixed(2)} L${padLeft},${baseY.toFixed(2)} Z`

  const yTicks: number[] = []
  for (let v = 0; v <= max + 0.5; v += step) yTicks.push(v)

  // 横軸のラベルは、隣とぶつからない間隔だけ残す。
  // 文字は 8.5 なので 34 もあれば「2026年」でも重ならない
  const minGap = 34
  const xTicks: number[] = []
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0 || x(i) - x(xTicks[xTicks.length - 1]) >= minGap) xTicks.push(i)
  }

  const last = points[points.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`累計貯金額の推移。${points[0].label}から${last.label}まで、最新 ${yen(last.value)}`}
      >
        <defs>
          <linearGradient id="mw-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 目盛り線は背景に退かせ、数字だけを読ませる */}
        {yTicks.map((value) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(value)}
              y2={y(value)}
              stroke="#1c2534"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={padLeft - 5}
              y={y(value) + 3}
              textAnchor="end"
              fontSize="8.5"
              fill="#9fb0c0"
              className="tnum"
            >
              {axisAmount(value, max)}
            </text>
          </g>
        ))}

        {points.length > 1 ? (
          <>
            <path d={area} fill="url(#mw-chart-fill)" />
            <path
              d={line}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill="#22d3ee" />

        {/* 点が1つだけのときは線が無く、丸の高さだけでは額が読み取りにくいので値を添える */}
        {points.length === 1 ? (
          <text
            x={x(0)}
            y={y(last.value) - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#e6edf3"
            className="tnum"
          >
            {yen(last.value)}
          </text>
        ) : null}

        {xTicks.map((index, i) => (
          <text
            key={points[index].label}
            x={x(index)}
            y={height - 7}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            fontSize="8.5"
            fill="#6b7c8d"
            className="tnum"
          >
            {points[index].label}
          </text>
        ))}
      </svg>

    </div>
  )
}
