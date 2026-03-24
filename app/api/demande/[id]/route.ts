import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const TRAVAUX_LABELS: Record<string, string> = {
  peinture_interieure: 'Peinture intérieure',
  peinture_exterieure: 'Peinture extérieure',
  ravalement_facade: 'Ravalement façade',
  traitement_humidite: 'Traitement humidité',
  autre: 'Autre',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Récupère la demande + le client lié
  const { data: demande, error: demandeError } = await supabaseAdmin
    .from('demandes')
    .select('id, adresse_chantier, type_travaux, statut, clients(prenom, nom, email)')
    .eq('id', id)
    .single()

  if (demandeError || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  // Récupère le créneau réservé pour cette demande
  const { data: creneau } = await supabaseAdmin
    .from('creneaux')
    .select('date_debut, date_fin')
    .eq('demande_id', id)
    .eq('statut', 'reserve')
    .maybeSingle()

  const client = Array.isArray(demande.clients) ? demande.clients[0] : demande.clients

  return NextResponse.json({
    id: demande.id,
    adresse_chantier: demande.adresse_chantier,
    type_travaux: TRAVAUX_LABELS[demande.type_travaux] ?? demande.type_travaux,
    statut: demande.statut,
    client: client ?? null,
    creneau: creneau ?? null,
  })
}
