import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── Helpers date ─────────────────────────────────────────────────────────────

function getLundiDeSemaine(date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=dim, 1=lun...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Groq : liste composants ──────────────────────────────────────────────────

type Composant = { nom: string; quantite: number; unite: string }

async function getComposants(type_travaux: string, surface: string): Promise<Composant[]> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Pour un chantier de peinture : ${type_travaux} surface ${surface}, génère la liste des composants nécessaires avec quantités estimées. Format JSON strict (tableau uniquement, sans texte autour) :
[{ "nom": "", "quantite": 0, "unite": "" }]`,
      }],
      temperature: 0.2,
      max_tokens: 400,
    })
    const raw = completion.choices[0].message.content ?? '[]'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(cleaned) as Composant[]
  } catch (e) {
    console.error('[resume-hebdo] Erreur Groq composants:', e)
    return []
  }
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

type JourRdv = {
  date: Date
  rdvs: Array<{
    client: string
    adresse: string
    type_travaux: string
    composants: Composant[]
  }>
}

function buildResumeEmail(semaine: JourRdv[], dateDebut: Date): string {
  const titre = `Semaine du ${formatDateFR(dateDebut)}`

  const joursHtml = semaine.map(jour => {
    const dateStr = capitalise(formatDateFR(jour.date))

    if (jour.rdvs.length === 0) {
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #E5E3DF;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#1A1A18;">${dateStr}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#9A9A8A;font-style:italic;">Aucun RDV</p>
          </td>
        </tr>`
    }

    const rdvsHtml = jour.rdvs.map(rdv => {
      const composantsHtml = rdv.composants.length > 0
        ? rdv.composants.map(c => `<li style="font-size:12px;color:#5A5A5A;line-height:1.6;">${c.quantite} ${c.unite} — ${c.nom}</li>`).join('')
        : '<li style="font-size:12px;color:#9A9A8A;font-style:italic;">Aucun composant estimé</li>'

      return `
        <div style="margin:8px 0 12px;padding:12px 14px;background:#F7F5F1;border-radius:6px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A1A18;">${rdv.client}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#6A6A60;">${rdv.adresse}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#3A3A3A;">${rdv.type_travaux}</p>
          <ul style="margin:0;padding-left:18px;">${composantsHtml}</ul>
        </div>`
    }).join('')

    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #E5E3DF;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1A1A18;">${dateStr}</p>
          ${rdvsHtml}
        </td>
      </tr>`
  }).join('')

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#1A1A14;padding:28px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Admin</p>
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Résumé hebdomadaire</h1>
                <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">${titre}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${joursHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:18px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;">Osmose · Rapport automatique hebdomadaire</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

// ─── GET /api/cron/resume-hebdo ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  console.log('[resume-hebdo] ── démarrage ──')

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return NextResponse.json({ error: 'ADMIN_EMAIL non configuré' }, { status: 500 })
  }

  // Calcule la plage lundi–vendredi de la semaine courante
  const lundi = getLundiDeSemaine()
  const vendredi = new Date(lundi)
  vendredi.setDate(lundi.getDate() + 4)
  vendredi.setHours(23, 59, 59, 999)

  console.log('[resume-hebdo] semaine:', lundi.toISOString(), '→', vendredi.toISOString())

  // Récupère les créneaux confirmés de la semaine
  const { data: creneaux, error } = await supabaseAdmin
    .from('creneaux')
    .select(`
      id, date_debut,
      demandes (
        adresse_chantier, type_travaux,
        clients ( prenom, nom )
      )
    `)
    .eq('statut', 'confirme')
    .gte('date_debut', lundi.toISOString())
    .lte('date_debut', vendredi.toISOString())
    .order('date_debut', { ascending: true })

  if (error) {
    console.error('[resume-hebdo] Erreur fetch créneaux:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[resume-hebdo] créneaux trouvés:', creneaux?.length ?? 0)

  // Construit les 5 jours de la semaine
  const semaine: JourRdv[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(lundi)
    d.setDate(lundi.getDate() + i)
    return { date: d, rdvs: [] }
  })

  // Pour chaque créneau : génère les composants et rattache au bon jour
  for (const creneau of creneaux ?? []) {
    const dateRdv = new Date(creneau.date_debut as string)
    const jourIdx = Math.min(
      Math.floor((dateRdv.getTime() - lundi.getTime()) / (24 * 60 * 60 * 1000)),
      4
    )

    const demandeRaw = Array.isArray(creneau.demandes) ? creneau.demandes[0] : creneau.demandes
    const clientRaw  = demandeRaw ? (Array.isArray(demandeRaw.clients) ? demandeRaw.clients[0] : demandeRaw.clients) : null
    const client = clientRaw as { prenom: string; nom: string } | null
    const demande = demandeRaw as { adresse_chantier: string; type_travaux: string } | null

    const type_travaux = demande?.type_travaux ?? 'Peinture'
    const adresse      = demande?.adresse_chantier ?? '—'
    const clientNom    = client ? `${client.prenom} ${client.nom}` : '—'

    console.log('[resume-hebdo] traitement RDV:', clientNom, type_travaux)
    const composants = await getComposants(type_travaux, 'non précisée')

    semaine[jourIdx].rdvs.push({
      client:       clientNom,
      adresse,
      type_travaux,
      composants,
    })
  }

  // Envoie le mail
  const html = buildResumeEmail(semaine, lundi)
  await resend.emails.send({
    from:    'Osmose <onboarding@resend.dev>',
    to:      adminEmail,
    subject: `Résumé semaine du ${formatDateFR(lundi)}`,
    html,
  }).catch(err => console.error('[resume-hebdo] Email error:', err))

  const totalRdvs = semaine.reduce((s, j) => s + j.rdvs.length, 0)
  console.log('[resume-hebdo] ── terminé — RDVs traités:', totalRdvs)

  return NextResponse.json({
    ok: true,
    semaine_debut: lundi.toISOString(),
    rdvs_traites:  totalRdvs,
    jours: semaine.map(j => ({ date: formatDateFR(j.date), rdvs: j.rdvs.length })),
  })
}
