import { getDatabase } from 'firebase/database';
import { app } from './app';
import { firebaseConfig } from './env';

export const realtimeDatabase = app ? getDatabase(app, firebaseConfig.databaseURL) : null;
