import { useState, useRef, useId, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useC } from '../../colors'

export function ExpandableCard({ id, trigger, accentColor, className, children }) {
  const [active, setActive] = useState(false)
  const cardRef = useRef(null)
  const triggerRef = useRef(null)
  const uid = useId()
  const layoutId = `exp-card-${id ?? uid}`
  const C = useC()

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') setActive(false) }
    const onClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) setActive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('touchstart', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('touchstart', onClickOutside)
    }
  }, [])

  const close = () => setActive(false)

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 pointer-events-none">
            <motion.div
              layoutId={layoutId}
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              className={cn('w-full max-w-lg rounded-2xl overflow-hidden pointer-events-auto', className)}
              style={{
                backgroundColor: C.surface,
                border: `1px solid ${accentColor ? accentColor + '55' : C.border}`,
                boxShadow: `0 0 0 1px ${accentColor ? accentColor + '22' : C.border}, 0 24px 80px rgba(0,0,0,0.5)`,
              }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08 }}
                className="overflow-auto max-h-[88vh]"
              >
                {typeof children === 'function' ? children(close) : children}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        ref={triggerRef}
        layoutId={layoutId}
        onClick={() => setActive(true)}
        className="cursor-pointer"
        style={{ boxShadow: 'none', border: 'none', borderRadius: 0, backgroundColor: 'transparent' }}
        onLayoutAnimationComplete={() => {
          const el = triggerRef.current
          if (!el || active) return
          el.style.removeProperty('box-shadow')
          el.style.removeProperty('border')
          el.style.removeProperty('border-radius')
          el.style.removeProperty('background-color')
          el.style.removeProperty('outline')
          el.style.removeProperty('opacity')
        }}
      >
        {trigger}
      </motion.div>
    </>
  )
}
