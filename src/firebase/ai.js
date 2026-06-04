import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from './app';
import { isFirebaseConfigured } from './env';

export const defaultAiModelName = import.meta.env.VITE_FIREBASE_AI_MODEL || 'gemini-2.5-flash';

export const ai = app ? getAI(app, { backend: new GoogleAIBackend() }) : null;

export const getAiModel = (modelName = defaultAiModelName) => {
  if (!isFirebaseConfigured || !ai) {
    throw new Error('Firebase must be configured before using Firebase AI Logic.');
  }

  return getGenerativeModel(ai, { model: modelName });
};
