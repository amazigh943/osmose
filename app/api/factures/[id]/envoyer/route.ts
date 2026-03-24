import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: facture, error } = await supabaseAdmin
    .from('factures')
    .select('id, numero, statut, client_nom, client_email, montant_ttc, montant_acompte, montant_paye')
    .eq('id', params.id)
    .single()

  if (error || !facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  // Télécharger le PDF depuis le storage
  const filename = `${facture.numero}.pdf`
  const { data: blob, error: dlError } = await supabaseAdmin.storage
    .from('factures')
    .download(filename)

  if (dlError || !blob) {
    console.error('[factures/envoyer] download error:', dlError?.message)
    return NextResponse.json({ error: 'PDF introuvable dans le storage' }, { status: 404 })
  }

  const pdfBuffer  = Buffer.from(await blob.arrayBuffer())
  const resteAPayer = Math.max(0, facture.montant_ttc - facture.montant_paye)

  // Mettre à jour statut si soldée
  if (facture.montant_paye >= facture.montant_ttc && facture.statut !== 'soldee') {
    await supabaseAdmin.from('factures').update({ statut: 'soldee' }).eq('id', params.id)
  }

  const toEmail = process.env.ADMIN_EMAIL!

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#1A1A14;padding:32px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Peinture</p>
                <h1 style="margin:8px 0 0;font-size:26px;font-weight:300;color:#FFFFFF;">Votre facture</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 16px;font-size:14px;color:#1A1A18;">Bonjour ${facture.client_nom ?? ''},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#5A5A5A;line-height:1.7;">
                  Veuillez trouver ci-joint votre facture <strong style="color:#1A1A18;">${facture.numero}</strong>
                  pour les travaux réalisés.
                </p>
                <table width="100%" cellpadding="16" cellspacing="0" style="background:#F5F3EF;border-radius:6px;margin-bottom:24px;">
                  <tr>
                    <td style="border-bottom:1px solid #E5E3DF;padding-bottom:12px;">
                      <p style="margin:0 0 3px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Montant TTC</p>
                      <p style="margin:0;font-size:18px;color:#1A1A18;">${facture.montant_ttc.toFixed(2)} €</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-bottom:1px solid #E5E3DF;padding:12px 0;">
                      <p style="margin:0 0 3px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Acompte versé</p>
                      <p style="margin:0;font-size:18px;color:#4ADE80;">− ${facture.montant_acompte.toFixed(2)} €</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px;">
                      <p style="margin:0 0 3px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Reste à payer</p>
                      <p style="margin:0;font-size:24px;font-weight:600;color:#1A1A18;">${resteAPayer.toFixed(2)} €</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:13px;color:#9A9A8A;line-height:1.6;">
                  Le PDF de votre facture est joint à cet email. Merci pour votre confiance.
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

  await resend.emails.send({
    from:        'Osmose <onboarding@resend.dev>',
    to:          toEmail,
    subject:     `Facture Osmose – ${facture.numero}`,
    html,
    attachments: [{ filename, content: pdfBuffer }],
  }).catch(err => console.error('[factures/envoyer] email error:', err))

  console.log('[factures/envoyer]', facture.numero, '→', toEmail)
  return NextResponse.json({ ok: true })
}
