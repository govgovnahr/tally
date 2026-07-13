import { AnimatePresence, motion } from 'motion/react'
import { Sparkle } from 'lucide-react'
import { useC } from '../../colors'

// One-shot celebratory pop next to a freshly-added row's name. Deliberately
// inline (not absolutely positioned) so it can't get clipped by a table
// cell's overflow/truncation styling — it just participates in normal flex
// layout like the neighboring recurring-icon does.
export default function SparkleBurst({ show }) {
  const C = useC()
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          key="sparkle"
          className="inline-flex flex-shrink-0"
          style={{ color: C.primary }}
          initial={{ opacity: 0, scale: 0.4, rotate: -25 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Sparkle size={13} fill={C.primary} />
        </motion.span>
      )}
    </AnimatePresence>
  )
}
