'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant'
  content: string
  propose_rdv?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  const key = 'osmose_chat_session'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function loadHistory(sessionId: string): Message[] {
  try {
    const raw = localStorage.getItem(`osmose_chat_${sessionId}`)
    return raw ? (JSON.parse(raw) as Message[]) : []
  } catch {
    return []
  }
}

function saveHistory(sessionId: string, messages: Message[]) {
  localStorage.setItem(`osmose_chat_${sessionId}`, JSON.stringify(messages))
}

const WELCOME: Message = {
  role: 'assistant',
  content: 'Bonjour ! Je suis l\'assistant Osmose. Posez-moi vos questions sur vos travaux de peinture, je suis là pour vous aider.',
}

// ─── Indicateur de frappe ─────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '10px 0 4px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.4)',
            animation: 'osmose-bounce 1.2s infinite',
            animationDelay: `${i * 0.2}s`,
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}

// ─── ChatWidget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Initialisation session + historique
  useEffect(() => {
    const id = getOrCreateSessionId()
    setSessionId(id)
    const history = loadHistory(id)
    setMessages(history.length > 0 ? history : [WELCOME])
  }, [])

  // Scroll automatique
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Masquer sur les pages admin (après tous les hooks)
  if (pathname?.startsWith('/admin')) return null

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    saveHistory(sessionId, newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message ?? 'Désolé, une erreur est survenue.',
        propose_rdv: data.propose_rdv ?? false,
      }
      const updated = [...newMessages, assistantMsg]
      setMessages(updated)
      saveHistory(sessionId, updated)
    } catch {
      const updated: Message[] = [...newMessages, { role: 'assistant', content: 'Désolé, une erreur est survenue. Réessayez dans un moment.' }]
      setMessages(updated)
      saveHistory(sessionId, updated)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Animation CSS keyframes */}
      <style>{`
        @keyframes osmose-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes osmose-fadein {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ouvrir le chat"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.15)',
          color: '#FFFFFF', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)' }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14M16 2L2 16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 4a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H7l-4 3V4z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/></svg>
        )}
      </button>

      {/* Panneau chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '88px', right: '24px', zIndex: 1000,
          width: '300px', height: '480px',
          background: '#0F0F0D',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          animation: 'osmose-fadein 0.2s ease',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ADE80' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                Assistant Osmose
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  fontSize: '13px',
                  color: '#FFFFFF',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
                {msg.propose_rdv && (
                  <Link
                    href="/demande"
                    style={{
                      marginTop: '8px',
                      display: 'inline-block',
                      background: '#FFFFFF',
                      color: '#0F0F0D',
                      fontSize: '12px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      padding: '7px 14px',
                      borderRadius: '20px',
                      textDecoration: 'none',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Prendre rendez-vous →
                  </Link>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px 12px 12px 2px', padding: '4px 12px' }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: '8px', alignItems: 'center',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Posez votre question…"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                padding: '8px 12px',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: input.trim() && !loading ? '#0F0F0D' : 'rgba(255,255,255,0.3)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
