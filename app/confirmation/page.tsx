'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Types ────────────────────────────────────────────────────────────────────

interface DemandeDetails {
  id: string
  adresse_chantier: string
  type_travaux: string
  statut: string
  client: { prenom: string; nom: string; email: string } | null
  creneau: { date_debut: string; date_fin: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Contenu ──────────────────────────────────────────────────────────────────

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [data, setData] = useState<DemandeDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }

    fetch(`/api/demande/${id}`)
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: DemandeDetails) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [id])

  return (
    <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>

      {/* Icône validation */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="23" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <polyline
            points="15,24 21,30 33,18"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Titre */}
      <h1
        className={cormorant.className}
        style={{
          fontSize: '52px',
          fontWeight: 300,
          color: '#FFFFFF',
          letterSpacing: '-0.01em',
          lineHeight: 1,
          margin: '0 0 16px',
        }}
      >
        Demande confirmée
      </h1>

      {/* Sous-titre */}
      <p style={{
        fontSize: '14px',
        color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.6,
        margin: '0 0 40px',
      }}>
        Nous vous contacterons pour confirmer votre rendez-vous
      </p>

      {/* Carte récap */}
      {loading ? (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', padding: '32px 0' }}>
          Chargement...
        </div>
      ) : error || !data ? (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', padding: '32px 0' }}>
          Impossible de charger les détails.
        </div>
      ) : (
        <>
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '420px',
            margin: '0 auto 28px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>

            {/* Créneau */}
            {data.creneau && (
              <div>
                <p style={{
                  margin: '0 0 4px',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  Créneau
                </p>
                <p style={{ margin: 0, fontSize: '15px', color: '#FFFFFF', fontWeight: 300, textTransform: 'capitalize' }}>
                  {formatDateLong(data.creneau.date_debut)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                  {formatTime(data.creneau.date_debut)}
                </p>
              </div>
            )}

            {/* Séparateur */}
            {data.creneau && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            )}

            {/* Adresse */}
            <div>
              <p style={{
                margin: '0 0 4px',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}>
                Adresse du chantier
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontWeight: 300 }}>
                {data.adresse_chantier}
              </p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

            {/* Type de travaux */}
            <div>
              <p style={{
                margin: '0 0 4px',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
              }}>
                Type de travaux
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontWeight: 300 }}>
                {data.type_travaux}
              </p>
            </div>

          </div>

          {/* Email de confirmation */}
          {data.client?.email && (
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.4)',
              margin: '0 0 40px',
            }}>
              Un email de confirmation a été envoyé à{' '}
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{data.client.email}</span>
            </p>
          )}
        </>
      )}

      {/* Retour accueil */}
      <Link
        href="/"
        style={{
          display: 'inline-block',
          fontSize: '12px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          textDecoration: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          paddingBottom: '2px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
        }}
      >
        Retour à l'accueil
      </Link>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfirmationPage() {
  return (
    <main
      className={dmSans.className}
      style={{
        minHeight: '100vh',
        background: '#0F0F0D',
        padding: '60px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense fallback={
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          Chargement...
        </div>
      }>
        <ConfirmationContent />
      </Suspense>
    </main>
  )
}
