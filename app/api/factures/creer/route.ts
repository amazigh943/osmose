import { NextRequest, NextResponse } from 'next/server'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

type Ligne = { description: string; quantite: number; unite: string; prix_unitaire: number }

// ─── PDF Facture ──────────────────────────────────────────────────────────────

function generateFacturePdf(data: {
  numero: string
  date: string
  date_echeance: string
  client_nom: string
  client_email: string
  client_telephone: string | null
  adresse_chantier: string
  type_travaux: string
  lignes: Ligne[]
  montant_ht: number
  tva_taux: number
  montant_tva: number
  montant_ttc: number
  montant_acompte: number
  devis_numero: string
}): Buffer {
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
  doc.text('FACTURE', W - 15, 18, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 144)
  doc.text(`N\u00B0 ${data.numero}`, W - 15, 25, { align: 'right' })
  doc.text(`Date : ${data.date}`, W - 15, 30, { align: 'right' })
  doc.text(`\u00C9ch\u00E9ance : ${data.date_echeance}`, W - 15, 35, { align: 'right' })

  // ── Client / Chantier ──
  const infoY = 52

  doc.setFillColor(247, 245, 241)
  doc.roundedRect(15, infoY, 85, 38, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(106, 106, 96)
  doc.text('DESTINATAIRE', 20, infoY + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 26, 20)
  doc.text(data.client_nom, 20, infoY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(26, 26, 24)
  doc.text(data.client_email, 20, infoY + 23)
  if (data.client_telephone) doc.text(data.client_telephone, 20, infoY + 29)

  doc.setFillColor(247, 245, 241)
  doc.roundedRect(105, infoY, 90, 38, 2, 2, 'F')
  doc.setFontSize(7)
  doc.setTextColor(106, 106, 96)
  doc.text('CHANTIER', 110, infoY + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 26, 20)
  doc.text(data.type_travaux || 'Travaux', 110, infoY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(26, 26, 24)
  const adresseLines = doc.splitTextToSize(data.adresse_chantier, 80)
  doc.text(adresseLines, 110, infoY + 23)

  // Ref devis
  doc.setFontSize(8)
  doc.setTextColor(154, 154, 136)
  doc.text(`R\u00E9f. devis : ${data.devis_numero}`, 15, infoY + 44)

  // ── Tableau ──
  const tableY = infoY + 50

  autoTable(doc, {
    startY: tableY,
    head: [['Description', 'Qté', 'Unité', 'P.U. HT', 'Total HT']],
    body: data.lignes.map(l => [
      l.description || '—',
      String(l.quantite),
      l.unite,
      eur(l.prix_unitaire),
      eur(l.quantite * l.prix_unitaire),
    ]),
    headStyles: { fillColor: [26, 26, 20], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', halign: 'right' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 'auto' },
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
  const totauxW = 72

  doc.setDrawColor(229, 227, 223)
  doc.setLineWidth(0.3)
  doc.line(totauxX - totauxW, finalY, totauxX, finalY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(106, 106, 96)
  doc.text('Sous-total HT', totauxX - totauxW, finalY + 7)
  doc.setTextColor(26, 26, 24)
  doc.text(eur(data.montant_ht), totauxX, finalY + 7, { align: 'right' })

  doc.setTextColor(106, 106, 96)
  doc.text(`TVA (${data.tva_taux} %)`, totauxX - totauxW, finalY + 14)
  doc.setTextColor(26, 26, 24)
  doc.text(eur(data.montant_tva), totauxX, finalY + 14, { align: 'right' })

  doc.setTextColor(106, 106, 96)
  doc.text('Total TTC', totauxX - totauxW, finalY + 21)
  doc.setTextColor(26, 26, 24)
  doc.text(eur(data.montant_ttc), totauxX, finalY + 21, { align: 'right' })

  doc.line(totauxX - totauxW, finalY + 24, totauxX, finalY + 24)

  doc.setTextColor(106, 106, 96)
  doc.text('Acompte vers\u00E9 (60%)', totauxX - totauxW, finalY + 30)
  doc.setTextColor(74, 200, 120)
  doc.text('- ' + eur(data.montant_acompte), totauxX, finalY + 30, { align: 'right' })

  const resteAPayer = Math.max(0, data.montant_ttc - data.montant_acompte)
  doc.setFillColor(26, 26, 20)
  doc.roundedRect(totauxX - totauxW - 2, finalY + 33, totauxW + 4, 12, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('RESTE \u00C0 PAYER', totauxX - totauxW + 2, finalY + 41)
  doc.text(eur(resteAPayer), totauxX - 2, finalY + 41, { align: 'right' })

  // ── Conditions ──
  const condY = finalY + 53
  doc.setDrawColor(229, 227, 223)
  doc.line(15, condY, W - 15, condY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(106, 106, 96)
  doc.text('CONDITIONS DE R\u00C8GLEMENT', 15, condY + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(26, 26, 24)
  const conditions = `Paiement a reception de facture. Reglement par virement bancaire ou cheque a l'ordre d'Osmose.\nEn cas de retard, penalites de 3x le taux legal en vigueur. Date d'echeance : ${data.date_echeance}`
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

// ─── POST /api/factures/creer ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { demande_id } = await req.json()
  if (!demande_id) return NextResponse.json({ error: 'demande_id requis' }, { status: 400 })

  // Demande + acompte + client
  const { data: demande, error: errDemande } = await supabaseAdmin
    .from('demandes')
    .select('id, adresse_chantier, montant_acompte, clients(prenom, nom, email, telephone)')
    .eq('id', demande_id)
    .single()

  if (errDemande || !demande) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  // Dernier devis
  const { data: devis, error: errDevis } = await supabaseAdmin
    .from('devis')
    .select('id, numero, montant_ht, tva_taux, montant_ttc, lignes, duree_chantier, adresse_chantier')
    .eq('demande_id', demande_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errDevis || !devis) {
    return NextResponse.json({ error: 'Aucun devis associé à cette demande' }, { status: 400 })
  }

  // Numéro FAC-MMAA-NNN
  const now = new Date()
  const mm  = String(now.getMonth() + 1).padStart(2, '0')
  const aa  = String(now.getFullYear()).slice(2)
  const { count } = await supabaseAdmin.from('factures').select('*', { count: 'exact', head: true })
  const seq    = String((count ?? 0) + 1).padStart(3, '0')
  const numero = `FAC-${mm}${aa}-${seq}`

  const client        = demande.clients as unknown as { prenom: string; nom: string; email: string; telephone: string | null } | null
  const montant_acompte = demande.montant_acompte ?? 0
  const montant_ht   = devis.montant_ht ?? 0
  const tva_taux     = devis.tva_taux ?? 10
  const montant_tva  = Math.round(montant_ht * tva_taux / 100 * 100) / 100
  const montant_ttc  = devis.montant_ttc ?? 0
  const lignes       = (devis.lignes ?? []) as Ligne[]

  const dateStr      = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const echeanceDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const echeanceStr  = echeanceDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const echeanceISO  = echeanceDate.toISOString().split('T')[0]

  // Génère PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = generateFacturePdf({
      numero,
      date:             dateStr,
      date_echeance:    echeanceStr,
      client_nom:       client ? `${client.prenom} ${client.nom}` : '',
      client_email:     client?.email ?? '',
      client_telephone: client?.telephone ?? null,
      adresse_chantier: demande.adresse_chantier ?? '',
      type_travaux:     devis.duree_chantier ?? '',
      lignes,
      montant_ht,
      tva_taux,
      montant_tva,
      montant_ttc,
      montant_acompte,
      devis_numero:     devis.numero,
    })
  } catch (err) {
    console.error('[factures/creer] PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }

  // Upload Storage
  const filename = `${numero}.pdf`
  const { error: storageError } = await supabaseAdmin
    .storage.from('factures')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (storageError) {
    console.error('[factures/creer] Storage error:', storageError.message)
    return NextResponse.json({ error: 'Erreur upload PDF : ' + storageError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('factures').getPublicUrl(filename)

  // Insertion
  const { data: facture, error: errInsert } = await supabaseAdmin
    .from('factures')
    .insert({
      demande_id,
      devis_id:         devis.id,
      numero,
      client_nom:       client ? `${client.prenom} ${client.nom}` : null,
      client_email:     client?.email ?? null,
      client_telephone: client?.telephone ?? null,
      adresse_chantier: demande.adresse_chantier ?? null,
      type_travaux:     devis.duree_chantier ?? null,
      lignes,
      montant_ht,
      tva_taux,
      montant_tva,
      montant_ttc,
      montant_acompte,
      montant_paye:     montant_acompte,
      statut:           montant_acompte >= montant_ttc ? 'soldee' : 'emise',
      date_echeance:    echeanceISO,
      pdf_url:          publicUrl,
    })
    .select('id')
    .single()

  if (errInsert) {
    console.error('[factures/creer] DB error:', errInsert.message)
    return NextResponse.json({ error: errInsert.message }, { status: 500 })
  }

  console.log('[factures/creer] facture créée:', numero)
  return NextResponse.json({ ok: true, facture_id: facture.id })
}
