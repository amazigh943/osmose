import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── GET /api/admin/calendrier?year=2026&month=2 ──────────────────────────────
// month est 0-indexé (0=janvier, 11=décembre)

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth()))

  const monthStart = new Date(Date.UTC(year, month, 1))
  const monthEnd   = new Date(Date.UTC(year, month + 1, 1))

  const { data, error } = await supabaseAdmin
    .from('creneaux')
    .select('id, date_debut, date_fin, statut, demande_id, demandes(id, adresse_chantier, type_travaux, statut, clients(prenom, nom))')
    .gte('date_debut', monthStart.toISOString())
    .lt('date_debut', monthEnd.toISOString())
    .order('date_debut')

  if (error) {
    console.error('[admin/calendrier] Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ creneaux: data ?? [] })
}
