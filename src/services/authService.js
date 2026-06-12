import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getRedirectResult,
  linkWithPhoneNumber,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { appleProvider, googleProvider } from '../firebase/authProviders';
import { auth } from '../firebase/config';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { isHiddenAdminAccount } from '../utils/adminAccount';
import { normalizeCoordinates } from '../utils/location';
import { buildProfileAvatarDataUrl } from '../utils/profileAvatar';
import { normalizeFirebaseAuthPhoneNumber, normalizeWhatsAppPhoneNumber } from '../utils/phone';
import {
  clearRedirectContext,
  getCurrentAppPath,
  readRedirectContext,
  storeRedirectContext
} from '../utils/oauthRedirectContext';

let recaptchaVerifier = null;

const shouldUseRedirectAuth = () => false;
const getCreatedAtValue = (user) =>
  user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : serverTimestamp();

const resolveAccountRole = (user, formValues = {}, existingProfile = null) => {
  if (existingProfile?.role === 'admin' || isHiddenAdminAccount(user, formValues, existingProfile)) {
    return 'admin';
  }

  return existingProfile?.role || formValues.role || '';
};

const startRedirectAuthentication = async (provider, redirectContext) => {
  storeRedirectContext({
    ...redirectContext,
    resumePath: redirectContext.resumePath || getCurrentAppPath()
  });
  await signInWithRedirect(auth, provider);
  return null;
};

const authenticateWithProvider = async (provider, redirectContext = {}) => {
  if (shouldUseRedirectAuth()) {
    return startRedirectAuthentication(provider, redirectContext);
  }

  try {
    const credentials = await signInWithPopup(auth, provider);
    clearRedirectContext();
    return credentials.user;
  } catch (error) {
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      return startRedirectAuthentication(provider, redirectContext);
    }

    throw error;
  }
};

const buildBaseProfile = (user, formValues = {}, existingProfile = null) => {
  const resolvedRole = resolveAccountRole(user, formValues, existingProfile);
  const isHiddenAdmin = isHiddenAdminAccount(user, formValues, existingProfile);
  const fullName = isHiddenAdmin
    ? 'admin'
    : formValues.fullName || existingProfile?.fullName || user.displayName || '';
  const profilePhotoUrl =
    formValues.profilePhotoUrl ||
    formValues.profilePhoto ||
    existingProfile?.profilePhoto ||
    buildProfileAvatarDataUrl(fullName);

  return {
    uid: user.uid,
    fullName,
    phoneNumber: normalizeWhatsAppPhoneNumber(
      existingProfile?.phoneNumber || user.phoneNumber || formValues.phoneNumber
    ),
    email: isHiddenAdmin ? 'admin@gmail.com' : existingProfile?.email || user.email || formValues.email || '',
    profilePhoto: profilePhotoUrl,
    role: resolvedRole,
    location: formValues.currentLocation || formValues.location || existingProfile?.location || '',
    coordinates:
      normalizeCoordinates(formValues.coordinates) ||
      normalizeCoordinates(existingProfile?.coordinates) ||
      null,
    accountStatus: existingProfile?.accountStatus || 'active',
    verified: existingProfile?.verified ?? false,
    updatedAt: serverTimestamp()
  };
};

export const getOrCreateRecaptchaVerifier = (containerId = 'recaptcha-container') => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Authentication is not configured yet.');
  }

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible'
    });
  }

  return recaptchaVerifier;
};

const clearRecaptchaVerifier = () => {
  try {
    recaptchaVerifier?.clear();
  } catch (error) {
    // Firebase may already have torn down the verifier after a failed attempt.
  }

  recaptchaVerifier = null;
};

export const registerWithEmail = async ({ email, password, fullName }) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Add Firebase keys in .env before using email signup.');
  }

  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  if (fullName) {
    await updateProfile(credentials.user, { displayName: fullName });
  }

  if (!credentials.user.emailVerified) {
    await sendEmailVerification(credentials.user);
  }

  return credentials.user;
};

export const loginWithEmail = async ({ email, password }) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Add Firebase keys in .env before using email login.');
  }

  const credentials = await signInWithEmailAndPassword(auth, email, password);
  return credentials.user;
};

export const loginWithGoogle = async (context = {}) => {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    throw new Error('Add Firebase keys in .env before using Google login.');
  }

  return authenticateWithProvider(googleProvider, {
    ...context,
    provider: 'google.com'
  });
};

export const loginWithApple = async (context = {}) => {
  if (!isFirebaseConfigured || !auth || !appleProvider) {
    throw new Error('Add Firebase keys in .env before using Apple login.');
  }

  return authenticateWithProvider(appleProvider, {
    ...context,
    provider: 'apple.com'
  });
};

export const beginGoogleLogin = async (context = {}) => {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    throw new Error('Add Firebase keys in .env before using Google login.');
  }

  return authenticateWithProvider(googleProvider, {
    ...context,
    provider: 'google.com'
  });
};

export const beginAppleLogin = async (context = {}) => {
  if (!isFirebaseConfigured || !auth || !appleProvider) {
    throw new Error('Add Firebase keys in .env before using Apple login.');
  }

  return authenticateWithProvider(appleProvider, {
    ...context,
    provider: 'apple.com'
  });
};

export const getPendingRedirectContext = () => readRedirectContext();

export const consumeRedirectAuthResult = async () => {
  if (!auth) {
    return null;
  }

  const redirectContext = readRedirectContext();

  try {
    const credentials = await getRedirectResult(auth);

    if (!credentials?.user) {
      return null;
    }

    const providerId =
      credentials.providerId ||
      credentials.user.providerData.find((provider) => provider?.providerId)?.providerId ||
      redirectContext?.provider ||
      '';

    return {
      context: redirectContext,
      providerId,
      user: credentials.user
    };
  } finally {
    clearRedirectContext();
  }
};

export const sendPhoneOtp = async (phoneNumber) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Add Firebase keys in .env before using phone OTP login.');
  }

  const verifier = getOrCreateRecaptchaVerifier();
  try {
    return await signInWithPhoneNumber(auth, normalizeFirebaseAuthPhoneNumber(phoneNumber), verifier);
  } catch (error) {
    clearRecaptchaVerifier();
    throw error;
  }
};

export const sendPhoneLinkOtp = async (phoneNumber) => {
  if (!isFirebaseConfigured || !auth?.currentUser) {
    throw new Error('Create or sign in to your email account before linking phone OTP.');
  }

  const verifier = getOrCreateRecaptchaVerifier();
  try {
    return await linkWithPhoneNumber(auth.currentUser, normalizeFirebaseAuthPhoneNumber(phoneNumber), verifier);
  } catch (error) {
    clearRecaptchaVerifier();
    throw error;
  }
};

export const sendPasswordReset = async (email) => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Add Firebase keys in .env before using password reset.');
  }

  await sendPasswordResetEmail(auth, email);
};

export const verifyPhoneOtp = async (confirmationResult, code, { requireExistingProfile = false } = {}) => {
  const credential = await confirmationResult.confirm(code);

  if (requireExistingProfile && !credential.user?.phoneNumber) {
    await signOut(auth);
    throw new Error('Phone login did not return a verified phone number.');
  }

  return credential.user;
};

export const verifyPhoneLinkOtp = async (confirmationResult, code) => {
  const credential = await confirmationResult.confirm(code);
  return credential.user;
};

const normalizeCommaSeparated = (value) =>
  Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const hasFormValue = (values, key) => Object.prototype.hasOwnProperty.call(values ?? {}, key);

const getFormValue = (values, key, fallback = '') =>
  hasFormValue(values, key) ? values[key] : fallback;

const getNumericFormValue = (values, key, fallback = 0, { emptyAsNull = false } = {}) => {
  if (!hasFormValue(values, key)) {
    return fallback;
  }

  const value = values[key];

  if (value === '' || value === null || value === undefined) {
    return emptyAsNull ? null : 0;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const createBaseUserProfile = async (user, formValues = {}) => {
  if (!isFirebaseConfigured || !db || !user) {
    throw new Error('Firebase must be configured before profile creation.');
  }

  const userRef = doc(db, 'users', user.uid);
  const existingUserSnapshot = await getDoc(userRef);
  const existingUser = existingUserSnapshot.exists() ? existingUserSnapshot.data() : null;
  const mergedValues = {
    ...existingUser,
    ...formValues
  };
  const resolvedRole = resolveAccountRole(user, mergedValues, existingUser);
  const baseProfile = {
    ...buildBaseProfile(
      user,
      {
        ...mergedValues,
        role: resolvedRole
      },
      existingUser
    ),
    profileComplete: resolvedRole === 'admin' ? true : existingUser?.profileComplete ?? false,
    createdAt: existingUser?.createdAt ?? getCreatedAtValue(user)
  };

  await setDoc(userRef, baseProfile, { merge: true });
  return baseProfile;
};

export const createOrUpdateUserProfile = async (user, formValues) => {
  if (!isFirebaseConfigured || !db || !user) {
    throw new Error('Firebase must be configured before profile creation.');
  }

  const userRef = doc(db, 'users', user.uid);
  const labourRef = doc(db, 'labours', user.uid);
  const clientRef = doc(db, 'clients', user.uid);
  const existingUserSnapshot = await getDoc(userRef);
  const existingUser = existingUserSnapshot.exists() ? existingUserSnapshot.data() : null;
  const resolvedRole = resolveAccountRole(user, formValues, existingUser);
  const mergedBaseValues = {
    ...existingUser,
    ...formValues,
    role: resolvedRole
  };
  const baseProfile = {
    ...buildBaseProfile(user, mergedBaseValues, existingUser),
    role: resolvedRole,
    coordinates:
      normalizeCoordinates(formValues.coordinates) ||
      normalizeCoordinates(existingUser?.coordinates) ||
      null,
    accountStatus: existingUser?.accountStatus || 'active',
    verified: existingUser?.verified ?? false,
    profileComplete: true
  };

  await setDoc(
    userRef,
    {
      ...baseProfile,
      createdAt: existingUser?.createdAt ?? getCreatedAtValue(user)
    },
    { merge: true }
  );

  if (resolvedRole === 'labour') {
    const existingLabourSnapshot = await getDoc(labourRef);
    const existingLabour = existingLabourSnapshot.exists() ? existingLabourSnapshot.data() : null;
    const labourProfileFields = {
      category:
        getFormValue(formValues, 'category', existingLabour?.category) ||
        normalizeCommaSeparated(
          getFormValue(formValues, 'skills', existingLabour?.skills || formValues.category || '')
        )[0] ||
        '',
      gender: getFormValue(formValues, 'gender', existingLabour?.gender || ''),
      age: getNumericFormValue(formValues, 'age', existingLabour?.age ?? null, { emptyAsNull: true }),
      education: getFormValue(formValues, 'education', existingLabour?.education || ''),
      experienceYears: getNumericFormValue(
        formValues,
        'experienceYears',
        existingLabour?.experienceYears ?? 0
      ),
      skills: hasFormValue(formValues, 'skills')
        ? normalizeCommaSeparated(formValues.skills || formValues.category)
        : (existingLabour?.skills ?? []),
      languages: hasFormValue(formValues, 'languages')
        ? normalizeCommaSeparated(formValues.languages)
        : (existingLabour?.languages ?? []),
      currentLocation: getFormValue(
        formValues,
        'currentLocation',
        existingLabour?.currentLocation || existingUser?.location || ''
      ),
      coordinates:
        normalizeCoordinates(formValues.coordinates) ||
        normalizeCoordinates(existingLabour?.coordinates) ||
        normalizeCoordinates(existingUser?.coordinates) ||
        null,
      about: getFormValue(formValues, 'about', existingLabour?.about || ''),
      availability: getFormValue(
        formValues,
        'availability',
        existingLabour?.availability || 'Available'
      ),
      dailyWage: getNumericFormValue(formValues, 'dailyWage', existingLabour?.dailyWage ?? 0),
      previousWorkHistory: hasFormValue(formValues, 'previousWorkHistory')
        ? normalizeCommaSeparated(formValues.previousWorkHistory)
        : (existingLabour?.previousWorkHistory ?? [])
    };

    if (!labourProfileFields.currentLocation.trim()) {
      throw new Error('Current location is required for labour profiles.');
    }

    await setDoc(
      labourRef,
      {
        ...baseProfile,
        ...labourProfileFields,
        verified: existingLabourSnapshot.exists() ? (existingLabour?.verified ?? false) : false,
        rating: existingLabour?.rating ?? 0,
        reviewsCount: existingLabour?.reviewsCount ?? 0,
        completedJobs: existingLabour?.completedJobs ?? 0
      },
      { merge: true }
    );

    await setDoc(
      userRef,
      {
        ...labourProfileFields,
        location: labourProfileFields.currentLocation || baseProfile.location || ''
      },
      { merge: true }
    );

    return {
      ...baseProfile,
      ...labourProfileFields,
      location: labourProfileFields.currentLocation || baseProfile.location || ''
    };
  }

  if (resolvedRole === 'client') {
    const existingClientSnapshot = await getDoc(clientRef);
    const existingClient = existingClientSnapshot.exists() ? existingClientSnapshot.data() : null;
    const clientProfileFields = {
      gender: getFormValue(formValues, 'gender', existingClient?.gender || ''),
      age: getNumericFormValue(formValues, 'age', existingClient?.age ?? null, { emptyAsNull: true })
    };

    await setDoc(
      clientRef,
      {
        ...baseProfile,
        ...clientProfileFields,
        coordinates:
          normalizeCoordinates(formValues.coordinates) ||
          normalizeCoordinates(existingClient?.coordinates) ||
          normalizeCoordinates(existingUser?.coordinates) ||
          null,
        savedLabours: existingClient?.savedLabours ?? []
      },
      { merge: true }
    );

    await setDoc(userRef, clientProfileFields, { merge: true });

    return {
      ...baseProfile,
      ...clientProfileFields
    };
  }

  return baseProfile;
};

export const logoutUser = async () => {
  if (!auth) {
    return;
  }

  await signOut(auth);
};
