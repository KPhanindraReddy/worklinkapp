import { BellRing } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { PageSEO } from '../../components/common/PageSEO';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
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
              <Badge tone={unreadCount ? 'blue' : 'slate'}>{notifications.length} total</Badge>
            </div>
          </Card>

          {notifications.length ? (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const target = getNotificationTarget(notification);
                const Wrapper = target ? Link : 'button';

                return (
                  <Wrapper
                    key={notification.id}
                    to={target || undefined}
                    type={target ? undefined : 'button'}
                    className="block text-left"
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <Card className="rounded-[18px] px-3 py-2.5 transition hover:bg-slate-50">
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-100 text-brand-700">
                            <BellRing size={15} />
                          </div>
                          <Badge tone={notification.read ? 'slate' : 'blue'} className="sm:hidden">
                            {notification.read ? 'Read' : 'New'}
                          </Badge>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                              {notification.title}
                            </h3>
                            <Badge tone={notification.read ? 'slate' : 'blue'} className="hidden sm:inline-flex">
                              {notification.read ? 'Read' : 'New'}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-slate-600 dark:text-slate-300">
                            {notification.body}
                          </p>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-right">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                    </Card>
                  </Wrapper>
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
