import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useC } from '../../colors'
import api from '../../api.js'

const STARTER_PROMPTS = [
  'How much did I spend on food this month?',
  'Am I on track with my budget?',
  'How long to save $5,000 at my current rate?',
]

export default function ChatPage() {
  const C = useC()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)

    try {
      const res = await api.post('/chat', { message: trimmed, history })
      setHistory(res.data.history)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 140px)',
      maxWidth: 720,
      margin: '0 auto',
    }}>

      {/* ── Message list ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.warmText, marginBottom: 6 }}>
              Ask Tally AI
            </div>
            <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 28 }}>
              Ask questions about your spending, savings, and budgets.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: '1px solid ' + C.borderMed,
                    background: C.surfaceAlt,
                    color: C.warmText,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderMed }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              paddingLeft: msg.role === 'user' ? 48 : 0,
              paddingRight: msg.role === 'user' ? 0 : 48,
            }}
          >
            <div style={{
              padding: '10px 14px',
              borderRadius: 14,
              maxWidth: '100%',
              fontSize: 14,
              lineHeight: 1.65,
              wordBreak: 'break-word',
              backgroundColor: msg.role === 'user' ? C.primaryTint : C.surfaceAlt,
              color: C.warmText,
              border: '1px solid ' + (msg.role === 'user' ? C.primary + '55' : C.borderMed),
            }}>
              {msg.role === 'user' ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p:      ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
                    ul:     ({ children }) => <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>{children}</ul>,
                    ol:     ({ children }) => <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>{children}</ol>,
                    li:     ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                    strong: ({ children }) => <strong style={{ fontWeight: 700, color: C.warmText }}>{children}</strong>,
                    code:   ({ inline, children }) => inline
                      ? <code style={{ fontFamily: 'monospace', fontSize: 12.5, backgroundColor: C.hover, borderRadius: 4, padding: '1px 5px' }}>{children}</code>
                      : <pre style={{ fontFamily: 'monospace', fontSize: 12.5, backgroundColor: C.hover, borderRadius: 8, padding: '10px 12px', overflowX: 'auto', margin: '0 0 8px' }}><code>{children}</code></pre>,
                    table:  ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 8, fontSize: 13 }}>{children}</table>,
                    th:     ({ children }) => <th style={{ textAlign: 'left', padding: '4px 10px', borderBottom: '1px solid ' + C.borderMed, fontWeight: 600 }}>{children}</th>,
                    td:     ({ children }) => <td style={{ padding: '4px 10px', borderBottom: '1px solid ' + C.border }}>{children}</td>,
                    a:      ({ href, children }) => <a href={href} style={{ color: C.primary, textDecoration: 'underline' }} target="_blank" rel="noreferrer">{children}</a>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 14,
              backgroundColor: C.surfaceAlt,
              border: '1px solid ' + C.borderMed,
              display: 'flex',
              gap: 5,
              alignItems: 'center',
            }}>
              {[0, 1, 2].map(dot => (
                <div
                  key={dot}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: C.muted,
                    animation: 'pulse 1.2s ease-in-out infinite',
                    animationDelay: (dot * 0.2) + 's',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        borderTop: '1px solid ' + C.borderMed,
        paddingTop: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid ' + C.borderMed,
            background: C.surfaceAlt,
            color: C.warmText,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            lineHeight: 1.5,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = C.borderStrong }}
          onBlur={e => { e.currentTarget.style.borderColor = C.borderMed }}
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: 'none',
            cursor: (input.trim() && !loading) ? 'pointer' : 'not-allowed',
            backgroundColor: (input.trim() && !loading) ? C.primary : C.surfaceAlt,
            color: (input.trim() && !loading) ? '#fff' : C.dimText,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.15s',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
