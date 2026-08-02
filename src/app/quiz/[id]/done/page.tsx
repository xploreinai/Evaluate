'use client'

import { useSearchParams } from 'next/navigation'

export default function DonePage({
  params,
}: {
  params: { id: string }
}) {
  const searchParams = useSearchParams()
  const score = searchParams.get('score') || '0'
  const passed = searchParams.get('passed') === 'true'

  return (
    <div className="text-center py-20">
      <div className="mb-6">
        {passed ? (
          <div className="text-6xl mb-4">✓</div>
        ) : (
          <div className="text-6xl mb-4">✗</div>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {passed ? 'Great job!' : 'Keep learning'}
      </h1>

      <p className="text-4xl font-bold text-gray-900 mb-8">
        {score} out of 10
      </p>

      <p className="text-gray-600 text-lg mb-2">
        {passed ? '✓ You passed the quiz' : '✗ You did not pass this time'}
      </p>

      <p className="text-gray-500">
        Your trainer has your results.
      </p>
    </div>
  )
}
