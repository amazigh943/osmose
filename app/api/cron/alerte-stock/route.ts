import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

function buildAlerteEmail(
  produits: Array<{ nom: string; reference: string | null; quantite: number; seuil_alerte: number; unite: string }>
): string {
  const lignes = produits.map(p => {
    const statut = p.quantite === 0 ? 'Rupture' : 'Stock faible'
    const couleur = p.quantite === 0 ? '#F87171' : '#FB923C'
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#1A1A18;">${p.nom}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#6A6A60;">${p.reference ?? '—'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#1A1A18;text-align:right;">${p.quantite} ${p.unite}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#6A6A60;text-align:right;">seuil : ${p.seuil_alerte}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #E5E3DF;text-align:center;">
          <span style="background:${couleur}22;color:${couleur};font-size:11px;padding:3px 10px;border-radius:20px;">${statut}</span>
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
          <table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#1A1A14;padding:28px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">Osmose · Stock</p>
                <h1 style="margin:8px 0 0;font-size:22px;font-weight:300;color:#FFFFFF;">Alerte stock — Produits à réapprovisionner</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 20px;font-size:14px;color:#5A5A5A;line-height:1.6;">
                  Les produits suivants nécessitent un réapprovisionnement :
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E3DF;border-radius:6px;overflow:hidden;">
                  <thead>
                    <tr style="background:#F5F3EF;">
                      <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Produit</th>
                      <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Référence</th>
                      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Qté</th>
                      <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Seuil</th>
                      <th style="padding:10px 14px;text-align:center;font-size:11px;letter-spacing:0.08em;color:#9A9A8A;text-transform:uppercase;font-weight:400;">Statut</th>
                    </tr>
                  </thead>
                  <tbody>${lignes}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:18px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;">Osmose · Alerte stock automatique</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  console.log('[alerte-stock] ── démarrage ──')

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return NextResponse.json({ error: 'ADMIN_EMAIL non configuré' }, { status: 500 })

  const { data, error } = await supabaseAdmin
    .from('stock_composants')
    .select('nom, reference, quantite, seuil_alerte, unite')
    .or('quantite.eq.0,quantite.lte.seuil_alerte')
    .order('quantite', { ascending: true })

  if (error) {
    console.error('[alerte-stock] Erreur fetch:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filtre côté JS pour garantir quantite <= seuil_alerte (Supabase ne supporte pas col vs col)
  const produits = (data ?? []).filter(p => p.quantite <= p.seuil_alerte)

  console.log('[alerte-stock] produits en alerte:', produits.length)

  if (produits.length === 0) {
    console.log('[alerte-stock] aucune alerte — aucun mail envoyé')
    return NextResponse.json({ ok: true, alertes: 0 })
  }

  await sendMail({
    to:      adminEmail,
    subject: 'Alerte stock Osmose — Produits à réapprovisionner',
    html:    buildAlerteEmail(produits),
  }).catch(err => console.error('[alerte-stock] Email error:', err))

  console.log('[alerte-stock] ── terminé — alertes envoyées:', produits.length)
  return NextResponse.json({ ok: true, alertes: produits.length, produits: produits.map(p => p.nom) })
}
