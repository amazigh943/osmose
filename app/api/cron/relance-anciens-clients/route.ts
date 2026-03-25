import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

// ─── Templates email ──────────────────────────────────────────────────────────

function buildEmailClient(prenom: string, appUrl: string): string {
  const rdvUrl = `${appUrl}/creneaux`
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#1A1A14;padding:32px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Peinture &amp; Finitions</p>
                <h1 style="margin:8px 0 0;font-size:24px;font-weight:300;color:#FFFFFF;">Un coup de frais pour votre intérieur ?</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 16px;font-size:15px;color:#3A3A3A;line-height:1.7;">Bonjour ${prenom},</p>
                <p style="margin:0 0 16px;font-size:15px;color:#5A5A5A;line-height:1.7;">
                  Il y a presque un an, nous avons réalisé vos travaux de peinture. Le printemps approche — c'est le moment idéal pour rafraîchir votre intérieur ou votre extérieur.
                </p>
                <p style="margin:0 0 28px;font-size:15px;color:#5A5A5A;line-height:1.7;">
                  Nous vous offrons une <strong style="color:#1A1A18;">visite gratuite</strong> pour établir un nouveau devis, sans engagement.
                </p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#1A1A14;border-radius:4px;">
                      <a href="${rdvUrl}" style="display:inline-block;padding:14px 28px;font-size:13px;letter-spacing:0.08em;color:#FFFFFF;text-decoration:none;text-transform:uppercase;">
                        Prendre rendez-vous →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:18px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;">Osmose · Peinture artisanale en Île-de-France</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

function buildRecapAdmin(clients: Array<{ prenom: string; nom: string; email: string }>): string {
  const lignes = clients.map(c =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:14px;color:#1A1A18;">${c.prenom} ${c.nom}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:14px;color:#5A5A5A;">${c.email}</td>
    </tr>`
  ).join('')

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
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Relances anciens clients — ${clients.length} envoi(s)</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 20px;font-size:14px;color:#5A5A5A;line-height:1.6;">
                  Les clients suivants ont été relancés automatiquement :
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E3DF;border-radius:6px;overflow:hidden;">
                  <tr style="background:#F5F3EF;">
                    <th style="padding:10px 14px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;text-align:left;">Client</th>
                    <th style="padding:10px 14px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;text-align:left;">Email</th>
                  </tr>
                  ${lignes}
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:18px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;">Osmose · Notification automatique</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

// ─── GET /api/cron/relance-anciens-clients ────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Seuil : il y a 11 mois
  const seuil = new Date()
  seuil.setMonth(seuil.getMonth() - 11)

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, prenom, nom, email, dernier_chantier')
    .eq('relance_envoyee', false)
    .not('dernier_chantier', 'is', null)
    .lte('dernier_chantier', seuil.toISOString())

  if (error) {
    console.error('[relance-anciens-clients] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[relance-anciens-clients] clients éligibles:', clients?.length ?? 0)

  const relances: Array<{ prenom: string; nom: string; email: string }> = []

  for (const client of clients ?? []) {
    const html = buildEmailClient(client.prenom, appUrl)

    await sendMail({
      to: adminEmail ?? client.email, // en prod: client.email
      subject: 'On pense à vous — Un coup de frais pour votre intérieur ?',
      html,
    }).catch(err => console.error('[relance-anciens-clients] email error:', client.email, err))

    await supabaseAdmin
      .from('clients')
      .update({ relance_envoyee: true, date_relance: new Date().toISOString() })
      .eq('id', client.id)

    relances.push({ prenom: client.prenom, nom: client.nom, email: client.email })
    console.log('[relance-anciens-clients] relancé:', client.email)
  }

  // Récap admin
  if (adminEmail && relances.length > 0) {
    await sendMail({
      to: adminEmail,
      subject: `Relances anciens clients — ${relances.length} mail(s) envoyé(s)`,
      html: buildRecapAdmin(relances),
    }).catch(err => console.error('[relance-anciens-clients] recap error:', err))
  }

  console.log('[relance-anciens-clients] terminé — relancés:', relances.length)
  return NextResponse.json({ relances: relances.length, clients: relances.map(c => `${c.prenom} ${c.nom}`) })
}
