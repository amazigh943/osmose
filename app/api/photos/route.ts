import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { demande_id, type, file } = await req.json()

    if (!demande_id || !type || !file) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (!['avant', 'pendant', 'apres'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }

    // Extraire la partie base64 (sans le préfixe data:image/...;base64,)
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Détecter le content type depuis le préfixe
    const mimeMatch = file.match(/^data:(image\/\w+);base64,/)
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const ext = contentType.split('/')[1] ?? 'jpg'

    const timestamp = Date.now()
    const storagePath = `photos/${demande_id}/${type}/${timestamp}.${ext}`

    // Upload dans Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(storagePath, buffer, { contentType, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // URL publique
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('photos')
      .getPublicUrl(storagePath)

    // Insertion en base
    const { data, error: insertError } = await supabaseAdmin
      .from('photos_chantier')
      .insert({ demande_id, type, url: publicUrl, storage_path: storagePath })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl, id: (data as { id: string }).id })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
