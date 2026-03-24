import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DevisData } from '@/types/devis'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

// ─── Génération PDF ───────────────────────────────────────────────────────────

function generatePdf(devis: DevisData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210

  // ── En-tête ──
  doc.setFillColor(26, 26, 20)
  doc.rect(0, 0, W, 42, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('OSMOSE', 15, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(154, 154, 136)
  doc.text('Artisan peintre  Ile-de-France', 15, 29)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('DEVIS', W - 15, 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 144)
  doc.text(`N\u00B0 ${devis.numero}`, W - 15, 25, { align: 'right' })
  doc.text(`Date : ${devis.date}`, W - 15, 30, { align: 'right' })
  doc.text(`Valable jusqu'au : ${devis.validite}`, W - 15, 35, { align: 'right' })

  // ── Infos client / chantier ──
  const infoY = 52

  // Boîte gauche — destinataire
  doc.setFillColor(247, 245, 241)
  doc.roundedRect(15, infoY, 85, 38, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(106, 106, 96)
  doc.text('DESTINATAIRE', 20, infoY + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 26, 20)
  doc.text(`${devis.client.prenom} ${devis.client.nom}`, 20, infoY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(26, 26, 24)
  doc.text(devis.client.email, 20, infoY + 23)
  if (devis.client.telephone) {
    doc.text(devis.client.telephone, 20, infoY + 29)
  }

  // Boîte droite — chantier
  doc.setFillColor(247, 245, 241)
  doc.roundedRect(105, infoY, 90, 38, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(106, 106, 96)
  doc.text('CHANTIER', 110, infoY + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 26, 20)
  doc.text(devis.type_travaux, 110, infoY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(26, 26, 24)
  const adresseLines = doc.splitTextToSize(devis.client.adresse_chantier, 80)
  doc.text(adresseLines, 110, infoY + 23)

  // ── Tableau des prestations ──
  const tableY = infoY + 46

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qté', 'Unité', 'P.U. HT', 'Total HT']],
    body: devis.lignes.map(l => [
      l.description || '—',
      String(l.quantite),
      l.unite,
      eur(l.prix_unitaire),
      eur(l.quantite * l.prix_unitaire),
    ]),
    headStyles: {
      fillColor: [26, 26, 20],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'right',
    },
    columnStyles: {
      0: { halign: 'left',  cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [244, 243, 239] },
    bodyStyles: { fontSize: 9, textColor: [26, 26, 24] },
    margin: { left: 15, right: 15 },
    styles: { overflow: 'linebreak' },
  })

  // ── Totaux ──
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  const totauxX = W - 15
  const totauxW = 65

  doc.setDrawColor(229, 227, 223)
  doc.setLineWidth(0.3)
  doc.line(totauxX - totauxW, finalY, totauxX, finalY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(106, 106, 96)
  doc.text('Sous-total HT', totauxX - totauxW, finalY + 7)
  doc.setTextColor(26, 26, 24)
  doc.text(eur(devis.sous_total_ht), totauxX, finalY + 7, { align: 'right' })

  doc.setTextColor(106, 106, 96)
  doc.text(`TVA (${devis.tva_taux} %)`, totauxX - totauxW, finalY + 14)
  doc.setTextColor(26, 26, 24)
  doc.text(eur(devis.montant_tva), totauxX, finalY + 14, { align: 'right' })

  doc.setFillColor(26, 26, 20)
  doc.roundedRect(totauxX - totauxW - 2, finalY + 18, totauxW + 4, 12, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL TTC', totauxX - totauxW + 2, finalY + 26)
  doc.text(eur(devis.total_ttc), totauxX - 2, finalY + 26, { align: 'right' })

  // ── Conditions ──
  const condY = finalY + 38
  doc.setDrawColor(229, 227, 223)
  doc.line(15, condY, W - 15, condY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(106, 106, 96)
  doc.text('CONDITIONS', 15, condY + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const conditions = "Devis valable 30 jours a compter de sa date d'emission. Acompte de 30 % a la commande.\nTVA non recuperable sur les travaux d'amelioration de l'habitat (taux reduit applicable).\nCe devis vaut contrat des acceptation et signature par le client."
  doc.text(conditions, 15, condY + 14, { lineHeightFactor: 1.7 })

  // ── Pied de page ──
  const pageH = 297
  doc.setDrawColor(229, 227, 223)
  doc.setLineWidth(0.3)
  doc.line(15, pageH - 16, W - 15, pageH - 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(154, 154, 138)
  doc.text('Osmose  Artisan peintre certifie  Ile-de-France', 15, pageH - 10)
  doc.text('SIRET : 000 000 000 00000  contact@osmose.fr', W - 15, pageH - 10, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function buildDevisEmail(prenom: string, nom: string, numero: string, totalTTC: number): string {
  const total = eur(totalTTC)
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
                <h1 style="margin:8px 0 0;font-size:26px;font-weight:300;color:#FFFFFF;">
                  Votre devis est prêt
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;">
                <p style="margin:0 0 20px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Bonjour ${prenom} ${nom},
                </p>
                <p style="margin:0 0 20px;font-size:15px;color:#3A3A3A;line-height:1.6;">
                  Veuillez trouver ci-joint votre devis <strong>${numero}</strong> pour les travaux demandés.
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
                <p style="margin:0;font-size:14px;color:#8A8A7A;line-height:1.6;">
                  Ce devis est valable 30 jours. Pour l'accepter, il vous suffit de nous le retourner signé.
                  <br />Acompte de 30% à la commande.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F3EF;padding:20px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;letter-spacing:0.08em;">
                  Osmose · Artisan peintre Île-de-France · Devis gratuit
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

// ─── POST /api/devis/generer ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json() as { demande_id?: string | null; devis: DevisData }
  const { demande_id, devis } = body

  console.log('[devis/generer] body reçu:', JSON.stringify({
    demande_id,
    numero:           devis?.numero,
    client:           devis?.client,
    lignes_count:     devis?.lignes?.length,
    montant_ht:       devis?.sous_total_ht,
    montant_ttc:      devis?.total_ttc,
    tva_taux:         devis?.tva_taux,
  }, null, 2))

  if (!devis?.numero) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  // 2. Génère le PDF avec jsPDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = generatePdf(devis)
  } catch (err) {
    console.error('[devis/generer] Erreur generatePdf:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }

  // 3. Upload Supabase Storage
  const filename = `${devis.numero}.pdf`
  const { error: storageError } = await supabaseAdmin
    .storage
    .from('devis')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (storageError) {
    console.error('[devis/generer] Storage error:', storageError.message)
    return NextResponse.json({ error: 'Erreur upload PDF : ' + storageError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('devis').getPublicUrl(filename)

  // 4. Récupère infos demande + client
  let ancienStatut: string | null = null
  let clientEmail: { prenom: string; nom: string; email: string } | null = null

  if (demande_id) {
    const { data: currentDemande } = await supabaseAdmin
      .from('demandes')
      .select('statut, clients(prenom, nom, email)')
      .eq('id', demande_id)
      .single()

    ancienStatut = currentDemande?.statut ?? null
    const rawClients = currentDemande?.clients
    clientEmail = (Array.isArray(rawClients) ? rawClients[0] : rawClients) as { prenom: string; nom: string; email: string } | null
  } else {
    if (devis.client?.email) {
      clientEmail = { prenom: devis.client.prenom, nom: devis.client.nom, email: devis.client.email }
    }
  }

  // 5. Insère dans la table devis
  const insertPayload = {
    ...(demande_id ? { demande_id } : {}),
    numero:           devis.numero,
    montant_ht:       devis.sous_total_ht,
    tva_taux:         devis.tva_taux ?? 10,
    montant_ttc:      devis.total_ttc,
    pdf_url:          publicUrl,
    client_nom:       [devis.client?.nom, devis.client?.prenom].filter(Boolean).join(' ') || null,
    client_email:     devis.client?.email    || null,
    client_telephone: devis.client?.telephone || null,
    adresse_chantier: devis.client?.adresse_chantier || null,
    duree_chantier:   devis.type_travaux      || null,
    lignes:           devis.lignes            ?? [],
  }
  console.log('[devis/generer] insert payload:', JSON.stringify(insertPayload, null, 2))

  const { data: devisRow, error: dbError } = await supabaseAdmin
    .from('devis')
    .insert(insertPayload)
    .select('id')
    .single()

  if (dbError) {
    console.error('[devis/generer] DB error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // 6. Met à jour statut demande
  if (demande_id) {
    await supabaseAdmin
      .from('demandes')
      .update({ statut: 'devis_envoye' })
      .eq('id', demande_id)

    if (ancienStatut !== 'devis_envoye') {
      void supabaseAdmin.from('historique_statuts').insert({
        demande_id,
        ancien_statut:  ancienStatut,
        nouveau_statut: 'devis_envoye',
      })
    }
  }

  // 7. Envoie le mail
  const client = clientEmail
  if (client) {
    const isDev = process.env.NODE_ENV === 'development'
    const toEmail = isDev ? process.env.ADMIN_EMAIL! : client.email
    await resend.emails.send({
      from:    'Osmose <onboarding@resend.dev>',
      to:      toEmail,
      subject: `Votre devis Osmose – ${devis.numero}`,
      html:    buildDevisEmail(client.prenom, client.nom, devis.numero, devis.total_ttc),
      attachments: [{
        filename: filename,
        content:  pdfBuffer,
      }],
    }).catch(err => console.error('[devis/generer] Email error:', err))
  }

  return NextResponse.json({ success: true, devis_id: devisRow.id })
}
