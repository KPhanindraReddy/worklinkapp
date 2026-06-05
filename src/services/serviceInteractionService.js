import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';

const SESSION_KEY_PREFIX = 'slivz-service-interaction';

export const recordServiceInteraction = async ({
  serviceType = '',
  type = 'search',
  source = 'app'
} = {}) => {
  const normalizedService = String(serviceType || '').trim();
  const normalizedType = String(type || 'search').trim();

  if (!isFirebaseConfigured || !db || !normalizedService) {
    return;
  }

  const sessionKey = `${SESSION_KEY_PREFIX}:${normalizedType}:${normalizedService.toLowerCase()}`;

  try {
    if (window.sessionStorage?.getItem(sessionKey)) {
      return;
    }
    window.sessionStorage?.setItem(sessionKey, '1');
  } catch {
    // Session storage can be unavailable in private or locked-down browsers.
  }

  try {
    await addDoc(collection(db, 'serviceInteractions'), {
      serviceType: normalizedService,
      type: normalizedType,
      source: String(source || 'app').trim(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('[Slivz analytics] service interaction skipped', error);
  }
};
