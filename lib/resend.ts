import { Resend } from 'resend'

// Utilise un placeholder si la clé est absente pour éviter un crash au chargement du module.
// L'envoi échouera silencieusement (attrapé par .catch() dans les routes) tant que la clé n'est pas configurée.
export const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder')
