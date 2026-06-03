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

export const getIndianLocalPhoneNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(2, 12);
  }

  return digits.slice(0, 10);
};

export const normalizeIndianPhoneNumber = (value) => {
  const localNumber = getIndianLocalPhoneNumber(value);

  if (!localNumber) {
    return '';
  }

  return localNumber.length === 10 ? `91${localNumber}` : localNumber;
};

export const normalizeFirebaseAuthPhoneNumber = (value) => {
  const localNumber = getIndianLocalPhoneNumber(value);
  const phoneNumber = localNumber.length === 10 ? `91${localNumber}` : '';

  return phoneNumber ? `+${phoneNumber}` : '';
};
