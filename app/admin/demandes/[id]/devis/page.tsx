'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import type { DevisData, LigneDevis } from '@/types/devis'
import DevisPreview from '@/components/devis/DevisPreview'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Constantes ───────────────────────────────────────────────────────────────

const TRAVAUX_LABELS: Record<string, string> = {
  peinture_interieure: 'Peinture intérieure',
  peinture_exterieure: 'Peinture extérieure',
  ravalement_facade:   'Ravalement façade',
  traitement_humidite: 'Traitement humidité',
  autre:               'Autre',
}

const UNITES = ['m²', 'h', 'forfait', 'ml', 'u']
const TVA_OPTIONS = [5.5, 10, 20]

const EMPTY_LIGNE: LigneDevis = { description: '', quantite: 1, unite: 'm²', prix_unitaire: 0 }

function formatDateFR(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  color: '#FFFFFF',
  fontSize: '13px',
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: '6px',
  display: 'block',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ClientInfo = {
  prenom: string; nom: string; email: string; telephone: string | null
}
type DemandeInfo = { adresse_chantier: string; type_travaux: string }

export default function DevisPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [clientInfo,  setClientInfo]  = useState<ClientInfo | null>(null)
  const [demandeInfo, setDemandeInfo] = useState<DemandeInfo | null>(null)
  const [loading,     setLoading]     = useState(true)

  const today     = new Date()
  const validite  = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [numero,   setNumero]   = useState('DEVIS-2026-001')
  const [lignes,   setLignes]   = useState<LigneDevis[]>([{ ...EMPTY_LIGNE }])
  const [tvaTaux,  setTvaTaux]  = useState(10)
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState<string | null>(null)

  // ─── Fetch données demande ───────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      supabase
        .from('demandes')
        .select('adresse_chantier, type_travaux, clients(prenom, nom, email, telephone)')
        .eq('id', id)
        .single(),
      supabase
        .from('devis')
        .select('id', { count: 'exact', head: true }),
    ]).then(([{ data: d }, { count }]) => {
      if (d) {
        const demande = d as unknown as { adresse_chantier: string; type_travaux: string; clients: ClientInfo }
        setDemandeInfo({ adresse_chantier: demande.adresse_chantier, type_travaux: demande.type_travaux })
        setClientInfo(demande.clients)
        const n = (count ?? 0) + 1
        setNumero(`DEVIS-${today.getFullYear()}-${String(n).padStart(3, '0')}`)
      }
      setLoading(false)
    })
  }, [id])

  // ─── Calculs ─────────────────────────────────────────────────────────────────

  const sousTotal   = useMemo(() => lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0), [lignes])
  const montantTVA  = useMemo(() => sousTotal * (tvaTaux / 100), [sousTotal, tvaTaux])
  const totalTTC    = useMemo(() => sousTotal + montantTVA, [sousTotal, montantTVA])

  // ─── DevisData pour le PDF ───────────────────────────────────────────────────

  const devisData = useMemo<DevisData>(() => ({
    numero,
    date:     formatDateFR(today),
    validite: formatDateFR(validite),
    client: {
      prenom:           clientInfo?.prenom          ?? '',
      nom:              clientInfo?.nom             ?? '',
      email:            clientInfo?.email           ?? '',
      telephone:        clientInfo?.telephone       ?? null,
      adresse_chantier: demandeInfo?.adresse_chantier ?? '',
    },
    type_travaux: TRAVAUX_LABELS[demandeInfo?.type_travaux ?? ''] ?? (demandeInfo?.type_travaux ?? ''),
    lignes,
    tva_taux:       tvaTaux,
    sous_total_ht:  sousTotal,
    montant_tva:    montantTVA,
    total_ttc:      totalTTC,
  }), [numero, clientInfo, demandeInfo, lignes, tvaTaux, sousTotal, montantTVA, totalTTC])

  // ─── Gestion des lignes ──────────────────────────────────────────────────────

  const updateLigne = (i: number, field: keyof LigneDevis, value: string | number) => {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const addLigne = () => setLignes(prev => [...prev, { ...EMPTY_LIGNE }])

  const removeLigne = (i: number) => {
    if (lignes.length <= 1) return
    setLignes(prev => prev.filter((_, idx) => idx !== i))
  }

  // ─── Génération / envoi ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/devis/generer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ demande_id: id, devis: devisData }),
      })
      if (res.ok) {
        router.push(`/admin/demandes/${id}`)
      } else {
        const { error } = await res.json()
        setGenError(error ?? 'Erreur lors de la génération')
      }
    } catch {
      setGenError('Erreur réseau')
    } finally {
      setGenerating(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>Chargement…</span>
      </div>
    )
  }

  return (
    <div className={dmSans.className} style={{ height: '100vh', background: '#0F0F0D', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>

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
        <Link
          href={`/admin/demandes/${id}`}
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          ← Retour à la fiche
        </Link>
        <span className={cormorant.className} style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.01em' }}>
          Créer un devis
        </span>
        <div style={{ width: '160px' }} />
      </header>

      {/* ── Contenu (formulaire + aperçu) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Formulaire ── */}
        <div style={{ width: '50%', overflowY: 'auto', padding: '32px 40px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Numéro de devis */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Numéro de devis</label>
            <input
              value={numero}
              onChange={e => setNumero(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* Infos client (lecture seule) */}
          {clientInfo && (
            <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px' }}>
              <p style={{ ...labelStyle, marginBottom: '10px' }}>Client</p>
              <div style={{ fontSize: '14px', fontWeight: 400 }}>
                {clientInfo.prenom} {clientInfo.nom}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{clientInfo.email}</div>
              {clientInfo.telephone && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{clientInfo.telephone}</div>}
              {demandeInfo && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                  {demandeInfo.adresse_chantier}
                </div>
              )}
            </div>
          )}

          {/* Lignes de travaux */}
          <div style={{ marginBottom: '24px' }}>
            <p style={labelStyle}>Lignes de travaux</p>

            {/* En-tête colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '6px', marginBottom: '6px' }}>
              {['Description', 'Qté', 'Unité', 'Prix U. HT', ''].map(h => (
                <span key={h} style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {/* Lignes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {lignes.map((ligne, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '6px', alignItems: 'center' }}>
                  <input
                    value={ligne.description}
                    onChange={e => updateLigne(i, 'description', e.target.value)}
                    placeholder="Ex: Peinture murs"
                    style={{ ...inputStyle }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ligne.quantite}
                    onChange={e => updateLigne(i, 'quantite', parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, textAlign: 'right' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                  <select
                    value={ligne.unite}
                    onChange={e => updateLigne(i, 'unite', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {UNITES.map(u => <option key={u} value={u} style={{ background: '#1a1a18' }}>{u}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ligne.prix_unitaire}
                    onChange={e => updateLigne(i, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                    style={{ ...inputStyle, textAlign: 'right' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                  <button
                    onClick={() => removeLigne(i)}
                    disabled={lignes.length <= 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: lignes.length > 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                      cursor: lignes.length > 1 ? 'pointer' : 'not-allowed',
                      fontSize: '16px',
                      padding: '0',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => { if (lignes.length > 1) e.currentTarget.style.color = '#F87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = lignes.length > 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addLigne}
              style={{
                marginTop: '10px',
                background: 'none',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: '4px',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                letterSpacing: '0.06em',
                padding: '9px 0',
                width: '100%',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            >
              + Ajouter une ligne
            </button>
          </div>

          {/* TVA */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Taux de TVA</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TVA_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => setTvaTaux(t)}
                  style={{
                    background:   tvaTaux === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border:       `1px solid ${tvaTaux === t ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '20px',
                    color:        tvaTaux === t ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontSize:     '12px',
                    padding:      '6px 16px',
                    cursor:       'pointer',
                    fontFamily:   'inherit',
                    transition:   'all 0.15s',
                  }}
                >
                  {t} %
                </button>
              ))}
            </div>
          </div>

          {/* Récapitulatif */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px', marginBottom: '28px' }}>
            {[
              { label: 'Sous-total HT', val: sousTotal },
              { label: `TVA (${tvaTaux} %)`, val: montantTVA },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {val.toFixed(2).replace('.', ',')} €
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 400 }}>
              <span>Total TTC</span>
              <span>{totalTTC.toFixed(2).replace('.', ',')} €</span>
            </div>
          </div>

          {/* Erreur */}
          {genError && (
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#F87171' }}>{genError}</p>
          )}

          {/* Bouton principal */}
          <button
            onClick={handleGenerate}
            disabled={generating || lignes.every(l => l.description === '')}
            style={{
              width: '100%',
              background: generating ? 'rgba(255,255,255,0.7)' : '#FFFFFF',
              color: '#0F0F0D',
              border: 'none',
              borderRadius: '4px',
              padding: '14px',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.7 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.2s',
            }}
          >
            {generating ? 'Génération en cours…' : 'Générer et envoyer par mail'}
          </button>
        </div>

        {/* ── Aperçu PDF ── */}
        <div style={{ width: '50%', background: '#1A1A17', overflowY: 'auto' }}>
          <DevisPreview data={devisData} />
        </div>
      </div>
    </div>
  )
}
