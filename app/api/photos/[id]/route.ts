import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Récupérer le chemin Storage avant suppression
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('photos_chantier')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
    }

    // Supprimer du Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('photos')
      .remove([(photo as { storage_path: string }).storage_path])

    if (storageError) {
      console.error('Storage delete error:', storageError.message)
    }

    // Supprimer de la base
    const { error: deleteError } = await supabaseAdmin
      .from('photos_chantier')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
