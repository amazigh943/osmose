'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

type AcompteData = {
  nomClient: string
  adresse_chantier: string
  montant_acompte: number
  statut_acompte: string | null
}

export default function AcomptePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<AcompteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/acompte/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setInvalid(true)
        } else {
          setData(d)
          if (d.statut_acompte === 'confirme') setConfirmed(true)
        }
        setLoading(false)
      })
      .catch(() => { setInvalid(true); setLoading(false) })
  }, [token])

  const handleConfirmer = async () => {
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch('/api/acompte/confirmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await res.json()
      if (res.ok) {
        setConfirmed(true)
      } else {
        setError(d.error ?? 'Une erreur est survenue')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setConfirming(false)
    }
  }

  const bg: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0F0F0D',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  }

  if (loading) {
    return (
      <div className={dmSans.className} style={bg}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>Chargement...</span>
      </div>
    )
  }

  if (invalid || !data) {
    return (
      <div className={dmSans.className} style={bg}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={dmSans.className} style={bg}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ background: '#1A1A14', padding: '28px 36px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            Osmose · Peinture
          </p>
          <h1
            className={cormorant.className}
            style={{ margin: 0, fontSize: '28px', fontWeight: 300, color: '#FFFFFF', lineHeight: 1.2 }}
          >
            Validation du chantier
          </h1>
        </div>

        {/* Corps */}
        <div style={{ padding: '32px 36px' }}>

          {/* Infos */}
          <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Client</p>
              <p style={{ margin: 0, fontSize: '15px', color: '#FFFFFF', fontWeight: 300 }}>{data.nomClient}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Adresse du chantier</p>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>{data.adresse_chantier}</p>
            </div>
          </div>

          {/* Montant */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            marginBottom: '28px',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
              Acompte 60% TTC
            </p>
            <p style={{ margin: 0, fontSize: '44px', fontWeight: 300, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1 }}>
              {data.montant_acompte.toFixed(2)} €
            </p>
          </div>

          {/* Action ou confirmation */}
          {confirmed ? (
            <div style={{
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '20px' }}>✓</p>
              <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#4ADE80', fontWeight: 400 }}>
                Votre chantier est confirmé !
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                Vous recevrez une confirmation par mail. Nous reviendrons vers vous prochainement.
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, textAlign: 'center' }}>
                Pour confirmer votre chantier, veuillez valider le versement de l&apos;acompte de{' '}
                <strong style={{ color: '#FFFFFF' }}>{data.montant_acompte.toFixed(2)} €</strong>.
              </p>
              <button
                onClick={handleConfirmer}
                disabled={confirming}
                style={{
                  display: 'block',
                  width: '100%',
                  background: confirming ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  color: confirming ? 'rgba(255,255,255,0.3)' : '#0F0F0D',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '16px',
                  fontSize: '13px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit',
                  cursor: confirming ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 400,
                }}
                onMouseEnter={e => { if (!confirming) e.currentTarget.style.background = 'rgba(255,255,255,0.88)' }}
                onMouseLeave={e => { if (!confirming) e.currentTarget.style.background = '#FFFFFF' }}
              >
                {confirming ? 'Confirmation en cours…' : 'Je confirme le versement de l\'acompte'}
              </button>
              {error && (
                <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#F87171', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 36px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
            Osmose · Peinture artisanale en Île-de-France
          </p>
        </div>

      </div>
    </div>
  )
}
