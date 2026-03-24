import { createClient } from '@supabase/supabase-js'

// À n'importer QUE dans les API routes (app/api/*) — jamais dans un composant client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
