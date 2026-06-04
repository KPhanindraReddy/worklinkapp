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
            <div className="space-y-3">
              <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 md:grid md:grid-cols-[0.9fr_1.6fr_0.8fr_0.55fr] md:gap-3">
                <span>Title</span>
                <span>Message</span>
                <span>Time</span>
                <span>Status</span>
              </div>
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
                <Card className="rounded-2xl p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
                  <div className="grid gap-3 md:grid-cols-[0.9fr_1.6fr_0.8fr_0.55fr] md:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                    <BellRing size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Title</p>
                        <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {notification.title}
                        </h3>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Message</p>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-300">{notification.body}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Time</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex justify-start md:justify-end">
                      <Badge tone={notification.read ? 'slate' : 'blue'}>
                        {notification.read ? 'Read' : 'New'}
                      </Badge>
                    </div>
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
