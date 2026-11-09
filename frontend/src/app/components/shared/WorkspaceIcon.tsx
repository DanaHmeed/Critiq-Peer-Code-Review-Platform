import type { SVGProps, ReactNode } from 'react'

export type WorkspaceIconName = 'home' | 'reviews' | 'bell' | 'person' | 'settings' | 'shield' | 'plus' | 'exit' | 'sun' | 'moon' | 'menu' | 'close'
const paths: Record<WorkspaceIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  reviews: <><path d="M5 3h14v14H9l-4 4Z" /><path d="m10 7-2 3 2 3m4-6 2 3-2 3" /></>,
  bell: <path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Zm5 3h4M12 2v2" />,
  person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  settings: <path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  exit: <path d="M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" /></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
}
export function WorkspaceIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: WorkspaceIconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
