import { BellRing, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { PageSEO } from '../../components/common/PageSEO';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from '../../services/notificationService';
import { formatDate } from '../../utils/formatters';

const getNotificationTarget = (notification) => {
  if (notification.type === 'chat' && notification.conversationId) {
    return `/chat?conversation=${encodeURIComponent(notification.conversationId)}`;
  }

  if (notification.type === 'booking' && notification.bookingId) {
    return notification.bookingId ? '/recent-services' : '/notifications';
  }

  return '';
};

const NotificationsPage = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [deletingId, setDeletingId] = useState('');
  const [swipedNotificationId, setSwipedNotificationId] = useState('');
  const swipeRef = useRef({ id: '', startX: 0, deleting: false });
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    return subscribeNotifications(currentUser?.uid, setNotifications);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!notifications.length) {
      return undefined;
    }

    markAllNotificationsRead(notifications).catch(() => {});
    return undefined;
  }, [notifications]);

  const handleDeleteNotification = async (notificationId) => {
    const removedNotification = notifications.find((notification) => notification.id === notificationId);

    if (!removedNotification || deletingId === notificationId) {
      return;
    }

    setDeletingId(notificationId);
    setSwipedNotificationId('');
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId)
    );

    try {
      await deleteNotification(notificationId);
      toast.success('Notification deleted.');
    } catch {
      setNotifications((currentNotifications) =>
        currentNotifications.some((notification) => notification.id === notificationId)
          ? currentNotifications
          : [removedNotification, ...currentNotifications]
      );
      toast.error('Could not delete notification.');
    } finally {
      setDeletingId('');
      swipeRef.current = { id: '', startX: 0, deleting: false };
    }
  };

  const handleSwipeStart = (notificationId, event) => {
    swipeRef.current = {
      id: notificationId,
      startX: event.clientX,
      deleting: false
    };
  };

  const handleSwipeMove = (notificationId, event) => {
    const swipe = swipeRef.current;

    if (swipe.id !== notificationId || swipe.deleting || deletingId === notificationId) {
      return;
    }

    const distance = swipe.startX - event.clientX;

    if (distance > 38) {
      setSwipedNotificationId(notificationId);
    }

    if (distance > 132) {
      swipeRef.current = { ...swipe, deleting: true };
      handleDeleteNotification(notificationId);
    }
  };

  const handleSwipeEnd = () => {
    swipeRef.current = { id: '', startX: 0, deleting: false };
  };

  return (
    <AppShell>
      <PageSEO title="Notifications" description="Booking, chat, verification, and platform alerts for your Slivz account." />

      <section className="section-space">
        <div className="page-shell space-y-4">
          <Card className="rounded-[30px]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                  <BellRing size={18} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-950">Notifications</h1>
                  <p className="text-sm text-slate-500">
                    {unreadCount ? `${unreadCount} new updates` : 'All caught up'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={unreadCount ? 'blue' : 'slate'}>{notifications.length} total</Badge>
              </div>
            </div>
          </Card>

          {notifications.length ? (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const target = getNotificationTarget(notification);
                const ContentWrapper = target ? Link : 'button';
                const isSwiped = swipedNotificationId === notification.id;

                return (
                <div
                  key={notification.id}
                  className="relative overflow-hidden rounded-2xl"
                  style={{ touchAction: 'pan-y' }}
                  onPointerDown={(event) => handleSwipeStart(notification.id, event)}
                  onPointerMove={(event) => handleSwipeMove(notification.id, event)}
                  onPointerUp={handleSwipeEnd}
                  onPointerCancel={handleSwipeEnd}
                >
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 grid w-20 place-items-center bg-rose-600 text-white"
                    onClick={() => handleDeleteNotification(notification.id)}
                    aria-label="Delete notification"
                  >
                    <Trash2 size={18} />
                  </button>
                  <Card
                    className={`relative rounded-2xl px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50/40 ${
                      isSwiped ? '-translate-x-20' : 'translate-x-0'
                    }`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <ContentWrapper
                        to={target || undefined}
                        type={target ? undefined : 'button'}
                        className="min-w-0 text-left"
                        onClick={(event) => {
                          if (isSwiped) {
                            event.preventDefault();
                            setSwipedNotificationId('');
                            return;
                          }

                          markNotificationRead(notification.id);
                        }}
                      >
                        <p className="truncate text-xs font-semibold text-slate-950 dark:text-white">
                          {notification.title}
                          {notification.body ? (
                            <span className="font-medium text-slate-500 dark:text-slate-300"> - {notification.body}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {formatDate(notification.createdAt)}
                        </p>
                      </ContentWrapper>
                      <div className="flex items-center gap-2">
                        {!notification.read ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
                        <Badge tone={notification.read ? 'slate' : 'blue'} className="px-2 py-1 text-[10px]">
                          {notification.read ? 'Read' : 'New'}
                        </Badge>
                        {isSwiped ? (
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600">
                            Delete
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </div>
              );
              })}
            </div>
          ) : (
            <EmptyState
              title="No notifications yet"
              description="Booking, chat, and account updates will appear here."
            />
          )}
        </div>
      </section>
    </AppShell>
  );
};

export default NotificationsPage;
