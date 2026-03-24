'use client'

import type { DevisData } from '@/types/devis'

function eur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €'
}

export default function DevisPreview({ data }: { data: DevisData }) {
  return (
    <div style={{
      background: '#FFFFFF',
      color: '#1A1A18',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: '9pt',
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      padding: '0',
    }}>
      {/* En-tête */}
      <div style={{ background: '#1A1A14', padding: '28px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '22pt', fontWeight: 700, color: '#FFFFFF', letterSpacing: '3px' }}>OSMOSE</div>
          <div style={{ fontSize: '8pt', color: '#9A9A88', letterSpacing: '1px', marginTop: '4px' }}>Artisan peintre — Ile-de-France</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18pt', fontWeight: 700, color: '#FFFFFF', letterSpacing: '2px' }}>DEVIS</div>
          <div style={{ fontSize: '8pt', color: '#A0A090', marginTop: '5px', lineHeight: '1.7' }}>
            <div>N° {data.numero}</div>
            <div>Date : {data.date}</div>
            <div>Valable jusqu'au : {data.validite}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 40px' }}>
        {/* Infos client / chantier */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1, background: '#F7F5F1', borderRadius: '4px', padding: '14px' }}>
            <div style={{ fontSize: '7pt', color: '#6A6A60', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '7px' }}>Destinataire</div>
            <div style={{ fontWeight: 700, fontSize: '11pt', color: '#1A1A14', marginBottom: '4px' }}>{data.client.prenom} {data.client.nom}</div>
            <div style={{ color: '#1A1A18', lineHeight: '1.6' }}>{data.client.email}</div>
            {data.client.telephone && <div style={{ color: '#1A1A18' }}>{data.client.telephone}</div>}
          </div>
          <div style={{ flex: 1, background: '#F7F5F1', borderRadius: '4px', padding: '14px' }}>
            <div style={{ fontSize: '7pt', color: '#6A6A60', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '7px' }}>Chantier</div>
            <div style={{ fontWeight: 700, fontSize: '11pt', color: '#1A1A14', marginBottom: '4px' }}>{data.type_travaux}</div>
            <div style={{ color: '#1A1A18', lineHeight: '1.6' }}>{data.client.adresse_chantier}</div>
          </div>
        </div>

        {/* Tableau prestations */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <thead>
            <tr style={{ background: '#1A1A14' }}>
              {['Description', 'Qté', 'Unité', 'P.U. HT', 'Total HT'].map((h, i) => (
                <th key={h} style={{ padding: '8px 10px', fontSize: '7pt', color: '#FFFFFF', letterSpacing: '0.8px', fontWeight: 700, textAlign: i === 0 ? 'left' : 'right' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.lignes.map((l, i) => (
              <tr key={i} style={{ background: i % 2 !== 0 ? '#F4F3EF' : '#FFFFFF', borderBottom: '0.5px solid #E5E3DF' }}>
                <td style={{ padding: '8px 10px', fontSize: '9pt' }}>{l.description || '—'}</td>
                <td style={{ padding: '8px 10px', fontSize: '9pt', textAlign: 'right' }}>{l.quantite}</td>
                <td style={{ padding: '8px 10px', fontSize: '9pt', textAlign: 'right', color: '#6A6A60' }}>{l.unite}</td>
                <td style={{ padding: '8px 10px', fontSize: '9pt', textAlign: 'right' }}>{eur(l.prix_unitaire)}</td>
                <td style={{ padding: '8px 10px', fontSize: '9pt', textAlign: 'right' }}>{eur(l.quantite * l.prix_unitaire)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #E5E3DF' }}>
          <div style={{ width: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '9pt' }}>
              <span style={{ color: '#6A6A60' }}>Sous-total HT</span>
              <span>{eur(data.sous_total_ht)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '9pt' }}>
              <span style={{ color: '#6A6A60' }}>TVA ({data.tva_taux} %)</span>
              <span>{eur(data.montant_tva)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1A1A14', borderRadius: '3px', padding: '9px 12px', marginTop: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '10pt', color: '#FFFFFF', letterSpacing: '0.5px' }}>TOTAL TTC</span>
              <span style={{ fontWeight: 700, fontSize: '10pt', color: '#FFFFFF' }}>{eur(data.total_ttc)}</span>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #E5E3DF' }}>
          <div style={{ fontSize: '7.5pt', color: '#6A6A60', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700 }}>Conditions</div>
          <div style={{ fontSize: '8.5pt', color: '#6A6A60', lineHeight: '1.7' }}>
            Devis valable 30 jours à compter de sa date d'émission. Acompte de 30 % à la commande.<br />
            TVA non récupérable sur les travaux d'amélioration de l'habitat (taux réduit applicable).<br />
            Ce devis vaut contrat dès acceptation et signature par le client.
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '24px', paddingTop: '9px', borderTop: '0.5px solid #E5E3DF', display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', color: '#9A9A8A' }}>
          <span>Osmose · Artisan peintre certifié · Ile-de-France</span>
          <span>SIRET : 000 000 000 00000 · contact@osmose.fr</span>
        </div>
      </div>
    </div>
  )
}
