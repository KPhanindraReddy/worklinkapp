import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/functions';

export const syncLabourCompletedJobs = async (uid) => {
  if (!uid || !functions) {
    return null;
  }

  const callable = httpsCallable(functions, 'syncLabourProfileCompletedJobs');
  const result = await callable({ uid });

  return result.data ?? null;
};
