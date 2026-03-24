import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── GET /api/clients ─────────────────────────────────────────────────────────
// Retourne tous les clients avec leur dernier_chantier calculé depuis les demandes

export async function GET() {
  // Récupérer les clients
  const { data: clients, error: clientsError } = await supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, email, telephone, dernier_chantier, relance_envoyee, date_relance, created_at')
    .order('created_at', { ascending: false })

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }

  // Pour chaque client, calculer le dernier chantier depuis les demandes si non renseigné
  const ids = (clients ?? []).map(c => c.id)

  const { data: demandes } = await supabaseAdmin
    .from('demandes')
    .select('client_id, created_at, statut')
    .in('client_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
    .in('statut', ['accepte', 'termine'])
    .order('created_at', { ascending: false })

  // Construire un map client_id → max created_at de ses chantiers
  const dernierMap = new Map<string, string>()
  for (const d of demandes ?? []) {
    if (!dernierMap.has(d.client_id)) {
      dernierMap.set(d.client_id, d.created_at)
    }
  }

  // Fusionner : priorité à dernier_chantier en base, sinon calculé
  const enriched = (clients ?? []).map(c => ({
    ...c,
    dernier_chantier: c.dernier_chantier ?? dernierMap.get(c.id) ?? null,
  }))

  return NextResponse.json({ clients: enriched })
}

// ─── PATCH /api/clients ───────────────────────────────────────────────────────
// Réinitialise relance_envoyee = false pour tous les clients

export async function PATCH(_req: NextRequest) {
  const { error } = await supabaseAdmin
    .from('clients')
    .update({ relance_envoyee: false, date_relance: null })
    .neq('id', '00000000-0000-0000-0000-000000000000') // filtre universel (tous)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
