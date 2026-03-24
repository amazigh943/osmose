'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Types ────────────────────────────────────────────────────────────────────

type Ligne = { description: string; quantite: number; unite: string; prix_unitaire: number }

type Facture = {
  id: string
  numero: string
  client_nom: string | null
  client_email: string | null
  client_telephone: string | null
  adresse_chantier: string | null
  type_travaux: string | null
  lignes: Ligne[]
  montant_ht: number
  tva_taux: number
  montant_tva: number
  montant_ttc: number
  montant_acompte: number
  montant_paye: number
  statut: 'emise' | 'partiellement_payee' | 'soldee'
  date_echeance: string | null
  pdf_url: string | null
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUT_CFG = {
  emise:              { label: 'Émise',               color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  partiellement_payee:{ label: 'Partiellement payée', color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  soldee:             { label: 'Soldée',              color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FactureDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [facture, setFacture]   = useState<Facture | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [sending,  setSending]  = useState(false)
  const [soldering, setSoldering] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    supabase
      .from('factures')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setFacture(data as Facture)
        setLoading(false)
      })
  }, [id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  const handleEnvoyer = async () => {
    setSending(true)
    setFeedback(null)
    const res  = await fetch(`/api/factures/${id}/envoyer`, { method: 'POST' })
    const data = await res.json()
    setSending(false)
    setFeedback({ msg: res.ok ? '✓ Facture envoyée par mail' : (data.error ?? 'Erreur'), ok: res.ok })
  }

  const handleSolder = async () => {
    if (!confirm('Marquer cette facture comme entièrement soldée ?')) return
    setSoldering(true)
    setFeedback(null)
    const res  = await fetch(`/api/factures/${id}/solder`, { method: 'PATCH' })
    const data = await res.json()
    setSoldering(false)
    if (res.ok) {
      setFacture(prev => prev ? { ...prev, statut: 'soldee', montant_paye: prev.montant_ttc } : prev)
      setFeedback({ msg: '✓ Facture soldée', ok: true })
    } else {
      setFeedback({ msg: data.error ?? 'Erreur', ok: false })
    }
  }

  const NAV = [
    { href: '/admin/dashboard',  label: 'Demandes' },
    { href: '/admin/calendrier', label: 'Calendrier' },
    { href: '/admin/stock',      label: 'Stock' },
    { href: '/admin/factures',   label: 'Factures' },
  ]

  if (loading) return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>Chargement...</span>
    </div>
  )

  if (notFound || !facture) return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Facture introuvable.</span>
    </div>
  )

  const cfg        = STATUT_CFG[facture.statut] ?? STATUT_CFG.emise
  const resteAPayer = Math.max(0, facture.montant_ttc - facture.montant_paye)
  const isSoldee   = facture.statut === 'soldee'

  const btnBase: React.CSSProperties = {
    display: 'block', width: '100%', borderRadius: '4px', padding: '13px',
    fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
    transition: 'all 0.2s', boxSizing: 'border-box', border: 'none',
  }

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
        <button onClick={handleLogout}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', color: 'rgba(255,255,255,0.45)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
        >Se déconnecter</button>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px' }}>

        {/* Titre + badge */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/admin/factures" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', letterSpacing: '0.02em' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          >← Factures</Link>
          <h1 className={cormorant.className} style={{ margin: 0, fontSize: '34px', fontWeight: 300 }}>{facture.numero}</h1>
          <span style={{ background: cfg.bg, color: cfg.color, fontSize: '12px', padding: '4px 12px', borderRadius: '20px' }}>{cfg.label}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{fmtDate(facture.created_at)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Colonne gauche — infos + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Montants */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Règlement</p>
              {[
                { label: 'Montant TTC',    value: fmtEur(facture.montant_ttc),    color: 'rgba(255,255,255,0.8)' },
                { label: 'Acompte versé',  value: '− ' + fmtEur(facture.montant_acompte), color: '#4ADE80' },
                { label: 'Reste à payer',  value: fmtEur(resteAPayer),           color: resteAPayer > 0 ? '#FB923C' : '#4ADE80' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  <span style={{ fontSize: '14px', color, fontWeight: 400 }}>{value}</span>
                </div>
              ))}
              {facture.date_echeance && (
                <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  Échéance : {fmtDate(facture.date_echeance)}
                </p>
              )}
            </div>

            {/* Client */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Client</p>
              {[
                { label: 'Nom',      value: facture.client_nom },
                { label: 'Email',    value: facture.client_email },
                { label: 'Tél',      value: facture.client_telephone },
                { label: 'Adresse',  value: facture.adresse_chantier },
              ].map(({ label, value }) => value ? (
                <div key={label} style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: '2px' }}>{label}</span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{value}</span>
                </div>
              ) : null)}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {facture.pdf_url && (
                <a href={facture.pdf_url} target="_blank" rel="noreferrer" style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                >
                  Télécharger PDF ↓
                </a>
              )}
              <button onClick={handleEnvoyer} disabled={sending}
                style={{ ...btnBase, background: sending ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.12)', color: sending ? 'rgba(96,165,250,0.4)' : '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}
                onMouseEnter={e => { if (!sending) e.currentTarget.style.background = 'rgba(96,165,250,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = sending ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.12)' }}
              >
                {sending ? 'Envoi…' : 'Envoyer par mail →'}
              </button>
              {!isSoldee && (
                <button onClick={handleSolder} disabled={soldering}
                  style={{ ...btnBase, background: soldering ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.1)', color: soldering ? 'rgba(74,222,128,0.4)' : '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}
                  onMouseEnter={e => { if (!soldering) e.currentTarget.style.background = 'rgba(74,222,128,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = soldering ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.1)' }}
                >
                  {soldering ? 'Mise à jour…' : 'Marquer comme soldée ✓'}
                </button>
              )}
              {feedback && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: feedback.ok ? '#4ADE80' : '#F87171', textAlign: 'center' }}>
                  {feedback.msg}
                </p>
              )}
            </div>

          </div>

          {/* Colonne droite — aperçu HTML */}
          <div style={{ background: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 40px rgba(0,0,0,0.4)' }}>

            {/* En-tête facture */}
            <div style={{ background: '#1A1A14', padding: '28px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontFamily: 'Helvetica, sans-serif', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em' }}>OSMOSE</p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Helvetica, sans-serif' }}>Artisan peintre · Île-de-France</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'Helvetica, sans-serif', letterSpacing: '0.06em' }}>FACTURE</p>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica, sans-serif' }}>N° {facture.numero}</p>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica, sans-serif' }}>Émise le : {fmtDate(facture.created_at)}</p>
                {facture.date_echeance && (
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica, sans-serif' }}>Échéance : {fmtDate(facture.date_echeance)}</p>
                )}
              </div>
            </div>

            {/* Client / Chantier */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '24px 36px', background: '#FAFAF8' }}>
              <div style={{ background: '#F5F3EF', borderRadius: '6px', padding: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9A8A', fontFamily: 'Helvetica, sans-serif' }}>Destinataire</p>
                <p style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 700, color: '#1A1A18', fontFamily: 'Helvetica, sans-serif' }}>{facture.client_nom ?? '—'}</p>
                {facture.client_email && <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#5A5A5A', fontFamily: 'Helvetica, sans-serif' }}>{facture.client_email}</p>}
                {facture.client_telephone && <p style={{ margin: 0, fontSize: '12px', color: '#5A5A5A', fontFamily: 'Helvetica, sans-serif' }}>{facture.client_telephone}</p>}
              </div>
              <div style={{ background: '#F5F3EF', borderRadius: '6px', padding: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9A9A8A', fontFamily: 'Helvetica, sans-serif' }}>Chantier</p>
                <p style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 700, color: '#1A1A18', fontFamily: 'Helvetica, sans-serif' }}>{facture.type_travaux ?? '—'}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#5A5A5A', fontFamily: 'Helvetica, sans-serif' }}>{facture.adresse_chantier ?? '—'}</p>
              </div>
            </div>

            {/* Lignes */}
            <div style={{ padding: '0 36px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Helvetica, sans-serif' }}>
                <thead>
                  <tr style={{ background: '#1A1A14' }}>
                    {['Description', 'Qté', 'Unité', 'P.U. HT', 'Total HT'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '10px', letterSpacing: '0.08em', color: '#FFFFFF', fontWeight: 600, textAlign: i === 0 ? 'left' : 'right', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(facture.lignes ?? []).map((l, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F5F3EF' }}>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#1A1A18' }}>{l.description}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#5A5A5A', textAlign: 'right' }}>{l.quantite}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#5A5A5A', textAlign: 'right' }}>{l.unite}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#1A1A18', textAlign: 'right' }}>{l.prix_unitaire.toFixed(2)} €</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: '#1A1A18', textAlign: 'right', fontWeight: 600 }}>{(l.quantite * l.prix_unitaire).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            <div style={{ padding: '0 36px 32px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '260px', fontFamily: 'Helvetica, sans-serif' }}>
                {[
                  { label: 'Sous-total HT', value: fmtEur(facture.montant_ht), color: '#5A5A5A' },
                  { label: `TVA (${facture.tva_taux} %)`, value: fmtEur(facture.montant_tva), color: '#5A5A5A' },
                  { label: 'Total TTC', value: fmtEur(facture.montant_ttc), color: '#1A1A18' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E5E3DF' }}>
                    <span style={{ fontSize: '12px', color: '#9A9A8A' }}>{label}</span>
                    <span style={{ fontSize: '13px', color }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E5E3DF' }}>
                  <span style={{ fontSize: '12px', color: '#9A9A8A' }}>Acompte versé (60%)</span>
                  <span style={{ fontSize: '13px', color: '#16A34A' }}>− {fmtEur(facture.montant_acompte)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#1A1A14', borderRadius: '4px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reste à payer</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>{fmtEur(resteAPayer)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
