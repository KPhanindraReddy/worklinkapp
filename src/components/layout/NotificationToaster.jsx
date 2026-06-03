import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { subscribeNotifications } from '../../services/notificationService';

export const NotificationToaster = ({ currentUser }) => {
  const seenIdsRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid) {
      seenIdsRef.current = new Set();
      initializedRef.current = false;
      return undefined;
    }

    return subscribeNotifications(
      currentUser.uid,
      (items) => {
        const nextIds = new Set(items.map((item) => item.id));

        if (!initializedRef.current) {
          seenIdsRef.current = nextIds;
          initializedRef.current = true;
          return;
        }

        items
          .filter((item) => !seenIdsRef.current.has(item.id) && !item.read)
          .slice(0, 3)
          .forEach((item) => {
            toast(item.body || item.title || 'New WorkLink update');
          });

        seenIdsRef.current = nextIds;
      },
      () => {}
    );
  }, [currentUser?.uid]);

  return null;
};
