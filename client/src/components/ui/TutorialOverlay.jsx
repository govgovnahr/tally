import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useTutorial } from '../../TutorialContext.jsx'
import { useC } from '../../colors.jsx'

const CARD_W   = 360
const CARD_H   = 200   // used for placement math only; card auto-heights
const SPOT_PAD = 10
const CARD_GAP = 16

// When targetSelector is an array, pick the first one whose element has a
// non-zero bounding rect (i.e. is actually visible in the current layout).
function resolveSelector(selector) {
  if (!selector) return null
  if (!Array.isArray(selector)) return selector
  for (const sel of selector) {
    const el = document.querySelector(sel)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 || r.height > 0) return sel
    }
  }
  return selector[0] ?? null
}

function computeCardPos(rect, placement, cardW) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!rect || placement === 'center') {
    return {
      top:  Math.round((vh - CARD_H) / 2),
      left: Math.round((vw - cardW) / 2),
    }
  }

  let top, left

  switch (placement) {
    case 'bottom':
      top  = rect.bottom + CARD_GAP
      left = rect.left + rect.width / 2 - cardW / 2
      if (top + CARD_H > vh - 16) top = rect.top - CARD_GAP - CARD_H
      break
    case 'top':
      top  = rect.top - CARD_GAP - CARD_H
      left = rect.left + rect.width / 2 - cardW / 2
      if (top < 16) top = rect.bottom + CARD_GAP
      break
    case 'right':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.right + CARD_GAP
      break
    case 'left':
      top  = rect.top + rect.height / 2 - CARD_H / 2
      left = rect.left - CARD_GAP - cardW
      break
    default:
      return {
        top:  Math.round((vh - CARD_H) / 2),
        left: Math.round((vw - cardW) / 2),
      }
  }

  return {
    top:  Math.max(16, Math.min(top,  vh - CARD_H - 16)),
    left: Math.max(16, Math.min(left, vw - cardW - 16)),
  }
}

export default function TutorialOverlay() {
  const { steps, stepIndex, navigating, currentStep, next, prev, stop } = useTutorial()
  const C = useC()
  const [rect, setRect]   = useState(null)
  const observerRef       = useRef(null)
  const watchObserverRef  = useRef(null)
  // activeSelector tracks which element is currently spotlit:
  // starts at step.targetSelector, switches to step.watchFor once it appears in the DOM
  const [activeSelector, setActiveSelector] = useState(null)

  if (!currentStep) return null

  const step    = currentStep
  const isFirst = stepIndex === 0
  const isLast  = stepIndex === steps.length - 1
  const isCenter = !activeSelector

  // Reset activeSelector whenever the step changes
  useEffect(() => {
    setActiveSelector(resolveSelector(step.targetSelector ?? null))
  }, [step.id])

  // ── watchFor: switch spotlight to modal/element when it appears ───────────
  useEffect(() => {
    if (!step.watchFor) return
    watchObserverRef.current?.disconnect()

    const mo = new MutationObserver(() => {
      const el = document.querySelector(step.watchFor)
      setActiveSelector(el ? step.watchFor : step.targetSelector)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    watchObserverRef.current = mo

    // Check immediately in case modal is already mounted
    const el = document.querySelector(step.watchFor)
    if (el) setActiveSelector(step.watchFor)

    return () => watchObserverRef.current?.disconnect()
  }, [step.id, step.watchFor, step.targetSelector])

  // ── Measure active target element ─────────────────────────────────────────
  useEffect(() => {
    if (!activeSelector || navigating) { setRect(null); return }

    let cancelled = false
    observerRef.current?.disconnect()

    const measure = () => {
      if (cancelled) return
      const el = document.querySelector(activeSelector)
      if (!el) return
      setRect(el.getBoundingClientRect())
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      setTimeout(() => {
        if (cancelled) return
        const el2 = document.querySelector(activeSelector)
        if (el2) setRect(el2.getBoundingClientRect())
      }, 420)

      const ro = new ResizeObserver(() => {
        const el3 = document.querySelector(activeSelector)
        if (el3) setRect(el3.getBoundingClientRect())
      })
      ro.observe(el)
      observerRef.current = ro
    }

    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(measure)
      return () => cancelAnimationFrame(r2)
    })
    return () => { cancelled = true; cancelAnimationFrame(r1); observerRef.current?.disconnect() }
  }, [activeSelector, navigating])

  // ── Re-measure on resize ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSelector) return
    const onResize = () => {
      const el = document.querySelector(activeSelector)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeSelector])

  // ── ESC to dismiss ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') stop() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stop])

  const spotX = rect ? rect.x - SPOT_PAD : 0
  const spotY = rect ? rect.y - SPOT_PAD : 0
  const spotW = rect ? rect.width  + SPOT_PAD * 2 : 0
  const spotH = rect ? rect.height + SPOT_PAD * 2 : 0
  const cardW    = Math.min(CARD_W, window.innerWidth - 32)
  const cardPos  = computeCardPos(rect, step.placement, cardW)
  const nextLabel = step.ctaLabel ?? (isLast ? 'Finish' : 'Next →')

  return createPortal(
    <>
      {/* ── Dim overlay ── */}
      {/* For center/loading steps: one full-screen block.
          For spotlight steps: 4 strips around the cutout — the spotlight area
          has NO overlay at all, so the underlying UI remains fully clickable. */}
      {isCenter || !rect ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9990, backgroundColor: 'rgba(0,0,0,0.65)' }}
        />
      ) : (
        <>
          {/* top */}
          <div style={{ position: 'fixed', zIndex: 9990, top: 0, left: 0, right: 0, height: spotY, backgroundColor: 'rgba(0,0,0,0.65)', transition: 'all 0.25s ease-out' }} />
          {/* bottom */}
          <div style={{ position: 'fixed', zIndex: 9990, top: spotY + spotH, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', transition: 'all 0.25s ease-out' }} />
          {/* left */}
          <div style={{ position: 'fixed', zIndex: 9990, top: spotY, left: 0, width: spotX, height: spotH, backgroundColor: 'rgba(0,0,0,0.65)', transition: 'all 0.25s ease-out' }} />
          {/* right */}
          <div style={{ position: 'fixed', zIndex: 9990, top: spotY, left: spotX + spotW, right: 0, height: spotH, backgroundColor: 'rgba(0,0,0,0.65)', transition: 'all 0.25s ease-out' }} />
          {/* spotlight ring — pointer-events:none so clicks pass through */}
          <div style={{ position: 'fixed', zIndex: 9991, top: spotY, left: spotX, width: spotW, height: spotH, borderRadius: 12, border: '2px solid rgba(255,255,255,0.18)', pointerEvents: 'none', transition: 'all 0.25s ease-out' }} />
        </>
      )}

      {/* ── Tooltip card ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={navigating ? `nav-${stepIndex}` : step.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            ...cardPos,
            zIndex: 9999,
            width: cardW,
            backgroundColor: C.surfacePopup,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: '20px 24px 18px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            fontFamily: 'inherit',
          }}
        >
          {/* Counter + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {stepIndex + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={stop}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2, lineHeight: 1, borderRadius: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          {navigating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: C.muted, fontSize: 14, paddingBottom: 8 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${C.border}`, borderTopColor: C.primary,
                animation: 'spin 0.7s linear infinite', flexShrink: 0,
              }} />
              Navigating…
            </div>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.warmText, margin: '0 0 8px', lineHeight: 1.3 }}>
                {step.title}
              </p>
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65, margin: '0 0 18px' }}>
                {step.body}
              </p>
            </>
          )}

          {!navigating && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={stop}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 12.5, padding: 0, fontFamily: 'inherit' }}
              >
                Skip tour
              </button>
              <div style={{ display: 'flex', gap: 7 }}>
                {!isFirst && (
                  <button
                    type="button"
                    onClick={prev}
                    style={{
                      padding: '6px 13px', borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      cursor: 'pointer', color: C.muted,
                      fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    }}
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  style={{
                    padding: '6px 16px', borderRadius: 8,
                    border: 'none', backgroundColor: C.primary,
                    cursor: 'pointer', color: '#fff',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  {nextLabel}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>,
    document.body
  )
}
