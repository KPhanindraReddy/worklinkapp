import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import { normalizeCoordinates } from '../utils/location';

export const createServiceDemandRequest = async ({
  clientId,
  clientName,
  serviceType = '',
  location = '',
  coordinates = null,
  source = 'client_dashboard'
} = {}) => {
  if (!isFirebaseConfigured || !db || !clientId) {
    return '';
  }

  const normalizedCoordinates = normalizeCoordinates(coordinates);

  const demandRef = await addDoc(collection(db, 'serviceDemandRequests'), {
    clientId,
    clientName: clientName || 'Client',
    serviceType: serviceType || 'Any service',
    location: String(location || 'Service location requested').trim(),
    coordinates: normalizedCoordinates,
    source,
    status: 'open',
    createdAt: serverTimestamp()
  });

  return demandRef.id;
};
