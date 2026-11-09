import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { PublicBrand as Brand } from '../components/public/PublicBrand'

const lines = [
  'export async function getProfile(id: string) {',
  '  const response = await fetch(`/users/${id}`);',
  '  const profile = await response.json();',
  '  return profile;',
  '}',
]


export function Landing() {
  const { user } = useAuth()
  const [selectedLine, setSelectedLine] = useState(3)
  const [note, setNote] = useState('')
  const [comments, setComments] = useState([{ line: 3, text: 'What happens if the server returns an error? Check the response before parsing it.', author: 'A second pair of eyes' }])
  return <div className="cq-public">
    <header className="cq-nav cq-wrap"><Brand /><nav aria-label="Main navigation"><a href="#review">Try a review</a><a href="#how-it-works">How it works</a></nav><div className="cq-nav-actions"><Link to={user ? '/dashboard' : '/login'}>{user ? 'Your dashboard' : 'Sign in'}</Link><Link className="cq-button cq-small" to={user ? '/create-request' : '/register'}>{user ? 'Request a review' : 'Join Critiq'}</Link></div></header>
    <main id="main-content">
      <section className="cq-hero cq-wrap">
        <div className="cq-hero-copy"><p className="cq-intro"><span aria-hidden="true" className="cq-mini-mark">{'</>'}</span> Good code is a conversation.</p><h1>A fresh pair<br />of eyes.<br />A better commit.</h1><p className="cq-lead">You know what your code does. Someone else can help you see what it could do better. Meet your next code review on Critiq.</p><div className="cq-hero-actions"><Link className="cq-button" to={user ? '/create-request' : '/register'}>Find your second pair</Link><a className="cq-text-link" href="#review">Try it first</a></div><p className="cq-subtle">For the code you care about. And the people behind it.</p></div>
        <div className="cq-hero-art" aria-label="Example code review with a helpful comment"><div className="cq-art-tab">A little perspective changes things.</div><div className="cq-code-sheet"><div className="cq-file"><span>profile.ts</span><span>Example review</span></div><pre><code><span className="cq-code-muted">{'// Looks good to me. Or does it?\n\n'}</span><span className="cq-code-blue">{'async function '}</span>{'getProfile(id) {\n  const res = await fetch(url);\n'}<span className="cq-code-highlight">{'  return res.json();'}</span>{'\n}'}</code></pre><div className="cq-review-line"><span className="cq-avatar">?</span>One question worth asking.</div></div><div className="cq-sticky"><svg viewBox="0 0 80 48" fill="none" aria-hidden="true"><path d="M72 42C56 2 29 2 9 20m0 0 18 1M9 20l9-15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg><p>What if the<br />request fails?</p><span>That's why we review.</span></div><div className="cq-art-caption"><span className="cq-bracket">{'{ }'}</span><p>Less guessing.<br />More understanding.</p></div></div>
      </section>
      <section className="cq-belief"><div className="cq-wrap cq-belief-inner"><p>Behind every better version<br />is a useful conversation.</p><div>Not just “looks good.” A question that catches an edge case. A suggestion that makes a function clearer. The kind of feedback that stays with you after the review.</div></div></section>
      <section id="review" className="cq-wrap cq-demo-section"><div className="cq-section-heading"><h2>See something?<br />Say something.</h2><p>A small example, ready for your perspective. Select a line and leave a note. This demo stays in your browser until you leave.</p></div><div className="cq-demo"><div className="cq-demo-code"><div className="cq-file"><span>profile.ts</span><span>Interactive example</span></div><div className="cq-code-lines">{lines.map((line, i) => <button key={line} type="button" aria-label={`Comment on line ${i + 1}: ${line}`} aria-pressed={selectedLine === i + 1} onClick={() => setSelectedLine(i + 1)} className={selectedLine === i + 1 ? 'is-selected' : ''}><span>{i + 1}</span><code>{line}</code><b aria-hidden="true">+</b></button>)}</div><p className="cq-demo-hint">Select a line to start a conversation.</p></div><div className="cq-demo-notes"><div className="cq-comment-list" aria-live="polite">{comments.map((comment, i) => <article key={i} className="cq-comment"><div><strong>{comment.author}</strong><span>Line {comment.line}</span></div><p>{comment.text}</p></article>)}</div><form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; setComments([...comments, { line: selectedLine, text: note.trim(), author: 'Your perspective' }]); setNote('') }}><label htmlFor="demo-note">Your note on line {selectedLine}</label><textarea id="demo-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Ask a question. Suggest another approach." required maxLength={1000} /><button className="cq-button cq-small" disabled={!note.trim()}>Add your note</button></form></div></div></section>
      <section id="how-it-works" className="cq-workflow cq-wrap"><div><h2>From “can you<br />take a look?”<br />to “that’s better.”</h2><Link className="cq-text-link" to="/register">Make room for another perspective</Link></div><ol><li><span>1</span><div><h3>Bring your code</h3><p>Open a review request. Share the code and tell your reviewer what you want a second opinion on.</p></div></li><li><span>2</span><div><h3>Get into the details</h3><p>Discuss the lines that matter. Keep questions and suggestions right beside the code.</p></div></li><li><span>3</span><div><h3>Leave with a clearer view</h3><p>Work through the feedback, follow your review’s progress, and take what you’ve learned into your next commit.</p></div></li></ol></section>
      <section className="cq-invitation cq-wrap"><span className="cq-invitation-mark" aria-hidden="true">{'{↔}'}</span><h2>Bring your code.<br />Bring your curiosity.</h2><p>Ask for a review, or be someone’s fresh pair of eyes.</p><Link className="cq-button" to={user ? '/dashboard' : '/register'}>{user ? 'Open your dashboard' : 'Join Critiq'}</Link></section>
    </main><footer className="cq-footer cq-wrap"><Brand /><p>Better code. Shared perspective.</p><Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Sign in'}</Link></footer>
  </div>
}

