import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Lundi de la semaine contenant `d` (minuit UTC) */
function getMonday(d: Date): Date {
  const date = new Date(d)
  date.setUTCHours(0, 0, 0, 0)
  const dow = date.getUTCDay() // 0=dim, 1=lun...
  const diff = dow === 0 ? -6 : 1 - dow
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}

/** Offset UTC de la timezone Europe/Paris pour une date donnée (+1 ou +2) */
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

/**
 * Génère un timestamp ISO avec le bon offset Paris (CET +01:00 ou CEST +02:00)
 * ex: "2026-03-18T17:30:00+01:00"
 */
function parisISO(date: Date, hours: number, minutes: number): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(hours).padStart(2, '0')
  const min = String(minutes).padStart(2, '0')
  const offset = parisOffset(date)
  const sign = offset >= 0 ? '+' : '-'
  const offsetStr = `${sign}${String(Math.abs(offset)).padStart(2, '0')}:00`
  return `${y}-${m}-${d}T${h}:${min}:00${offsetStr}`
}

/** Clé unique par jour en UTC : "2026-3-18" */
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

// ─── GET /api/creneaux ────────────────────────────────────────────────────────

export async function GET() {
  const today = new Date()
  const startMonday = getMonday(today)
  const endDate = addDays(startMonday, 28) // 4 semaines exactes

  console.log(`[creneaux] Période : ${startMonday.toISOString()} → ${endDate.toISOString()}`)

  // 1. Créneaux déjà en base pour la période
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('creneaux')
    .select('date_debut')
    .gte('date_debut', startMonday.toISOString())
    .lt('date_debut', endDate.toISOString())

  if (fetchError) {
    console.error('[creneaux] Erreur lecture:', fetchError.message)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  console.log(`[creneaux] ${existing?.length ?? 0} créneau(x) déjà en base`)

  // Jours qui ont déjà au moins un créneau (évite les doublons)
  const daysWithSlots = new Set((existing ?? []).map(c => dayKey(c.date_debut)))

  // 2. Génère les créneaux manquants pour chaque jour lun-ven
  const toInsert: Array<{
    date_debut: string
    date_fin: string
    statut: string
    demande_id: null
  }> = []

  for (let i = 0; i < 28; i++) {
    const day = addDays(startMonday, i)
    const dow = day.getUTCDay()
    if (dow === 0 || dow === 6) continue // week-end

    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}-${day.getUTCDate()}`
    if (daysWithSlots.has(key)) continue // déjà présent

    toInsert.push(
      {
        date_debut: parisISO(day, 17, 30),
        date_fin:   parisISO(day, 18, 30),
        statut: 'disponible',
        demande_id: null,
      },
      {
        date_debut: parisISO(day, 18, 0),
        date_fin:   parisISO(day, 19, 0),
        statut: 'disponible',
        demande_id: null,
      }
    )
  }

  console.log(`[creneaux] ${toInsert.length} créneau(x) à insérer`)

  // 3. Insertion en base
  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('creneaux')
      .insert(toInsert)

    if (insertError) {
      console.error('[creneaux] Erreur insertion:', insertError.message, insertError.code)
      return NextResponse.json({ error: 'Erreur génération créneaux' }, { status: 500 })
    }

    console.log(`[creneaux] ${toInsert.length} créneau(x) insérés avec succès`)
  }

  // 4. Retourne tous les créneaux de la période (dispo + réservés pour griser)
  const { data: creneaux, error: listError } = await supabaseAdmin
    .from('creneaux')
    .select('id, date_debut, date_fin, statut')
    .gte('date_debut', startMonday.toISOString())
    .lt('date_debut', endDate.toISOString())
    .order('date_debut')

  if (listError) {
    console.error('[creneaux] Erreur lecture finale:', listError.message)
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  console.log(`[creneaux] Retourne ${creneaux?.length ?? 0} créneau(x) au total`)

  return NextResponse.json({ creneaux: creneaux ?? [] })
}
