import type { Notice } from './shared'

export function NoticeBar({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <p
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm font-semibold ${
        notice.kind === 'error' ? 'bg-accent-soft text-accent' : 'bg-ok-soft text-ok'
      }`}
    >
      {notice.text}
    </p>
  )
}
