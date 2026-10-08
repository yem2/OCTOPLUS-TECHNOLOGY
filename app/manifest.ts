import type { MetadataRoute } from 'next'

// Rend l'application installable sur téléphone (« Ajouter à l'écran d'accueil »).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OCTOPLUS TECHNOLOGY Gestion RH',
    short_name: 'OCTOPLUS RH',
    description: 'Pointage, congés, paie et documents des employés.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1F1F24',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
