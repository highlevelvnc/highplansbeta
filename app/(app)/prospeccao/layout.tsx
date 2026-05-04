'use client'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const PROSPECT_LS_KEYS = [
  'prosp_mobileOnly',
  'prosp_cityBlocklist',
  'prosp_dismissedInsights',
  'prosp_scoreFilter',
  'prosp_noSiteOnly',
  'prosp_weakSiteOnly',
  'prosp_minScore',
  'prosp_subNicho',
  'prosp_bestTimesDismissed',
  'prosp_aiVariant',
  'prosp_bookmarkedOnly',
  'prosp_outdoor',
  'prosp_smartBatch',
  'prosp_presets',
]

export default function ProspeccaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary scope="Modo Prospecção" resetKeys={PROSPECT_LS_KEYS}>
      {children}
    </ErrorBoundary>
  )
}
