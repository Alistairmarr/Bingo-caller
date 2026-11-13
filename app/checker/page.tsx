import { Suspense } from 'react'
import { CheckerView } from '@/components/CheckerView'

export default function CheckerPage() {
  return (
    <Suspense
      fallback={
        <main className="checker">
          <p className="join-hint" style={{ margin: '2rem auto', textAlign: 'center' }}>
            Opening checker…
          </p>
        </main>
      }
    >
      <CheckerView />
    </Suspense>
  )
}
