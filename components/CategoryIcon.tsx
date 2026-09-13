import {
  IconBeer,
  IconDots,
  IconFood,
  IconGoods,
  IconTicket,
  IconTransport,
} from '@/components/icons'
import type { ExpenseCategory } from '@/types'

const MAP = {
  ticket: IconTicket,
  food: IconFood,
  beer: IconBeer,
  goods: IconGoods,
  transport: IconTransport,
  other: IconDots,
} as const

export default function CategoryIcon({
  category,
  size = 17,
}: {
  category: ExpenseCategory
  size?: number
}) {
  const Component = MAP[category] ?? IconDots
  return <Component size={size} />
}
