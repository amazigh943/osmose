'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Types ─────────────────────────────────────────────────────────────────────

type ClientRow = {
  id: string
  prenom: string
  nom: string
  email: string
  telephone: string | null
  dernier_chantier: string | null
  relance_envoyee: boolean
  date_relance: string | null
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function moisDepuis(iso: string | null): number | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30))
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const NAV = [
  { href: '/admin/dashboard', label: 'Demandes' },
  { href: '/admin/calendrier', label: 'Calendrier' },
  { href: '/admin/stock', label: 'Stock' },
  { href: '/admin/factures', label: 'Factures' },
  { href: '/admin/clients', label: 'Clients' },
]

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)',
  fontWeight: 400,
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.75)',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [relancing, setRelancing] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/clients')
    if (res.ok) {
      const data = await res.json()
      setClients(data.clients ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  const handleRelancer = async () => {
    setRelancing(true)
    setActionMsg(null)
    setActionError(null)
    const secret = process.env.NEXT_PUBLIC_CRON_SECRET
    const res = await fetch('/api/cron/relance-anciens-clients', {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json()
    setRelancing(false)
    if (res.ok) {
      setActionMsg(`✓ ${data.relances} client(s) relancé(s)`)
      await loadClients()
    } else {
      setActionError(data.error ?? 'Erreur lors des relances')
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setActionMsg(null)
    setActionError(null)
    const res = await fetch('/api/clients', { method: 'PATCH' })
    setResetting(false)
    if (res.ok) {
      setActionMsg('✓ Relances réinitialisées')
      await loadClients()
    } else {
      const data = await res.json()
      setActionError(data.error ?? 'Erreur')
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const total = clients.length
  const relances = clients.filter(c => c.relance_envoyee).length
  const aRelancer = clients.filter(c => {
    const mois = moisDepuis(c.dernier_chantier)
    return !c.relance_envoyee && mois !== null && mois >= 11
  }).length

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', color: '#FFFFFF' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 40px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span className={cormorant.className} style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.01em' }}>
            Osmose
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  color: href === '/admin/clients' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  background: href === '/admin/clients' ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '3px',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '12px',
            letterSpacing: '0.06em',
            padding: '7px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        >
          Se déconnecter
        </button>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px' }}>

        {/* Titre + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <h1 className={cormorant.className} style={{ margin: 0, fontSize: '36px', fontWeight: 300 }}>
            Clients
          </h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRelancer}
              disabled={relancing}
              style={{
                background: relancing ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.1)',
                border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: '4px',
                padding: '9px 18px',
                color: relancing ? 'rgba(74,222,128,0.4)' : '#4ADE80',
                fontSize: '12px',
                letterSpacing: '0.06em',
                cursor: relancing ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!relancing) e.currentTarget.style.background = 'rgba(74,222,128,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = relancing ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.1)' }}
            >
              {relancing ? 'Envoi en cours…' : 'Lancer les relances manuellement'}
            </button>
            <button
              onClick={handleReset}
              disabled={resetting}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                padding: '9px 18px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
                letterSpacing: '0.06em',
                cursor: resetting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!resetting) { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            >
              {resetting ? '…' : 'Réinitialiser les relances'}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {actionMsg && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '6px', fontSize: '13px', color: '#4ADE80' }}>
            {actionMsg}
          </div>
        )}
        {actionError && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '6px', fontSize: '13px', color: '#F87171' }}>
            {actionError}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total clients', value: total, color: 'rgba(255,255,255,0.8)' },
            { label: 'Relancés', value: relances, color: '#4ADE80' },
            { label: 'À relancer', value: aRelancer, color: '#FB923C' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '18px 24px',
              minWidth: '140px',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                {label}
              </p>
              <p style={{ margin: 0, fontSize: '30px', fontWeight: 300, color, lineHeight: 1 }}>
                {loading ? '—' : value}
              </p>
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
              Chargement…
            </div>
          ) : clients.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
              Aucun client enregistré.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={thStyle}>Nom</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Téléphone</th>
                  <th style={thStyle}>Dernier chantier</th>
                  <th style={thStyle}>Relance</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const mois = moisDepuis(client.dernier_chantier)
                  const eligibleRelance = !client.relance_envoyee && mois !== null && mois >= 11

                  return (
                    <tr
                      key={client.id}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={tdStyle}>
                        <span style={{ color: '#FFFFFF', fontWeight: 400 }}>
                          {client.prenom} {client.nom}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.5)' }}>
                        {client.email}
                      </td>
                      <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.5)' }}>
                        {client.telephone ?? '—'}
                      </td>
                      <td style={tdStyle}>
                        {client.dernier_chantier ? (
                          <span style={{ color: mois !== null && mois >= 11 ? '#FB923C' : 'rgba(255,255,255,0.75)' }}>
                            {formatDate(client.dernier_chantier)}
                            {mois !== null && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                                ({mois} mois)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {client.relance_envoyee ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            color: '#4ADE80',
                            background: 'rgba(74,222,128,0.12)',
                          }}>
                            ✓ Envoyée {formatDate(client.date_relance)}
                          </span>
                        ) : eligibleRelance ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            color: '#FB923C',
                            background: 'rgba(251,146,60,0.12)',
                          }}>
                            À relancer
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <Link
                          href={`/admin/demandes?client=${client.id}`}
                          style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.35)',
                            textDecoration: 'none',
                            letterSpacing: '0.04em',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                        >
                          Voir demandes →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
