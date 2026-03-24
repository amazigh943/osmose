import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('demandes')
    .select('adresse_chantier, montant_acompte, statut_acompte, clients(prenom, nom)')
    .eq('token_acompte', token)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Token invalide' }, { status: 404 })

  const client = data.clients as unknown as { prenom: string; nom: string } | null

  return NextResponse.json({
    nomClient:        client ? `${client.prenom} ${client.nom}` : '',
    adresse_chantier: data.adresse_chantier,
    montant_acompte:  data.montant_acompte,
    statut_acompte:   data.statut_acompte,
  })
}
