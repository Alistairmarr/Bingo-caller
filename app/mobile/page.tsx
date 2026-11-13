import { Suspense } from 'react'
import { MobileView } from '@/components/MobileView'

export default function MobilePage() {
  return (
    <Suspense
      fallback={
        <main className="mobile">
          <p className="join-hint" style={{ margin: '2rem auto', textAlign: 'center' }}>
            Opening mobile…
          </p>
        </main>
      }
    >
      <MobileView />
    </Suspense>
  )
}
