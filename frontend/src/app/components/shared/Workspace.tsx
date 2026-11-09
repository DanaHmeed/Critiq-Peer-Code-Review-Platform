import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AppSidebar } from './AppSidebar'
import type { ReviewRequest } from '../../../api/types'
import { countValue, formatRelativeTime } from '../../utils/format'

export function Workspace({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className="cq-workspace"><a className="wk-skip" href="#workspace-main">Skip to content</a><AppSidebar /><main id="workspace-main" className={`wk-main${wide ? ' wk-main-wide' : ''}`} tabIndex={-1}>{children}</main></div>
}
export function WorkspaceHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="wk-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>
}
const statusLabels = { pending: 'Pending', 'in-review': 'In review', completed: 'Completed', rejected: 'Rejected' }
export function ReviewStatus({ status }: { status: ReviewRequest['status'] }) {
  return <span className={`wk-status wk-status-${status}`}><span aria-hidden="true" />{statusLabels[status] || status}</span>
}
export type ReviewFilter = 'all' | 'pending' | 'in-review' | 'completed' | 'rejected'
export const reviewFilters: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All reviews' }, { id: 'pending', label: 'Pending' },
  { id: 'in-review', label: 'In review' }, { id: 'completed', label: 'Completed' }, { id: 'rejected', label: 'Rejected' },
]
export function filterReviews(requests: ReviewRequest[], query: string, status: ReviewFilter) {
  const needle = query.trim().toLowerCase()
  return requests.filter(request => (status === 'all' || request.status === status) &&
    `${request.title} ${request.language} ${request.description || ''}`.toLowerCase().includes(needle))
}
export function ReviewToolbar({ query, onQuery, status, onStatus }: { query: string; onQuery: (query: string) => void; status: ReviewFilter; onStatus: (status: ReviewFilter) => void }) {
  return <div className="wk-toolbar"><label className="wk-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg><span className="wk-sr-only">Search reviews</span><input type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Find a title, language, or detail" /></label><div className="wk-filters" role="group" aria-label="Filter reviews by status">{reviewFilters.map(filter => <button key={filter.id} type="button" aria-pressed={status === filter.id} onClick={() => onStatus(filter.id)}>{filter.label}</button>)}</div></div>
}
export function ReviewList({ requests }: { requests: ReviewRequest[] }) {
  return <ul className="wk-review-list">{requests.map(request => <li key={request.id}><Link to={`/review/${request.id}`} className="wk-review-row"><div className="wk-review-title"><span className="wk-language">{request.language}</span><h3>{request.title}</h3><p>{request.reviewer_name ? `Reviewing with ${request.reviewer_name}` : 'Waiting for a second pair of eyes'}</p></div><div className="wk-review-meta"><ReviewStatus status={request.status} /><span>{countValue(request.comment_count)} {countValue(request.comment_count) === 1 ? 'note' : 'notes'}</span><time dateTime={request.updated_at || request.created_at}>{formatRelativeTime(request.updated_at || request.created_at)}</time></div><span className="wk-row-open" aria-hidden="true">↗</span></Link></li>)}</ul>
}
export function ReviewEmpty({ filtered, reset }: { filtered: boolean; reset: () => void }) {
  return <div className="wk-empty"><span aria-hidden="true">{'{ ? }'}</span><h2>{filtered ? 'No reviews in this view.' : 'Your next conversation starts here.'}</h2><p>{filtered ? 'Try another status or clear your search to see your reviews.' : 'Bring a piece of code and a question. Give someone a place to start.'}</p>{filtered ? <button className="wk-button wk-button-secondary" onClick={reset}>Clear filters</button> : <Link className="wk-button" to="/create-request">Request a review</Link>}</div>
}
