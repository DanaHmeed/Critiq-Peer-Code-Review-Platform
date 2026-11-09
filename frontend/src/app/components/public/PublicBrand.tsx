import { Link } from 'react-router'

export function PublicBrand() {
  return <Link to="/" className="cq-brand" aria-label="Critiq home"><span aria-hidden="true">c<span className="cq-brand-dot">:</span></span>critiq</Link>
}
