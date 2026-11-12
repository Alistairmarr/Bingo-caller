import { Suspense } from 'react'
import { DisplayView } from '@/components/DisplayView'

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <main className="display">
          <p className="join-hint" style={{ margin: '2rem auto', textAlign: 'center' }}>
            Opening display…
          </p>
        </main>
      }
    >
      <DisplayView />
    </Suspense>
  )
}
