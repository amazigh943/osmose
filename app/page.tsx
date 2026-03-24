'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300'] })

export default function Home() {
  const [showChat, setShowChat] = useState(false)

  return (
    <main
      className={dmSans.className}
      style={{ background: '#0F0F0D', minHeight: '100vh' }}
    >
      {/* Hero plein écran */}
      <div
        style={{
          position: 'relative',
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Image de fond */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1600)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.65))',
          }}
        />

        {/* Contenu centré */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            padding: '0 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Label */}
          <span style={{
            fontFamily: dmSans.style.fontFamily,
            fontSize: '11px',
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.55)',
            textTransform: 'uppercase',
            display: 'block',
          }}>
            Artisan peintre • Île-de-France
          </span>

          {/* Titre */}
          <h1
            className={cormorant.className}
            style={{
              fontSize: 'clamp(64px, 10vw, 96px)',
              fontWeight: 300,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              lineHeight: 1,
              marginTop: '16px',
            }}
          >
            Osmose
          </h1>

          {/* Sous-titre */}
          <p style={{
            fontFamily: dmSans.style.fontFamily,
            fontSize: '18px',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.75)',
            marginTop: '20px',
            lineHeight: 1.5,
          }}>
            Votre devis peinture, sans attendre.
          </p>

          {/* Trait */}
          <div style={{
            width: '40px',
            height: '1px',
            background: 'rgba(255,255,255,0.3)',
            margin: '28px auto',
          }} />

          {/* Boutons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full" style={{ maxWidth: '280px' }}>
            <Link
              href="/demande"
              style={{
                display: 'block',
                flex: 1,
                background: '#FFFFFF',
                color: '#0F0F0D',
                padding: '15px 36px',
                borderRadius: '2px',
                fontSize: '13px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textAlign: 'center',
                textDecoration: 'none',
                transition: 'opacity 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Prendre rendez-vous
            </Link>

            <button
              onClick={() => setShowChat(true)}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#FFFFFF',
                padding: '15px 36px',
                borderRadius: '2px',
                fontSize: '13px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, opacity 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)')}
            >
              Une question ?
            </button>
          </div>
        </div>

        {/* Texte bas de page */}
        <div style={{
          position: 'absolute',
          bottom: '32px',
          left: 0,
          right: 0,
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Devis gratuit • Déplacement offert • Île-de-France
          </span>
        </div>
      </div>

      {/* Modale chat */}
      {showChat && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 50,
          }}
        >
          <div style={{
            background: '#1A1A17',
            border: '1px solid rgba(255,255,255,0.08)',
            width: '100%',
            maxWidth: '440px',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '8px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Assistant Osmose
              </span>
              <button
                onClick={() => setShowChat(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '40px 20px', minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Le chat IA arrive bientôt.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
