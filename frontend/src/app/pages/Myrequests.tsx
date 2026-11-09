import { useState } from 'react'
import { Link } from 'react-router'
import { useReviewRequests } from '../hooks/useReviewRequests'
import { Workspace, WorkspaceHeader, ReviewToolbar, ReviewList, ReviewEmpty, filterReviews, type ReviewFilter } from '../components/shared/Workspace'

export function MyRequests() {
  const { requests, loading, error, retry } = useReviewRequests()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ReviewFilter>('all')
  const filtered = filterReviews(requests, query, status)
  return <Workspace>
    <WorkspaceHeader title="Every review, a little progress." description="The code you shared. The questions you asked. Keep track of your review requests here." action={<Link className="wk-button" to="/create-request">Request a review</Link>} />
    <ReviewToolbar query={query} onQuery={setQuery} status={status} onStatus={setStatus} />
    {loading ? <p className="wk-loading" role="status">Opening your reviews…</p> : error ? <div className="wk-error" role="alert"><p>{error}</p><button className="wk-button wk-button-secondary" onClick={retry}>Try again</button></div> : filtered.length ? <><p className="wk-result-count" role="status">Showing {filtered.length} of {requests.length} reviews</p><ReviewList requests={filtered} /></> : <ReviewEmpty filtered={!!query || status !== 'all'} reset={() => { setQuery(''); setStatus('all') }} />}
  </Workspace>
}
