const errorCodeMap = {
  'auth/email-already-in-use': 'This email is already connected to another Slivz account.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/invalid-credential': 'Your login details were not accepted. Please try again.',
  'auth/weak-password': 'Use a stronger password with at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google login popup was closed before finishing.',
  'auth/popup-blocked': 'The login popup was blocked by the browser. Allow popups for this site and try again.',
  'auth/cancelled-popup-request': 'Another login popup replaced the previous one. Try again once.',
  'auth/account-exists-with-different-credential':
    'This email already belongs to another sign-in method. Use that method first, then connect Google later.',
  'auth/credential-already-in-use':
    'This phone number is already linked to another login account. Delete that duplicate phone-only account in Firebase Auth, then link it here.',
  'auth/provider-already-linked':
    'This phone number is already linked to your account.',
  'auth/operation-not-allowed':
    'This login method is not enabled in Firebase Authentication yet.',
  'auth/operation-not-supported-in-this-environment':
    'This browser blocked the popup flow. Slivz will switch to a redirect-based login instead.',
  'auth/too-many-requests': 'Too many attempts were detected. Please wait and try again.',
  'auth/quota-exceeded': 'SMS quota was exceeded. Please wait and try again later.',
  'auth/unauthorized-domain':
    'This domain is not approved in Firebase Authentication. Add it to the authorized domains list and try again.',
  'auth/invalid-verification-code': 'The OTP code is invalid. Please check and retry.',
  'auth/missing-verification-code': 'Enter the OTP code before verifying.',
  'auth/code-expired': 'This OTP has expired. Send a new OTP and try again.',
  'auth/session-expired': 'The OTP session expired. Send a new OTP and try again.',
  'auth/missing-phone-number': 'Add a valid phone number with country code.',
  'auth/invalid-phone-number': 'Enter a valid phone number before sending OTP.',
  'auth/captcha-check-failed': 'reCAPTCHA verification failed. Refresh the page and send OTP again.',
  'auth/invalid-app-credential': 'The phone verification session expired. Refresh the page and send OTP again.',
  'auth/requires-recent-login': 'For security, sign out and sign in again with email, then link the phone.',
  internal:
    'Phone profile login failed on the server. Deploy the latest function, then check Firebase Functions logs if it continues.',
  unauthenticated: 'Please sign in again before continuing.',
  'failed-precondition':
    'Firestore needs the latest rules or indexes. Deploy Firebase rules and indexes, then try again.',
  'permission-denied':
    'Firestore permissions are blocking this action. Deploy the Slivz Firestore rules or switch the database to test mode while setting up.'
};

export const getFirebaseErrorMessage = (error) => {
  const rawMessage = String(error?.message || '');

  if (/cannot read properties of undefined.*path/i.test(rawMessage)) {
    return 'Some booking details were missing. Choose a service and available labour, then try again.';
  }

  return errorCodeMap[error?.code] ?? rawMessage ?? 'Something went wrong. Please try again.';
};
