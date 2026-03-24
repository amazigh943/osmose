import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

const schema = z.object({
  demande_id: z.string().uuid(),
  creneau_id: z.string().uuid(),
})

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildConfirmationEmail(prenom: string, nom: string, dateLong: string, heure: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">

            <tr>
              <td style="background:#0F0F0D;padding:32px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">
                  Osmose • Peinture & Finitions
                </p>
                <h1 style="margin:8px 0 0;font-size:26px;font-weight:300;color:#FFFFFF;">
                  Votre rendez-vous est confirmé
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 24px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Bonjour ${prenom} ${nom},
                </p>
                <p style="margin:0 0 24px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Votre rendez-vous pour la visite gratuite de votre chantier a bien été enregistré.
                </p>

                <table width="100%" cellpadding="0" cellspacing="0"
                  style="background:#F5F3EF;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">
                        Date
                      </p>
                      <p style="margin:0;font-size:16px;color:#1A1A1A;font-weight:400;text-transform:capitalize;">
                        ${dateLong}
                      </p>
                    </td>
                  </tr>
                  <tr><td style="padding:12px 0 0;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">
                      Heure
                    </p>
                    <p style="margin:0;font-size:16px;color:#1A1A1A;font-weight:400;">
                      ${heure}
                    </p>
                  </td></tr>
                </table>

                <p style="margin:0;font-size:14px;color:#8A8A7A;line-height:1.6;">
                  Un artisan Osmose se déplacera à l'adresse de votre chantier à l'heure convenue.
                  En cas d'empêchement, contactez-nous par retour de cet email.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background:#F5F3EF;padding:20px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;letter-spacing:0.08em;">
                  Osmose • Artisan peintre Île-de-France • Devis gratuit
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

// ─── POST /api/creneaux/reserver ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Validation
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { demande_id, creneau_id } = parsed.data

  // 2. Vérifier disponibilité du créneau
  const { data: creneau, error: creneauError } = await supabaseAdmin
    .from('creneaux')
    .select('id, date_debut, date_fin, statut')
    .eq('id', creneau_id)
    .single()

  if (creneauError || !creneau) {
    return NextResponse.json({ error: 'Créneau introuvable' }, { status: 404 })
  }

  if (creneau.statut !== 'disponible') {
    return NextResponse.json({ error: 'Créneau non disponible' }, { status: 409 })
  }

  // 3. Réserver le créneau
  const { error: updateCreneauError } = await supabaseAdmin
    .from('creneaux')
    .update({ statut: 'reserve', demande_id })
    .eq('id', creneau_id)

  if (updateCreneauError) {
    return NextResponse.json({ error: 'Erreur réservation' }, { status: 500 })
  }

  // 4. Mettre à jour la demande
  const { error: updateDemandeError } = await supabaseAdmin
    .from('demandes')
    .update({ statut: 'rdv_planifie' })
    .eq('id', demande_id)

  if (updateDemandeError) {
    return NextResponse.json({ error: 'Erreur mise à jour demande' }, { status: 500 })
  }

  // 5. Email de confirmation client (non bloquant)
  const { data: demande } = await supabaseAdmin
    .from('demandes')
    .select('client_id')
    .eq('id', demande_id)
    .single()

  if (demande) {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('prenom, nom, email')
      .eq('id', demande.client_id)
      .single()

    if (client) {
      const dateLong = formatDateLong(creneau.date_debut)
      const heure = formatTime(creneau.date_debut)

      const isDev = process.env.NODE_ENV === 'development'
      const toEmail = isDev ? process.env.ADMIN_EMAIL! : client.email
      await resend.emails.send({
        from: 'Osmose <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Votre RDV Osmose est confirmé',
        html: buildConfirmationEmail(client.prenom, client.nom, dateLong, heure),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
