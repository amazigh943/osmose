import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('stock_composants')
    .select('*')
    .order('nom', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { nom, reference, quantite, unite, seuil_alerte, prix_unitaire } = body

  if (!nom || !unite) {
    return NextResponse.json({ error: 'nom et unite requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('stock_composants')
    .insert({ nom, reference: reference || null, quantite: quantite ?? 0, unite, seuil_alerte: seuil_alerte ?? 0, prix_unitaire: prix_unitaire ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
