import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://slivz.com';
const DEFAULT_TITLE = 'Slivz | Modern Labour Hiring Marketplace';
const DEFAULT_DESCRIPTION =
  'Slivz is a modern labour hiring marketplace with verified profiles, bookings, and real-time chat.';
const DEFAULT_IMAGE = `${SITE_URL}/pwa-512x512.png`;

export const PageSEO = ({ title, description }) => {
  const { pathname } = useLocation();
  const pageTitle = title ? `${title} | Slivz` : DEFAULT_TITLE;
  const pageDescription = description ?? DEFAULT_DESCRIPTION;
  const canonicalUrl = `${SITE_URL}${pathname === '/' ? '' : pathname}`;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Slivz" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  );
};
