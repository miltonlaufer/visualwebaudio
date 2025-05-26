import React from 'react'
import { Helmet } from 'react-helmet-async'

interface SEOHeadProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'music.song' | 'video.other'
  siteName?: string
  author?: string
  keywords?: string[]
  noIndex?: boolean
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'Visual Web Audio (alpha) - Interactive Web Audio API Editor',
  description = 'A dynamic, metadata-driven visual editor for the Web Audio API. Create, connect, and experiment with audio nodes in an intuitive drag-and-drop interface.',
  image = './preview.png',
  url = 'http://visualwebaudio.miltonlaufer.com.ar/',
  type = 'website',
  siteName = 'Visual Web Audio',
  author = 'Milton Laufer',
  keywords = [
    'Web Audio API',
    'Audio Editor',
    'Visual Programming',
    'React',
    'TypeScript',
    'Audio Processing',
    'Music Technology',
    'Interactive Audio',
    'Sound Design',
    'Audio Synthesis',
  ],
  noIndex = false,
}) => {
  // Ensure absolute URL for image
  const absoluteImageUrl = image.startsWith('http')
    ? image
    : `${url.replace(/\/$/, '')}/${image.replace(/^\.?\//, '')}`

  // Ensure absolute URL
  const absoluteUrl = url.startsWith('http') ? url : `https://${url}`

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="author" content={author} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}

      {/* Canonical URL */}
      <link rel="canonical" href={absoluteUrl} />

      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImageUrl} />
      <meta property="og:image:alt" content={`Preview of ${title}`} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImageUrl} />
      <meta name="twitter:image:alt" content={`Preview of ${title}`} />
      <meta name="twitter:creator" content="@miltonlaufer" />
      <meta name="twitter:site" content="@miltonlaufer" />

      {/* Additional Meta Tags for Web Apps */}
      <meta name="application-name" content={siteName} />
      <meta name="theme-color" content="#3b82f6" />
      <meta name="msapplication-TileColor" content="#3b82f6" />

      {/* Structured Data for Rich Snippets */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: siteName,
          description: description,
          url: absoluteUrl,
          image: absoluteImageUrl,
          author: {
            '@type': 'Person',
            name: author,
          },
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Web Browser',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        })}
      </script>
    </Helmet>
  )
}

export default SEOHead
