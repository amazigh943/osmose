import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Vérifie que l'utilisateur est authentifié
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = params
  const body = await req.json()
  const { statut, notes_admin } = body as { statut?: string; notes_admin?: string }

  const updates: Record<string, string> = {}
  if (statut !== undefined) updates.statut = statut
  if (notes_admin !== undefined) updates.notes_admin = notes_admin

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('demandes')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('[admin/demandes] Erreur PATCH:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
