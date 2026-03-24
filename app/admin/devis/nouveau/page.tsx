'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import type { DevisData, LigneDevis } from '@/types/devis'
import DevisPreview from '@/components/devis/DevisPreview'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  color: '#FFFFFF',
  fontSize: '13px',
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: '6px',
  display: 'block',
}

const UNITES = ['m²', 'h', 'forfait', 'ml', 'u']
const EMPTY_LIGNE: LigneDevis = { description: '', quantite: 1, unite: 'm²', prix_unitaire: 0 }

function formatDateFR(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type ClientForm = {
  prenom: string; nom: string; email: string; telephone: string; adresse_chantier: string
}
type Tab = 'texte' | 'audio'

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NouveauDevisPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Saisie
  const [tab, setTab]               = useState<Tab>('texte')
  const [texte, setTexte]           = useState('')
  const [audioFile, setAudioFile]   = useState<File | null>(null)
  const [analysing, setAnalysing]   = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [transcription, setTranscription] = useState<string | null>(null)

  // Formulaire
  const [showForm, setShowForm]     = useState(false)
  const [numero, setNumero]         = useState('')
  const [client, setClient]         = useState<ClientForm>({ prenom: '', nom: '', email: '', telephone: '', adresse_chantier: '' })
  const [lignes, setLignes]         = useState<LigneDevis[]>([{ ...EMPTY_LIGNE }])
  const [dureeChantier, setDureeChantier] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)

  const today    = new Date()
  const validite = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Calculs
  const sousTotal  = useMemo(() => lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0), [lignes])
  const montantTVA = useMemo(() => sousTotal * 0.1, [sousTotal])
  const totalTTC   = useMemo(() => sousTotal + montantTVA, [sousTotal, montantTVA])

  const devisData = useMemo<DevisData>(() => ({
    numero:        numero || 'DEVIS',
    date:          formatDateFR(today),
    validite:      formatDateFR(validite),
    client: {
      prenom:           client.prenom,
      nom:              client.nom,
      email:            client.email,
      telephone:        client.telephone || null,
      adresse_chantier: client.adresse_chantier,
    },
    type_travaux:  dureeChantier || 'Travaux de peinture et finitions',
    lignes,
    tva_taux:      10,
    sous_total_ht: sousTotal,
    montant_tva:   montantTVA,
    total_ttc:     totalTTC,
  }), [numero, client, lignes, dureeChantier, sousTotal, montantTVA, totalTTC])

  // ── Analyse IA ───────────────────────────────────────────────────────────────

  const handleAnalyser = async () => {
    setAnalysing(true)
    setAnalyseError(null)
    setTranscription(null)
    try {
      let body: Record<string, string>

      if (tab === 'audio') {
        if (!audioFile) { setAnalyseError('Veuillez sélectionner un fichier audio.'); return }
        const bytes = new Uint8Array(await audioFile.arrayBuffer())
        let binary = ''
        bytes.forEach(b => { binary += String.fromCharCode(b) })
        body = { audio: btoa(binary), filename: audioFile.name }
      } else {
        if (!texte.trim()) { setAnalyseError('Veuillez coller un texte à analyser.'); return }
        body = { texte }
      }

      const res = await fetch('/api/devis/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setAnalyseError(data.error ?? "Erreur lors de l'analyse"); return }

      setClient({
        prenom:           data.client?.prenom          ?? '',
        nom:              data.client?.nom             ?? '',
        email:            data.client?.email           ?? '',
        telephone:        data.client?.telephone       ?? '',
        adresse_chantier: data.client?.adresse_chantier ?? '',
      })
      setLignes(
        data.taches?.length
          ? data.taches.map((t: { designation: string; quantite: number; unite: string; prix_unitaire: number }) => ({
              description:   t.designation,
              quantite:      t.quantite,
              unite:         t.unite,
              prix_unitaire: t.prix_unitaire,
            }))
          : [{ ...EMPTY_LIGNE }]
      )
      setNumero(data.numero ?? '')
      setDureeChantier(data.duree_chantier ?? '')
      if (data.transcription) setTranscription(data.transcription)
      setShowForm(true)
    } catch {
      setAnalyseError('Erreur réseau')
    } finally {
      setAnalysing(false)
    }
  }

  // ── Génération PDF + envoi ────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/devis/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devis: devisData }),
      })
      if (res.ok) {
        router.push('/admin/dashboard')
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

  // ── Helpers lignes ────────────────────────────────────────────────────────────

  const updateLigne = (i: number, field: keyof LigneDevis, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  const addLigne    = () => setLignes(prev => [...prev, { ...EMPTY_LIGNE }])
  const removeLigne = (i: number) => { if (lignes.length > 1) setLignes(prev => prev.filter((_, idx) => idx !== i)) }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={dmSans.className} style={{ height: '100vh', background: '#0F0F0D', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Link
          href="/admin/dashboard"
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', letterSpacing: '0.02em', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          ← Dashboard
        </Link>
        <span className={cormorant.className} style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.01em' }}>
          Nouveau devis intelligent
        </span>
        <div style={{ width: '100px' }} />
      </header>

      {/* Corps */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Panneau gauche */}
        <div style={{ width: showForm ? '50%' : '100%', overflowY: 'auto', padding: '32px 40px', borderRight: showForm ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>

          {/* ── Saisie (avant analyse) ── */}
          {!showForm && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <p className={cormorant.className} style={{ fontSize: '26px', fontWeight: 300, margin: '0 0 28px', color: 'rgba(255,255,255,0.9)' }}>
                Analysez un email ou un audio pour pré-remplir le devis
              </p>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px', width: 'fit-content' }}>
                {(['texte', 'audio'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setAnalyseError(null) }}
                    style={{ background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '4px', color: tab === t ? '#FFFFFF' : 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '7px 20px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  >
                    {t === 'texte' ? 'Email / Texte' : 'Audio'}
                  </button>
                ))}
              </div>

              {/* Tab texte */}
              {tab === 'texte' && (
                <textarea
                  value={texte}
                  onChange={e => setTexte(e.target.value)}
                  placeholder={"Collez ici le contenu de l'email client…\n\nEx : Bonjour, je souhaite faire peindre mon salon (40 m²) et ma chambre (20 m²). Adresse : 12 rue des Lilas, Paris 75011. Contact : marie.dupont@email.fr, 06 12 34 56 78."}
                  style={{ ...inputStyle, height: '260px', resize: 'vertical', lineHeight: '1.6' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              )}

              {/* Tab audio */}
              {tab === 'audio' && (
                <>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '6px', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', background: audioFile ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)')}
                  >
                    {audioFile ? (
                      <>
                        <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{audioFile.name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                          {(audioFile.size / 1024 / 1024).toFixed(1)} Mo · Cliquer pour changer
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 10px', fontSize: '28px', lineHeight: 1 }}>🎙</p>
                        <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Déposer un fichier audio</p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>MP3, M4A, WAV — max 25 Mo</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".mp3,.m4a,.wav,audio/*"
                    style={{ display: 'none' }}
                    onChange={e => setAudioFile(e.target.files?.[0] ?? null)}
                  />
                </>
              )}

              {analyseError && (
                <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#F87171' }}>{analyseError}</p>
              )}

              <button
                onClick={handleAnalyser}
                disabled={analysing}
                style={{ marginTop: '20px', width: '100%', background: analysing ? 'rgba(255,255,255,0.7)' : '#FFFFFF', color: '#0F0F0D', border: 'none', borderRadius: '4px', padding: '14px', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: analysing ? 'not-allowed' : 'pointer', opacity: analysing ? 0.7 : 1, fontFamily: 'inherit', transition: 'opacity 0.2s' }}
              >
                {analysing ? 'Analyse en cours…' : "Analyser avec l'IA"}
              </button>
            </div>
          )}

          {/* ── Formulaire pré-rempli (après analyse) ── */}
          {showForm && (
            <>
              {/* Transcription audio */}
              {transcription && (
                <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '14px' }}>
                  <p style={{ ...labelStyle, marginBottom: '8px' }}>Transcription audio</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>{transcription}</p>
                </div>
              )}

              {/* Numéro */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Numéro de devis</label>
                <FocusInput value={numero} onChange={e => setNumero(e.target.value)} />
              </div>

              {/* Infos client */}
              <div style={{ marginBottom: '20px' }}>
                <p style={labelStyle}>Informations client</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <FocusInput value={client.prenom} onChange={e => setClient(c => ({ ...c, prenom: e.target.value }))} placeholder="Prénom" />
                  <FocusInput value={client.nom}    onChange={e => setClient(c => ({ ...c, nom:    e.target.value }))} placeholder="Nom" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <FocusInput value={client.email}     onChange={e => setClient(c => ({ ...c, email:     e.target.value }))} placeholder="Email" type="email" />
                  <FocusInput value={client.telephone} onChange={e => setClient(c => ({ ...c, telephone: e.target.value }))} placeholder="Téléphone" />
                </div>
                <FocusInput value={client.adresse_chantier} onChange={e => setClient(c => ({ ...c, adresse_chantier: e.target.value }))} placeholder="Adresse du chantier" />
              </div>

              {/* Durée chantier */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Durée estimée / Type de travaux</label>
                <FocusInput value={dureeChantier} onChange={e => setDureeChantier(e.target.value)} placeholder="Ex: 3 jours — Peinture intérieure" />
              </div>

              {/* Lignes de tâches */}
              <div style={{ marginBottom: '24px' }}>
                <p style={labelStyle}>Tâches</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '6px', marginBottom: '6px' }}>
                  {['Désignation', 'Qté', 'Unité', 'Prix U. HT', ''].map(h => (
                    <span key={h} style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lignes.map((ligne, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '6px', alignItems: 'center' }}>
                      <input value={ligne.description} onChange={e => updateLigne(i, 'description', e.target.value)} placeholder="Désignation" style={{ ...inputStyle, width: 'auto' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      <input type="number" min="0" step="0.5" value={ligne.quantite} onChange={e => updateLigne(i, 'quantite', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 'auto', textAlign: 'right' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      <select value={ligne.unite} onChange={e => updateLigne(i, 'unite', e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                        {UNITES.map(u => <option key={u} value={u} style={{ background: '#1a1a18' }}>{u}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={ligne.prix_unitaire} onChange={e => updateLigne(i, 'prix_unitaire', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 'auto', textAlign: 'right' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      <button
                        onClick={() => removeLigne(i)}
                        disabled={lignes.length <= 1}
                        style={{ background: 'none', border: 'none', color: lignes.length > 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', cursor: lignes.length > 1 ? 'pointer' : 'not-allowed', fontSize: '16px', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { if (lignes.length > 1) e.currentTarget.style.color = '#F87171' }}
                        onMouseLeave={e => { e.currentTarget.style.color = lignes.length > 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }}
                      >×</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addLigne}
                  style={{ marginTop: '10px', background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '4px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.06em', padding: '9px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                >
                  + Ajouter une ligne
                </button>
              </div>

              {/* Récapitulatif */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
                {[
                  { label: 'Total HT',   val: sousTotal },
                  { label: 'TVA (10 %)', val: montantTVA },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{val.toFixed(2).replace('.', ',')} €</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 400 }}>
                  <span>Total TTC</span>
                  <span>{totalTTC.toFixed(2).replace('.', ',')} €</span>
                </div>
              </div>

              <button
                onClick={() => { setShowForm(false); setAnalyseError(null) }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', color: 'rgba(255,255,255,0.45)', fontSize: '12px', letterSpacing: '0.06em', padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', marginBottom: '16px' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                ← Ré-analyser
              </button>

              {genError && <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#F87171' }}>{genError}</p>}

              <button
                onClick={handleGenerate}
                disabled={generating || lignes.every(l => l.description === '')}
                style={{ width: '100%', background: generating ? 'rgba(255,255,255,0.7)' : '#FFFFFF', color: '#0F0F0D', border: 'none', borderRadius: '4px', padding: '14px', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit', transition: 'opacity 0.2s' }}
              >
                {generating ? 'Génération en cours…' : 'Générer le devis PDF et envoyer'}
              </button>
            </>
          )}
        </div>

        {/* Aperçu devis */}
        {showForm && (
          <div style={{ width: '50%', background: '#1A1A17', overflowY: 'auto' }}>
            <DevisPreview data={devisData} />
          </div>
        )}
      </div>
    </div>
  )
}
