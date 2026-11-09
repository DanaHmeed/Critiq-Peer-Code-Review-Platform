import { useState } from 'react'

export interface CodeComment {
  line: number
  author: string
  avatar?: string
  text: string
  timestamp: string
}
interface CodeBlockProps {
  code: string
  language?: string
  comments?: CodeComment[]
  onAddComment?: (line: number) => void
  showLineNumbers?: boolean
  highlightedLine?: number | null
  maxHeight?: string
  inlineComments?: boolean
}

export function CodeBlock({ code, language = 'typescript', comments = [], onAddComment, showLineNumbers = true, highlightedLine, maxHeight = '600px', inlineComments = true }: CodeBlockProps) {
  const [copyStatus, setCopyStatus] = useState('')
  const lines = code.split('\n')
  const byLine = comments.reduce<Record<number, CodeComment[]>>((result, comment) => {
    ;(result[comment.line] ||= []).push(comment)
    return result
  }, {})
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopyStatus('Code copied') }
    catch { setCopyStatus('Copy failed. Select the code and copy it manually.') }
  }

  return <div className="wk-code-block"><div className="wk-code-header"><span>{language}</span><div><span>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span><button type="button" onClick={copyCode}>Copy code</button></div></div>
    {copyStatus && <p className="wk-copy-status" role="status">{copyStatus}</p>}
    <div className="wk-code-viewport" tabIndex={0} role="region" aria-label={`${language} code, scroll horizontally for long lines`} style={{ maxHeight: maxHeight === 'none' ? undefined : maxHeight }}><div className="wk-code-content">{lines.map((line, index) => {
      const number = index + 1
      const lineComments = byLine[number] || []
      return <div key={number} id={`review-line-${number}`} className={`wk-code-line-group${highlightedLine === number ? ' is-highlighted' : ''}${lineComments.length ? ' has-notes' : ''}`}><div className="wk-code-line">{showLineNumbers && <div className="wk-code-gutter">{onAddComment ? <button type="button" aria-label={`Add note on line ${number}`} aria-pressed={highlightedLine === number} onClick={() => onAddComment(number)}><span aria-hidden="true">+</span>{number}</button> : <span>{number}</span>}<span className="wk-line-dot" aria-hidden="true">{lineComments.length ? '•' : ''}</span></div>}<pre><code>{line || ' '}</code></pre></div>{inlineComments && lineComments.map((comment, index) => <article className="wk-inline-note" key={index}><header><strong>{comment.author}</strong><span>{comment.timestamp}</span></header><p>{comment.text}</p></article>)}</div>
    })}</div></div>
  </div>
}
