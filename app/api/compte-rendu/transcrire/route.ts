import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { audio, demande_id: _demande_id } = await req.json()

    if (!audio) {
      return NextResponse.json({ error: 'Audio manquant' }, { status: 400 })
    }

    // Extraire la partie base64
    const base64Data = audio.replace(/^data:audio\/[\w;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const mimeMatch = audio.match(/^data:(audio\/[\w]+);base64,/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm'
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'webm'

    // Créer un File pour l'API Groq Whisper
    const audioFile = new File([buffer], `audio.${ext}`, { type: mimeType })

    // ── Transcription via Whisper ────────────────────────────────────────────
    const transcriptionResult = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'json',
    })

    const transcription = transcriptionResult.text?.trim() ?? ''

    if (!transcription) {
      return NextResponse.json({ transcription: '', resume: '' })
    }

    // ── Structuration via LLM ────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Structure ce compte-rendu de visite chantier en points clés :\n${transcription}\nFormat : observations principales, travaux à prévoir, remarques particulières.\nSois concis.`,
        },
      ],
    })

    const resume = completion.choices[0]?.message?.content?.trim() ?? ''

    return NextResponse.json({ transcription, resume })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
