'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Types ────────────────────────────────────────────────────────────────────

type Facture = {
  id: string
  numero: string
  client_nom: string | null
  montant_ttc: number
  montant_paye: number
  statut: 'emise' | 'partiellement_payee' | 'soldee'
  date_echeance: string | null
  created_at: string
}

// ─── Config statuts ───────────────────────────────────────────────────────────

const STATUT_CFG = {
  emise:              { label: 'Émise',               color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  partiellement_payee:{ label: 'Partiellement payée', color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  soldee:             { label: 'Soldée',              color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FacturesPage() {
  const router = useRouter()
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('factures')
      .select('id, numero, client_nom, montant_ttc, montant_paye, statut, date_echeance, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFactures((data as Facture[]) ?? [])
        setLoading(false)
      })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  // Stats
  const totalFacture  = factures.reduce((s, f) => s + f.montant_ttc, 0)
  const totalEncaisse = factures.reduce((s, f) => s + f.montant_paye, 0)
  const totalAttente  = factures
    .filter(f => f.statut !== 'soldee')
    .reduce((s, f) => s + Math.max(0, f.montant_ttc - f.montant_paye), 0)

  const NAV = [
    { href: '/admin/dashboard', label: 'Demandes' },
    { href: '/admin/calendrier', label: 'Calendrier' },
    { href: '/admin/stock', label: 'Stock' },
    { href: '/admin/factures', label: 'Factures' },
  ]

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', color: '#FFFFFF' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span className={cormorant.className} style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.01em' }}>Osmose</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: '12px', letterSpacing: '0.06em',
                color: href === '/admin/factures' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                textDecoration: 'none', padding: '5px 10px', borderRadius: '3px',
                background: href === '/admin/factures' ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', color: 'rgba(255,255,255,0.45)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        >
          Se déconnecter
        </button>
      </header>

      <main style={{ padding: '40px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total facturé',  value: fmtEur(totalFacture),  color: '#A78BFA' },
            { label: 'Total encaissé', value: fmtEur(totalEncaisse), color: '#4ADE80' },
            { label: 'En attente',     value: fmtEur(totalAttente),  color: '#FB923C' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '20px 24px', flex: '1', minWidth: '160px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 300, color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Titre */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h2 className={cormorant.className} style={{ margin: 0, fontSize: '28px', fontWeight: 300 }}>Factures</h2>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>{factures.length}</span>
        </div>

        {/* Tableau */}
        {loading ? (
          <div style={{ padding: '40px 0', fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>Chargement...</div>
        ) : factures.length === 0 ? (
          <div style={{ padding: '40px 0', fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>Aucune facture pour l'instant.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Numéro', 'Client', 'Montant TTC', 'Payé', 'Reste', 'Statut', 'Date', ''].map(h => (
                    <th key={h} style={{ textAlign: h === 'Montant TTC' || h === 'Payé' || h === 'Reste' ? 'right' : 'left', padding: '10px 16px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factures.map((f, i) => {
                  const cfg   = STATUT_CFG[f.statut] ?? STATUT_CFG.emise
                  const reste = Math.max(0, f.montant_ttc - f.montant_paye)
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '14px 16px', color: '#FFFFFF', fontWeight: 400, whiteSpace: 'nowrap' }}>{f.numero}</td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.7)' }}>{f.client_nom ?? '—'}</td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.8)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtEur(f.montant_ttc)}</td>
                      <td style={{ padding: '14px 16px', color: '#4ADE80', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtEur(f.montant_paye)}</td>
                      <td style={{ padding: '14px 16px', color: reste > 0 ? '#FB923C' : 'rgba(255,255,255,0.3)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtEur(reste)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: '11px', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{fmtDate(f.created_at)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <Link
                          href={`/admin/factures/${f.id}`}
                          style={{ fontSize: '12px', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '6px 12px', display: 'inline-block', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
