/** Last N called numbers, newest first — for Display / Mobile follow-along. */
export function RecentCalls({
  called,
  limit = 5,
  className = '',
}: {
  called: number[]
  limit?: number
  className?: string
}) {
  const recent = [...called].slice(-limit).reverse()
  if (recent.length === 0) return null

  return (
    <section className={`recent-calls ${className}`.trim()} aria-label="Recent calls">
      <p className="recent-calls-label">Recent</p>
      <ol className="recent-calls-list">
        {recent.map((n, i) => (
          <li
            key={`${n}-${i}`}
            className={i === 0 ? 'recent-calls-item recent-calls-item--hot' : 'recent-calls-item'}
          >
            {n}
          </li>
        ))}
      </ol>
    </section>
  )
}
