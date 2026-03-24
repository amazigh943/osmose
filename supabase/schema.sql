-- Osmose Database Schema
-- Exécuter dans le SQL Editor de Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  prenom text not null,
  email text not null unique,
  telephone text,
  created_at timestamptz default now()
);

create table if not exists demandes (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) not null,
  adresse_chantier text not null,
  type_travaux text not null,
  description text,
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'en_attente', 'rdv_planifie', 'planifie', 'devis_envoye', 'accepte', 'refuse', 'termine')),
  created_at timestamptz default now()
);

create table if not exists creneaux (
  id uuid primary key default uuid_generate_v4(),
  demande_id uuid references demandes(id),  -- nullable : null = disponible
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  statut text not null default 'disponible'
    check (statut in ('disponible', 'reserve', 'bloque')),
  created_at timestamptz default now()
);

create table if not exists devis (
  id uuid primary key default uuid_generate_v4(),
  demande_id uuid references demandes(id) not null,
  montant_ht numeric not null,
  tva numeric not null default 10,
  fichier_url text,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'envoye', 'accepte', 'refuse')),
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  contenu text not null,
  created_at timestamptz default now()
);

-- ─── Migration : abandon Google Calendar ──────────────────────────────────────

-- Rendre demande_id nullable (créneaux disponibles sans demande associée)
alter table creneaux alter column demande_id drop not null;

-- Supprimer les colonnes Google Calendar
alter table creneaux drop column if exists google_event_id;
alter table creneaux drop column if exists confirme;

-- Ajouter la colonne statut si elle n'existe pas
alter table creneaux add column if not exists statut text
  default 'disponible'
  check (statut in ('disponible', 'reserve', 'bloque'));

-- ─── Migration : clients — relances anciens clients ──────────────────────────

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS dernier_chantier timestamptz,
ADD COLUMN IF NOT EXISTS relance_envoyee boolean default false,
ADD COLUMN IF NOT EXISTS date_relance timestamptz;

-- ─── Photos chantier ──────────────────────────────────────────────────────────

-- Bucket Storage "photos" (public) — à exécuter via Supabase Dashboard ou CLI :
-- insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
-- on conflict (id) do nothing;

create table if not exists photos_chantier (
  id uuid primary key default uuid_generate_v4(),
  demande_id uuid references demandes(id) on delete cascade not null,
  type text not null check (type in ('avant', 'pendant', 'apres')),
  url text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Politique RLS : accès public en lecture (bucket public), écriture via service role
create policy if not exists "Photos lisibles publiquement"
  on photos_chantier for select using (true);

