const PROFILE_AVATAR_COLORS = ['1d4ed8', '0f766e', '7c3aed', 'b45309'];

export const getInitials = (value, fallback = 'U') =>
  String(value || fallback)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('') || fallback;

export const buildProfileAvatarDataUrl = (fullName, fallback = 'U') => {
  const initials = getInitials(fullName, fallback);
  const paletteIndex = initials.charCodeAt(0) % PROFILE_AVATAR_COLORS.length;
  const baseColor = PROFILE_AVATAR_COLORS[paletteIndex];
  const highlightColor = 'ffffff';
  const safeInitials = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${safeInitials}">
      <defs>
        <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#${baseColor}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="72" fill="url(#avatarGradient)" />
      <circle cx="196" cy="56" r="46" fill="#ffffff14" />
      <circle cx="58" cy="204" r="34" fill="#ffffff14" />
      <text
        x="50%"
        y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="92"
        font-weight="700"
        fill="#${highlightColor}"
      >${safeInitials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
};
