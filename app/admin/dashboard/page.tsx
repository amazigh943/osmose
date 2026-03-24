'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Config statuts ────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  nouvelle:      { label: 'Nouvelle',      color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  en_attente:    { label: 'En attente',    color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  rdv_planifie:  { label: 'RDV planifié',  color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  planifie:      { label: 'Planifié',      color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  devis_envoye:  { label: 'Devis envoyé',  color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  accepte:       { label: 'Accepté',       color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
  refuse:        { label: 'Refusé',        color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
  termine:       { label: 'Terminé',       color: '#6EE7B7', bg: 'rgba(110,231,183,0.15)' },
}

const STATUTS_LISTE = [
  'nouvelle', 'en_attente', 'rdv_planifie', 'planifie',
  'devis_envoye', 'accepte', 'refuse', 'termine',
]

const TRAVAUX_LABELS: Record<string, string> = {
  peinture_interieure: 'Peinture intérieure',
  peinture_exterieure: 'Peinture extérieure',
  ravalement_facade:   'Ravalement façade',
  traitement_humidite: 'Traitement humidité',
  autre:               'Autre',
}

const FILTRES = [
  { key: 'tous',         label: 'Tous' },
  { key: 'nouvelle',     label: 'Nouvelle' },
  { key: 'rdv_planifie', label: 'RDV planifié' },
  { key: 'devis_envoye', label: 'Devis envoyé' },
  { key: 'accepte',      label: 'Accepté' },
  { key: 'refuse',       label: 'Refusé' },
]

// ─── Types ─────────────────────────────────────────────────────────────────────

type DemandeRow = {
  id: string
  adresse_chantier: string
  type_travaux: string
  statut: string
  created_at: string
  clients: { prenom: string; nom: string; email: string } | null
}

type SortKey = 'date' | 'statut' | null
type SortDir = 'asc' | 'desc'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ─── Composants ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '6px',
      padding: '20px 24px',
      flex: '1',
      minWidth: '140px',
    }}>
      <p style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: 300, color, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  )
}

function StatutSelect({
  id,
  statut,
  onChange,
}: {
  id: string
  statut: string
  onChange: (id: string, newStatut: string) => void
}) {
  const cfg = STATUT_BADGE[statut] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' }
  return (
    <select
      value={statut}
      onChange={e => onChange(id, e.target.value)}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}33`,
        borderRadius: '20px',
        padding: '3px 10px',
        fontSize: '11px',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        fontFamily: 'inherit',
        paddingRight: '22px',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(cfg.color)}' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '10px',
      }}
    >
      {STATUTS_LISTE.map(s => (
        <option key={s} value={s} style={{ background: '#1a1a18', color: '#fff' }}>
          {STATUT_BADGE[s]?.label ?? s}
        </option>
      ))}
    </select>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [demandes, setDemandes] = useState<DemandeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [updating, setUpdating] = useState<string | null>(null)
  const [testingCron, setTestingCron] = useState(false)
  const [cronResult, setCronResult] = useState<string | null>(null)
  const [testingResume, setTestingResume] = useState(false)
  const [resumeResult, setResumeResult] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('demandes')
      .select('id, adresse_chantier, type_travaux, statut, created_at, clients(prenom, nom, email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDemandes((data as unknown as DemandeRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  const handleTestCron = async () => {
    setTestingCron(true)
    setCronResult(null)
    try {
      const res = await fetch('/api/cron/relances', {
        headers: { Authorization: 'Bearer osmose_cron_2026' },
      })
      const data = await res.json()
      if (res.ok) {
        setCronResult(`✓ Relancés : ${data.relances_envoyees?.length ?? 0} — Perdus : ${data.devis_perdus?.length ?? 0}`)
      } else {
        setCronResult('Erreur : ' + (data.error ?? res.status))
      }
    } catch {
      setCronResult('Erreur réseau')
    } finally {
      setTestingCron(false)
    }
  }

  const handleTestResume = async () => {
    setTestingResume(true)
    setResumeResult(null)
    try {
      const res = await fetch('/api/cron/resume-hebdo', {
        headers: { Authorization: 'Bearer osmose_cron_2026' },
      })
      const data = await res.json()
      if (res.ok) {
        setResumeResult(`✓ Résumé envoyé — ${data.rdvs_traites ?? 0} RDV`)
      } else {
        setResumeResult('Erreur : ' + (data.error ?? res.status))
      }
    } catch {
      setResumeResult('Erreur réseau')
    } finally {
      setTestingResume(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleStatutChange = async (id: string, newStatut: string) => {
    // Optimistic update
    setDemandes(prev => prev.map(d => d.id === id ? { ...d, statut: newStatut } : d))
    setUpdating(id)

    try {
      const res = await fetch(`/api/demandes/${id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        console.error('[statut] Erreur:', error)
        // Could revert here if needed
      }
    } catch (err) {
      console.error('[statut] Erreur réseau:', err)
    } finally {
      setUpdating(null)
    }
  }

  const filtered = useMemo(() => {
    let result = demandes

    // Filtre par statut
    if (filtre !== 'tous') {
      result = result.filter(d =>
        filtre === 'rdv_planifie'
          ? d.statut === 'rdv_planifie' || d.statut === 'planifie'
          : d.statut === filtre
      )
    }

    // Recherche
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(d => {
        const nom = d.clients ? `${d.clients.prenom} ${d.clients.nom}`.toLowerCase() : ''
        const email = d.clients?.email?.toLowerCase() ?? ''
        const adresse = d.adresse_chantier.toLowerCase()
        return nom.includes(q) || email.includes(q) || adresse.includes(q)
      })
    }

    // Tri
    if (sortKey === 'date') {
      result = [...result].sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        return sortDir === 'asc' ? diff : -diff
      })
    } else if (sortKey === 'statut') {
      result = [...result].sort((a, b) => {
        const diff = a.statut.localeCompare(b.statut)
        return sortDir === 'asc' ? diff : -diff
      })
    }

    return result
  }, [demandes, filtre, search, sortKey, sortDir])

  const stats = {
    nouvelles:  demandes.filter(d => d.statut === 'nouvelle').length,
    rdv:        demandes.filter(d => d.statut === 'rdv_planifie' || d.statut === 'planifie').length,
    devis:      demandes.filter(d => d.statut === 'devis_envoye').length,
    acceptes:   demandes.filter(d => d.statut === 'accepte').length,
  }

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: '4px' }}>↕</span>
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div
      className={dmSans.className}
      style={{ minHeight: '100vh', background: '#0F0F0D', color: '#FFFFFF' }}
    >

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
          <span
            className={cormorant.className}
            style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.01em' }}
          >
            Osmose
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{ href: '/admin/dashboard', label: 'Demandes' }, { href: '/admin/calendrier', label: 'Calendrier' }, { href: '/admin/stock', label: 'Stock' }, { href: '/admin/factures', label: 'Factures' }, { href: '/admin/clients', label: 'Clients' }].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  color: href === '/admin/dashboard' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  background: href === '/admin/dashboard' ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
          <Link
            href="/admin/devis/nouveau"
            style={{
              fontSize: '12px',
              letterSpacing: '0.06em',
              color: '#0F0F0D',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: '3px',
              background: '#FFFFFF',
              transition: 'opacity 0.2s',
              display: 'inline-block',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            + Nouveau devis intelligent
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleTestCron}
                disabled={testingCron}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', color: testingCron ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: testingCron ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                onMouseEnter={e => { if (!testingCron) { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' } }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              >
                {testingCron ? 'Test en cours…' : 'Tester les relances'}
              </button>
              <button
                onClick={handleTestResume}
                disabled={testingResume}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', color: testingResume ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: testingResume ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                onMouseEnter={e => { if (!testingResume) { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' } }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              >
                {testingResume ? 'Envoi en cours…' : 'Tester le résumé hebdo'}
              </button>
            </div>
            {cronResult && (
              <span style={{ fontSize: '11px', color: cronResult.startsWith('✓') ? '#4ADE80' : '#F87171', letterSpacing: '0.02em' }}>
                {cronResult}
              </span>
            )}
            {resumeResult && (
              <span style={{ fontSize: '11px', color: resumeResult.startsWith('✓') ? '#4ADE80' : '#F87171', letterSpacing: '0.02em' }}>
                {resumeResult}
              </span>
            )}
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
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#FFFFFF'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          }}
        >
          Se déconnecter
          </button>
        </div>
      </header>

      {/* Contenu */}
      <main style={{ padding: '40px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <StatCard label="Nouvelles"      value={stats.nouvelles} color="#60A5FA" />
          <StatCard label="RDV planifiés"  value={stats.rdv}       color="#FB923C" />
          <StatCard label="Devis envoyés"  value={stats.devis}     color="#A78BFA" />
          <StatCard label="Acceptés"       value={stats.acceptes}  color="#4ADE80" />
        </div>

        {/* Titre + contrôles */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
            <h2
              className={cormorant.className}
              style={{ margin: 0, fontSize: '28px', fontWeight: 300, color: '#FFFFFF' }}
            >
              Demandes
            </h2>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
              {filtered.length} / {demandes.length}
            </span>
          </div>

          {/* Filtres + Recherche */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FILTRES.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltre(f.key)}
                  style={{
                    background: filtre === f.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: filtre === f.key ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    color: filtre === f.key ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontSize: '12px',
                    letterSpacing: '0.04em',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Recherche */}
            <input
              type="text"
              placeholder="Rechercher client, email, adresse…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#FFFFFF',
                fontSize: '13px',
                padding: '7px 14px',
                outline: 'none',
                fontFamily: 'inherit',
                width: '260px',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div style={{ padding: '40px 0', fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            {demandes.length === 0 ? "Aucune demande pour l'instant." : 'Aucun résultat pour cette recherche.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { key: null,     label: 'Client' },
                    { key: null,     label: 'Adresse' },
                    { key: null,     label: 'Type de travaux' },
                    { key: 'statut', label: 'Statut' },
                    { key: 'date',   label: 'Date' },
                    { key: null,     label: '' },
                  ].map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={key ? () => handleSort(key as SortKey) : undefined}
                      style={{
                        textAlign: 'left',
                        padding: '10px 16px',
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: sortKey === key ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                        fontWeight: 400,
                        whiteSpace: 'nowrap',
                        cursor: key ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      {label}
                      {key && <SortIndicator col={key as SortKey} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      opacity: updating === d.id ? 0.6 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {/* Client */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#FFFFFF', fontWeight: 400 }}>
                        {d.clients ? `${d.clients.prenom} ${d.clients.nom}` : '—'}
                      </div>
                      {d.clients?.email && (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                          {d.clients.email}
                        </div>
                      )}
                    </td>

                    {/* Adresse */}
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', verticalAlign: 'middle' }}>
                      {truncate(d.adresse_chantier, 32)}
                    </td>

                    {/* Type */}
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.6)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {TRAVAUX_LABELS[d.type_travaux] ?? d.type_travaux}
                    </td>

                    {/* Statut inline */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <StatutSelect id={d.id} statut={d.statut} onChange={handleStatutChange} />
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.4)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {formatDate(d.created_at)}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <Link
                        href={`/admin/demandes/${d.id}`}
                        style={{
                          fontSize: '12px',
                          letterSpacing: '0.06em',
                          color: 'rgba(255,255,255,0.5)',
                          textDecoration: 'none',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '3px',
                          padding: '6px 12px',
                          transition: 'all 0.15s',
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = '#FFFFFF'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                        }}
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
