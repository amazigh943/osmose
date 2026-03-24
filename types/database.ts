export type StatutDemande = 'nouvelle' | 'en_attente' | 'rdv_planifie' | 'planifie' | 'devis_envoye' | 'accepte' | 'refuse' | 'termine'
export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse'
export type StatutCreneau = 'disponible' | 'reserve' | 'bloque'
export type RoleConversation = 'user' | 'assistant'

export interface Client {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string | null
  created_at: string
}

export interface Demande {
  id: string
  client_id: string
  adresse_chantier: string
  type_travaux: string
  description: string | null
  notes_admin: string | null
  statut: StatutDemande
  created_at: string
}

export interface Creneau {
  id: string
  demande_id: string | null
  date_debut: string
  date_fin: string
  statut: StatutCreneau
  created_at: string
}

export interface Devis {
  id: string
  demande_id: string
  montant_ht: number
  tva: number
  fichier_url: string | null
  statut: StatutDevis
  created_at: string
}

export interface Conversation {
  id: string
  session_id: string
  role: RoleConversation
  contenu: string
  created_at: string
}

export type TypePhoto = 'avant' | 'pendant' | 'apres'

export interface PhotoChantier {
  id: string
  demande_id: string
  type: TypePhoto
  url: string
  storage_path: string
  created_at: string
}

// Types pour les insertions (sans id et created_at)
export type ClientInsert = Omit<Client, 'id' | 'created_at'>
export type DemandeInsert = Omit<Demande, 'id' | 'created_at'>
export type CreneauInsert = Omit<Creneau, 'id' | 'created_at'>
export type DevisInsert = Omit<Devis, 'id' | 'created_at'>
export type ConversationInsert = Omit<Conversation, 'id' | 'created_at'>

// Type Database pour le client Supabase typé
export type Database = {
  public: {
    Tables: {
      clients: {
        Row: Client
        Insert: ClientInsert & { id?: string; created_at?: string }
        Update: Partial<ClientInsert>
        Relationships: []
      }
      demandes: {
        Row: Demande
        Insert: DemandeInsert & { id?: string; created_at?: string }
        Update: Partial<DemandeInsert>
        Relationships: []
      }
      creneaux: {
        Row: Creneau
        Insert: CreneauInsert & { id?: string; created_at?: string }
        Update: Partial<CreneauInsert>
        Relationships: []
      }
      devis: {
        Row: Devis
        Insert: DevisInsert & { id?: string; created_at?: string }
        Update: Partial<DevisInsert>
        Relationships: []
      }
      conversations: {
        Row: Conversation
        Insert: ConversationInsert & { id?: string; created_at?: string }
        Update: Partial<ConversationInsert>
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
