export type LigneDevis = {
  description: string
  quantite: number
  unite: string
  prix_unitaire: number
}

export type DevisData = {
  numero: string
  date: string       // "18/03/2026"
  validite: string   // "17/04/2026"
  client: {
    prenom: string
    nom: string
    email: string
    telephone: string | null
    adresse_chantier: string
  }
  type_travaux: string
  lignes: LigneDevis[]
  tva_taux: number
  sous_total_ht: number
  montant_tva: number
  total_ttc: number
}
