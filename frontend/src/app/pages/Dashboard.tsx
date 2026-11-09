import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useReviewRequests } from '../hooks/useReviewRequests'
import { Workspace, WorkspaceHeader, ReviewList, ReviewToolbar, ReviewEmpty, ReviewStatus, filterReviews, type ReviewFilter } from '../components/shared/Workspace'

export function Dashboard() {
  const { user } = useAuth()
  const { requests, loading, error, retry } = useReviewRequests()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ReviewFilter>('all')
  const filtered = filterReviews(requests, query, status)
  const inProgress = requests.filter(request => request.status === 'in-review')
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0]
  const counts = [
    { status: 'pending' as const, label: 'Waiting for a review' },
    { status: 'in-review' as const, label: 'In conversation' },
    { status: 'completed' as const, label: 'Reviewed and ready' },
  ]
  return <Workspace>
    <WorkspaceHeader title="Your workbench." description={`${user?.name?.split(' ')[0] || 'Welcome'}, make a little room for another perspective.`} action={<Link className="wk-button" to="/create-request">Request a review</Link>} />
    <section className="wk-overview" aria-label="Review overview">{counts.map(item => <button type="button" key={item.status} onClick={() => setStatus(status === item.status ? 'all' : item.status)} aria-pressed={status === item.status}><span className={`wk-count-mark wk-count-${item.status}`} aria-hidden="true" /><span>{item.label}</span><strong>{loading || error ? '—' : requests.filter(request => request.status === item.status).length}</strong></button>)}</section>
    <div className="wk-dashboard-grid"><section className="wk-dashboard-reviews" aria-labelledby="your-reviews-heading"><div className="wk-section-title"><h2 id="your-reviews-heading">On the table</h2><Link to="/my-requests">View all reviews</Link></div><ReviewToolbar query={query} onQuery={setQuery} status={status} onStatus={setStatus} />
      {loading ? <p className="wk-loading" role="status">Opening your reviews…</p> : error ? <div className="wk-error" role="alert"><p>{error}</p><button className="wk-button wk-button-secondary" onClick={retry}>Try again</button></div> : filtered.length ? <><p className="wk-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'review' : 'reviews'}</p><ReviewList requests={filtered.slice(0, 6)} />{filtered.length > 6 && <Link to="/my-requests" className="wk-list-more">See all {filtered.length} reviews</Link>}</> : <ReviewEmpty filtered={!!query || status !== 'all'} reset={() => { setQuery(''); setStatus('all') }} />}
    </section><aside className="wk-desk-aside" aria-label="Next steps">{!loading && !error && inProgress && <section className="wk-pickup"><p className="wk-aside-caption">Pick up the conversation</p><ReviewStatus status={inProgress.status} /><h2>{inProgress.title}</h2><p>{inProgress.reviewer_name ? `A fresh perspective with ${inProgress.reviewer_name}.` : 'There is a review in progress. Take a look at the details.'}</p><Link className="wk-text-link" to={`/review/${inProgress.id}`}>Open review</Link></section>}<section className="wk-desk-note"><span aria-hidden="true">?</span><h2>Give your reviewer<br />a starting point.</h2><p>“Does this handle an empty response?” goes further than “any thoughts?” A specific question makes space for useful feedback.</p><Link to="/create-request">Bring a question</Link></section><p className="wk-desk-footnote">A good review helps the next commit.<br />A great one helps the next developer.</p></aside></div>
  </Workspace>
}
