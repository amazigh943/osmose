'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans    = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

// ─── Types ────────────────────────────────────────────────────────────────────

type Composant = {
  id: string
  nom: string
  reference: string | null
  quantite: number
  unite: string
  seuil_alerte: number
  prix_unitaire: number
}

type ModalMode = 'create' | 'edit'

// ─── Styles partagés ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  color: '#FFFFFF',
  fontSize: '13px',
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: '6px',
  display: 'block',
}

const PRODUITS_DEFAUT = [
  { nom: 'Peinture blanche mur',        reference: null, quantite: 0, unite: 'L', seuil_alerte: 20, prix_unitaire: 8.50 },
  { nom: 'Peinture blanche plafond',    reference: null, quantite: 0, unite: 'L', seuil_alerte: 10, prix_unitaire: 9.00 },
  { nom: 'Rouleau 22cm',                reference: null, quantite: 0, unite: 'u', seuil_alerte:  5, prix_unitaire: 4.50 },
  { nom: 'Bâche de protection 3x3m',    reference: null, quantite: 0, unite: 'u', seuil_alerte:  3, prix_unitaire: 6.00 },
  { nom: 'Scotch de masquage',          reference: null, quantite: 0, unite: 'u', seuil_alerte:  5, prix_unitaire: 2.50 },
  { nom: 'Enduit de rebouchage 1kg',    reference: null, quantite: 0, unite: 'u', seuil_alerte:  4, prix_unitaire: 7.00 },
  { nom: 'White spirit 1L',             reference: null, quantite: 0, unite: 'u', seuil_alerte:  3, prix_unitaire: 5.00 },
  { nom: 'Pinceau plat 5cm',            reference: null, quantite: 0, unite: 'u', seuil_alerte:  3, prix_unitaire: 3.50 },
]

function getStatut(q: number, seuil: number): { label: string; color: string; bg: string } {
  if (q === 0)      return { label: 'Rupture',      color: '#F87171', bg: 'rgba(248,113,113,0.15)' }
  if (q <= seuil)   return { label: 'Stock faible', color: '#FB923C', bg: 'rgba(251,146,60,0.15)' }
  return               { label: 'Stock OK',      color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' }
}

const EMPTY_FORM = { nom: '', reference: '', quantite: 0, unite: 'u', seuil_alerte: 0, prix_unitaire: 0 }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const router = useRouter()
  const [composants, setComposants] = useState<Composant[]>([])
  const [loading, setLoading]       = useState(true)
  const [adjusting, setAdjusting]   = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)

  // Modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalMode, setModalMode]   = useState<ModalMode>('create')
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/admin')
    })
  }, [router])

  // ── Fetch ──
  const fetchStock = async () => {
    setLoading(true)
    const res = await fetch('/api/stock')
    if (res.ok) setComposants(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchStock() }, [])

  // ── Ajustement quantité ──
  const adjustQuantite = async (id: string, delta: number) => {
    const current = composants.find(c => c.id === id)
    if (!current) return
    const newQty = Math.max(0, current.quantite + delta)
    setAdjusting(id)
    setComposants(prev => prev.map(c => c.id === id ? { ...c, quantite: newQty } : c))
    await fetch(`/api/stock/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantite: newQty }),
    })
    setAdjusting(null)
  }

  // ── Initialisation stock de base ──
  const handleInitialiser = async () => {
    setInitializing(true)
    for (const p of PRODUITS_DEFAUT) {
      await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
    }
    await fetchStock()
    setInitializing(false)
  }

  // ── Modal ──
  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setModalMode('create')
    setSaveError(null)
    setModalOpen(true)
  }

  const openEdit = (c: Composant) => {
    setForm({ nom: c.nom, reference: c.reference ?? '', quantite: c.quantite, unite: c.unite, seuil_alerte: c.seuil_alerte, prix_unitaire: c.prix_unitaire })
    setEditId(c.id)
    setModalMode('edit')
    setSaveError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const payload = { ...form, reference: form.reference || null }
    const res = modalMode === 'create'
      ? await fetch('/api/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch(`/api/stock/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    if (res.ok) {
      setModalOpen(false)
      await fetchStock()
    } else {
      const d = await res.json()
      setSaveError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!editId) return
    setSaving(true)
    await fetch(`/api/stock/${editId}`, { method: 'DELETE' })
    setModalOpen(false)
    await fetchStock()
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin')
    router.refresh()
  }

  const f = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#0F0F0D', color: '#FFFFFF' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span className={cormorant.className} style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.01em' }}>Osmose</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { href: '/admin/dashboard', label: 'Demandes' },
              { href: '/admin/calendrier', label: 'Calendrier' },
              { href: '/admin/stock', label: 'Stock' },
              { href: '/admin/factures', label: 'Factures' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: '12px', letterSpacing: '0.06em', color: href === '/admin/stock' ? '#FFFFFF' : 'rgba(255,255,255,0.4)', textDecoration: 'none', padding: '5px 10px', borderRadius: '3px', background: href === '/admin/stock' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {composants.length === 0 && !loading && (
            <button
              onClick={handleInitialiser}
              disabled={initializing}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {initializing ? 'Initialisation…' : 'Initialiser le stock de base'}
            </button>
          )}
          <button
            onClick={openCreate}
            style={{ background: '#FFFFFF', border: 'none', borderRadius: '3px', color: '#0F0F0D', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + Ajouter un produit
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', color: 'rgba(255,255,255,0.45)', fontSize: '12px', letterSpacing: '0.06em', padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Contenu */}
      <main style={{ padding: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '28px' }}>
          <h2 className={cormorant.className} style={{ margin: 0, fontSize: '28px', fontWeight: 300 }}>Stock de composants</h2>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>{composants.length} produit{composants.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>Chargement…</div>
        ) : composants.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginBottom: '20px' }}>Aucun produit en stock.</p>
            <button
              onClick={handleInitialiser}
              disabled={initializing}
              style={{ background: '#FFFFFF', border: 'none', borderRadius: '4px', color: '#0F0F0D', fontSize: '12px', letterSpacing: '0.08em', padding: '12px 24px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {initializing ? 'Initialisation…' : 'Initialiser le stock de base'}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Produit', 'Référence', 'Quantité', 'Unité', 'Seuil alerte', 'Prix unitaire', 'Statut', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {composants.map((c, i) => {
                  const statut = getStatut(c.quantite, c.seuil_alerte)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', opacity: adjusting === c.id ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 400 }}>{c.nom}</td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.4)' }}>{c.reference ?? '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => adjustQuantite(c.id, -1)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '3px', color: '#FFFFFF', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 400 }}>{c.quantite}</span>
                          <button onClick={() => adjustQuantite(c.id, +1)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '3px', color: '#FFFFFF', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.5)' }}>{c.unite}</td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.5)' }}>{c.seuil_alerte}</td>
                      <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.7)' }}>{f(c.prix_unitaire)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: statut.bg, color: statut.color, border: `1px solid ${statut.color}33`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', letterSpacing: '0.04em' }}>
                          {statut.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => openEdit(c)}
                          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.06em', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                        >
                          Modifier
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal ajout / édition */}
      {modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#1A1A18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '440px', padding: '32px', fontFamily: dmSans.style.fontFamily }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400 }}>
                {modalMode === 'create' ? 'Ajouter un produit' : 'Modifier le produit'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nom du produit *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inputStyle} placeholder="Ex: Peinture blanche mur" onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Référence</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} style={inputStyle} placeholder="Ex: REF-001" onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Quantité</label>
                  <input type="number" min="0" step="1" value={form.quantite} onChange={e => setForm(f => ({ ...f, quantite: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, textAlign: 'right' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={labelStyle}>Unité *</label>
                  <input value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} style={inputStyle} placeholder="L, u, kg, m²…" onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Seuil alerte</label>
                  <input type="number" min="0" step="1" value={form.seuil_alerte} onChange={e => setForm(f => ({ ...f, seuil_alerte: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, textAlign: 'right' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={labelStyle}>Prix unitaire (€)</label>
                  <input type="number" min="0" step="0.01" value={form.prix_unitaire} onChange={e => setForm(f => ({ ...f, prix_unitaire: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, textAlign: 'right' }} onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
              </div>
            </div>

            {saveError && <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#F87171' }}>{saveError}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={handleSave} disabled={saving || !form.nom || !form.unite} style={{ flex: 1, background: saving ? 'rgba(255,255,255,0.7)' : '#FFFFFF', color: '#0F0F0D', border: 'none', borderRadius: '4px', padding: '12px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {modalMode === 'edit' && (
                <button onClick={handleDelete} disabled={saving} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', color: '#F87171', padding: '12px 16px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
