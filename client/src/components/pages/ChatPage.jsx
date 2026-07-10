import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useC } from '../../colors'
import { supabase } from '../../supabase'

const TOOL_LABELS = {
  semantic_search:            'Searched expenses',
  sql_query:                  'Queried data',
  savings_calculator:         'Savings calculator',
  suggest_category:           'Categorized expense',
  flag_anomalies:             'Checked for anomalies',
  get_monthly_summary:        'Monthly summary',
  get_category_breakdown:     'Category breakdown',
  get_budget_status:          'Budget status',
  get_savings_goals_status:   'Savings goals',
  get_recurring_transactions: 'Recurring transactions',
}

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
  const [streamingTools, setStreamingTools] = useState([])
  const [history, setHistory] = useState([])
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const streamingToolsRef = useRef([])
  const userScrolledUp = useRef(false)
  streamingToolsRef.current = streamingTools

  // Detect intentional upward scroll — stop auto-scrolling until user returns to bottom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUp.current = distFromBottom > 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    const shouldScroll = lastMsg?.role === 'user' || !userScrolledUp.current
    if (shouldScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    userScrolledUp.current = false
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)
    setStreamingTools([])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const baseURL = import.meta.env.VITE_API_URL ?? ''

      const res = await fetch(`${baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmed, history }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'tool_start') {
            setStreamingTools(prev => [...prev, data.tool])
          } else if (data.type === 'token') {
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.streaming) {
                return [...prev.slice(0, -1), { ...last, content: last.content + data.content }]
              }
              return [...prev, {
                role: 'assistant',
                content: data.content,
                tool_steps: [...streamingToolsRef.current],
                streaming: true,
              }]
            })
          } else if (data.type === 'done') {
            setHistory(data.history)
            setMessages(prev => {
              const last = prev[prev.length - 1]
              if (last?.streaming) {
                return [...prev.slice(0, -1), { ...last, tool_steps: data.tool_steps, streaming: false }]
              }
              return prev
            })
            setStreamingTools([])
          } else if (data.type === 'error') {
            setMessages(prev => [...prev, { role: 'assistant', content: data.detail }])
            setStreamingTools([])
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      setStreamingTools([])
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
      <div ref={containerRef} style={{
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
            }}>
              {msg.role === 'user' ? (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              ) : (
                <>
                  {msg.tool_steps?.length > 0 && (
                    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid ' + C.borderSubtle }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                        Tally checked
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {[...new Set(msg.tool_steps)].map((tool, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '3px 10px',
                              borderRadius: 10,
                              border: '1px solid ' + C.primary + '66',
                              color: C.primary,
                              backgroundColor: C.primaryTint,
                            }}
                          >
                            {TOOL_LABELS[tool] ?? tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                    a:      ({ href, children }) => {
                      // react-markdown doesn't strip javascript:/data: URIs on its own — if the
                      // model ever echoes a link with a dangerous scheme (e.g. reflecting an
                      // injected expense name back verbatim), only allow safe schemes through.
                      const safeHref = /^(https?:|mailto:)/i.test(href ?? '') ? href : undefined
                      return <a href={safeHref} style={{ color: C.primary, textDecoration: 'underline' }} target="_blank" rel="noreferrer">{children}</a>
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                </>
              )}
            </div>
          </div>
        ))}

        {loading && !messages.some(m => m.streaming) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: 14,
              backgroundColor: C.surfaceAlt,
              minWidth: 120,
            }}>
              {streamingTools.length === 0 ? (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(dot => (
                    <div key={dot} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: C.muted,
                      animation: 'pulse 1.2s ease-in-out infinite',
                      animationDelay: (dot * 0.2) + 's',
                    }} />
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                    Checking…
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {streamingTools.map((tool, i) => (
                      <span key={i} style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '3px 10px',
                        borderRadius: 10,
                        border: '1px solid ' + C.primary + '66',
                        color: C.primary,
                        backgroundColor: C.primaryTint,
                        animation: i === streamingTools.length - 1 ? 'pulse 1s ease-in-out infinite' : 'none',
                      }}>
                        {TOOL_LABELS[tool] ?? tool}
                      </span>
                    ))}
                  </div>
                </>
              )}
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
