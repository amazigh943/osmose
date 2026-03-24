import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY manquante — configurez cette variable d\'environnement' },
      { status: 500 }
    )
  }

  try {
    const { audio, mimeType } = await req.json()

    if (!audio) {
      return NextResponse.json({ error: 'Audio manquant' }, { status: 400 })
    }

    // Décoder le base64
    const base64Data = audio.replace(/^data:[\w/;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const type = mimeType ?? 'audio/webm'
    const ext = type.split('/')[1]?.split(';')[0] ?? 'webm'

    // FormData pour l'API OpenAI Whisper
    const formData = new FormData()
    formData.append('file', new File([buffer], `audio.${ext}`, { type }))
    formData.append('model', 'whisper-1')
    formData.append('language', 'fr')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } }).error?.message
      return NextResponse.json(
        { error: msg ?? `Erreur OpenAI (${response.status})` },
        { status: 500 }
      )
    }

    const data = (await response.json()) as { text?: string }
    return NextResponse.json({ texte: data.text?.trim() ?? '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
