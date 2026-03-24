'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Config statuts ────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  nouvelle:     { label: 'Nouvelle',      color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  en_attente:   { label: 'En attente',    color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  rdv_planifie: { label: 'RDV planifié',  color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  planifie:     { label: 'Planifié',      color: '#FB923C', bg: 'rgba(251,146,60,0.15)' },
  devis_envoye: { label: 'Devis envoyé',  color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  accepte:      { label: 'Accepté',       color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
  refuse:       { label: 'Refusé',        color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
  termine:      { label: 'Terminé',       color: '#6EE7B7', bg: 'rgba(110,231,183,0.15)' },
}

const STATUTS = [
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type DemandeDetail = {
  id: string
  adresse_chantier: string
  type_travaux: string
  description: string | null
  notes_admin: string | null
  statut: string
  statut_acompte: string | null
  montant_acompte: number | null
  created_at: string
  clients: {
    prenom: string
    nom: string
    email: string
    telephone: string | null
  } | null
}

type Creneau = {
  date_debut: string
  date_fin: string
} | null

type HistoriqueStatut = {
  id: string
  ancien_statut: string | null
  nouveau_statut: string
  created_at: string
}

type PhotoChantier = {
  id: string
  type: 'avant' | 'pendant' | 'apres'
  url: string
  created_at: string
}

type OngletPhoto = 'avant' | 'pendant' | 'apres'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Styles partagés ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: '6px',
  display: 'block',
}

const valueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'rgba(255,255,255,0.8)',
  fontWeight: 300,
  lineHeight: 1.5,
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '16px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)',
  marginBottom: '20px',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value || '—'}</span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DemandeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [demande, setDemande] = useState<DemandeDetail | null>(null)
  const [creneau, setCreneau] = useState<Creneau>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const [statut, setStatut] = useState('')
  const [statutSaving, setStatutSaving] = useState(false)
  const [statutSaved, setStatutSaved] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [sendingAcompte, setSendingAcompte] = useState(false)
  const [acompteResult, setAcompteResult] = useState<string | null>(null)
  const [creatingFacture, setCreatingFacture] = useState(false)
  const [factureResult, setFactureResult] = useState<string | null>(null)

  const [historique, setHistorique] = useState<HistoriqueStatut[]>([])

  const [photos, setPhotos] = useState<PhotoChantier[]>([])
  const [ongletPhoto, setOngletPhoto] = useState<OngletPhoto>('avant')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Compte-rendu vocal
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [crTranscription, setCrTranscription] = useState('')
  const [crError, setCrError] = useState<string | null>(null)
  const [crSaving, setCrSaving] = useState(false)
  const [crSaved, setCrSaved] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const loadHistorique = async () => {
    const { data } = await supabase
      .from('historique_statuts')
      .select('id, ancien_statut, nouveau_statut, created_at')
      .eq('demande_id', id)
      .order('created_at', { ascending: false })
    setHistorique((data as unknown as HistoriqueStatut[]) ?? [])
  }

  const loadPhotos = async () => {
    const { data } = await supabase
      .from('photos_chantier')
      .select('id, type, url, created_at')
      .eq('demande_id', id)
      .order('created_at', { ascending: true })
    setPhotos((data as unknown as PhotoChantier[]) ?? [])
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploadingPhoto(true)
    setPhotoError(null)

    for (const file of files) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demande_id: id, type: ongletPhoto, file: base64 }),
      })

      if (!res.ok) {
        const data = await res.json()
        setPhotoError(data.error ?? 'Erreur lors de l\'upload')
        break
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadingPhoto(false)
    await loadPhotos()
  }

  const startRecording = async () => {
    setCrError(null)

    // Vérifier le support navigateur
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setCrError('Votre navigateur ne supporte pas l\'enregistrement audio')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onload = async () => {
          setTranscribing(true)
          const res = await fetch('/api/transcription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: reader.result, mimeType }),
          })
          setTranscribing(false)
          if (res.ok) {
            const data = await res.json()
            const texte = (data.texte as string) ?? ''
            setCrTranscription(texte)
            // Ajout automatique aux notes
            setNotes(prev => prev ? `${prev}\n\n${texte}` : texte)
          } else {
            const data = await res.json()
            setCrError((data.error as string) ?? 'Erreur de transcription')
          }
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setCrError('Impossible d\'accéder au microphone. Vérifiez les permissions.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const saveCr = async () => {
    if (!crTranscription) return
    setCrSaving(true)
    setCrError(null)
    const res = await fetch(`/api/demandes/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes_admin: notes }),
    })
    setCrSaving(false)
    if (res.ok) {
      setCrSaved(true)
      setTimeout(() => setCrSaved(false), 2500)
    } else {
      const data = await res.json()
      setCrError((data.error as string) ?? 'Erreur lors de la sauvegarde')
    }
  }

  const handlePhotoDelete = async (photoId: string) => {
    setPhotoError(null)
    const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setPhotoError(data.error ?? 'Erreur lors de la suppression')
    } else {
      setPhotos(prev => prev.filter(p => p.id !== photoId))
    }
  }

  useEffect(() => {
    Promise.all([
      supabase
        .from('demandes')
        .select('id, adresse_chantier, type_travaux, description, notes_admin, statut, statut_acompte, montant_acompte, created_at, clients(prenom, nom, email, telephone)')
        .eq('id', id)
        .single(),
      supabase
        .from('creneaux')
        .select('date_debut, date_fin')
        .eq('demande_id', id)
        .eq('statut', 'reserve')
        .maybeSingle(),
      supabase
        .from('historique_statuts')
        .select('id, ancien_statut, nouveau_statut, created_at')
        .eq('demande_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('photos_chantier')
        .select('id, type, url, created_at')
        .eq('demande_id', id)
        .order('created_at', { ascending: true }),
    ]).then(([{ data: d, error }, { data: c }, { data: h }, { data: p }]) => {
      if (error || !d) {
        setNotFound(true)
      } else {
        const detail = d as unknown as DemandeDetail
        setDemande(detail)
        setNotes(detail.notes_admin ?? '')
        setStatut(detail.statut)
      }
      setCreneau(c)
      setHistorique((h as unknown as HistoriqueStatut[]) ?? [])
      setPhotos((p as unknown as PhotoChantier[]) ?? [])
      setLoading(false)
    })
  }, [id])

  const saveNotes = async () => {
    setNotesSaving(true)
    setActionError(null)
    const res = await fetch(`/api/demandes/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes_admin: notes }),
    })
    setNotesSaving(false)
    if (res.ok) {
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2500)
    } else {
      const data = await res.json()
      setActionError(data.error ?? 'Erreur lors de la sauvegarde')
    }
  }

  const saveStatut = async () => {
    setStatutSaving(true)
    setActionError(null)
    const res = await fetch(`/api/demandes/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    setStatutSaving(false)
    if (res.ok) {
      setDemande(prev => prev ? { ...prev, statut } : prev)
      setStatutSaved(true)
      setTimeout(() => setStatutSaved(false), 2500)
      loadHistorique()
    } else {
      const data = await res.json()
      setActionError(data.error ?? 'Erreur lors de la mise à jour')
    }
  }

  const handleCreerFacture = async () => {
    setCreatingFacture(true)
    setFactureResult(null)
    setActionError(null)
    try {
      const res  = await fetch('/api/factures/creer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ demande_id: id }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/admin/factures/${data.facture_id}`)
      } else {
        setActionError(data.error ?? 'Erreur lors de la création')
      }
    } catch {
      setActionError('Erreur réseau')
    } finally {
      setCreatingFacture(false)
    }
  }

  const handleDemanderAcompte = async () => {
    setSendingAcompte(true)
    setAcompteResult(null)
    setActionError(null)
    try {
      const res = await fetch('/api/acompte/demander', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demande_id: id }),
      })
      const data = await res.json()
      if (res.ok) {
        setAcompteResult(`✓ Mail envoyé — acompte de ${data.montant_acompte?.toFixed(2)} €`)
        setDemande(prev => prev ? { ...prev, statut_acompte: 'en_attente', montant_acompte: data.montant_acompte } : prev)
      } else {
        setActionError(data.error ?? 'Erreur lors de l\'envoi')
      }
    } catch {
      setActionError('Erreur réseau')
    } finally {
      setSendingAcompte(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  if (loading) {
    return (
      <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>Chargement...</span>
      </div>
    )
  }

  if (notFound || !demande) {
    return (
      <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Demande introuvable.</span>
      </div>
    )
  }

  const badge = STATUT_BADGE[demande.statut] ?? { label: demande.statut, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' }

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
        <Link
          href="/admin/dashboard"
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', letterSpacing: '0.02em' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          ← Retour aux demandes
        </Link>
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

      {/* Contenu */}
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '40px' }}>

        {/* Titre + badge */}
        <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1
            className={cormorant.className}
            style={{ margin: 0, fontSize: '36px', fontWeight: 300, color: '#FFFFFF' }}
          >
            {demande.clients
              ? `${demande.clients.prenom} ${demande.clients.nom}`
              : 'Demande'}
          </h1>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            color: badge.color,
            background: badge.bg,
          }}>
            {badge.label}
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
            {new Date(demande.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Colonne gauche */}
          <div>

            {/* Client */}
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>Client</p>
              <Field label="Prénom" value={demande.clients?.prenom} />
              <Field label="Nom" value={demande.clients?.nom} />
              <Field label="Email" value={demande.clients?.email} />
              <Field label="Téléphone" value={demande.clients?.telephone} />
            </div>

            {/* Créneau */}
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>Créneau RDV</p>
              {creneau ? (
                <>
                  <Field
                    label="Date"
                    value={formatDateLong(creneau.date_debut).replace(/^\w/, c => c.toUpperCase())}
                  />
                  <Field
                    label="Heure"
                    value={`${formatTime(creneau.date_debut)} – ${formatTime(creneau.date_fin)}`}
                  />
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
                  Aucun créneau réservé
                </p>
              )}
            </div>

          </div>

          {/* Colonne droite */}
          <div>

            {/* Chantier */}
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>Chantier</p>
              <Field label="Adresse" value={demande.adresse_chantier} />
              <Field label="Type de travaux" value={TRAVAUX_LABELS[demande.type_travaux] ?? demande.type_travaux} />
              {demande.description && (
                <Field label="Description client" value={demande.description} />
              )}
            </div>

            {/* Actions */}
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>Actions</p>

              {/* Changer statut */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Statut</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    value={statut}
                    onChange={e => setStatut(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      padding: '10px 12px',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {STATUTS.map(s => (
                      <option key={s} value={s} style={{ background: '#1a1a18' }}>
                        {STATUT_BADGE[s]?.label ?? s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={saveStatut}
                    disabled={statutSaving || statut === demande.statut}
                    style={{
                      background: statut !== demande.statut ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                      color: statut !== demande.statut ? '#0F0F0D' : 'rgba(255,255,255,0.3)',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '10px 16px',
                      fontSize: '12px',
                      letterSpacing: '0.06em',
                      cursor: statut !== demande.statut ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                    }}
                  >
                    {statutSaving ? '...' : statutSaved ? '✓ Mis à jour' : 'Confirmer'}
                  </button>
                </div>
              </div>

              {/* Créer le devis */}
              <Link
                href={`/admin/demandes/${id}/devis`}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: '4px',
                  padding: '13px',
                  color: '#A78BFA',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.2)'; e.currentTarget.style.color = '#C4B5FD' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.12)'; e.currentTarget.style.color = '#A78BFA' }}
              >
                Créer le devis →
              </Link>

              {/* Demander l'acompte 60% */}
              {demande.statut === 'devis_envoye' && (
                <div style={{ marginTop: '12px' }}>
                  {demande.statut_acompte === 'confirme' ? (
                    <div style={{
                      background: 'rgba(74,222,128,0.1)',
                      border: '1px solid rgba(74,222,128,0.3)',
                      borderRadius: '4px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#4ADE80',
                      textAlign: 'center',
                    }}>
                      ✓ Acompte confirmé — {demande.montant_acompte?.toFixed(2)} €
                    </div>
                  ) : demande.statut_acompte === 'en_attente' ? (
                    <div style={{
                      background: 'rgba(251,146,60,0.1)',
                      border: '1px solid rgba(251,146,60,0.3)',
                      borderRadius: '4px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#FB923C',
                      textAlign: 'center',
                    }}>
                      En attente du versement — {demande.montant_acompte?.toFixed(2)} €
                    </div>
                  ) : (
                    <button
                      onClick={handleDemanderAcompte}
                      disabled={sendingAcompte}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: sendingAcompte ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.1)',
                        border: '1px solid rgba(74,222,128,0.3)',
                        borderRadius: '4px',
                        padding: '13px',
                        color: sendingAcompte ? 'rgba(74,222,128,0.4)' : '#4ADE80',
                        fontSize: '12px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: sendingAcompte ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={e => { if (!sendingAcompte) { e.currentTarget.style.background = 'rgba(74,222,128,0.18)' } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.1)' }}
                    >
                      {sendingAcompte ? 'Envoi en cours…' : 'Demander l\'acompte 60% →'}
                    </button>
                  )}
                  {acompteResult && (
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#4ADE80', letterSpacing: '0.02em' }}>
                      {acompteResult}
                    </p>
                  )}
                </div>
              )}

              {/* Créer la facture */}
              {demande.statut === 'accepte' && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={handleCreerFacture}
                    disabled={creatingFacture}
                    style={{
                      display: 'block',
                      width: '100%',
                      background: creatingFacture ? 'rgba(167,139,250,0.06)' : 'rgba(167,139,250,0.12)',
                      border: '1px solid rgba(167,139,250,0.3)',
                      borderRadius: '4px',
                      padding: '13px',
                      color: creatingFacture ? 'rgba(167,139,250,0.4)' : '#A78BFA',
                      fontSize: '12px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: creatingFacture ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={e => { if (!creatingFacture) e.currentTarget.style.background = 'rgba(167,139,250,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = creatingFacture ? 'rgba(167,139,250,0.06)' : 'rgba(167,139,250,0.12)' }}
                  >
                    {creatingFacture ? 'Génération en cours…' : 'Créer la facture →'}
                  </button>
                  {factureResult && (
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#4ADE80' }}>{factureResult}</p>
                  )}
                </div>
              )}

              {actionError && (
                <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#FF7B7B' }}>
                  {actionError}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Notes internes — pleine largeur */}
        <div style={{ ...sectionStyle, marginTop: '0' }}>
          <p style={sectionTitleStyle}>Notes internes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observations, remarques sur le chantier..."
            rows={5}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              padding: '12px 14px',
              color: '#FFFFFF',
              fontSize: '13px',
              lineHeight: 1.6,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          />
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={saveNotes}
              disabled={notesSaving}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '3px',
                padding: '9px 18px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                letterSpacing: '0.06em',
                cursor: notesSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!notesSaving) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#FFFFFF' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            >
              {notesSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            {notesSaved && (
              <span style={{ fontSize: '12px', color: '#4ADE80' }}>✓ Sauvegardé</span>
            )}
          </div>
        </div>

        {/* Compte-rendu de visite — pleine largeur */}
        <div style={{ ...sectionStyle, marginTop: '0' }}>
          <p style={sectionTitleStyle}>Compte-rendu de visite</p>

          {/* Bouton micro */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={transcribing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: transcribing ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '4px',
                  padding: '10px 18px',
                  color: transcribing ? 'rgba(239,68,68,0.4)' : '#EF4444',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  cursor: transcribing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!transcribing) e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.background = transcribing ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.1)' }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
                Enregistrer une note vocale
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="animate-pulse"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239,68,68,0.22)',
                  border: '1px solid rgba(239,68,68,0.6)',
                  borderRadius: '4px',
                  padding: '10px 18px',
                  color: '#EF4444',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#EF4444', display: 'inline-block', flexShrink: 0 }} />
                Stop — Enregistrement en cours…
              </button>
            )}

            {transcribing && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                Transcription en cours…
              </span>
            )}
          </div>

          {/* Transcription */}
          {transcribing && (
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
              Transcription en cours…
            </p>
          )}

          {crTranscription && (
            <div style={{ marginBottom: '16px' }}>
              <span style={labelStyle}>Transcription</span>
              <textarea
                value={crTranscription}
                onChange={e => {
                  setCrTranscription(e.target.value)
                  // Sync dans les notes : remplace la dernière transcription ajoutée
                  setNotes(prev => {
                    const idx = prev.lastIndexOf(crTranscription)
                    if (idx === -1) return prev
                    return prev.slice(0, idx) + e.target.value + prev.slice(idx + crTranscription.length)
                  })
                }}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  padding: '12px 14px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>
                Ajouté automatiquement aux notes internes ci-dessus
              </p>
            </div>
          )}

          {/* Bouton sauvegarder */}
          {crTranscription && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={saveCr}
                disabled={crSaving}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '3px',
                  padding: '9px 18px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  cursor: crSaving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!crSaving) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#FFFFFF' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
              >
                {crSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              {crSaved && <span style={{ fontSize: '12px', color: '#4ADE80' }}>✓ Sauvegardé</span>}
            </div>
          )}

          {crError && (
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#FF7B7B' }}>{crError}</p>
          )}
        </div>

        {/* Historique des statuts — pleine largeur */}
        <div style={{ ...sectionStyle, marginTop: '0' }}>
          <p style={sectionTitleStyle}>Historique</p>
          {historique.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
              Aucun changement de statut enregistré.
            </p>
          ) : (
            <div style={{ borderLeft: '2px solid rgba(255,255,255,0.07)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
              {historique.map((h, i) => {
                const ancienLabel = h.ancien_statut ? (STATUT_BADGE[h.ancien_statut]?.label ?? h.ancien_statut) : 'Création'
                const nouveauLabel = STATUT_BADGE[h.nouveau_statut]?.label ?? h.nouveau_statut
                const ancienColor  = h.ancien_statut ? (STATUT_BADGE[h.ancien_statut]?.color ?? '#94A3B8') : 'rgba(255,255,255,0.3)'
                const nouveauColor = STATUT_BADGE[h.nouveau_statut]?.color ?? '#94A3B8'
                const dateStr = new Date(h.created_at).toLocaleDateString('fr-FR', {
                  timeZone: 'Europe/Paris',
                  day: 'numeric', month: 'long', year: 'numeric',
                })
                const heureStr = new Date(h.created_at).toLocaleTimeString('fr-FR', {
                  timeZone: 'Europe/Paris',
                  hour: '2-digit', minute: '2-digit',
                })
                return (
                  <div
                    key={h.id}
                    style={{
                      paddingBottom: i < historique.length - 1 ? '16px' : '0',
                      paddingTop: i > 0 ? '0' : '0',
                      position: 'relative',
                    }}
                  >
                    {/* Point sur la timeline */}
                    <div style={{
                      position: 'absolute',
                      left: '-25px',
                      top: '5px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: nouveauColor,
                      flexShrink: 0,
                    }} />
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>
                      {dateStr} à {heureStr}
                    </div>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>Statut changé :</span>
                      <span style={{ color: ancienColor }}>{ancienLabel}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>→</span>
                      <span style={{ color: nouveauColor, fontWeight: 400 }}>{nouveauLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Photos du chantier — pleine largeur */}
        <div style={{ ...sectionStyle, marginTop: '0' }}>
          <p style={sectionTitleStyle}>Photos du chantier</p>

          {/* Onglets */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
            {(['avant', 'pendant', 'apres'] as OngletPhoto[]).map(tab => {
              const labels = { avant: 'Avant', pendant: 'Pendant', apres: 'Après' }
              const count = photos.filter(p => p.type === tab).length
              const active = ongletPhoto === tab
              return (
                <button
                  key={tab}
                  onClick={() => setOngletPhoto(tab)}
                  style={{
                    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    padding: '7px 16px',
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {labels[tab]}{count > 0 && <span style={{ marginLeft: '6px', opacity: 0.6 }}>({count})</span>}
                </button>
              )
            })}

            {/* Bouton ajouter */}
            <div style={{ marginLeft: 'auto' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{
                  background: uploadingPhoto ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  padding: '7px 16px',
                  color: uploadingPhoto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  letterSpacing: '0.05em',
                  cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!uploadingPhoto) { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' } }}
                onMouseLeave={e => { e.currentTarget.style.color = uploadingPhoto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = uploadingPhoto ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)' }}
              >
                {uploadingPhoto ? 'Upload en cours…' : '+ Ajouter des photos'}
              </button>
            </div>
          </div>

          {/* Grille photos */}
          {(() => {
            const filtered = photos.filter(p => p.type === ongletPhoto)
            if (filtered.length === 0) {
              return (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '32px 0' }}>
                  Aucune photo pour cet onglet
                </p>
              )
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {filtered.map(photo => (
                  <div
                    key={photo.id}
                    style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    onClick={() => setLightboxUrl(photo.url)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    />
                    {/* Bouton supprimer */}
                    <button
                      onClick={e => { e.stopPropagation(); handlePhotoDelete(photo.id) }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.65)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '13px',
                        lineHeight: 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,50,50,0.85)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}

          {photoError && (
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#FF7B7B' }}>{photoError}</p>
          )}
        </div>

      </main>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '6px',
              cursor: 'default',
              boxShadow: '0 0 60px rgba(0,0,0,0.6)',
            }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '28px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
