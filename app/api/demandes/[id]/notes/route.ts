import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { notes_admin } = await req.json() as { notes_admin?: string }

  if (notes_admin === undefined) {
    return NextResponse.json({ error: 'Champ notes_admin manquant' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('demandes')
    .update({ notes_admin })
    .eq('id', params.id)

  if (error) {
    console.error('[demandes/notes] Erreur PATCH:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
