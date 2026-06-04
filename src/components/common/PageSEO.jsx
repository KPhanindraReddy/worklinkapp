import { Helmet } from 'react-helmet-async';

export const PageSEO = ({ title, description }) => (
  <Helmet>
    <title>{title ? `${title} | Slivz` : 'Slivz | Modern Labour Hiring Marketplace'}</title>
    <meta
      name="description"
      content={
        description ??
        'Slivz is a modern labour hiring marketplace with verified profiles, bookings, and real-time chat.'
      }
    />
  </Helmet>
);

