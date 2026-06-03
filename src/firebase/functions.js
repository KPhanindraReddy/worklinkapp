import { getFunctions } from 'firebase/functions';
import { app } from './app';

export const functions = app ? getFunctions(app, 'asia-south1') : null;
