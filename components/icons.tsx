import type { SVGProps } from 'react'

/**
 * Marine Wallet のアイコンセット。
 * 仕様書 4.1 の禁止事項に従い、UIでは絵文字を一切使わず単色のラインアイコンで統一する。
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 22, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11.2 12 4l9 7.2" />
      <path d="M5.6 10.2V20h12.8v-9.8" />
      <path d="M10 20v-4.6h4V20" />
    </Icon>
  )
}

export function IconSavings(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.8c0-1.55 3.58-2.8 8-2.8s8 1.25 8 2.8-3.58 2.8-8 2.8-8-1.25-8-2.8Z" />
      <path d="M4 6.8v4.7c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V6.8" />
      <path d="M4 11.5v4.7c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8v-4.7" />
    </Icon>
  )
}

export function IconSplit(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6v16.8" />
      <path d="M8.6 8.4H6.4" />
      <path d="M17.6 15.6h-2.2" />
    </Icon>
  )
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 3.8v16.4h16" />
      <path d="M7.2 15.6 11 11.2l2.9 2.4L20 7" />
    </Icon>
  )
}

export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </Icon>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  )
}

export function IconMinus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Icon>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Icon>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.4" />
      <path d="M15.5 5.5H6.9A2.4 2.4 0 0 0 4.5 7.9v8.6" />
    </Icon>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 4.5H19.5v6" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.5v3.6a2 2 0 0 1-2 2H5.9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.6" />
    </Icon>
  )
}

export function IconEdit(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5l-1 3Z" />
      <path d="M14.5 7.5 17 10" />
    </Icon>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8h5v1.7" />
      <path d="M6.8 6.5 7.6 20h8.8l.8-13.5" />
      <path d="M10.4 10v6.2" />
      <path d="M13.6 10v6.2" />
    </Icon>
  )
}

export function IconRules(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7.5h10" />
      <circle cx="17.5" cy="7.5" r="2" />
      <path d="M19.5 16.5h-10" />
      <circle cx="6.5" cy="16.5" r="2" />
    </Icon>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.4" />
      <path d="M4 10h16" />
      <path d="M8.5 3.5v4" />
      <path d="M15.5 3.5v4" />
    </Icon>
  )
}

export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" />
    </Icon>
  )
}

export function IconLogout(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5H7.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h7" />
      <path d="M15 12h5.5" />
      <path d="m17.8 9.2 2.7 2.8-2.7 2.8" />
    </Icon>
  )
}

export function IconBank(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 9.5 12 4.5l8.5 5" />
      <path d="M5.5 9.5v8" />
      <path d="M10 9.5v8" />
      <path d="M14 9.5v8" />
      <path d="M18.5 9.5v8" />
      <path d="M3.5 19.8h17" />
    </Icon>
  )
}

export function IconSpark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z" />
    </Icon>
  )
}
