import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { demande_id } = await req.json()
  if (!demande_id) return NextResponse.json({ error: 'demande_id requis' }, { status: 400 })

  // Récupérer la demande + client
  const { data: demande, error: errDemande } = await supabaseAdmin
    .from('demandes')
    .select('id, statut, adresse_chantier, clients(prenom, nom, email)')
    .eq('id', demande_id)
    .single()

  if (errDemande || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  // Récupérer le dernier devis associé
  const { data: devis, error: errDevis } = await supabaseAdmin
    .from('devis')
    .select('montant_ttc')
    .eq('demande_id', demande_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errDevis || !devis) {
    return NextResponse.json({ error: 'Aucun devis associé à cette demande' }, { status: 400 })
  }

  const montant_acompte = Math.round(devis.montant_ttc * 0.60 * 100) / 100
  const token_acompte = crypto.randomUUID()

  // Sauvegarder token + montant dans la demande
  const { error: errUpdate } = await supabaseAdmin
    .from('demandes')
    .update({ token_acompte, montant_acompte, statut_acompte: 'en_attente' })
    .eq('id', demande_id)

  if (errUpdate) {
    console.error('[acompte/demander] update error:', errUpdate.message)
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  const client = demande.clients as unknown as { prenom: string; nom: string; email: string } | null
  if (!client?.email) {
    return NextResponse.json({ error: 'Email client introuvable' }, { status: 400 })
  }

  const toEmail = process.env.ADMIN_EMAIL!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const lienAcompte = `${appUrl}/acompte/${token_acompte}`
  const nomClient = `${client.prenom} ${client.nom}`

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
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Validation de votre chantier</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 12px;font-size:14px;color:#1A1A18;">Bonjour ${nomClient},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#5A5A5A;line-height:1.7;">
                  Pour confirmer votre chantier au <strong style="color:#1A1A18;">${demande.adresse_chantier}</strong>,
                  nous vous demandons de valider le versement d'un acompte de :
                </p>
                <div style="text-align:center;margin:28px 0;">
                  <p style="margin:0;font-size:40px;font-weight:300;color:#1A1A18;letter-spacing:-0.02em;">
                    ${montant_acompte.toFixed(2)} €
                  </p>
                  <p style="margin:6px 0 0;font-size:12px;color:#9A9A8A;letter-spacing:0.06em;text-transform:uppercase;">
                    Acompte 60% TTC
                  </p>
                </div>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${lienAcompte}" style="display:inline-block;background:#1A1A14;color:#FFFFFF;text-decoration:none;padding:16px 36px;border-radius:4px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">
                    Valider mon acompte →
                  </a>
                </div>
                <p style="margin:24px 0 0;font-size:12px;color:#9A9A8A;line-height:1.6;">
                  Ce lien est personnel et sécurisé. Si vous avez des questions, n'hésitez pas à nous contacter.
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
    to:      toEmail,
    subject: 'Validation de votre chantier Osmose — Acompte requis',
    html,
  }).catch(err => console.error('[acompte/demander] email error:', err))

  console.log('[acompte/demander] token généré, mail envoyé à', toEmail)

  return NextResponse.json({ ok: true, montant_acompte })
}
