import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Tu es l'assistant virtuel d'Osmose, une entreprise de peinture professionnelle en Île-de-France. Tu aides les clients à :
- Répondre aux questions sur les travaux de peinture
- Estimer les surfaces et quantités de peinture nécessaires
- Expliquer les différences entre types de peinture (mat, satiné, brillant)
- Conseiller sur la préparation des murs
- Donner des fourchettes de prix indicatives
- Orienter vers la prise de RDV pour un devis gratuit

Règles :
- Réponds toujours en français
- Sois chaleureux et professionnel
- Pour les devis précis, invite toujours à prendre RDV
- Si le client mentionne surface, pièce, ou type de travaux → ajoute 'PROPOSE_RDV' à la fin de ta réponse (sera retiré avant affichage)
- Garde tes réponses concises (max 3 paragraphes)`

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: ChatMessage[]; session_id: string }
  const { messages, session_id } = body

  if (!messages?.length || !session_id) {
    return NextResponse.json({ error: 'messages et session_id requis' }, { status: 400 })
  }

  // Appel Groq
  let rawContent: string
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 512,
    })
    rawContent = completion.choices[0].message.content ?? ''
  } catch (e: unknown) {
    const err = e as Error
    console.error('[chat] Erreur Groq:', err.message)
    return NextResponse.json({ error: 'Erreur IA : ' + err.message }, { status: 500 })
  }

  // Détecte PROPOSE_RDV et nettoie la réponse
  const propose_rdv = rawContent.includes('PROPOSE_RDV')
  const message = rawContent.replace(/PROPOSE_RDV/g, '').trim()

  // Sauvegarde en base (non bloquant)
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMsg) {
    void supabaseAdmin.from('conversations').insert([
      { session_id, role: 'user',      content: lastUserMsg.content },
      { session_id, role: 'assistant', content: message },
    ]).then(({ error }) => {
      if (error) console.error('[chat] Erreur save conversation:', error.message)
    })
  }

  return NextResponse.json({ message, propose_rdv })
}
