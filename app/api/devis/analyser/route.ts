import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

console.log('[analyser] GROQ_API_KEY présente ?', !!process.env.GROQ_API_KEY)
console.log('[analyser] OPENAI_API_KEY présente ?', !!process.env.OPENAI_API_KEY)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Tu es un assistant spécialisé en devis de peinture et travaux.
Analyse ce texte et extrais en JSON strict :
{
  "client": { "nom": "", "prenom": "", "email": "", "telephone": "", "adresse_chantier": "" },
  "taches": [{ "designation": "", "quantite": 0, "unite": "", "prix_unitaire": 0 }],
  "duree_chantier": ""
}
Réponds UNIQUEMENT avec le JSON, sans texte autour, sans markdown.`

// ─── POST /api/devis/analyser ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[analyser] ── début de requête ──')

  // Auth
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[analyser] auth user:', user?.id ?? 'non connecté')
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  } catch (e: unknown) {
    const err = e as Error
    console.error('[analyser] Erreur auth:', err.message, err.stack)
    return NextResponse.json({ error: 'Erreur auth : ' + err.message, stack: err.stack }, { status: 500 })
  }

  let body: { texte?: string; audio?: string; filename?: string }
  try {
    body = await req.json()
    console.log('[analyser] body reçu — mode:', body.audio ? 'audio' : 'texte', '— longueur texte:', body.texte?.length ?? 0)
  } catch (e: unknown) {
    const err = e as Error
    console.error('[analyser] Erreur parsing body:', err.message)
    return NextResponse.json({ error: 'Body JSON invalide : ' + err.message }, { status: 400 })
  }

  let texte: string

  // ── Transcription audio via Whisper ──────────────────────────────────────────
  if (body.audio) {
    console.log('[analyser] mode audio — démarrage Whisper')
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('[analyser] OPENAI_API_KEY manquante')
      return NextResponse.json({ error: 'OPENAI_API_KEY non configurée' }, { status: 500 })
    }

    try {
      const audioBuffer = Buffer.from(body.audio, 'base64')
      const filename = body.filename ?? 'audio.mp3'
      const mimeType = filename.endsWith('.wav') ? 'audio/wav'
        : filename.endsWith('.m4a') ? 'audio/mp4'
        : 'audio/mpeg'
      console.log('[analyser] audio filename:', filename, '— taille buffer:', audioBuffer.length)

      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)
      formData.append('model', 'whisper-1')
      formData.append('language', 'fr')

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      })

      if (!whisperRes.ok) {
        const errText = await whisperRes.text()
        console.error('[analyser] Whisper HTTP', whisperRes.status, ':', errText)
        return NextResponse.json({ error: 'Erreur Whisper (' + whisperRes.status + ') : ' + errText }, { status: 500 })
      }

      const whisperData = await whisperRes.json() as { text: string }
      texte = whisperData.text
      console.log('[analyser] Whisper OK — transcription (' + texte.length + ' chars):', texte.slice(0, 100))
    } catch (e: unknown) {
      const err = e as Error
      console.error('[analyser] Exception Whisper:', err.message, err.stack)
      return NextResponse.json({ error: 'Exception Whisper : ' + err.message, stack: err.stack }, { status: 500 })
    }

  } else if (body.texte?.trim()) {
    texte = body.texte
    console.log('[analyser] texte reçu (' + texte.length + ' chars):', texte.slice(0, 100))

  } else {
    return NextResponse.json({ error: 'Texte ou audio requis' }, { status: 400 })
  }

  // ── Analyse Groq ─────────────────────────────────────────────────────────────
  console.log('[analyser] appel Groq...')
  let rawJson: string
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: texte },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })
    rawJson = completion.choices[0].message.content ?? ''
    console.log('[analyser] Groq OK — réponse brute:', rawJson.slice(0, 200))
  } catch (e: unknown) {
    const err = e as Error
    console.error('[analyser] Erreur Groq:', err.message, err.stack)
    return NextResponse.json({ error: 'Erreur Groq : ' + err.message, stack: err.stack }, { status: 500 })
  }

  // ── Parse JSON ───────────────────────────────────────────────────────────────
  type Extracted = {
    client: { nom: string; prenom: string; email: string; telephone: string; adresse_chantier: string }
    taches: Array<{ designation: string; quantite: number; unite: string; prix_unitaire: number }>
    duree_chantier: string
  }

  let extracted: Extracted
  try {
    const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    extracted = JSON.parse(cleaned) as Extracted
    console.log('[analyser] JSON parsé OK — client:', extracted.client?.nom, '— tâches:', extracted.taches?.length)
  } catch (e: unknown) {
    const err = e as Error
    console.error('[analyser] Erreur parse JSON:', err.message, '— raw:', rawJson)
    return NextResponse.json({ error: 'Parse JSON échoué : ' + err.message, raw: rawJson }, { status: 500 })
  }

  // ── Numéro de devis ──────────────────────────────────────────────────────────
  console.log('[analyser] récupération count devis...')
  const { count, error: countError } = await supabaseAdmin
    .from('devis')
    .select('id', { count: 'exact', head: true })

  if (countError) {
    console.error('[analyser] Erreur count devis:', countError.message)
  }

  const n = (count ?? 0) + 1
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const aa = String(now.getFullYear()).slice(-2)
  const numero = `${n}-${mm}${aa}`
  console.log('[analyser] numéro de devis généré:', numero)

  // ── Enrichissement via référentiel ───────────────────────────────────────────
  // Mots à ignorer lors de la recherche (stop words)
  const STOP_WORDS = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'par', 'sur', 'sous', 'pour', 'avec', 'dans', 'l', 'd'])

  function motsClesDe(designation: string): string[] {
    return designation
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprime accents
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(m => m.length > 2 && !STOP_WORDS.has(m))
      .slice(0, 4) // max 4 mots significatifs
  }

  console.log('[analyser] enrichissement référentiel pour', extracted.taches?.length, 'tâches...')
  const taches = await Promise.all(
    (extracted.taches ?? []).map(async (t) => {
      try {
        const mots = motsClesDe(t.designation)
        if (mots.length === 0) {
          console.log('[analyser] aucun mot clé pour:', t.designation)
          return { ...t, prix_source: 'ia' }
        }

        // Construit un filtre OR sur mots_cles pour chaque mot
        const filtre = mots.map(m => `mots_cles.ilike.%${m}%`).join(',')
        console.log('[analyser] recherche référentiel pour "' + t.designation + '" → mots:', mots.join(', '))

        const { data, error } = await supabaseAdmin
          .from('taches_referentiel')
          .select('designation, prix_unitaire')
          .or(filtre)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('[analyser] Erreur requête référentiel:', error.message)
          return { ...t, prix_source: 'ia' }
        }

        if (data) {
          console.log('[analyser] trouvé dans référentiel:', data.designation, '→', data.prix_unitaire)
          return { ...t, prix_unitaire: data.prix_unitaire, prix_source: 'referentiel' }
        }

        console.log('[analyser] non trouvé dans référentiel pour:', t.designation)
        return { ...t, prix_unitaire: 0, prix_source: 'ia' }

      } catch (e: unknown) {
        const err = e as Error
        console.error('[analyser] Exception référentiel pour "' + t.designation + '":', err.message)
        return { ...t, prix_source: 'ia' }
      }
    })
  )

  console.log('[analyser] ── succès, retour réponse ──')
  return NextResponse.json({
    client: extracted.client,
    taches,
    duree_chantier: extracted.duree_chantier,
    numero,
    ...(body.audio ? { transcription: texte } : {}),
  })
}
