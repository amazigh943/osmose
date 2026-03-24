import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: facture, error } = await supabaseAdmin
    .from('factures')
    .select('id, numero, montant_ttc, client_nom, client_email')
    .eq('id', params.id)
    .single()

  if (error || !facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  await supabaseAdmin
    .from('factures')
    .update({ statut: 'soldee', montant_paye: facture.montant_ttc })
    .eq('id', params.id)

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
              <td style="background:#1A1A14;padding:28px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Peinture</p>
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Reçu de paiement</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 16px;font-size:14px;color:#1A1A18;">Bonjour ${facture.client_nom ?? ''},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#5A5A5A;line-height:1.7;">
                  Nous confirmons la réception du règlement complet de la facture
                  <strong style="color:#1A1A18;">${facture.numero}</strong>.
                </p>
                <div style="background:#F5F3EF;border-radius:6px;padding:24px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0 0 4px;font-size:11px;color:#9A9A8A;text-transform:uppercase;letter-spacing:0.08em;">Montant soldé</p>
                  <p style="margin:0;font-size:36px;font-weight:300;color:#1A1A18;">${facture.montant_ttc.toFixed(2)} €</p>
                </div>
                <p style="margin:0;font-size:13px;color:#9A9A8A;line-height:1.6;">
                  Merci pour votre confiance. Ce règlement solde intégralement votre facture.
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
    from:    'Osmose <onboarding@resend.dev>',
    to:      toEmail,
    subject: `Règlement confirmé — Facture ${facture.numero} soldée`,
    html,
  }).catch(err => console.error('[factures/solder] email error:', err))

  console.log('[factures/solder]', facture.numero, 'soldée')
  return NextResponse.json({ ok: true })
}
