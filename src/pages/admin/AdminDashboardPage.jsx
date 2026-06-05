import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CircleOff,
  ExternalLink,
  LoaderCircle,
  MessageSquareWarning,
  Pencil,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { Skeleton } from '../../components/common/Skeleton';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { AppShell } from '../../components/layout/AppShell';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { MetricsGrid } from '../../components/dashboard/MetricsGrid';
import {
  getAdminDiagnostics,
  getAdminOverview,
  listSupportTickets,
  listAdminProfiles,
  updateAdminUserProfile,
  updateSupportTicketStatus,
  updateUserAccountStatus,
  verifyLabourAccount
} from '../../services/adminService';
import { firebaseConfig } from '../../firebase/env';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { formatCurrency, fromNow } from '../../utils/formatters';
import { getLocationLabel } from '../../utils/location';
import { availabilityOptions, workCategories } from '../../utils/constants';

const TableShell = ({ children }) => (
  <div className="overflow-x-auto rounded-[16px] border border-slate-200 bg-white">
    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
      {children}
    </table>
  </div>
);

const Th = ({ children }) => (
  <th className="whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-normal text-slate-500">
    {children}
  </th>
);

const Td = ({ children, className = '', ...props }) => (
  <td className={`min-w-0 px-3 py-3 align-top text-slate-700 ${className}`} {...props}>
    {children}
  </td>
);

const RowActionMenu = ({ children }) => (
  <details className="relative">
    <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
      ...
    </summary>
    <div className="absolute right-0 z-20 mt-2 grid min-w-36 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
      {children}
    </div>
  </details>
);

const toTime = (value) => {
  if (!value) {
    return 0;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLabourQualityFlags = (labour) => {
  const flags = [];
  const hasLocation = Boolean(
    labour.currentLocation ||
      labour.location ||
      labour.workLocation ||
      labour.coordinates ||
      labour.locationCoordinates
  );
  const hasPhoto = Boolean(labour.profilePhoto || labour.profilePhotoUrl || labour.photoURL);
  const hasBasicProfile = Boolean(labour.fullName && labour.phoneNumber && labour.category && hasLocation);
  const lastProfileTouch = toTime(labour.availabilityUpdatedAt || labour.updatedAt || labour.createdAt);
  const offlineTooLong =
    labour.availability === 'Offline' && (!lastProfileTouch || Date.now() - lastProfileTouch > 24 * 60 * 60 * 1000);

  if (!hasBasicProfile) {
    flags.push({ label: 'Incomplete profile', tone: 'amber' });
  }

  if (!hasPhoto) {
    flags.push({ label: 'No photo', tone: 'slate' });
  }

  if (!hasLocation) {
    flags.push({ label: 'No location', tone: 'rose' });
  }

  if (offlineTooLong) {
    flags.push({ label: 'Offline long', tone: 'amber' });
  }

  return flags;
};

const AdminDashboardPage = () => {
  const [overview, setOverview] = useState({
    analytics: {},
    categories: [],
    pendingLabours: [],
    customServices: [],
    demandByLocation: [],
    demandByService: [],
    recentActivity: []
  });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState({
    failedNotifications: [],
    functionErrors: [],
    stuckBookings: [],
    messageFailures: []
  });
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
  const [labourDirectory, setLabourDirectory] = useState({
    items: [],
    cursor: null,
    hasMore: false,
    loading: false
  });
  const [clientDirectory, setClientDirectory] = useState({
    items: [],
    cursor: null,
    hasMore: false,
    loading: false
  });
  const [filters, setFilters] = useState({
    labour: '',
    client: ''
  });
  const [editingProfile, setEditingProfile] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const response = await getAdminOverview();
      setOverview(response);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const response = await getAdminDiagnostics();
      setDiagnostics(response);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      setTickets(await listSupportTickets());
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadDirectory = async (role, { reset = false } = {}) => {
    const state = role === 'client' ? clientDirectory : labourDirectory;
    const setState = role === 'client' ? setClientDirectory : setLabourDirectory;

    setState((prev) => ({
      ...prev,
      loading: true
    }));

    try {
      const response = await listAdminProfiles({
        role,
        cursor: reset ? null : state.cursor
      });

      setState((prev) => ({
        items: reset
          ? response.items
          : [
              ...prev.items,
              ...response.items.filter(
                (item) => !prev.items.some((existingItem) => existingItem.id === item.id)
              )
            ],
        cursor: response.cursor,
        hasMore: response.hasMore,
        loading: false
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false
      }));
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  useEffect(() => {
    loadOverview();
    loadDiagnostics();
    loadTickets();
    loadDirectory('labour', { reset: true });
    loadDirectory('client', { reset: true });
  }, []);

  const metrics = useMemo(
    () => [
      { label: 'Users', value: overview.analytics.userCount ?? 0, hint: 'Total users on the platform' },
      { label: 'Labour accounts', value: overview.analytics.labourCount ?? 0, hint: 'Registered labour profiles' },
      { label: 'Client accounts', value: overview.analytics.clientCount ?? 0, hint: 'Registered client profiles' },
      { label: 'Bookings', value: overview.analytics.activeBookings ?? 0, hint: 'Total booking records' },
      {
        label: 'Paid earnings',
        value: formatCurrency(overview.analytics.paidEarnings ?? 0),
        hint: `${overview.analytics.paidBookingCount ?? 0} completed payments`
      },
      {
        label: 'Pending verifications',
        value: overview.analytics.pendingVerifications ?? 0,
        hint: 'Manual review queue'
      }
    ],
    [overview.analytics]
  );
  const analyticsRows = useMemo(
    () => [
      ['Total users', overview.analytics.userCount ?? 0],
      ['Labour accounts', overview.analytics.labourCount ?? 0],
      ['Client accounts', overview.analytics.clientCount ?? 0],
      ['Bookings', overview.analytics.activeBookings ?? 0],
      ['Pending verifications', overview.analytics.pendingVerifications ?? 0],
      ['Paid bookings', overview.analytics.paidBookingCount ?? 0],
      ['Paid earnings', formatCurrency(overview.analytics.paidEarnings ?? 0)]
    ],
    [overview.analytics]
  );
  const topSearchedServices = useMemo(
    () =>
      [...(overview.categories || [])]
        .map((category) => ({
          ...category,
          totalInterest: (category.clickCount || 0) + (category.searchCount || 0)
        }))
        .filter((category) => category.totalInterest > 0)
        .sort(
          (a, b) =>
            b.totalInterest - a.totalInterest ||
            (b.searchCount || 0) - (a.searchCount || 0) ||
            a.name.localeCompare(b.name)
        )
        .slice(0, 5),
    [overview.categories]
  );

  const handleVerify = async (labourId) => {
    try {
      await verifyLabourAccount(labourId);
      toast.success('Labour profile verified.');
      setLabourDirectory((prev) => ({
        ...prev,
        items: prev.items.map((labour) =>
          labour.id === labourId
            ? {
                ...labour,
                verified: true
              }
            : labour
        )
      }));
      await loadOverview();
      await loadDiagnostics();
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleBan = async (userId, role) => {
    await handleAccountStatus(userId, role, 'banned');
  };

  const handleAccountStatus = async (userId, role, accountStatus) => {
    try {
      await updateUserAccountStatus({ userId, role, accountStatus });
      toast.success(`User status updated to ${accountStatus}.`);
      const setState = role === 'client' ? setClientDirectory : setLabourDirectory;
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === userId
            ? {
                ...item,
                accountStatus
              }
            : item
        )
      }));
      await loadOverview();
      await loadDiagnostics();
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const handleTicketStatus = async (ticketId, status) => {
    try {
      await updateSupportTicketStatus(ticketId, status);
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                status
              }
            : ticket
        )
      );
      toast.success(`Ticket marked ${status}.`);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    }
  };

  const filteredLabours = useMemo(() => {
    const query = filters.labour.trim().toLowerCase();

    if (!query) {
      return labourDirectory.items;
    }

    return labourDirectory.items.filter((labour) =>
      [
        labour.fullName,
        labour.email,
        labour.phoneNumber,
        labour.category,
        getLocationLabel(labour, { preferCurrent: true, fallback: '' })
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [filters.labour, labourDirectory.items]);

  const filteredClients = useMemo(() => {
    const query = filters.client.trim().toLowerCase();

    if (!query) {
      return clientDirectory.items;
    }

    return clientDirectory.items.filter((client) =>
      [
        client.fullName,
        client.email,
        client.phoneNumber,
        getLocationLabel(client, { fallback: '' })
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [clientDirectory.items, filters.client]);

  const formatStuckDuration = (ageMs) => {
    const totalMinutes = Math.max(0, Math.round(Number(ageMs || 0) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  const firebaseProjectId = firebaseConfig.projectId || 'Slivz-labour';
  const functionsLogsUrl = `https://console.cloud.google.com/functions/list?project=${encodeURIComponent(
    firebaseProjectId
  )}`;
  const firestoreLogsUrl = `https://console.firebase.google.com/project/${encodeURIComponent(
    firebaseProjectId
  )}/firestore/data/~2FwhatsappLogs`;

  const openProfileEditor = (item, role) => {
    setEditingProfile({
      userId: item.id,
      role,
      fullName: item.fullName || '',
      phoneNumber: item.phoneNumber || '',
      email: item.email || '',
      location: item.location || '',
      currentLocation: item.currentLocation || '',
      accountStatus: item.accountStatus || 'active',
      category: item.category || '',
      availability: item.availability || 'Available',
      experienceYears: Number(item.experienceYears || 0),
      skills: Array.isArray(item.skills) ? item.skills.join(', ') : item.skills || '',
      about: item.about || ''
    });
  };

  const updateEditField = (key, value) => {
    setEditingProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const closeProfileEditor = () => {
    if (!savingEdit) {
      setEditingProfile(null);
    }
  };

  const saveEditedProfile = async () => {
    if (!editingProfile?.userId || !editingProfile?.role) {
      return;
    }

    setSavingEdit(true);

    try {
      await updateAdminUserProfile({
        userId: editingProfile.userId,
        role: editingProfile.role,
        payload: editingProfile
      });

      const setState = editingProfile.role === 'client' ? setClientDirectory : setLabourDirectory;
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === editingProfile.userId
            ? {
                ...item,
                ...editingProfile,
                skills:
                  editingProfile.role === 'labour'
                    ? String(editingProfile.skills || '')
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean)
                    : item.skills
              }
            : item
        )
      }));

      toast.success('Profile details updated.');
      setEditingProfile(null);
      await loadOverview();
      await loadDiagnostics();
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AppShell>
      <PageSEO title="Admin Dashboard" description="Manage Slivz users, verification, reports, analytics, and marketplace operations." />

      <section className="section-space">
        <div className="page-shell">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[28px] sm:rounded-[36px]">
              <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6 md:p-8">
                <div>
                  <BrandLogo to="/" showTagline />
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">Admin</Badge>
                    <Badge tone="slate">Operations</Badge>
                  </div>
                  <h1 className="mt-4 break-words font-display text-2xl font-bold text-slate-950 sm:text-3xl md:text-4xl">
                    Marketplace overview
                  </h1>
                </div>
                <Button as={Link} to="/settings" size="sm" className="w-full sm:w-auto">
                  <UserRound size={16} />
                  Open admin profile
                </Button>
              </div>
            </Card>

            <MetricsGrid items={metrics} loading={overviewLoading} />

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Website analytics</h2>
                  <p className="mt-1 text-sm text-slate-500">Simple count view for users, labour, clients, bookings, and earnings.</p>
                </div>
                <Badge tone="blue">Live summary</Badge>
              </div>
              <TableShell>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Metric</Th>
                    <Th>Value</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overviewLoading ? (
                    <tr>
                      <Td colSpan={2}><Skeleton className="h-8 w-full" /></Td>
                    </tr>
                  ) : (
                    analyticsRows.map(([label, value]) => (
                      <tr key={label}>
                        <Td className="font-semibold text-slate-950">{label}</Td>
                        <Td>{value}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </TableShell>
            </Card>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Recent activity</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest signup, booking, completed service, and support movement.</p>
                </div>
                <Badge tone="blue">{overview.recentActivity?.length || 0} updates</Badge>
              </div>
              <TableShell>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Type</Th>
                    <Th>Details</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overviewLoading ? (
                    <tr>
                      <Td colSpan={3}><Skeleton className="h-8 w-full" /></Td>
                    </tr>
                  ) : overview.recentActivity?.length ? (
                    overview.recentActivity.map((item) => (
                      <tr key={item.id}>
                        <Td><Badge tone={item.type === 'Support ticket' ? 'amber' : 'slate'}>{item.type}</Badge></Td>
                        <Td>
                          <p className="font-semibold text-slate-950">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.detail}</p>
                        </Td>
                        <Td className="whitespace-nowrap">{fromNow(item.createdAt)}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={3} className="text-slate-500">No recent activity yet.</Td>
                    </tr>
                  )}
                </tbody>
              </TableShell>
            </Card>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Support tickets</h2>
                  <p className="mt-1 text-sm text-slate-500">Tickets raised from client and labour profiles.</p>
                </div>
                <Badge tone="amber">{tickets.length} tickets</Badge>
              </div>
              <TableShell>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Ticket</Th>
                    <Th>User</Th>
                    <Th>Contact</Th>
                    <Th>Subject</Th>
                    <Th>Description</Th>
                    <Th>Date</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ticketsLoading ? (
                    <tr>
                      <Td colSpan={7}><Skeleton className="h-8 w-full" /></Td>
                    </tr>
                  ) : tickets.length ? (
                    tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <Td>
                          <p className="font-bold text-slate-950">{ticket.ticketNumber || ticket.id}</p>
                          <Badge tone="slate">{ticket.status || 'open'}</Badge>
                        </Td>
                        <Td>
                          <p className="font-semibold text-slate-950">{ticket.fullName || 'User'}</p>
                          <p className="text-xs font-medium text-slate-400">{ticket.role || 'account'}</p>
                        </Td>
                        <Td>
                          <p className="break-all">{ticket.phoneNumber || 'No phone'}</p>
                          <p className="break-all text-xs text-slate-500">{ticket.email || 'No email'}</p>
                        </Td>
                        <Td className="min-w-44 font-semibold text-slate-950">{ticket.subject}</Td>
                        <Td className="min-w-64 max-w-md break-words">{ticket.description}</Td>
                        <Td className="whitespace-nowrap">{ticket.createdAt ? fromNow(ticket.createdAt) : 'New'}</Td>
                        <Td>
                          <div className="flex min-w-36 flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleTicketStatus(ticket.id, 'open')}>
                              Open
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTicketStatus(ticket.id, 'solved')}>
                              Solved
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={7} className="text-slate-500">No support tickets yet.</Td>
                    </tr>
                  )}
                </tbody>
              </TableShell>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Pending labour verification</h2>
                <div className="mt-5 space-y-4">
                  {overviewLoading ? (
                    <>
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </>
                  ) : overview.pendingLabours.length ? (
                    overview.pendingLabours.map((labour) => (
                      <div key={labour.id} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800/50">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-slate-950 dark:text-white">{labour.fullName}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {labour.category} - {getLocationLabel(labour, { preferCurrent: true })}
                            </p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {labour.experienceYears} years experience - {labour.skills?.join(', ')}
                            </p>
                          </div>
                          <VerificationBadge verified={labour.verified} />
                        </div>
                        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
                          <Button size="sm" className="w-full sm:w-auto" onClick={() => handleVerify(labour.id)}>
                            Approve ID
                          </Button>
                          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => handleBan(labour.id, 'labour')}>
                            Ban user
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No pending labour verifications right now.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Top searched services</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Quick top 5 from client clicks and search interest.
                    </p>
                  </div>
                  <Badge tone="blue">Top 5</Badge>
                </div>
                <TableShell>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Service</Th>
                      <Th>Clicks</Th>
                      <Th>Searches</Th>
                      <Th>Total</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overviewLoading ? (
                      <tr>
                        <Td colSpan={4}><Skeleton className="h-8 w-full" /></Td>
                      </tr>
                    ) : topSearchedServices.length ? (
                      topSearchedServices.map((category) => (
                        <tr key={category.id}>
                          <Td className="font-semibold text-slate-950">{category.name}</Td>
                          <Td>{category.clickCount || 0}</Td>
                          <Td>{category.searchCount || 0}</Td>
                          <Td className="font-bold text-slate-950">{category.totalInterest}</Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={4} className="text-slate-500">No service searches recorded yet.</Td>
                      </tr>
                    )}
                  </tbody>
                </TableShell>
              </Card>

              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Service people count</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      See how many labour people are registered for each service.
                    </p>
                  </div>
                  <Badge tone="blue">{overview.categories.length} services</Badge>
                </div>
                <TableShell>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Service</Th>
                      <Th>People</Th>
                      <Th>Clicks</Th>
                      <Th>Searches</Th>
                      <Th>Total interest</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {overviewLoading ? (
                    <tr>
                      <Td colSpan={5}><Skeleton className="h-8 w-full" /></Td>
                    </tr>
                  ) : (
                    overview.categories.map((category) => (
                      <tr key={category.id}>
                        <Td className="font-semibold text-slate-950">{category.name}</Td>
                        <Td>
                          <Badge tone={category.peopleCount ? 'blue' : 'slate'}>
                            {category.peopleCount} people
                          </Badge>
                        </Td>
                        <Td>{category.clickCount || 0}</Td>
                        <Td>{category.searchCount || 0}</Td>
                        <Td className="font-bold text-slate-950">
                          {(category.clickCount || 0) + (category.searchCount || 0)}
                        </Td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </TableShell>
              </Card>

              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">New service names</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Services typed by labour that are not in the default list.
                    </p>
                  </div>
                  <Badge tone="amber">{overview.customServices.length} new</Badge>
                </div>
                <TableShell>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Service</Th>
                      <Th>Labour</Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overviewLoading ? (
                      <tr>
                        <Td colSpan={3}><Skeleton className="h-8 w-full" /></Td>
                      </tr>
                    ) : overview.customServices.length ? (
                      overview.customServices.map((service) => (
                        <tr key={service.id}>
                          <Td className="font-semibold text-slate-950">{service.name}</Td>
                          <Td>{service.labourName || 'Labour'}</Td>
                          <Td>
                            <Badge tone="slate">{service.source || 'profile'}</Badge>
                          </Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={3} className="text-slate-500">No new custom services yet.</Td>
                      </tr>
                    )}
                  </tbody>
                </TableShell>
              </Card>
            </div>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Diagnostics</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Track failed notifications, function errors, stuck bookings, and message delivery issues.
                  </p>
                </div>
                <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
                  <Button as="a" href={functionsLogsUrl} target="_blank" rel="noreferrer" type="button" size="sm" variant="outline">
                    <ExternalLink size={15} />
                    Functions logs
                  </Button>
                  <Button as="a" href={firestoreLogsUrl} target="_blank" rel="noreferrer" type="button" size="sm" variant="outline">
                    <ExternalLink size={15} />
                    WhatsApp logs
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={loadDiagnostics} disabled={diagnosticsLoading}>
                    {diagnosticsLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle size={16} />
                    <h3 className="font-semibold">Failed notifications</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {diagnosticsLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : diagnostics.failedNotifications.length ? (
                      diagnostics.failedNotifications.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {item.serviceType || 'Service'} • {item.status || 'unknown'}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {item.labourName || 'Labour'} / {item.clientName || 'Client'}
                          </p>
                          <p className="mt-1 text-amber-700">{item.lastErrorMessage}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-amber-900">No failed notifications in recent records.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <div className="flex items-center gap-2 text-rose-800">
                    <ShieldAlert size={16} />
                    <h3 className="font-semibold">Function errors</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {diagnosticsLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : diagnostics.functionErrors.length ? (
                      diagnostics.functionErrors.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-rose-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {item.kind || 'unknown'} • HTTP {item.status || 0}
                          </p>
                          <p className="mt-1 text-slate-600">{item.bookingId ? `Booking ${item.bookingId}` : 'No booking id'}</p>
                          <p className="mt-1 text-rose-700">{item.errorMessage}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-rose-900">No recent function errors.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <CircleOff size={16} />
                    <h3 className="font-semibold">Stuck bookings</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {diagnosticsLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : diagnostics.stuckBookings.length ? (
                      diagnostics.stuckBookings.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-blue-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {item.status} • stuck {formatStuckDuration(item.ageMs)}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {item.serviceType || 'Service'} • {item.labourName || 'Labour'}
                          </p>
                          <p className="mt-1 text-blue-700">{fromNow(item.updatedAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-blue-900">No stuck bookings detected.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                  <div className="flex items-center gap-2 text-violet-800">
                    <MessageSquareWarning size={16} />
                    <h3 className="font-semibold">Message failures</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {diagnosticsLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : diagnostics.messageFailures.length ? (
                      diagnostics.messageFailures.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-violet-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {item.kind || 'message'} • HTTP {item.status || 0}
                          </p>
                          <p className="mt-1 text-slate-600">{item.to || 'No phone'}</p>
                          <p className="mt-1 text-violet-700">{item.errorMessage}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-violet-900">No recent message failures.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">No-labour demand by service</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Services clients searched when no available labour was found.
                  </p>
                </div>
                <Badge tone="amber">{overview.demandByService?.length || 0} services</Badge>
              </div>
              <div className="mt-5">
                <TableShell>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Service</Th>
                      <Th>Requests</Th>
                      <Th>Locations</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overviewLoading ? (
                      <tr>
                        <Td colSpan={3}><Skeleton className="h-8 w-full" /></Td>
                      </tr>
                    ) : overview.demandByService?.length ? (
                      overview.demandByService.map((item) => (
                        <tr key={item.id}>
                          <Td className="font-semibold text-slate-950">{item.serviceType}</Td>
                          <Td><Badge tone="amber">{item.requestCount} requests</Badge></Td>
                          <Td className="min-w-64">{item.locations?.join(', ') || 'Unknown address'}</Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={3} className="text-slate-500">No unavailable-service demand recorded yet.</Td>
                      </tr>
                    )}
                  </tbody>
                </TableShell>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Requested addresses</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Locations where clients searched but no labour was available.
                  </p>
                </div>
                <Badge tone="blue">{overview.demandByLocation?.length || 0} locations</Badge>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {overviewLoading ? (
                  <>
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                  </>
                ) : overview.demandByLocation?.length ? (
                  overview.demandByLocation.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-slate-950">{item.location}</p>
                          <p className="mt-2 text-xs font-medium text-slate-500">
                            {item.services?.join(', ') || 'Any service'}
                          </p>
                        </div>
                        <Badge tone="amber">{item.requestCount} requests</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
                    No unavailable-location demand recorded yet.
                  </p>
                )}
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Labour directory</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Review labour details, verify profiles, and keep moderation hidden inside admin.
                    </p>
                  </div>
                  {labourDirectory.loading && !labourDirectory.items.length ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <Badge tone="blue">{labourDirectory.items.length} loaded</Badge>
                  )}
                </div>

                <div className="mt-5">
                  <InputField
                    label="Search labour"
                    value={filters.labour}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, labour: event.target.value }))
                    }
                    placeholder="Name, phone, category, area"
                  />
                </div>

                <div className="mt-5">
                  {labourDirectory.loading && !labourDirectory.items.length ? (
                    <>
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </>
                  ) : filteredLabours.length ? (
                    <TableShell>
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Name</Th>
                          <Th>Service</Th>
                          <Th>Contact</Th>
                          <Th>Location</Th>
                          <Th>Status</Th>
                          <Th>Quality</Th>
                          <Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLabours.map((labour) => {
                          const qualityFlags = getLabourQualityFlags(labour);

                          return (
                          <tr key={labour.id}>
                            <Td>
                              <div className="flex items-center gap-2">
                                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                                  {(labour.fullName || 'L').charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-950">{labour.fullName || 'Labour'}</p>
                                  <VerificationBadge verified={labour.verified} />
                                </div>
                              </div>
                            </Td>
                            <Td>
                              <p className="font-semibold text-slate-950">{labour.category || 'No category'}</p>
                              <p className="text-xs text-slate-500">{labour.availability || 'Status not set'}</p>
                            </Td>
                            <Td>
                              <p className="break-all">{labour.phoneNumber || 'Phone not added'}</p>
                              <p className="break-all text-xs text-slate-500">{labour.email || 'Email not added'}</p>
                            </Td>
                            <Td className="min-w-48">{getLocationLabel(labour, { preferCurrent: true })}</Td>
                            <Td>
                              <Badge tone={labour.accountStatus === 'banned' ? 'rose' : 'slate'}>
                                {labour.accountStatus || 'active'}
                              </Badge>
                            </Td>
                            <Td>
                              <div className="flex min-w-36 flex-wrap gap-1.5">
                                {qualityFlags.length ? (
                                  qualityFlags.map((flag) => (
                                    <Badge key={flag.label} tone={flag.tone}>{flag.label}</Badge>
                                  ))
                                ) : (
                                  <Badge tone="emerald">OK</Badge>
                                )}
                              </div>
                            </Td>
                            <Td>
                              <RowActionMenu>
                                {!labour.verified ? (
                                  <Button size="sm" className="w-full justify-start" onClick={() => handleVerify(labour.id)}>
                                    <ShieldCheck size={15} />
                                    Approve
                                  </Button>
                                ) : null}
                                <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={() => openProfileEditor(labour, 'labour')}>
                                  <Pencil size={15} />
                                  Edit
                                </Button>
                                <Button as={Link} to={`/labour/${labour.id}`} size="sm" variant="outline" className="w-full justify-start">
                                  Open
                                </Button>
                                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => handleAccountStatus(labour.id, 'labour', 'active')}>
                                  Active
                                </Button>
                                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => handleBan(labour.id, 'labour')}>
                                  Ban
                                </Button>
                              </RowActionMenu>
                            </Td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </TableShell>
                  ) : (
                    <p className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:text-slate-400">
                      No labour matched this admin search.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Paginated for scale
                  </p>
                  {labourDirectory.hasMore ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => loadDirectory('labour')}
                      disabled={labourDirectory.loading}
                    >
                      {labourDirectory.loading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                      Load more labour
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Client directory</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Review client contact details and account status without exposing admin routes publicly.
                    </p>
                  </div>
                  {clientDirectory.loading && !clientDirectory.items.length ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <Badge tone="blue">{clientDirectory.items.length} loaded</Badge>
                  )}
                </div>

                <div className="mt-5">
                  <InputField
                    label="Search clients"
                    value={filters.client}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, client: event.target.value }))
                    }
                    placeholder="Name, phone, area"
                  />
                </div>

                <div className="mt-5">
                  {clientDirectory.loading && !clientDirectory.items.length ? (
                    <>
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </>
                  ) : filteredClients.length ? (
                    <TableShell>
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Name</Th>
                          <Th>Contact</Th>
                          <Th>Location</Th>
                          <Th>Status</Th>
                          <Th>Actions</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredClients.map((client) => (
                          <tr key={client.id}>
                            <Td>
                              <div className="flex items-center gap-2">
                                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                                  {(client.fullName || 'C').charAt(0).toUpperCase()}
                                </span>
                                <p className="font-semibold text-slate-950">{client.fullName || 'Client'}</p>
                              </div>
                            </Td>
                            <Td>
                              <p className="break-all">{client.phoneNumber || 'Phone not added'}</p>
                              <p className="break-all text-xs text-slate-500">{client.email || 'Email not added'}</p>
                            </Td>
                            <Td className="min-w-48">{getLocationLabel(client)}</Td>
                            <Td>
                              <Badge tone={client.accountStatus === 'banned' ? 'rose' : 'slate'}>
                                {client.accountStatus || 'active'}
                              </Badge>
                            </Td>
                            <Td>
                              <RowActionMenu>
                                <Button type="button" size="sm" variant="outline" className="w-full justify-start" onClick={() => openProfileEditor(client, 'client')}>
                                  <Pencil size={15} />
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => handleAccountStatus(client.id, 'client', 'active')}>
                                  Active
                                </Button>
                                <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => handleBan(client.id, 'client')}>
                                  Ban
                                </Button>
                              </RowActionMenu>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </TableShell>
                  ) : (
                    <p className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:text-slate-400">
                      No client matched this admin search.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Paginated for scale
                  </p>
                  {clientDirectory.hasMore ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => loadDirectory('client')}
                      disabled={clientDirectory.loading}
                    >
                      {clientDirectory.loading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                      Load more clients
                    </Button>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {editingProfile ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-slate-950/40 p-3 sm:place-items-center sm:p-5">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">Edit {editingProfile.role} profile</h3>
              <Badge tone="blue">{editingProfile.userId}</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InputField
                label="Full name"
                value={editingProfile.fullName}
                onChange={(event) => updateEditField('fullName', event.target.value)}
              />
              <InputField
                label="Phone"
                value={editingProfile.phoneNumber}
                onChange={(event) => updateEditField('phoneNumber', event.target.value)}
              />
              <InputField
                label="Email"
                value={editingProfile.email}
                onChange={(event) => updateEditField('email', event.target.value)}
              />
              <SelectField
                label="Account status"
                options={['active', 'banned']}
                value={editingProfile.accountStatus}
                onChange={(event) => updateEditField('accountStatus', event.target.value)}
              />
              <InputField
                label="Location"
                value={editingProfile.location}
                onChange={(event) => updateEditField('location', event.target.value)}
              />
              {editingProfile.role === 'labour' ? (
                <InputField
                  label="Current location"
                  value={editingProfile.currentLocation}
                  onChange={(event) => updateEditField('currentLocation', event.target.value)}
                />
              ) : null}
            </div>

            {editingProfile.role === 'labour' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Category"
                  options={workCategories}
                  value={editingProfile.category}
                  onChange={(event) => updateEditField('category', event.target.value)}
                />
                <SelectField
                  label="Availability"
                  options={availabilityOptions}
                  value={editingProfile.availability}
                  onChange={(event) => updateEditField('availability', event.target.value)}
                />
                <InputField
                  label="Experience years"
                  type="number"
                  min="0"
                  value={editingProfile.experienceYears}
                  onChange={(event) => updateEditField('experienceYears', event.target.value)}
                />
                <InputField
                  label="Skills (comma separated)"
                  value={editingProfile.skills}
                  onChange={(event) => updateEditField('skills', event.target.value)}
                />
                <InputField
                  label="About"
                  value={editingProfile.about}
                  onChange={(event) => updateEditField('about', event.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            ) : null}

            <div className="mt-6 grid gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" onClick={closeProfileEditor} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="button" onClick={saveEditedProfile} disabled={savingEdit}>
                {savingEdit ? <LoaderCircle size={15} className="animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
};

export default AdminDashboardPage;

