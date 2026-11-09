import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Workspace, WorkspaceHeader } from '../components/shared/Workspace'
import { requestApi } from '../../api/requests'
import { userApi } from '../../api/users'
import type { User } from '../../api/types'

const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'SQL', 'C++']
const urgencies = [
  { id: 'low', label: 'Low', description: 'A second opinion, when there is time.' },
  { id: 'normal', label: 'Normal', description: 'Part of your usual review flow.' },
  { id: 'high', label: 'High', description: 'Blocking your next step.' },
] as const
const stepLabels = ['Set the context', 'Share your code', 'Choose a reviewer']

export function CreateRequest() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [reviewers, setReviewers] = useState<User[]>([])
  const [loadingReviewers, setLoadingReviewers] = useState(true)
  const [reviewerError, setReviewerError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const [data, setData] = useState({ title: '', description: '', language: 'TypeScript', code: '', reviewerId: '', urgency: 'normal' as 'low' | 'normal' | 'high' })

  useEffect(() => {
    let active = true
    setLoadingReviewers(true)
    setReviewerError('')
    userApi.reviewers().then(({ reviewers }) => { if (active) setReviewers(reviewers) })
      .catch(error => { if (active) setReviewerError(error instanceof Error ? error.message : 'Reviewers could not be loaded.') })
      .finally(() => { if (active) setLoadingReviewers(false) })
    return () => { active = false }
  }, [attempt])

  const canContinue = step === 0 ? !!data.title.trim() : !!data.code.trim()
  function changeStep(next: number) {
    setStep(next)
    setError('')
    // The heading stays mounted, so focus announces the new step to keyboard users.
    stepHeading.current?.focus()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (step < 2) { if (canContinue) changeStep(step + 1); return }
    if (submitting || !data.title.trim() || !data.code.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { request } = await requestApi.create({ title: data.title.trim(), description: data.description.trim(), language: data.language, code: data.code, urgency: data.urgency, reviewer_id: data.reviewerId || undefined })
      navigate(`/review/${request.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Your request could not be published. Try again.')
    } finally { setSubmitting(false) }
  }

  return <Workspace>
    <Link className="wk-back-link" to="/my-requests">Back to your reviews</Link>
    <WorkspaceHeader title="Bring a fresh question." description="A little context helps someone give your code the attention it deserves." />
    <ol className="wk-steps" aria-label="Request progress">{stepLabels.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={index < step ? 'is-complete' : ''}><span aria-hidden="true">{index < step ? '✓' : index + 1}</span><span>{label}</span>{index < step && <span className="wk-sr-only">Completed</span>}</li>)}</ol>
    <div className="wk-compose-grid"><form onSubmit={handleSubmit} className="wk-request-form"><h2 ref={stepHeading} tabIndex={-1}>{stepLabels[step]}</h2>
      {error && <div className="wk-error" role="alert">{error}</div>}
      {step === 0 && <div className="wk-fields"><div><label htmlFor="title">What are we looking at?</label><input id="title" value={data.title} onChange={event => setData({ ...data, title: event.target.value })} placeholder="For example, handling failed webhook requests" required /><p className="wk-field-hint">Give your review a short, specific title.</p></div><div><label htmlFor="description">What would you like a second opinion on? <span>(optional)</span></label><textarea id="description" rows={5} value={data.description} onChange={event => setData({ ...data, description: event.target.value })} placeholder="What should happen? Where are you unsure? What have you already tried?" /></div><div><label htmlFor="language">Code language</label><select id="language" value={data.language} onChange={event => setData({ ...data, language: event.target.value })}>{languages.map(language => <option key={language}>{language}</option>)}</select></div></div>}
      {step === 1 && <div className="wk-fields"><div><div className="wk-code-label"><label htmlFor="code">Your {data.language} snippet</label><span>{data.code ? data.code.split('\n').length : 0} lines</span></div><textarea id="code" className="wk-code-input" rows={18} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={data.code} onChange={event => setData({ ...data, code: event.target.value })} placeholder="Paste the part you want to discuss." required aria-describedby="code-hint" /><p id="code-hint" className="wk-field-hint">Keep the relevant context. Your reviewer can leave a note on any line.</p></div></div>}
      {step === 2 && <div className="wk-fields"><fieldset><legend>Who should take a look?</legend><p className="wk-field-hint">Choose a peer, or leave the request unassigned.</p>{loadingReviewers && <p role="status" className="wk-field-hint">Finding reviewers…</p>}{reviewerError && <div className="wk-reviewer-error" role="alert"><p>{reviewerError} You can still publish without an assigned reviewer.</p><button type="button" className="wk-text-button" onClick={() => setAttempt(value => value + 1)}>Try loading reviewers again</button></div>}<div className="wk-reviewer-options"><label className={`wk-choice${!data.reviewerId ? ' is-selected' : ''}`}><input type="radio" name="reviewer" value="" checked={!data.reviewerId} onChange={() => setData({ ...data, reviewerId: '' })} /><span><strong>Leave it open</strong><small>Publish without assigning a peer.</small></span></label>{reviewers.map(reviewer => <label key={reviewer.id} className={`wk-choice${data.reviewerId === reviewer.id ? ' is-selected' : ''}`}><input type="radio" name="reviewer" value={reviewer.id} checked={data.reviewerId === reviewer.id} onChange={() => setData({ ...data, reviewerId: reviewer.id })} /><span><strong>{reviewer.name}</strong><small>{reviewer.review_count} {reviewer.review_count === 1 ? 'review' : 'reviews'}</small></span></label>)}</div></fieldset><fieldset><legend>How urgent is this?</legend><div className="wk-urgency-options">{urgencies.map(urgency => <label key={urgency.id} className={`wk-choice${data.urgency === urgency.id ? ' is-selected' : ''}`}><input type="radio" name="urgency" value={urgency.id} checked={data.urgency === urgency.id} onChange={() => setData({ ...data, urgency: urgency.id })} /><span><strong>{urgency.label}</strong><small>{urgency.description}</small></span></label>)}</div></fieldset></div>}
      <div className="wk-form-actions"><button className="wk-button wk-button-secondary" type="button" onClick={() => changeStep(step - 1)} disabled={step === 0 || submitting}>Back</button><button className="wk-button" type="submit" disabled={submitting || (step < 2 && !canContinue)}>{step < 2 ? 'Continue' : submitting ? 'Publishing…' : 'Publish request'}</button></div>
    </form><aside className="wk-compose-aside"><section className="wk-desk-note"><span aria-hidden="true">?</span><h2>Useful feedback<br />starts with context.</h2><p>Tell your reviewer what you want to learn. An edge case, a naming choice, a simpler approach. A small question is a good place to start.</p></section>{data.title && <section className="wk-request-summary"><h2>Your review so far</h2><p>{data.title}</p><dl><div><dt>Language</dt><dd>{data.language}</dd></div><div><dt>Code</dt><dd>{data.code ? `${data.code.split('\n').length} lines` : 'Not added yet'}</dd></div><div><dt>Reviewer</dt><dd>{reviewers.find(reviewer => reviewer.id === data.reviewerId)?.name || 'Unassigned'}</dd></div></dl></section>}</aside></div>
  </Workspace>
}
