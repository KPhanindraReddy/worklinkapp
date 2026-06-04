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
  deleteNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from '../../services/notificationService';
import { formatDate, parseDateValue } from '../../utils/formatters';

const retentionOptions = [
  { value: '5', label: '5 days' },
  { value: '15', label: '15 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' }
];

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
  const [retentionDays, setRetentionDays] = useState(
    () => window.localStorage.getItem('slivzNotificationRetentionDays') || '30'
  );
  const [deletingId, setDeletingId] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [swipedNotificationId, setSwipedNotificationId] = useState('');
  const swipeRef = useRef({ id: '', startX: 0, deleting: false });
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );
  const oldNotifications = useMemo(() => {
    if (retentionDays === 'all') {
      return [];
    }

    const cutoffTime = Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000;
    return notifications.filter((notification) => {
      const createdAt = parseDateValue(notification.createdAt)?.getTime();
      return createdAt && createdAt < cutoffTime;
    });
  }, [notifications, retentionDays]);

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

  useEffect(() => {
    window.localStorage.setItem('slivzNotificationRetentionDays', retentionDays);
  }, [retentionDays]);

  const handleDeleteNotification = async (notificationId) => {
    setDeletingId(notificationId);

    try {
      await deleteNotification(notificationId);
      setSwipedNotificationId('');
      toast.success('Notification deleted.');
    } catch {
      toast.error('Could not delete notification.');
    } finally {
      setDeletingId('');
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

  const handleCleanOldNotifications = async () => {
    if (!oldNotifications.length) {
      toast.success('No old notifications to delete.');
      return;
    }

    setCleaning(true);

    try {
      await deleteNotifications(oldNotifications);
      toast.success(`Deleted ${oldNotifications.length} old notifications.`);
    } catch {
      toast.error('Could not clean notifications.');
    } finally {
      setCleaning(false);
    }
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
                <select
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 max-sm:text-base"
                  aria-label="Notification retention"
                >
                  {retentionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      Keep {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={cleaning || !oldNotifications.length}
                  onClick={handleCleanOldNotifications}
                >
                  Clean
                </Button>
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
