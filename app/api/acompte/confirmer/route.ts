import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token requis' }, { status: 400 })

  // Récupérer la demande via le token
  const { data: demande, error: errFind } = await supabaseAdmin
    .from('demandes')
    .select('id, statut_acompte, montant_acompte, adresse_chantier, clients(prenom, nom, email)')
    .eq('token_acompte', token)
    .maybeSingle()

  if (errFind) {
    console.error('[acompte/confirmer] find error:', errFind.message)
    return NextResponse.json({ error: errFind.message }, { status: 500 })
  }

  if (!demande) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 404 })
  }

  if (demande.statut_acompte === 'confirme') {
    return NextResponse.json({ ok: true, already: true })
  }

  // Mettre à jour la demande
  const { error: errUpdate } = await supabaseAdmin
    .from('demandes')
    .update({ statut_acompte: 'confirme', statut: 'accepte' })
    .eq('id', demande.id)

  if (errUpdate) {
    console.error('[acompte/confirmer] update error:', errUpdate.message)
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  // Mettre à jour dernier_chantier sur le client
  const clientData = demande.clients as unknown as { prenom: string; nom: string; email: string } | null
  if (clientData) {
    const { data: clientRow } = await supabaseAdmin
      .from('demandes')
      .select('client_id')
      .eq('id', demande.id)
      .single()
    if (clientRow?.client_id) {
      await supabaseAdmin
        .from('clients')
        .update({ dernier_chantier: new Date().toISOString(), relance_envoyee: false })
        .eq('id', clientRow.client_id)
    }
  }

  const client = demande.clients as unknown as { prenom: string; nom: string; email: string } | null
  const nomClient = client ? `${client.prenom} ${client.nom}` : 'Client'
  const adminEmail = process.env.ADMIN_EMAIL!

  // Mail de confirmation au client
  if (client?.email) {
    const toClient = adminEmail
    const htmlClient = `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8" /></head>
      <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="background:#1A1A14;padding:28px 40px;">
                  <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Peinture</p>
                  <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Chantier confirmé ✓</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 16px;font-size:14px;color:#1A1A18;">Bonjour ${nomClient},</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#5A5A5A;line-height:1.7;">
                    Nous avons bien reçu votre confirmation d'acompte de <strong style="color:#1A1A18;">${(demande.montant_acompte ?? 0).toFixed(2)} €</strong>.
                  </p>
                  <p style="margin:0 0 0;font-size:14px;color:#5A5A5A;line-height:1.7;">
                    Votre chantier au <strong style="color:#1A1A18;">${demande.adresse_chantier}</strong> est maintenant confirmé.
                    Nous reviendrons vers vous prochainement pour finaliser les détails.
                  </p>
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
    await sendMail({
      to:      toClient,
      subject: 'Votre chantier Osmose est confirmé',
      html:    htmlClient,
    }).catch(err => console.error('[acompte/confirmer] client email error:', err))
  }

  // Mail de notification à l'admin
  const htmlAdmin = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#1A1A14;padding:28px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Admin</p>
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Acompte confirmé — Chantier validé</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;font-size:12px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;width:140px;">Client</td>
                    <td style="padding:8px 0;font-size:14px;color:#1A1A18;">${nomClient}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Adresse</td>
                    <td style="padding:8px 0;font-size:14px;color:#1A1A18;">${demande.adresse_chantier}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Acompte</td>
                    <td style="padding:8px 0;font-size:14px;color:#1A1A18;font-weight:500;">${(demande.montant_acompte ?? 0).toFixed(2)} €</td>
                  </tr>
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
  await sendMail({
    to:      adminEmail,
    subject: `Acompte confirmé — Chantier ${nomClient} validé`,
    html:    htmlAdmin,
  }).catch(err => console.error('[acompte/confirmer] admin email error:', err))

  console.log('[acompte/confirmer] demande', demande.id, 'passée à accepte')

  return NextResponse.json({ ok: true })
}
