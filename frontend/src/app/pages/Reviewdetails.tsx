import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Workspace, ReviewStatus } from '../components/shared/Workspace'
import { CodeBlock } from '../components/shared/CodeBlock'
import { useAuth } from '../context/AuthContext'
import { requestApi } from '../../api/requests'
import { commentApi } from '../../api/comments'
import type { ReviewComment, ReviewRequest } from '../../api/types'
import { formatRelativeTime } from '../utils/format'

export function ReviewDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [request, setRequest] = useState<ReviewRequest | null>(null)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [draft, setDraft] = useState('')
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [inspectedLine, setInspectedLine] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [posting, setPosting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const composer = useRef<HTMLTextAreaElement>(null)
  const discussion = useRef<HTMLHeadingElement>(null)
  const draftLine = useRef(1)

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError(''); setError(''); setRequest(null)
    setSelectedLine(null); setInspectedLine(null); setDraft(''); setComments([])
    if (!id) { setLoadError('This review link is incomplete. Open a review from your workbench.'); setLoading(false); return }
    requestApi.get(id).then(({ request, comments }) => {
      if (active) { setRequest(request); setComments(comments) }
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'This review could not be opened.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, attempt])

  useEffect(() => { if (selectedLine) composer.current?.focus() }, [selectedLine])

  function selectLine(line: number) {
    if (posting) return
    draftLine.current = line
    setInspectedLine(null)
    setSelectedLine(line)
    setError('')
    // Keep a draft when inspecting another line; never discard typed feedback implicitly.
    if (line === selectedLine) composer.current?.focus()
  }

  async function postNote(event: React.FormEvent) {
    event.preventDefault()
    if (!request || !selectedLine || !draft.trim() || posting) return
    setPosting(true); setError('')
    const line = selectedLine
    try {
      const { comment } = await commentApi.add({ request_id: request.id, line_number: line, text: draft.trim() })
      setComments(previous => [...previous, comment]); setDraft(''); setSelectedLine(null)
      setAnnouncement(`Note added on line ${line}.`)
      discussion.current?.focus()
    } catch (error) { setError(error instanceof Error ? error.message : 'Your note could not be added. Try again.') }
    finally { setPosting(false) }
  }

  async function completeReview() {
    if (!request || completing) return
    setCompleting(true); setError('')
    try {
      const { request: updated } = await requestApi.updateStatus(request.id, 'completed')
      setRequest(previous => previous ? { ...previous, ...updated } : updated)
      setAnnouncement('Review marked complete.')
    } catch (error) { setError(error instanceof Error ? error.message : 'The review could not be completed. Try again.') }
    finally { setCompleting(false) }
  }

  const canComplete = request && user && (request.author_id === user.id || request.reviewer_id === user.id || user.role === 'admin')
  const codeComments = comments.map(comment => ({ line: comment.line_number, author: comment.author_name, text: comment.text, timestamp: formatRelativeTime(comment.created_at) }))
  return <Workspace wide><Link className="wk-back-link" to="/my-requests">Back to your reviews</Link>
    {loading && <p className="wk-loading" role="status">Opening the conversation…</p>}
    {loadError && <div className="wk-error" role="alert"><h1>This review needs another try.</h1><p>{loadError}</p><button className="wk-button wk-button-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {request && !loading && <>
      <header className="wk-review-heading"><div><div className="wk-review-heading-meta"><ReviewStatus status={request.status} /><span>{request.language}</span><span>{request.urgency === 'high' ? 'High priority' : request.urgency === 'low' ? 'Low priority' : 'Normal priority'}</span></div><h1>{request.title}</h1><p>Shared by {request.author_name || 'the author'} <time dateTime={request.created_at}>{formatRelativeTime(request.created_at)}</time></p></div>{request.status === 'completed' ? <span className="wk-complete-label">✓ Review complete</span> : canComplete ? <button className="wk-button" type="button" disabled={completing} onClick={completeReview}>{completing ? 'Completing…' : 'Mark complete'}</button> : null}</header>
      {error && <div className="wk-error" role="alert">{error}</div>}
      <div className="wk-review-layout"><section className="wk-review-code" aria-label="Code and context">{request.description && <section className="wk-review-context"><h2>A little context</h2><p>{request.description}</p></section>}<div className="wk-code-instruction"><h2>The code</h2><p>Select a line number to add your perspective.</p></div><CodeBlock code={request.code} language={request.language} comments={codeComments} onAddComment={selectLine} highlightedLine={inspectedLine ?? selectedLine} maxHeight="none" inlineComments={false} /></section>
        <aside className="wk-discussion" aria-labelledby="discussion-heading"><div className="wk-discussion-heading"><h2 id="discussion-heading" tabIndex={-1} ref={discussion}>The conversation</h2><span>{comments.length} {comments.length === 1 ? 'note' : 'notes'}</span></div><p className="wk-review-peer">{request.reviewer_name ? `Reviewing with ${request.reviewer_name}` : 'No reviewer assigned yet.'}</p>
          {selectedLine && <form className="wk-note-composer" onSubmit={postNote}><label htmlFor="review-note">Your note on line {selectedLine}</label><textarea ref={composer} id="review-note" rows={4} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask a question. Share another approach." required disabled={posting} /><div><button className="wk-text-button" type="button" disabled={posting} onClick={() => { setSelectedLine(null); discussion.current?.focus() }}>Close draft</button><button className="wk-button" disabled={posting || !draft.trim()}>{posting ? 'Adding…' : 'Add note'}</button></div></form>}
          {!selectedLine && draft && <button className="wk-resume-draft" type="button" onClick={() => selectLine(draftLine.current)}>You have an unsent draft. Keep writing</button>}
          <div className="wk-note-feed">{comments.map(comment => <article className={`wk-review-note${(inspectedLine ?? selectedLine) === comment.line_number ? ' is-selected' : ''}`} key={comment.id}><header><span className="wk-initial" aria-hidden="true">{comment.author_name.slice(0, 1).toUpperCase()}</span><div><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{formatRelativeTime(comment.created_at)}</time></div><button type="button" className="wk-note-line" onClick={() => { setInspectedLine(comment.line_number); document.getElementById(`review-line-${comment.line_number}`)?.querySelector('button')?.focus() }}>Line {comment.line_number}</button></header><p>{comment.text}</p></article>)}</div>
          {!comments.length && !selectedLine && <div className="wk-discussion-empty"><span aria-hidden="true">“</span><h3>The first question opens the door.</h3><p>Select a line number in the code to leave a note. A question, an edge case, or a simpler approach all belong here.</p></div>}
        </aside></div>
    </>}
    <p className="wk-sr-only" role="status">{announcement}</p>
  </Workspace>
}
