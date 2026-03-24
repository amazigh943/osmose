'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Schemas ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  prenom: z.string().min(2, 'Prénom requis'),
  nom: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  telephone: z.string().min(10, 'Téléphone invalide').max(15),
})

const step2Schema = z.object({
  adresse_chantier: z.string().min(5, 'Adresse requise'),
  type_travaux: z.string().min(1, 'Choisissez un type de travaux'),
  surface: z.string().min(1, 'Choisissez une surface'),
  description: z.string().optional(),
})

type Step1Data = z.infer<typeof step1Schema>
type Step2Data = z.infer<typeof step2Schema>

// ─── Styles partagés ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#FFFFFF',
  borderRadius: '4px',
  padding: '14px 16px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  boxSizing: 'border-box',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
}

const errorStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#FF7B7B',
  marginTop: '2px',
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  color: '#0F0F0D',
  padding: '15px 36px',
  borderRadius: '2px',
  fontSize: '13px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.2s ease',
  fontFamily: 'inherit',
}

// ─── Composant Field ──────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemandePage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      adresse_chantier: '',
      type_travaux: '',
      surface: '',
      description: '',
    },
  })

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data)
    setStep(2)
  }

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) {
      console.error('[demande] step1Data manquant')
      return
    }

    setSubmitting(true)
    setApiError(null)

    const body = { ...step1Data, ...data }
    console.log('[demande] Début soumission, body:', body)

    try {
      const res = await fetch('/api/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      console.log('[demande] Réponse API, status:', res.status)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('[demande] Erreur API:', errData)
        setApiError(errData.error ?? `Erreur serveur (${res.status})`)
        setSubmitting(false)
        return
      }

      const json = await res.json()
      console.log('[demande] Succès, id:', json.id)
      router.push(`/creneaux?id=${json.id}`)
    } catch (err) {
      console.error('[demande] Erreur réseau:', err)
      setApiError('Erreur réseau. Vérifiez votre connexion et réessayez.')
      setSubmitting(false)
    }
  }

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.5)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.15)'
  }

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
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Retour */}
        <Link
          href="/"
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
          <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            {step} / 2
          </span>
          <h1
            className={cormorant.className}
            style={{ fontSize: '52px', fontWeight: 300, color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: 1, marginTop: '10px' }}
          >
            Votre projet
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginTop: '10px' }}>
            Parlez-nous de votre chantier
          </p>
        </div>

        {/* ── ÉTAPE 1 ── */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1Submit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Prénom" error={form1.formState.errors.prenom?.message}>
                <input
                  {...form1.register('prenom')}
                  placeholder="Jean"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
              <Field label="Nom" error={form1.formState.errors.nom?.message}>
                <input
                  {...form1.register('nom')}
                  placeholder="Dupont"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </Field>
            </div>

            <Field label="Email" error={form1.formState.errors.email?.message}>
              <input
                {...form1.register('email')}
                type="email"
                placeholder="jean.dupont@email.com"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <Field label="Téléphone" error={form1.formState.errors.telephone?.message}>
              <input
                {...form1.register('telephone')}
                type="tel"
                placeholder="06 00 00 00 00"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <button
              type="submit"
              style={{ ...btnPrimary, marginTop: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Continuer →
            </button>
          </form>
        )}

        {/* ── ÉTAPE 2 ── */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2Submit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <Field label="Adresse du chantier" error={form2.formState.errors.adresse_chantier?.message}>
              <input
                {...form2.register('adresse_chantier')}
                placeholder="12 rue de la Paix, 75001 Paris"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <Field label="Type de travaux" error={form2.formState.errors.type_travaux?.message}>
              <select
                {...form2.register('type_travaux')}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                onFocus={focusStyle}
              >
                <option value="" disabled style={{ background: '#1A1A17' }}>Choisir...</option>
                <option value="peinture_interieure" style={{ background: '#1A1A17' }}>Peinture intérieure</option>
                <option value="peinture_exterieure" style={{ background: '#1A1A17' }}>Peinture extérieure</option>
                <option value="ravalement_facade" style={{ background: '#1A1A17' }}>Ravalement façade</option>
                <option value="traitement_humidite" style={{ background: '#1A1A17' }}>Traitement humidité</option>
                <option value="autre" style={{ background: '#1A1A17' }}>Autre</option>
              </select>
            </Field>

            <Field label="Surface approximative" error={form2.formState.errors.surface?.message}>
              <select
                {...form2.register('surface')}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                onFocus={focusStyle}
              >
                <option value="" disabled style={{ background: '#1A1A17' }}>Choisir...</option>
                <option value="moins_30" style={{ background: '#1A1A17' }}>Moins de 30m²</option>
                <option value="30_80" style={{ background: '#1A1A17' }}>30 à 80m²</option>
                <option value="80_150" style={{ background: '#1A1A17' }}>80 à 150m²</option>
                <option value="plus_150" style={{ background: '#1A1A17' }}>Plus de 150m²</option>
              </select>
            </Field>

            <Field label="Description (optionnel)">
              <textarea
                {...form2.register('description')}
                placeholder="Décrivez votre projet..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              {apiError && (
                <div style={{
                  fontSize: '13px',
                  color: '#FF7B7B',
                  background: 'rgba(255,80,80,0.08)',
                  border: '1px solid rgba(255,80,80,0.2)',
                  borderRadius: '4px',
                  padding: '12px 14px',
                }}>
                  {apiError}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.opacity = '1' }}
              >
                {submitting ? 'Envoi en cours...' : 'Envoyer ma demande →'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.5)',
                  padding: '14px',
                  borderRadius: '2px',
                  fontSize: '13px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
              >
                ← Retour
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Placeholder couleur texte placeholder via style global injecté */}
      <style>{`
        input::placeholder, textarea::placeholder {
          color: rgba(255,255,255,0.35);
        }
        select option {
          background: #1A1A17;
          color: #FFFFFF;
        }
      `}</style>
    </main>
  )
}
