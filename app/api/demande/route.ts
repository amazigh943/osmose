import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  prenom: z.string().min(2),
  nom: z.string().min(2),
  email: z.string().email(),
  telephone: z.string().min(10).max(15),
  adresse_chantier: z.string().min(5),
  type_travaux: z.string().min(1),
  surface: z.string().min(1),
  description: z.string().optional(),
})

// ─── Labels ───────────────────────────────────────────────────────────────────

const TRAVAUX_LABELS: Record<string, string> = {
  peinture_interieure: 'Peinture intérieure',
  peinture_exterieure: 'Peinture extérieure',
  ravalement_facade: 'Ravalement façade',
  traitement_humidite: 'Traitement humidité',
  autre: 'Autre',
}

const SURFACE_LABELS: Record<string, string> = {
  moins_30: 'Moins de 30m²',
  '30_80': '30 à 80m²',
  '80_150': '80 à 150m²',
  plus_150: 'Plus de 150m²',
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function buildEmailHtml(data: z.infer<typeof schema>) {
  const travaux = TRAVAUX_LABELS[data.type_travaux] ?? data.type_travaux
  const surface = SURFACE_LABELS[data.surface] ?? data.surface

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3EF;padding:40px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:#0F0F0D;padding:32px 40px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:rgba(255,255,255,0.5);text-transform:uppercase;">
                  Osmose • Peinture & Finitions
                </p>
                <h1 style="margin:8px 0 0;font-size:28px;font-weight:300;color:#FFFFFF;letter-spacing:-0.01em;">
                  Nouvelle demande de devis
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 40px;">

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:24px;border-bottom:1px solid #F0EEE8;">
                      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Client</p>
                      <p style="margin:0;font-size:18px;font-weight:400;color:#1A1A1A;">${data.prenom} ${data.nom}</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 0;border-bottom:1px solid #F0EEE8;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Email</p>
                            <p style="margin:0;font-size:14px;color:#3A3A3A;">
                              <a href="mailto:${data.email}" style="color:#1A1A1A;text-decoration:none;">${data.email}</a>
                            </p>
                          </td>
                          <td width="50%" style="vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Téléphone</p>
                            <p style="margin:0;font-size:14px;color:#3A3A3A;">
                              <a href="tel:${data.telephone}" style="color:#1A1A1A;text-decoration:none;">${data.telephone}</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 0;border-bottom:1px solid #F0EEE8;">
                      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Adresse du chantier</p>
                      <p style="margin:0;font-size:14px;color:#3A3A3A;">${data.adresse_chantier}</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 0;border-bottom:1px solid #F0EEE8;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Type de travaux</p>
                            <p style="margin:0;font-size:14px;color:#3A3A3A;">${travaux}</p>
                          </td>
                          <td width="50%" style="vertical-align:top;">
                            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Surface</p>
                            <p style="margin:0;font-size:14px;color:#3A3A3A;">${surface}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  ${data.description ? `
                  <tr>
                    <td style="padding:20px 0;">
                      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.1em;color:#9A9A8A;text-transform:uppercase;">Description</p>
                      <p style="margin:0;font-size:14px;color:#3A3A3A;line-height:1.6;white-space:pre-wrap;">${data.description}</p>
                    </td>
                  </tr>
                  ` : ''}
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F5F3EF;padding:20px 40px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9A9A8A;letter-spacing:0.08em;">
                  Osmose • Artisan peintre Île-de-France
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    // 2. Validation zod
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      console.error('[api/demande] Validation échouée:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    console.log('[api/demande] Données validées, email:', data.email)

    // 3. Vérifier si le client existe déjà
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('email', data.email)
      .maybeSingle()

    if (fetchError) {
      console.error('[api/demande] Erreur SELECT clients:', fetchError)
      return NextResponse.json(
        { error: 'Erreur recherche client', detail: fetchError.message, code: fetchError.code },
        { status: 500 }
      )
    }

    // 4. Créer le client si absent
    let clientId: string

    if (existing) {
      clientId = existing.id
      console.log('[api/demande] Client existant, id:', clientId)
    } else {
      const { data: newClient, error: insertClientError } = await supabaseAdmin
        .from('clients')
        .insert({
          nom: data.nom,
          prenom: data.prenom,
          email: data.email,
          telephone: data.telephone,
        })
        .select('id')
        .single()

      if (insertClientError || !newClient) {
        console.error('[api/demande] Erreur INSERT clients:', insertClientError)
        return NextResponse.json(
          { error: 'Erreur création client', detail: insertClientError?.message, code: insertClientError?.code },
          { status: 500 }
        )
      }
      clientId = newClient.id
      console.log('[api/demande] Nouveau client créé, id:', clientId)
    }

    // 5. Créer la demande
    // Note: surface n'est pas une colonne de la table demandes — transmis uniquement par email
    const { data: demande, error: demandeError } = await supabaseAdmin
      .from('demandes')
      .insert({
        client_id: clientId,
        adresse_chantier: data.adresse_chantier,
        type_travaux: data.type_travaux,
        description: data.description ?? null,
        statut: 'nouvelle',
      })
      .select('id')
      .single()

    if (demandeError || !demande) {
      console.error('[api/demande] Erreur INSERT demandes:', demandeError)
      return NextResponse.json(
        { error: 'Erreur création demande', detail: demandeError?.message, code: demandeError?.code },
        { status: 500 }
      )
    }

    console.log('[api/demande] Demande créée, id:', demande.id)

    // 6. Email admin (non bloquant)
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      sendMail({
        to: adminEmail,
        subject: `Nouvelle demande de devis — ${data.prenom} ${data.nom}`,
        html: buildEmailHtml(data),
      }).catch(emailErr => {
        console.error('[api/demande] Erreur envoi email admin (non bloquant):', emailErr)
      })
    }

    return NextResponse.json({ id: demande.id }, { status: 201 })

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('[api/demande] Erreur inattendue:', error)
    return NextResponse.json(
      { error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    )
  }
}
