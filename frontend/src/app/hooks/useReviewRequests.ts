import { useCallback, useEffect, useState } from 'react'
import { requestApi } from '../../api/requests'
import type { ReviewRequest } from '../../api/types'

export function useReviewRequests() {
  const [requests, setRequests] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    requestApi.mine()
      .then(({ requests }) => { if (active) setRequests(requests) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Your reviews could not be loaded. Try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  return { requests, loading, error, retry }
}
