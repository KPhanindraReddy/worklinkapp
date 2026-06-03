import { useEffect, useState } from 'react';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';

export const ProfileAvatar = ({
  src,
  name,
  alt,
  className = '',
  imgClassName = 'h-full w-full object-cover',
  fallback = 'U',
  loading = 'lazy',
  decoding = 'async'
}) => {
  const [imageError, setImageError] = useState(false);
  const hasImage = Boolean(src && !imageError);
  const fallbackSrc = buildProfileAvatarDataUrl(name, fallback);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-brand-600 ${className}`}>
      {hasImage ? (
        <img
          src={src}
          alt={alt || (name ? `${name} profile` : 'Profile')}
          className={imgClassName}
          loading={loading}
          decoding={decoding}
          onError={() => setImageError(true)}
        />
      ) : (
        <img
          src={fallbackSrc}
          alt={alt || (name ? `${name} profile` : 'Profile')}
          className={imgClassName}
          loading={loading}
          decoding={decoding}
        />
      )}
    </div>
  );
};
