'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Constantes ───────────────────────────────────────────────────────────────

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_HEADER = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const TRAVAUX_LABELS: Record<string, string> = {
  peinture_interieure: 'Peinture intérieure',
  peinture_exterieure: 'Peinture extérieure',
  ravalement_facade:   'Ravalement façade',
  traitement_humidite: 'Traitement humidité',
  autre:               'Autre',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CreneauCalendrier = {
  id: string
  date_debut: string
  date_fin: string
  statut: 'disponible' | 'reserve' | 'bloque'
  demande_id: string | null
  demandes: {
    id: string
    adresse_chantier: string
    type_travaux: string
    statut: string
    clients: { prenom: string; nom: string } | null
  } | null
}

type SlotChoice = 'all' | '17h30' | '18h00'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parisDateKey(iso: string): string {
  // Returns "2026-03-18" from an ISO timestamp
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso))
}

function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

function isPastDay(year: number, month: number, day: number): boolean {
  const today = todayDateString()
  const key   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return key < today
}

function makeDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Couleur d'un créneau réservé selon le statut de la demande
function creneauColor(c: CreneauCalendrier): { bg: string; text: string; border: string } {
  if (c.statut === 'bloque') return { bg: 'rgba(248,113,113,0.15)', text: '#F87171', border: 'rgba(248,113,113,0.3)' }
  if (c.statut === 'reserve') {
    const ds = c.demandes?.statut
    if (ds === 'accepte') return { bg: 'rgba(74,222,128,0.15)',  text: '#4ADE80', border: 'rgba(74,222,128,0.3)' }
    return { bg: 'rgba(251,146,60,0.15)', text: '#FB923C', border: 'rgba(251,146,60,0.3)' }
  }
  return { bg: 'transparent', text: 'rgba(255,255,255,0.2)', border: 'transparent' }
}

// ─── Composants internes ──────────────────────────────────────────────────────

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '3px',
        color: 'rgba(255,255,255,0.5)',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: '14px',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
    >
      {children}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendrierPage() {
  const router = useRouter()

  // Mois affiché (stocké comme year+month 0-indexed)
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [creneaux,     setCreneaux]     = useState<CreneauCalendrier[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selectedDay,  setSelectedDay]  = useState<string | null>(null) // "YYYY-MM-DD"

  // Modal bloquer
  const [showModal,  setShowModal]  = useState(false)
  const [modalDate,  setModalDate]  = useState('')
  const [modalSlot,  setModalSlot]  = useState<SlotChoice>('all')
  const [blocking,   setBlocking]   = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)

  // ─── Fetch données calendrier ──────────────────────────────────────────────

  const fetchCreneaux = useCallback(async () => {
    setLoading(true)
    setSelectedDay(null)
    const res = await fetch(`/api/admin/calendrier?year=${year}&month=${month}`)
    if (res.ok) {
      const { creneaux: data } = await res.json()
      setCreneaux((data as CreneauCalendrier[]) ?? [])
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchCreneaux() }, [fetchCreneaux])

  // ─── Navigation mois ──────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // ─── Grille calendrier ────────────────────────────────────────────────────

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstDOW     = new Date(year, month, 1).getDay() // 0=Sun
  const leadingBlanks = firstDOW === 0 ? 6 : firstDOW - 1 // Mon=0..Sun=6
  const totalCells   = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7
  const cells        = Array.from({ length: totalCells }, (_, i) => {
    const d = i - leadingBlanks + 1
    return d >= 1 && d <= daysInMonth ? d : null
  })

  // Regrouper créneaux par jour Paris
  const byDay: Record<string, CreneauCalendrier[]> = {}
  for (const c of creneaux) {
    const k = parisDateKey(c.date_debut)
    byDay[k] = [...(byDay[k] ?? []), c]
  }

  const today = todayDateString()

  // ─── Bloquer créneau ──────────────────────────────────────────────────────

  const handleBlock = async () => {
    if (!modalDate) return
    setBlocking(true)
    setBlockError(null)
    try {
      const res = await fetch('/api/creneaux/bloquer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: modalDate, slot: modalSlot }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        setBlockError(error ?? 'Erreur inconnue')
      } else {
        setShowModal(false)
        fetchCreneaux()
      }
    } catch {
      setBlockError('Erreur réseau')
    } finally {
      setBlocking(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  // ─── Détails jour sélectionné ─────────────────────────────────────────────

  const selectedCreneaux = selectedDay ? (byDay[selectedDay] ?? []) : []
  const [selYear, selMonth, selDay] = selectedDay
    ? selectedDay.split('-').map(Number)
    : [0, 0, 0]
  const selectedLabel = selectedDay
    ? new Date(selYear, selMonth - 1, selDay).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 40px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span className={cormorant.className} style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.01em' }}>
            Osmose
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{ href: '/admin/dashboard', label: 'Demandes' }, { href: '/admin/calendrier', label: 'Calendrier' }].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  color: href === '/admin/calendrier' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  background: href === '/admin/calendrier' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => { setModalDate(today); setModalSlot('all'); setBlockError(null); setShowModal(true) }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '3px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              letterSpacing: '0.06em',
              padding: '7px 14px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
          >
            Bloquer des créneaux
          </button>
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
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* ── Contenu ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Calendrier ── */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>

          {/* Navigation mois */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <h1 className={cormorant.className} style={{ margin: 0, fontSize: '32px', fontWeight: 300 }}>
              Calendrier
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <NavBtn onClick={prevMonth}>←</NavBtn>
              <span style={{ fontSize: '15px', fontWeight: 300, letterSpacing: '0.04em', minWidth: '120px', textAlign: 'center' }}>
                {MOIS[month]} {year}
              </span>
              <NavBtn onClick={nextMonth}>→</NavBtn>
            </div>
          </div>

          {/* Grille */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
              Chargement...
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '1px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}>

              {/* En-têtes jours */}
              {JOURS_HEADER.map(j => (
                <div key={j} style={{
                  background: '#0F0F0D',
                  padding: '10px 0',
                  textAlign: 'center',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.3)',
                }}>
                  {j}
                </div>
              ))}

              {/* Cellules jours */}
              {cells.map((dayNum, i) => {
                if (dayNum === null) {
                  return <div key={`blank-${i}`} style={{ background: 'rgba(255,255,255,0.01)', minHeight: '100px' }} />
                }

                const dateKey = makeDateKey(year, month, dayNum)
                const weekend  = isWeekend(year, month, dayNum)
                const past     = isPastDay(year, month, dayNum)
                const isToday  = dateKey === today
                const dayCren  = byDay[dateKey] ?? []
                const active   = dayCren.filter(c => c.statut === 'reserve' || c.statut === 'bloque')
                const isSelected = dateKey === selectedDay

                return (
                  <div
                    key={dateKey}
                    onClick={() => !weekend && setSelectedDay(isSelected ? null : dateKey)}
                    style={{
                      background: isSelected
                        ? 'rgba(255,255,255,0.07)'
                        : weekend
                          ? 'rgba(255,255,255,0.01)'
                          : '#0F0F0D',
                      minHeight: '100px',
                      padding: '10px',
                      cursor: weekend ? 'default' : 'pointer',
                      opacity: past && !isToday ? 0.45 : 1,
                      outline: isToday ? '1px solid rgba(255,255,255,0.25)' : 'none',
                      outlineOffset: '-1px',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!weekend) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (!weekend) e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.07)' : '#0F0F0D' }}
                  >
                    {/* Numéro du jour */}
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 400,
                      color: isToday ? '#FFFFFF' : weekend ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
                      marginBottom: '6px',
                    }}>
                      {dayNum}
                    </div>

                    {/* Badge "Fermé" week-end */}
                    {weekend && (
                      <div style={{
                        fontSize: '9px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.15)',
                      }}>
                        Fermé
                      </div>
                    )}

                    {/* Créneaux actifs */}
                    {active.map(c => {
                      const col = creneauColor(c)
                      const label = c.statut === 'bloque'
                        ? 'Bloqué'
                        : c.demandes?.clients
                          ? `${c.demandes.clients.prenom} ${c.demandes.clients.nom}`
                          : 'RDV'
                      return (
                        <div
                          key={c.id}
                          style={{
                            background: col.bg,
                            border: `1px solid ${col.border}`,
                            borderRadius: '3px',
                            padding: '2px 6px',
                            marginBottom: '3px',
                            fontSize: '10px',
                            color: col.text,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {label}
                          </span>
                          <span style={{ flexShrink: 0, opacity: 0.7 }}>
                            {formatHeure(c.date_debut)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Légende */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { color: '#FB923C', label: 'RDV planifié' },
              { color: '#4ADE80', label: 'Accepté' },
              { color: '#F87171', label: 'Bloqué' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'block' }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>{label}</span>
              </div>
            ))}
          </div>
        </main>

        {/* ── Panel latéral ── */}
        {selectedDay && (
          <aside style={{
            width: '300px',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            overflowY: 'auto',
            padding: '24px',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>
                  Sélection
                </div>
                <div style={{ fontSize: '14px', fontWeight: 400, textTransform: 'capitalize' }}>
                  {selectedLabel}
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0' }}
              >
                ×
              </button>
            </div>

            {selectedCreneaux.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                Aucun créneau pour ce jour.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedCreneaux.map(c => {
                  const col = creneauColor(c)
                  return (
                    <div key={c.id} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '6px',
                      padding: '14px',
                    }}>
                      {/* Heure + statut */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 400 }}>
                          {formatHeure(c.date_debut)} – {formatHeure(c.date_fin)}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          letterSpacing: '0.05em',
                          color: col.text,
                          background: col.bg,
                          border: `1px solid ${col.border}`,
                          borderRadius: '12px',
                          padding: '2px 8px',
                        }}>
                          {c.statut === 'bloque' ? 'Bloqué' : c.statut === 'reserve' ? 'Réservé' : 'Disponible'}
                        </span>
                      </div>

                      {c.statut === 'reserve' && c.demandes && (
                        <>
                          {c.demandes.clients && (
                            <div style={{ marginBottom: '6px' }}>
                              <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Client</div>
                              <div style={{ fontSize: '13px' }}>
                                {c.demandes.clients.prenom} {c.demandes.clients.nom}
                              </div>
                            </div>
                          )}
                          <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Adresse</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{c.demandes.adresse_chantier}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Travaux</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                              {TRAVAUX_LABELS[c.demandes.type_travaux] ?? c.demandes.type_travaux}
                            </div>
                          </div>
                          <div style={{ marginTop: '12px' }}>
                            <Link
                              href={`/admin/demandes/${c.demandes.id}`}
                              style={{
                                fontSize: '11px',
                                letterSpacing: '0.06em',
                                color: 'rgba(255,255,255,0.5)',
                                textDecoration: 'none',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '3px',
                                padding: '5px 10px',
                                display: 'inline-block',
                              }}
                            >
                              Voir la demande →
                            </Link>
                          </div>
                        </>
                      )}

                      {c.statut === 'disponible' && (
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Disponible</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Bouton bloquer ce jour */}
            <button
              onClick={() => { setModalDate(selectedDay); setModalSlot('all'); setBlockError(null); setShowModal(true) }}
              style={{
                marginTop: '20px',
                width: '100%',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '3px',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                letterSpacing: '0.06em',
                padding: '9px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >
              Bloquer ce jour
            </button>
          </aside>
        )}
      </div>

      {/* ── Modal blocage ── */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{
            background: '#1A1A17',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '32px',
            width: '100%',
            maxWidth: '420px',
          }}>
            <h2 className={cormorant.className} style={{ margin: '0 0 24px', fontSize: '26px', fontWeight: 300 }}>
              Bloquer des créneaux
            </h2>

            {/* Date */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
                Date
              </label>
              <input
                type="date"
                value={modalDate}
                onChange={e => setModalDate(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '14px',
                  padding: '10px 14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            </div>

            {/* Créneau */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
                Créneau
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {([
                  { value: 'all',   label: 'Toute la journée (17h30 et 18h00)' },
                  { value: '17h30', label: '17h30 – 18h30 uniquement' },
                  { value: '18h00', label: '18h00 – 19h00 uniquement' },
                ] as { value: SlotChoice; label: string }[]).map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: modalSlot === opt.value ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    <input
                      type="radio"
                      name="slot"
                      value={opt.value}
                      checked={modalSlot === opt.value}
                      onChange={() => setModalSlot(opt.value)}
                      style={{ accentColor: '#fff' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {blockError && (
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#F87171' }}>{blockError}</p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '3px',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  padding: '9px 18px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleBlock}
                disabled={blocking || !modalDate}
                style={{
                  background: '#FFFFFF',
                  color: '#0F0F0D',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '9px 18px',
                  cursor: blocking || !modalDate ? 'not-allowed' : 'pointer',
                  opacity: blocking || !modalDate ? 0.6 : 1,
                  fontFamily: 'inherit',
                  transition: 'opacity 0.2s',
                }}
              >
                {blocking ? 'Blocage...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
