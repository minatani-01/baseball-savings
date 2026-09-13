import { shortDate, yen } from '@/lib/format'

export type ChartPoint = { date: string; value: number }

/**
 * 累計貯金額の推移。外部チャートライブラリを使わず SVG で描画する。
 * （バンドルを増やさず、Marine Wallet のトンマナに合わせた線幅・発光を直接制御するため）
 */
export default function CumulativeChart({
  points,
  height = 200,
}: {
  points: ChartPoint[]
  height?: number
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-fg-dim">
        2試合以上記録するとグラフが表示されます
      </div>
    )
  }

  const width = 320
  const padTop = 12
  const padBottom = 22
  const padX = 4
  const innerW = width - padX * 2
  const innerH = height - padTop - padBottom

  const max = Math.max(...points.map((p) => p.value))
  const min = 0
  const span = max - min || 1

  const x = (i: number) => padX + (innerW * i) / (points.length - 1)
  const y = (value: number) => padTop + innerH - (innerH * (value - min)) / span

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(2)},${(padTop + innerH).toFixed(2)} L${padX},${(padTop + innerH).toFixed(2)} Z`

  const gridValues = [0.25, 0.5, 0.75, 1].map((ratio) => min + span * ratio)
  const last = points[points.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`累計貯金額の推移。最新 ${yen(last.value)}`}
      >
        <defs>
          <linearGradient id="mw-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => (
          <line
            key={value}
            x1={padX}
            x2={width - padX}
            y1={y(value)}
            y2={y(value)}
            stroke="#1c2534"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

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
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill="#22d3ee" />
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-fg-mute">
        <span className="tnum">{shortDate(points[0].date)}</span>
        <span className="tnum">{shortDate(last.date)}</span>
      </div>
    </div>
  )
}
