export const normalizeWhatsAppPhoneNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  return digits;
};

export const normalizeFirebaseAuthPhoneNumber = (value) => {
  const phoneNumber = normalizeWhatsAppPhoneNumber(value);

  return phoneNumber ? `+${phoneNumber}` : '';
};
