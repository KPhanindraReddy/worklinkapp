import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { isFirebaseConfigured } from '../firebase/env';
import { storage } from '../firebase/storage';

const MAX_PROFILE_IMAGE_SIZE = 384;
const PROFILE_IMAGE_QUALITY = 0.82;

const sanitizeFileName = (value) =>
  String(value || 'profile')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'profile';

const resizeImageFile = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_PROFILE_IMAGE_SIZE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not prepare this profile photo.'));
            return;
          }

          resolve(blob);
        },
        'image/jpeg',
        PROFILE_IMAGE_QUALITY
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Choose a valid image file.'));
    };

    image.src = objectUrl;
  });

export const uploadProfilePhoto = async ({ uid, role, file }) => {
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage must be configured before uploading profile photos.');
  }

  if (!uid || !file) {
    throw new Error('A signed-in user and image file are required.');
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Choose an image file for the profile photo.');
  }

  const optimizedImage = await resizeImageFile(file);
  const fileName = `${Date.now()}-${sanitizeFileName(file.name)}.jpg`;
  const photoRef = ref(storage, `profile-photos/${role || 'user'}/${uid}/${fileName}`);

  await uploadBytes(photoRef, optimizedImage, {
    contentType: 'image/jpeg',
    customMetadata: {
      ownerId: uid,
      role: role || 'user'
    }
  });

  return getDownloadURL(photoRef);
};
