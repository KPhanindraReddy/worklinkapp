import { useEffect, useRef } from 'react';
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

        seenIdsRef.current = nextIds;
      },
      () => {}
    );
  }, [currentUser?.uid]);

  return null;
};
