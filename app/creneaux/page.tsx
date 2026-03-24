'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4)
  const d1 = monday.getDate()
  const d2 = friday.getDate()
  const month = friday.toLocaleDateString('fr-FR', { month: 'long' })
  const year = friday.getFullYear()
  return `${d1} – ${d2} ${month} ${year}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreneauAPI {
  id: string
  date_debut: string
  date_fin: string
  statut: string
}

// ─── Calendrier ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function CalendrierContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const demandeId = searchParams.get('id') ?? ''

  const [creneaux, setCreneaux] = useState<CreneauAPI[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/creneaux')
      .then(r => r.json())
      .then(data => {
        setCreneaux(data.creneaux ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Impossible de charger les créneaux')
        setLoading(false)
      })
  }, [])

  const baseMonday = getMonday(new Date())
  const currentMonday = addDays(baseMonday, weekOffset * 7)
  const days = Array.from({ length: 5 }, (_, i) => addDays(currentMonday, i))

  const slotsForDay = (day: Date) =>
    creneaux.filter(c => isSameDay(new Date(c.date_debut), day))

  const selectedCreneau = creneaux.find(c => c.id === selected)

  const handleConfirm = async () => {
    if (!selected || !demandeId) return
    setConfirming(true)
    try {
      const res = await fetch('/api/creneaux/reserver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demande_id: demandeId, creneau_id: selected }),
      })
      if (res.ok) {
        router.push('/confirmation')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Erreur lors de la réservation')
        setConfirming(false)
      }
    } catch {
      setError('Erreur réseau')
      setConfirming(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '680px' }}>

      {/* Retour */}
      <Link
        href="/demande"
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '40px',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
      >
        ← Retour
      </Link>

      {/* En-tête */}
      <div style={{ marginBottom: '40px' }}>
        <h1
          className={cormorant.className}
          style={{
            fontSize: 'clamp(40px, 6vw, 52px)',
            fontWeight: 300,
            color: '#FFFFFF',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          Choisissez un créneau
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginTop: '10px' }}>
          Visite gratuite du chantier • Lundi au vendredi
        </p>
      </div>

      {/* Navigation semaine */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <button
          onClick={() => { setSelected(null); setWeekOffset(w => Math.max(0, w - 1)) }}
          disabled={weekOffset === 0}
          style={{
            background: 'none',
            border: 'none',
            color: weekOffset === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
            cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            letterSpacing: '0.04em',
            padding: '8px 0',
            fontFamily: 'inherit',
            transition: 'color 0.2s',
          }}
        >
          ← Précédente
        </button>

        <span style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.65)',
          letterSpacing: '0.04em',
        }}>
          {formatWeekRange(currentMonday)}
        </span>

        <button
          onClick={() => { setSelected(null); setWeekOffset(w => Math.min(3, w + 1)) }}
          disabled={weekOffset === 3}
          style={{
            background: 'none',
            border: 'none',
            color: weekOffset === 3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
            cursor: weekOffset === 3 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            letterSpacing: '0.04em',
            padding: '8px 0',
            fontFamily: 'inherit',
            transition: 'color 0.2s',
          }}
        >
          Suivante →
        </button>
      </div>

      {/* Grille */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
          Chargement des créneaux...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {days.map(day => {
            const slots = slotsForDay(day)
            return (
              <div key={day.toISOString()} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* Header jour */}
                <div style={{
                  textAlign: 'center',
                  paddingBottom: '12px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    {DAY_NAMES[day.getDay()]}
                  </div>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 300,
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: '4px',
                    lineHeight: 1,
                  }}>
                    {day.getDate()}
                  </div>
                </div>

                {/* Créneaux */}
                {slots.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '12px 0',
                    fontSize: '18px',
                    color: 'rgba(255,255,255,0.1)',
                  }}>
                    —
                  </div>
                ) : (
                  slots.map(slot => {
                    const isSelected = selected === slot.id
                    const isReserved = slot.statut !== 'disponible'
                    return (
                      <button
                        key={slot.id}
                        disabled={isReserved}
                        onClick={() => setSelected(isSelected ? null : slot.id)}
                        style={{
                          background: isSelected
                            ? '#FFFFFF'
                            : isReserved
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(255,255,255,0.06)',
                          border: isSelected
                            ? 'none'
                            : `1px solid ${isReserved ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                          color: isSelected
                            ? '#0F0F0D'
                            : isReserved
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(255,255,255,0.65)',
                          borderRadius: '3px',
                          padding: '10px 4px',
                          fontSize: '12px',
                          cursor: isReserved ? 'not-allowed' : 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                          textDecoration: isReserved ? 'line-through' : 'none',
                          width: '100%',
                          fontFamily: 'inherit',
                          letterSpacing: '0.02em',
                        }}
                        onMouseEnter={e => {
                          if (!isReserved && !isSelected) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                            e.currentTarget.style.color = '#FFFFFF'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isReserved && !isSelected) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                            e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                          }
                        }}
                      >
                        {formatTime(slot.date_debut)}
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p style={{ fontSize: '13px', color: '#FF7B7B', marginTop: '20px', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {/* Panneau confirmation */}
      {selected && selectedCreneau && (
        <div style={{
          marginTop: '32px',
          padding: '22px 24px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div>
            <p style={{
              margin: 0,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Créneau sélectionné
            </p>
            <p style={{
              margin: '8px 0 0',
              fontSize: '16px',
              color: '#FFFFFF',
              fontWeight: 300,
              textTransform: 'capitalize',
            }}>
              {formatDateLong(new Date(selectedCreneau.date_debut))} à {formatTime(selectedCreneau.date_debut)}
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              background: '#FFFFFF',
              color: '#0F0F0D',
              border: 'none',
              padding: '15px',
              borderRadius: '2px',
              fontSize: '13px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: confirming ? 'not-allowed' : 'pointer',
              opacity: confirming ? 0.7 : 1,
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
              width: '100%',
            }}
            onMouseEnter={e => { if (!confirming) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { if (!confirming) e.currentTarget.style.opacity = '1' }}
          >
            {confirming ? 'Confirmation en cours...' : 'Confirmer ce créneau →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreneauxPage() {
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
      }}
    >
      <Suspense fallback={
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '40px' }}>
          Chargement...
        </div>
      }>
        <CalendrierContent />
      </Suspense>
    </main>
  )
}
