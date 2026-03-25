import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

// ─── Emails ───────────────────────────────────────────────────────────────────

function buildRelanceClient(prenom: string, nom: string, numero: string, montantTTC: number): string {
  const total = montantTTC.toFixed(2).replace('.', ',') + ' €'
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
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">
                  Osmose · Peinture &amp; Finitions
                </p>
                <h1 style="margin:8px 0 0;font-size:24px;font-weight:300;color:#FFFFFF;">
                  Avez-vous eu le temps d'y réfléchir ?
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 20px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Bonjour ${prenom} ${nom},
                </p>
                <p style="margin:0 0 20px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Nous vous avons envoyé votre devis <strong>${numero}</strong> il y a quelques jours.
                  Avez-vous eu l'occasion d'en prendre connaissance ?
                </p>
                <table width="100%" cellpadding="0" cellspacing="0"
                  style="background:#F5F3EF;border-radius:6px;padding:18px 24px;margin-bottom:24px;">
                  <tr>
                    <td>
                      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Montant TTC</p>
                      <p style="margin:0;font-size:20px;color:#1A1A18;font-weight:600;">${total}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  N'hésitez pas à nous contacter pour toute question ou pour valider votre projet.
                  Nous restons à votre disposition.
                </p>
                <p style="margin:0;font-size:14px;color:#8A8A7A;line-height:1.6;">
                  Ce devis reste valable 30 jours à compter de sa date d'émission.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:20px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;letter-spacing:0.08em;">
                  Osmose · Artisan peintre Île-de-France · contact@osmose.fr
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

function buildRecapAdmin(
  perdus: Array<{ numero: string; nom: string; prenom: string; montant_ttc: number }>
): string {
  const lignes = perdus.map(d =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:14px;color:#1A1A18;">${d.numero}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:14px;color:#1A1A18;">${d.prenom} ${d.nom}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:14px;color:#1A1A18;text-align:right;">${d.montant_ttc.toFixed(2).replace('.', ',')} €</td>
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
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Résumé hebdo — Devis sans suite</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:14px;color:#5A5A5A;line-height:1.6;">
                  Les devis suivants ont été classés <strong>perdus</strong> (aucune réponse après relance) :
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E3DF;border-radius:6px;overflow:hidden;">
                  <thead>
                    <tr style="background:#F5F3EF;">
                      <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Numéro</th>
                      <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Client</th>
                      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>${lignes}</tbody>
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

// ─── GET /api/cron/relances ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth par secret
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  console.log('[cron/relances] ── démarrage ──')

  const adminEmail = process.env.ADMIN_EMAIL
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Récupère tous les devis envoyés depuis plus de 7 jours
  const { data: devis, error } = await supabaseAdmin
    .from('devis')
    .select(`
      id, numero, montant_ttc, created_at,
      demandes (
        id,
        clients ( prenom, nom, email )
      )
    `)
    .eq('statut', 'envoye')
    .lt('created_at', sevenDaysAgo)

  if (error) {
    console.error('[cron/relances] Erreur fetch devis:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[cron/relances] devis éligibles:', devis?.length ?? 0)

  const perdus: Array<{ numero: string; nom: string; prenom: string; montant_ttc: number }> = []
  const relances: string[] = []

  for (const d of devis ?? []) {
    const devisId = d.id
    const numero = d.numero as string
    const montantTTC = (d.montant_ttc as number) ?? 0

    // Récupère client
    const demandeRaw = Array.isArray(d.demandes) ? d.demandes[0] : d.demandes
    const clientRaw  = demandeRaw
      ? (Array.isArray(demandeRaw.clients) ? demandeRaw.clients[0] : demandeRaw.clients)
      : null
    const client = clientRaw as { prenom: string; nom: string; email: string } | null

    // Récupère la relance existante
    const { data: relanceRow } = await supabaseAdmin
      .from('relances')
      .select('id, compteur_relance, statut')
      .eq('devis_id', devisId)
      .maybeSingle()

    const compteur = (relanceRow?.compteur_relance as number) ?? 0

    if (compteur >= 1) {
      // Déjà relancé une fois → perdu
      console.log('[cron/relances] perdu:', numero)

      await supabaseAdmin
        .from('devis')
        .update({ statut: 'perdu' })
        .eq('id', devisId)

      if (relanceRow) {
        await supabaseAdmin
          .from('relances')
          .update({ statut: 'perdu' })
          .eq('id', relanceRow.id)
      } else {
        await supabaseAdmin
          .from('relances')
          .insert({ devis_id: devisId, compteur_relance: compteur, statut: 'perdu' })
      }

      perdus.push({
        numero,
        prenom: client?.prenom ?? '—',
        nom:    client?.nom    ?? '—',
        montant_ttc: montantTTC,
      })

    } else {
      // Pas encore relancé → envoyer mail de relance
      console.log('[cron/relances] relance:', numero, client?.email)

      if (client?.email) {
        const isDev = process.env.NODE_ENV === 'development'
        const toEmail = isDev ? process.env.ADMIN_EMAIL! : client.email
        await sendMail({
          to:      toEmail,
          subject: `Votre devis Osmose — Avez-vous eu le temps d'y réfléchir ?`,
          html:    buildRelanceClient(client.prenom, client.nom, numero, montantTTC),
        }).catch(err => console.error('[cron/relances] Email client error:', err))
      }

      // Met à jour ou insère la relance
      if (relanceRow) {
        await supabaseAdmin
          .from('relances')
          .update({ compteur_relance: 1, statut: 'relance' })
          .eq('id', relanceRow.id)
      } else {
        await supabaseAdmin
          .from('relances')
          .insert({ devis_id: devisId, compteur_relance: 1, statut: 'relance' })
      }

      relances.push(numero)
    }
  }

  // Mail récap admin si des devis sont perdus
  if (perdus.length > 0 && adminEmail) {
    await sendMail({
      to:      adminEmail,
      subject: 'Résumé hebdo — Devis sans suite',
      html:    buildRecapAdmin(perdus),
    }).catch(err => console.error('[cron/relances] Email admin error:', err))
  }

  console.log('[cron/relances] ── terminé — relancés:', relances.length, '— perdus:', perdus.length)

  return NextResponse.json({
    ok: true,
    relances_envoyees: relances,
    devis_perdus: perdus.map(p => p.numero),
  })
}
