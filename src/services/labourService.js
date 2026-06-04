import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/env';
import { db } from '../firebase/firestore';
import {
  labourMatchesCategory,
  labourMatchesServiceQuery,
  recommendLabours
} from '../utils/recommendations';
import { availabilityOptions, NEARBY_LABOUR_RADIUS_KM, workCategories } from '../utils/constants';
import { buildLocationCacheKey, normalizeCoordinates } from '../utils/location';

const SEARCH_RESULT_LIMIT = 80;
const SEARCH_CACHE_TTL_MS = 30000;
const labourSearchCache = new Map();
const debugLabourSearch = (message, payload = {}) => {
  console.debug(`[Slivz labour search] ${message}`, payload);
};

const normalizeAvailabilityValue = (value) => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return availabilityOptions.find((option) => option.toLowerCase() === normalizedValue) || '';
};

const buildSearchCacheKey = (filters, resolvedCategory, origin, maxDistanceKm) =>
  JSON.stringify({
    skill: String(filters.skill ?? '').trim().toLowerCase(),
    keywords: String(filters.keywords ?? '').trim().toLowerCase(),
    category: String(filters.category ?? '').trim().toLowerCase(),
    resolvedCategory: String(resolvedCategory ?? '').trim().toLowerCase(),
    availability: String(filters.availability ?? '').trim().toLowerCase(),
    minRating: String(filters.minRating ?? '').trim(),
    minExperience: String(filters.minExperience ?? '').trim(),
    maxPrice: String(filters.maxPrice ?? '').trim(),
    maxDistanceKm: maxDistanceKm ?? '',
    origin: buildLocationCacheKey(origin)
  });

const getCachedSearchResults = (cacheKey) => {
  const cachedEntry = labourSearchCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (Date.now() - cachedEntry.createdAt > SEARCH_CACHE_TTL_MS) {
    labourSearchCache.delete(cacheKey);
    return null;
  }

  return cachedEntry;
};

const cacheSearchResults = (cacheKey, payload) => {
  labourSearchCache.set(cacheKey, {
    createdAt: Date.now(),
    ...payload
  });

  if (labourSearchCache.size <= 40) {
    return;
  }

  const oldestKey = labourSearchCache.keys().next().value;

  if (oldestKey) {
    labourSearchCache.delete(oldestKey);
  }
};

const fetchLabourCandidates = async (filters, resolvedCategory) => {
  const shouldUseCategoryConstraint = Boolean(resolvedCategory && !filters.skill);
  const availability = normalizeAvailabilityValue(filters.availability);
  const attempts = [
    () => {
      const constraints = [];

      if (availability) {
        constraints.push(where('availability', '==', availability));
      }

      if (shouldUseCategoryConstraint) {
        constraints.push(where('category', '==', resolvedCategory));
      }

      constraints.push(limit(SEARCH_RESULT_LIMIT));
      return getDocs(query(collection(db, 'labours'), ...constraints));
    },
    () => {
      if (!availability) {
        return null;
      }

      return getDocs(
        query(
          collection(db, 'labours'),
          where('availability', '==', availability),
          limit(SEARCH_RESULT_LIMIT)
        )
      );
    },
    () => getDocs(query(collection(db, 'labours'), limit(SEARCH_RESULT_LIMIT)))
  ];

  let lastError = null;

  for (const runAttempt of attempts) {
    try {
      const snapshot = await runAttempt();

      if (!snapshot) {
        continue;
      }

      debugLabourSearch('candidate query succeeded', {
        filters,
        resolvedCategory,
        count: snapshot.size
      });

      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    } catch (error) {
      lastError = error;
      console.warn('[Slivz labour search] candidate query failed', {
        code: error?.code,
        message: error?.message,
        filters,
        resolvedCategory
      });

      if (error?.code !== 'failed-precondition') {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
};

const normalizeSearchValue = (value) => String(value ?? '').trim().toLowerCase();
const resolveMaxDistanceKm = (filters, origin) => {
  const requestedDistance = Number(filters.maxDistanceKm);

  if (Number.isFinite(requestedDistance) && requestedDistance > 0) {
    return requestedDistance;
  }

  return origin ? NEARBY_LABOUR_RADIUS_KM : null;
};

const resolveCategoryFromSkill = (skill) => {
  const normalizedSkill = normalizeSearchValue(skill);

  if (!normalizedSkill) {
    return '';
  }

  return (
    workCategories.find((category) => {
      const normalizedCategory = normalizeSearchValue(category);
      return normalizedCategory === normalizedSkill || normalizedSkill.includes(normalizedCategory);
    }) ?? ''
  );
};

export const fetchFeaturedLabours = async (count = 6) => {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const labourQuery = query(
    collection(db, 'labours'),
    orderBy('rating', 'desc'),
    limit(count)
  );
  const snapshot = await getDocs(labourQuery);

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const searchLabours = async (filters = {}, origin) => {
  const resolvedCategory = filters.category || resolveCategoryFromSkill(filters.skill);
  const availability = normalizeAvailabilityValue(filters.availability);
  const keywordQuery = [filters.skill, filters.keywords].filter(Boolean).join(' ').trim();
  const normalizedOrigin = normalizeCoordinates(origin);
  const maxDistanceKm = resolveMaxDistanceKm(filters, normalizedOrigin);
  const cacheKey = buildSearchCacheKey(filters, resolvedCategory, normalizedOrigin, maxDistanceKm);
  const cachedEntry = getCachedSearchResults(cacheKey);

  if (cachedEntry?.results) {
    return cachedEntry.results;
  }

  if (cachedEntry?.requestPromise) {
    return cachedEntry.requestPromise;
  }

  const requestPromise = (async () => {
    if (!isFirebaseConfigured || !db) {
      return [];
    }

    if (Number.isFinite(maxDistanceKm) && !normalizedOrigin) {
      return [];
    }

    const items = await fetchLabourCandidates(filters, resolvedCategory);
    debugLabourSearch('ranking candidates', {
      filters,
      resolvedCategory,
      maxDistanceKm,
      origin: normalizedOrigin,
      candidateCount: items.length
    });

    return recommendLabours(items, filters, normalizedOrigin)
      .filter((labour) => {
        const matchesKeywords = keywordQuery
          ? labourMatchesServiceQuery(labour, keywordQuery)
          : true;
        const matchesCategory = filters.category
          ? labourMatchesCategory(labour, filters.category)
          : true;
        const matchesService = matchesKeywords && matchesCategory;
        const matchesPrice = filters.maxPrice ? labour.dailyWage <= Number(filters.maxPrice) : true;
        const matchesExperience = filters.minExperience
          ? labour.experienceYears >= Number(filters.minExperience)
          : true;
        const matchesRating = filters.minRating ? labour.rating >= Number(filters.minRating) : true;
        const matchesAvailability = availability ? labour.availability === availability : true;
        const matchesDistance = Number.isFinite(maxDistanceKm)
          ? Number.isFinite(Number(labour.distanceKm)) && Number(labour.distanceKm) <= maxDistanceKm
          : true;

        return (
          matchesService &&
          matchesPrice &&
          matchesExperience &&
          matchesRating &&
          matchesAvailability &&
          matchesDistance
        );
      })
      .slice(0, SEARCH_RESULT_LIMIT);
  })();

  cacheSearchResults(cacheKey, { requestPromise });

  try {
    const results = await requestPromise;
    cacheSearchResults(cacheKey, { results });
    return results;
  } catch (error) {
    labourSearchCache.delete(cacheKey);
    throw error;
  }
};

export const getLabourById = async (labourId) => {
  if (!labourId) {
    return null;
  }

  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'labours', labourId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

export const subscribeLabourById = (labourId, onNext, onError) => {
  if (!labourId) {
    onNext(null);
    return () => {};
  }

  if (!isFirebaseConfigured || !db) {
    onNext(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'labours', labourId),
    (snapshot) => {
      onNext(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    },
    onError
  );
};

export const updateLabourProfile = async (uid, payload) => {
  if (!uid || !isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating labour profile.');
  }

  await setDoc(
    doc(db, 'labours', uid),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const updateAvailability = async (uid, availability) => {
  if (!uid || !isFirebaseConfigured || !db) {
    throw new Error('Firebase must be configured before updating availability.');
  }

  const payload = {
    availability,
    updatedAt: serverTimestamp()
  };

  await Promise.all([
    setDoc(doc(db, 'labours', uid), payload, { merge: true }),
    setDoc(doc(db, 'users', uid), payload, { merge: true })
  ]);
};
