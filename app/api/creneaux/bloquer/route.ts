import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function parisOffset(date: Date): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const match = tz.match(/GMT([+-])(\d+)/)
  if (!match) return 1
  return (match[1] === '-' ? -1 : 1) * parseInt(match[2])
}

// ─── PATCH /api/creneaux/bloquer ──────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json() as { date?: string; slot?: string }
  const { date, slot } = body

  if (!date || !slot || !['all', '17h30', '18h00'].includes(slot)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // Parse YYYY-MM-DD
  const [year, month, day] = date.split('-').map(Number)
  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const offset = parisOffset(refDate)

  const dayStart = new Date(Date.UTC(year, month - 1, day, -offset, 0, 0))
  const dayEnd   = new Date(Date.UTC(year, month - 1, day, 24 - offset, 0, 0))

  if (slot === 'all') {
    // Mise à jour des creneaux existants
    const { error } = await supabaseAdmin
      .from('creneaux')
      .update({ statut: 'bloque' })
      .gte('date_debut', dayStart.toISOString())
      .lt('date_debut', dayEnd.toISOString())
      .eq('statut', 'disponible')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Si aucun créneau n'existait pour ce jour, les créer directement bloqués
    const { data: existing } = await supabaseAdmin
      .from('creneaux')
      .select('id')
      .gte('date_debut', dayStart.toISOString())
      .lt('date_debut', dayEnd.toISOString())

    if (!existing || existing.length === 0) {
      const toInsert = [
        { date_debut: new Date(Date.UTC(year, month - 1, day, 17 - offset, 30, 0)).toISOString(), date_fin: new Date(Date.UTC(year, month - 1, day, 18 - offset, 30, 0)).toISOString(), statut: 'bloque', demande_id: null },
        { date_debut: new Date(Date.UTC(year, month - 1, day, 18 - offset, 0, 0)).toISOString(),  date_fin: new Date(Date.UTC(year, month - 1, day, 19 - offset, 0, 0)).toISOString(),  statut: 'bloque', demande_id: null },
      ]
      const { error: insertError } = await supabaseAdmin.from('creneaux').insert(toInsert)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  } else {
    const [h, m] = slot === '17h30' ? [17, 30] : [18, 0]
    const slotStart = new Date(Date.UTC(year, month - 1, day, h - offset, m, 0))
    const slotEnd   = new Date(slotStart.getTime() + 60 * 1000)

    const { data: existing } = await supabaseAdmin
      .from('creneaux')
      .select('id')
      .gte('date_debut', slotStart.toISOString())
      .lt('date_debut', slotEnd.toISOString())

    if (existing && existing.length > 0) {
      const { error } = await supabaseAdmin
        .from('creneaux')
        .update({ statut: 'bloque' })
        .gte('date_debut', slotStart.toISOString())
        .lt('date_debut', slotEnd.toISOString())
        .eq('statut', 'disponible')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const slotFinHour  = slot === '17h30' ? 18 : 19
      const slotFinMin   = 30
      const toInsert = [{
        date_debut: slotStart.toISOString(),
        date_fin:   new Date(Date.UTC(year, month - 1, day, slotFinHour - offset, slotFinMin === 30 && slot === '17h30' ? 30 : 0, 0)).toISOString(),
        statut: 'bloque',
        demande_id: null,
      }]
      const { error } = await supabaseAdmin.from('creneaux').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
