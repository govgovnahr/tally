import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X, Sparkles } from 'lucide-react'
import { TOURS } from './tourSteps.js'
import TutorialOverlay from './components/ui/TutorialOverlay.jsx'
import { useC } from './colors.jsx'

// ─── Tour suggestion banner ────────────────────────────────────────────────────

const BANNER_CONTENT = {
  onboarding: {
    title: 'Try the Getting Started Tour',
    body: 'Walk through setting budget limits, logging expenses, and tracking savings in about 3 minutes.',
  },
  advanced: {
    title: 'Try the Advanced Tour',
    body: 'Covers imports, projections, monthly overrides, and how pacing is calculated.',
  },
}

function TourSuggestionBanner({ type, onStart, onDismiss }) {
  const C = useC()
  const { title, body } = BANNER_CONTENT[type] ?? BANNER_CONTENT.advanced

  useEffect(() => {
    const t = setTimeout(onDismiss, 9000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9995,
        backgroundColor: C.surfacePopup,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 14,
        maxWidth: 440, width: 'calc(100vw - 32px)',
        fontFamily: 'inherit',
      }}
    >
      <Sparkles size={18} style={{ color: C.primary, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: C.warmText, margin: '0 0 2px' }}>
          {title}
        </p>
        <p style={{ fontSize: 12.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onStart}
          style={{
            padding: '5px 12px', borderRadius: 8,
            border: 'none', backgroundColor: C.primary,
            cursor: 'pointer', color: '#fff',
            fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          Start
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>,
    document.body
  )
}

// ─── Context ───────────────────────────────────────────────────────────────────

const TutorialContext = createContext(null)

export function TutorialProvider({ children }) {
  const [active, setActive]         = useState(false)
  const [steps, setSteps]           = useState([])
  const [stepIndex, setStepIndex]   = useState(0)
  const [navigating, setNavigating] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const navigateFnRef   = useRef(null)
  const currentPageRef  = useRef('home')
  const activeTourIdRef = useRef(null)

  function registerNavigate(fn) { navigateFnRef.current = fn }
  function trackPage(pg)        { currentPageRef.current = pg }

  function start(tourId = 'basic') {
    setSuggestion(null)
    activeTourIdRef.current = tourId
    const tourSteps = TOURS[tourId] ?? TOURS.basic
    setSteps(tourSteps)
    setStepIndex(0)
    setNavigating(false)
    setActive(true)
  }

  function stop() {
    setActive(false)
    localStorage.setItem('tally_tour_seen', '1')
    if (activeTourIdRef.current === 'onboarding') {
      localStorage.setItem('tally_onboarding_seen', '1')
    }
  }

  function suggestOnboardingTour() {
    if (active) return
    if (localStorage.getItem('tally_tour_seen')) return
    if (localStorage.getItem('tally_onboarding_suggested')) return
    localStorage.setItem('tally_onboarding_suggested', '1')
    setSuggestion('onboarding')
  }

  // Show the advanced tour suggestion once — only on first import button click
  function suggestAdvancedTour() {
    if (active) return
    if (localStorage.getItem('tally_import_suggested')) return
    localStorage.setItem('tally_import_suggested', '1')
    setSuggestion('advanced')
  }

  function goToStep(index, tourSteps) {
    const step = tourSteps[index]
    if (step.targetPage && step.targetPage !== currentPageRef.current) {
      setNavigating(true)
      navigateFnRef.current?.(step.targetPage)
      setTimeout(() => {
        setNavigating(false)
        setStepIndex(index)
      }, 600)
    } else {
      setStepIndex(index)
    }
  }

  function next() {
    const nextIndex = stepIndex + 1
    if (nextIndex >= steps.length) {
      const wasBasic = activeTourIdRef.current === 'basic'
      stop()
      if (wasBasic && !localStorage.getItem('tally_onboarding_seen')) {
        setTimeout(() => start('onboarding'), 500)
      }
      return
    }
    goToStep(nextIndex, steps)
  }

  function prev() {
    if (stepIndex === 0) return
    goToStep(stepIndex - 1, steps)
  }

  const value = {
    active, steps, stepIndex, navigating,
    currentStep: steps[stepIndex] ?? null,
    start, stop, next, prev,
    registerNavigate, trackPage,
    suggestAdvancedTour, suggestOnboardingTour,
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active && steps.length > 0 && <TutorialOverlay />}
      <AnimatePresence>
        {suggestion && (
          <TourSuggestionBanner
            type={suggestion}
            onStart={() => { setSuggestion(null); start(suggestion) }}
            onDismiss={() => setSuggestion(null)}
          />
        )}
      </AnimatePresence>
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  return useContext(TutorialContext)
}
