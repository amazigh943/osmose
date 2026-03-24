import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const STATUTS_VALIDES = [
  'nouvelle', 'en_attente', 'rdv_planifie', 'planifie',
  'devis_envoye', 'accepte', 'refuse', 'termine',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { statut } = await req.json() as { statut?: string }

  if (!statut || !STATUTS_VALIDES.includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Récupère l'ancien statut avant mise à jour
  const { data: current } = await supabaseAdmin
    .from('demandes')
    .select('statut')
    .eq('id', params.id)
    .single()

  const ancienStatut = current?.statut ?? null

  // Met à jour le statut
  const { error } = await supabaseAdmin
    .from('demandes')
    .update({ statut })
    .eq('id', params.id)

  if (error) {
    console.error('[demandes/statut] Erreur PATCH:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insère dans l'historique (non bloquant si erreur)
  if (ancienStatut !== statut) {
    const { error: histError } = await supabaseAdmin
      .from('historique_statuts')
      .insert({
        demande_id:    params.id,
        ancien_statut: ancienStatut,
        nouveau_statut: statut,
      })

    if (histError) {
      console.error('[demandes/statut] Erreur historique:', histError.message)
    }
  }

  return NextResponse.json({ success: true })
}
