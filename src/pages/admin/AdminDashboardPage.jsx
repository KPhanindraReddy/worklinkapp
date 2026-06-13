import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CircleOff,
  ExternalLink,
  LoaderCircle,
  Megaphone,
  MessageSquareWarning,
  Pencil,
  Search,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { ProfileAvatar } from '../../components/common/ProfileAvatar';
import { SelectField } from '../../components/common/SelectField';
import { Skeleton } from '../../components/common/Skeleton';
import { TextAreaField } from '../../components/common/TextAreaField';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { AppShell } from '../../components/layout/AppShell';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import {
  cleanupOverflowNotifications,
  getAdminDiagnostics,
  getAdminOverview,
  listSupportTickets,
  listAdminProfiles,
  sendAdminAnnouncement,
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

const TableShell = ({ children, minWidth = 'min-w-full', className = '' }) => (
  <div className={`overflow-auto bg-white ${className}`}>
    <table className={`${minWidth} text-left text-sm`}>
      {children}
    </table>
  </div>
);

const Th = ({ children }) => (
  <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 first:rounded-l-none last:rounded-r-none">
    {children}
  </th>
);

const Td = ({ children, className = '', ...props }) => (
  <td className={`min-w-0 border-b border-slate-100 px-3 py-4 align-middle text-slate-700 ${className}`} {...props}>
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

const AdminCard = ({ children, className = '', ...props }) => (
  <Card
    {...props}
    className={`rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
  >
    {children}
  </Card>
);

const AdminSectionHeader = ({ title, description, badge }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </div>
    {badge}
  </div>
);

const adminNavItems = [
  { label: 'Overview', href: '#overview' },
  { label: 'Announcements', href: '#announcements' },
  { label: 'Activity', href: '#activity' },
  { label: 'Labour', href: '#labour' },
  { label: 'Clients', href: '#clients' },
  { label: 'Bookings', href: '#bookings' },
  { label: 'Risk flags', href: '#risk-flags' },
  { label: 'Services', href: '#services' },
  { label: 'Diagnostics', href: '#diagnostics' },
  { label: 'Support', href: '#support' }
];

const AdminSidebar = () => (
  <aside className="sticky top-0 hidden h-screen w-[218px] shrink-0 flex-col border-r border-slate-200 bg-white text-slate-950 lg:flex">
    <div className="flex h-[86px] items-center border-b border-slate-200 px-6">
      <div>
        <BrandLogo to="/" className="[&_img]:rounded-lg [&_img]:shadow-none [&_span>span:first-child]:text-xl [&_span>span:first-child]:sm:text-xl" />
        <p className="mt-1 pl-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Admin panel
        </p>
      </div>
    </div>
    <nav className="flex-1 py-7">
      {adminNavItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="block min-h-12 border-l-4 border-transparent px-6 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-500 hover:bg-brand-50 hover:text-slate-950 focus:border-brand-500 focus:bg-brand-50 focus:text-slate-950"
        >
          {item.label}
        </a>
      ))}
    </nav>
    <div className="border-t border-slate-200 px-6 py-5 text-[11px] font-medium text-slate-500">
      Signed in as admin
    </div>
  </aside>
);

const AdminMetricGrid = ({ items, loading = false }) => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => (
      <AdminCard key={item.label} className="min-h-[136px] p-7">
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-slate-500">{item.label}</p>
        {loading ? (
          <Skeleton className="mt-4 h-9 w-24" />
        ) : (
          <h3 className="mt-2 text-4xl font-black leading-none text-slate-950">{item.value}</h3>
        )}
        {item.hint ? <p className="mt-3 text-sm text-slate-500">{item.hint}</p> : null}
      </AdminCard>
    ))}
  </div>
);

const AdminProfileCard = ({ cleaningRole, email, name, onCleanNotifications, onLogout, photo, role }) => (
  <details className="relative w-full sm:w-auto">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
      <ProfileAvatar
        src={photo}
        name={name || 'Admin'}
        className="h-9 w-9 rounded-full"
        loading="eager"
        decoding="sync"
      />
      <span className="min-w-0 flex-1">
        <span className="block max-w-[150px] truncate text-sm font-bold text-slate-950">
          {name || 'Admin profile'}
        </span>
        <span className="block truncate text-xs font-medium capitalize text-slate-500">
          {role || 'admin'}
        </span>
      </span>
      <span className="text-xs font-bold text-slate-400">Account</span>
    </summary>

    <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-soft">
      <div className="border-b border-slate-100 px-3 py-3">
        <p className="truncate text-sm font-bold text-slate-950">{name || 'Admin profile'}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{email || 'Admin account'}</p>
      </div>
      <Link
        to="/settings"
        className="mt-2 block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      >
        Settings
      </Link>
      <div className="my-2 border-t border-slate-100 pt-2">
        <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Cleanup notifications
        </p>
        <button
          type="button"
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={Boolean(cleaningRole)}
          onClick={() => onCleanNotifications?.('labour')}
        >
          {cleaningRole === 'labour' ? 'Cleaning labour...' : 'Clean labour notifications'}
        </button>
        <button
          type="button"
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={Boolean(cleaningRole)}
          onClick={() => onCleanNotifications?.('client')}
        >
          {cleaningRole === 'client' ? 'Cleaning clients...' : 'Clean client notifications'}
        </button>
      </div>
      <button
        type="button"
        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
        onClick={onLogout}
      >
        Logout
      </button>
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

const hasProfileLocation = (profile) =>
  Boolean(
    profile.currentLocation ||
      profile.location ||
      profile.workLocation ||
      profile.coordinates ||
      profile.locationCoordinates
  );

const firstFilled = (...values) =>
  values.find((value) => String(value ?? '').trim()) ?? '';

const getAdminProfileName = (profile, fallback) =>
  firstFilled(profile.fullName, profile.displayName, profile.name, profile.clientName, profile.labourName, fallback);

const getAdminProfilePhone = (profile) =>
  firstFilled(profile.phoneNumber, profile.phone, profile.mobileNumber, profile.contactNumber, profile.clientPhoneNumber);

const getAdminProfileEmail = (profile) =>
  firstFilled(profile.email, profile.emailAddress, profile.clientEmail);

const getAdminProfileLocation = (profile, options) =>
  firstFilled(
    getLocationLabel(profile, { ...options, fallback: '' }),
    profile.location,
    profile.currentLocation,
    profile.address,
    profile.currentAddress,
    profile.requestedAddress
  );

const toCommaText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');

const getProfileDetailsText = (profile) =>
  [
    profile.gender ? `Gender: ${profile.gender}` : '',
    profile.age ? `Age: ${profile.age}` : ''
  ]
    .filter(Boolean)
    .join(' / ') || 'Details not added';

const buildProfileRiskRows = (profiles, role) =>
  profiles.flatMap((profile) => {
    const rows = [];
    const name = profile.fullName || (role === 'labour' ? 'Labour' : 'Client');

    if (!profile.phoneNumber) {
      rows.push({
        id: `${role}-${profile.id}-missing-phone`,
        risk: 'Missing phone',
        subject: name,
        role,
        detail: profile.email || 'Contact number not added',
        tone: 'amber',
        priority: 3
      });
    }

    if (!hasProfileLocation(profile)) {
      rows.push({
        id: `${role}-${profile.id}-missing-location`,
        risk: 'Missing location',
        subject: name,
        role,
        detail: profile.phoneNumber || profile.email || 'Location not set',
        tone: 'rose',
        priority: 4
      });
    }

    return rows;
  });

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();
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
    messageFailures: [],
    repeatedCancellations: []
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
  const [cleaningNotificationsRole, setCleaningNotificationsRole] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [announcement, setAnnouncement] = useState({
    audience: 'all',
    title: '',
    body: '',
    route: '/notifications'
  });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const announcementSendInFlightRef = useRef(false);

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
      { label: 'Total users', value: overview.analytics.userCount ?? 0, hint: 'on the platform' },
      { label: 'Labour accounts', value: overview.analytics.labourCount ?? 0, hint: 'registered profiles' },
      { label: 'Client accounts', value: overview.analytics.clientCount ?? 0, hint: 'registered profiles' },
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

  const riskRows = useMemo(() => {
    const profileRisks = [
      ...buildProfileRiskRows(labourDirectory.items, 'labour'),
      ...buildProfileRiskRows(clientDirectory.items, 'client')
    ];
    const repeatedCancellationRisks = (diagnostics.repeatedCancellations || []).map((item) => ({
      id: `repeated-cancellations-${item.id}`,
      risk: 'Repeated cancellations',
      subject: item.name || 'Account',
      role: item.role || 'account',
      detail: `${item.count} cancelled/rejected bookings${item.services?.length ? ` - ${item.services.join(', ')}` : ''}`,
      tone: 'amber',
      priority: 5
    }));
    const stuckBookingRisks = (diagnostics.stuckBookings || []).map((item) => ({
      id: `stuck-booking-${item.id}`,
      risk: 'Stuck booking',
      subject: item.serviceType || 'Service booking',
      role: 'booking',
      detail: `${item.status || 'unknown'} for ${formatStuckDuration(item.ageMs)} - ${item.labourName || 'Labour'} / ${item.clientName || 'Client'}`,
      tone: 'rose',
      priority: 6
    }));
    const notificationRisks = (diagnostics.failedNotifications || []).map((item) => ({
      id: `failed-notification-${item.id}`,
      risk: 'Failed notification',
      subject: item.serviceType || 'Service booking',
      role: 'message',
      detail: item.lastErrorMessage || `${item.labourName || 'Labour'} / ${item.clientName || 'Client'}`,
      tone: 'rose',
      priority: 4
    }));
    const messageFailureRisks = (diagnostics.messageFailures || []).map((item) => ({
      id: `message-failure-${item.id}`,
      risk: 'Message failure',
      subject: item.kind || 'Message',
      role: 'message',
      detail: item.to || item.errorMessage || 'Delivery failed',
      tone: 'rose',
      priority: 4
    }));

    return [
      ...profileRisks,
      ...repeatedCancellationRisks,
      ...stuckBookingRisks,
      ...notificationRisks,
      ...messageFailureRisks
    ]
      .sort((a, b) => b.priority - a.priority || a.subject.localeCompare(b.subject))
      .slice(0, 24);
  }, [
    clientDirectory.items,
    diagnostics.failedNotifications,
    diagnostics.messageFailures,
    diagnostics.repeatedCancellations,
    diagnostics.stuckBookings,
    formatStuckDuration,
    labourDirectory.items
  ]);

  const riskSummary = useMemo(
    () => ({
      missingPhone: riskRows.filter((item) => item.risk === 'Missing phone').length,
      missingLocation: riskRows.filter((item) => item.risk === 'Missing location').length,
      repeatedCancellations: diagnostics.repeatedCancellations?.length || 0,
      stuckBookings: diagnostics.stuckBookings?.length || 0,
      failedMessages: (diagnostics.failedNotifications?.length || 0) + (diagnostics.messageFailures?.length || 0)
    }),
    [diagnostics, riskRows]
  );
  const firebaseProjectId = firebaseConfig.projectId || 'Slivz-labour';
  const functionsLogsUrl = `https://console.cloud.google.com/functions/list?project=${encodeURIComponent(
    firebaseProjectId
  )}`;
  const firestoreLogsUrl = `https://console.firebase.google.com/project/${encodeURIComponent(
    firebaseProjectId
  )}/firestore/data/~2FwhatsappLogs`;

  const openProfileEditor = (item, role) => {
    const fallbackName = role === 'client' ? 'Client' : 'Labour';

    setEditingProfile({
      userId: item.id,
      role,
      fullName: getAdminProfileName(item, fallbackName),
      phoneNumber: getAdminProfilePhone(item),
      email: getAdminProfileEmail(item),
      location: getAdminProfileLocation(item, { fallback: '' }),
      currentLocation: firstFilled(item.currentLocation, item.workLocation, item.location),
      accountStatus: item.accountStatus || 'active',
      gender: item.gender || '',
      age: item.age ?? '',
      category: item.category || '',
      availability: item.availability || 'Available',
      experienceYears: Number(item.experienceYears || 0),
      skills: Array.isArray(item.skills) ? item.skills.join(', ') : item.skills || '',
      languages: toCommaText(item.languages),
      education: item.education || '',
      dailyWage: item.dailyWage ?? 0,
      previousWorkHistory: toCommaText(item.previousWorkHistory),
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
                    : item.skills,
                languages:
                  editingProfile.role === 'labour'
                    ? String(editingProfile.languages || '')
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean)
                    : item.languages,
                previousWorkHistory:
                  editingProfile.role === 'labour'
                    ? String(editingProfile.previousWorkHistory || '')
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean)
                    : item.previousWorkHistory
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
  const handleAdminLogout = async () => {
    navigate('/auth?role=client&mode=login', { replace: true });
    await logout();
  };
  const handleNotificationCleanup = async (role) => {
    const roleLabel = role === 'labour' ? 'labour' : 'client';
    const confirmed = window.confirm(
      `Clean ${roleLabel} notifications? This keeps the newest 10 notifications per profile and deletes older ones from the database.`
    );

    if (!confirmed) {
      return;
    }

    setCleaningNotificationsRole(role);
    try {
      const result = await cleanupOverflowNotifications({ role, keepLatest: 10 });
      toast.success(
        result.deletedCount
          ? `Deleted ${result.deletedCount} old ${roleLabel} notifications for ${result.affectedUsers} profiles.`
          : `No ${roleLabel} profiles had more than 10 notifications.`
      );
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setCleaningNotificationsRole('');
    }
  };
  const handleSendAnnouncement = async (event) => {
    event.preventDefault();

    if (announcementSendInFlightRef.current) {
      return;
    }

    if (!announcement.title.trim() || !announcement.body.trim()) {
      toast.error('Add an announcement title and message.');
      return;
    }

    announcementSendInFlightRef.current = true;
    setSendingAnnouncement(true);
    try {
      const result = await sendAdminAnnouncement({
        adminId: currentUser?.uid,
        ...announcement
      });
      toast.success(`Announcement sent to ${result.sentCount} account${result.sentCount === 1 ? '' : 's'}.`);
      setAnnouncement((prev) => ({ ...prev, title: '', body: '' }));
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      announcementSendInFlightRef.current = false;
      setSendingAnnouncement(false);
    }
  };
  const adminProfileName = userProfile?.fullName || currentUser?.displayName || 'Admin profile';
  const adminProfileEmail = userProfile?.email || currentUser?.email || '';
  const adminProfilePhoto = userProfile?.profilePhoto || currentUser?.photoURL || '';

  return (
    <AppShell hideNavbar hideFooter hideBottomDock contentClassName="bg-slate-50">
      <PageSEO title="Admin Dashboard" description="Manage Slivz users, verification, reports, analytics, and marketplace operations." />

      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[924px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
            <div className="space-y-7">
              <section id="overview" className="scroll-mt-8">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                      Marketplace overview
                    </h1>
                    <p className="mt-3 text-sm text-slate-600 sm:text-base">
                      Live snapshot of platform health and activity.
                    </p>
                  </div>
                  <AdminProfileCard
                    cleaningRole={cleaningNotificationsRole}
                    email={adminProfileEmail}
                    name={adminProfileName}
                    onCleanNotifications={handleNotificationCleanup}
                    onLogout={handleAdminLogout}
                    photo={adminProfilePhoto}
                    role={userProfile?.role || 'admin'}
                  />
                </div>

                <AdminMetricGrid items={metrics} loading={overviewLoading} />
              </section>

              <AdminCard id="announcements" className="scroll-mt-8">
                <AdminSectionHeader
                  title="Send announcement"
                  description="Send offers and platform updates through the existing in-app and mobile notification flow."
                  badge={<Badge tone="blue"><Megaphone size={13} /> Broadcast</Badge>}
                />
                <form className="grid gap-4" onSubmit={handleSendAnnouncement}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Audience"
                      value={announcement.audience}
                      options={[
                        { label: 'Everyone', value: 'all' },
                        { label: 'Clients only', value: 'client' },
                        { label: 'Labour only', value: 'labour' }
                      ]}
                      onChange={(event) => setAnnouncement((prev) => ({ ...prev, audience: event.target.value }))}
                    />
                    <SelectField
                      label="Open page"
                      value={announcement.route}
                      options={[
                        { label: 'Notifications', value: '/notifications' },
                        { label: 'Search services', value: '/search' },
                        { label: 'Recent services', value: '/recent-services' }
                      ]}
                      onChange={(event) => setAnnouncement((prev) => ({ ...prev, route: event.target.value }))}
                    />
                  </div>
                  <InputField
                    label="Title"
                    value={announcement.title}
                    maxLength={80}
                    placeholder="Weekend service offer"
                    onChange={(event) => setAnnouncement((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <TextAreaField
                    label="Message"
                    value={announcement.body}
                    maxLength={240}
                    placeholder="Book today and receive a special service offer."
                    onChange={(event) => setAnnouncement((prev) => ({ ...prev, body: event.target.value }))}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={sendingAnnouncement}>
                      {sendingAnnouncement ? <LoaderCircle size={15} className="animate-spin" /> : <Megaphone size={15} />}
                      {sendingAnnouncement ? 'Sending...' : 'Send announcement'}
                    </Button>
                  </div>
                </form>
              </AdminCard>

              <AdminCard>
                <AdminSectionHeader
                  title="Website analytics"
                  description="Simple count view for users, labour, clients, bookings, and earnings."
                  badge={<Badge tone="blue">Live summary</Badge>}
                />
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
              </AdminCard>

              <AdminCard id="activity" className="scroll-mt-8">
                <AdminSectionHeader
                  title="Recent activity"
                  description="Latest signups, bookings, completed services, and support movements."
                  badge={<Badge tone="blue">{overview.recentActivity?.length || 0} updates</Badge>}
                />
              <TableShell className="max-h-[420px] rounded-xl border border-slate-100">
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
              </AdminCard>

              <AdminCard id="support" className="scroll-mt-8">
                <AdminSectionHeader
                  title="Support tickets"
                  description="Tickets raised from client and labour profiles."
                  badge={<Badge tone="amber">{tickets.length} tickets</Badge>}
                />
              <TableShell className="max-h-[460px] rounded-xl border border-slate-100">
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
                          <p className="text-xs font-medium text-slate-500">{ticket.role || 'account'}</p>
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
              </AdminCard>

              <AdminCard id="risk-flags" className="scroll-mt-8">
                <AdminSectionHeader
                  title="Risk flags"
                  description="Accounts and bookings that need attention because details are missing or operational checks failed."
                  badge={<Badge tone={riskRows.length ? 'amber' : 'emerald'}>{riskRows.length} active flags</Badge>}
                />

                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['Missing phone', riskSummary.missingPhone],
                    ['Missing location', riskSummary.missingLocation],
                    ['Repeated cancellations', riskSummary.repeatedCancellations],
                    ['Stuck bookings', riskSummary.stuckBookings],
                    ['Failed messages', riskSummary.failedMessages]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>

                <TableShell minWidth="min-w-[860px]" className="max-h-[430px] rounded-xl border border-slate-100">
                  <thead>
                    <tr>
                      <Th>Risk</Th>
                      <Th>Subject</Th>
                      <Th>Area</Th>
                      <Th>Details</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(diagnosticsLoading || labourDirectory.loading || clientDirectory.loading) && !riskRows.length ? (
                      <tr>
                        <Td colSpan={4}><Skeleton className="h-8 w-full" /></Td>
                      </tr>
                    ) : riskRows.length ? (
                      riskRows.map((item) => (
                        <tr key={item.id}>
                          <Td><Badge tone={item.tone}>{item.risk}</Badge></Td>
                          <Td className="font-semibold text-slate-950">{item.subject}</Td>
                          <Td className="capitalize">{item.role}</Td>
                          <Td className="min-w-64">{item.detail}</Td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <Td colSpan={4} className="text-slate-600">No active risk flags found in loaded records.</Td>
                      </tr>
                    )}
                  </tbody>
                </TableShell>
              </AdminCard>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <AdminCard>
                <AdminSectionHeader
                  title="Pending labour verification"
                  badge={<Badge tone="amber">{overview.pendingLabours.length} pending</Badge>}
                />
                <div className="mt-5 space-y-4">
                  {overviewLoading ? (
                    <>
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </>
                  ) : overview.pendingLabours.length ? (
                    overview.pendingLabours.map((labour) => (
                      <div key={labour.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-slate-950">{labour.fullName}</h3>
                            <p className="text-sm text-slate-600">
                              {labour.category} - {getLocationLabel(labour, { preferCurrent: true })}
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {labour.experienceYears} years experience - {labour.skills?.join(', ')}
                            </p>
                          </div>
                          <VerificationBadge verified={labour.verified} />
                        </div>
                        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
                          <Button size="sm" className="w-full sm:w-auto" onClick={() => handleVerify(labour.id)}>
                            Approve ID
                          </Button>
                          <Button size="sm" variant="outline" className="w-full border-rose-300 text-rose-600 hover:border-rose-400 hover:text-rose-700 sm:w-auto" onClick={() => handleBan(labour.id, 'labour')}>
                            Ban user
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">
                      No pending labour verifications right now.
                    </p>
                  )}
                </div>
              </AdminCard>

              <AdminCard id="services" className="scroll-mt-8">
                <AdminSectionHeader
                  title="Top searched services"
                  description="Quick top 5 from client clicks and search interest."
                  badge={<Badge tone="blue">Top 5</Badge>}
                />
                <TableShell className="max-h-[360px] rounded-xl border border-slate-100">
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
              </AdminCard>

              <AdminCard>
                <AdminSectionHeader
                  title="Service people count"
                  description="See how many labour people are registered for each service."
                  badge={<Badge tone="blue">{overview.categories.length} services</Badge>}
                />
                <TableShell className="max-h-[420px] rounded-xl border border-slate-100">
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
              </AdminCard>

              <AdminCard>
                <AdminSectionHeader
                  title="New service names"
                  description="Services typed by labour that are not in the default list."
                  badge={<Badge tone="amber">{overview.customServices.length} new</Badge>}
                />
                <TableShell className="max-h-[360px] rounded-xl border border-slate-100">
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
              </AdminCard>
            </div>

            <AdminCard id="diagnostics" className="scroll-mt-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Diagnostics</h2>
                  <p className="mt-2 text-sm text-slate-600">
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
            </AdminCard>

            <AdminCard id="bookings" className="scroll-mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">No-labour demand by service</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Services clients searched when no available labour was found.
                  </p>
                </div>
                <Badge tone="amber">{overview.demandByService?.length || 0} services</Badge>
              </div>
              <div className="mt-5">
                <TableShell className="max-h-[360px] rounded-xl border border-slate-100">
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
            </AdminCard>

            <AdminCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Requested addresses</h2>
                  <p className="mt-2 text-sm text-slate-600">
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
            </AdminCard>

            <div className="grid gap-6">
              <AdminCard id="labour" className="scroll-mt-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Labour directory</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Review profiles, verify IDs, and manage labour accounts.
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
                    <TableShell minWidth="min-w-[1120px]" className="max-h-[520px] rounded-xl border border-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Name</Th>
                          <Th>Service</Th>
                          <Th>Details</Th>
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
                            <Td className="min-w-40">{getProfileDetailsText(labour)}</Td>
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
                    <p className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      No labour matched this admin search.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
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
              </AdminCard>

              <AdminCard id="clients" className="scroll-mt-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Client directory</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Review client contact details and account status.
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
                    <TableShell minWidth="min-w-[920px]" className="max-h-[520px] rounded-xl border border-slate-100">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Name</Th>
                          <Th>Details</Th>
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
                                  {getAdminProfileName(client, 'C').charAt(0).toUpperCase()}
                                </span>
                                <p className="font-semibold text-slate-950">{getAdminProfileName(client, 'Client')}</p>
                              </div>
                            </Td>
                            <Td className="min-w-40">{getProfileDetailsText(client)}</Td>
                            <Td>
                              <p className="break-all">{getAdminProfilePhone(client) || 'Phone not added'}</p>
                              <p className="break-all text-xs text-slate-500">{getAdminProfileEmail(client) || 'Email not added'}</p>
                            </Td>
                            <Td className="min-w-48">{getAdminProfileLocation(client) || 'Location not set'}</Td>
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
                    <p className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      No client matched this admin search.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:flex sm:items-center sm:justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
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
              </AdminCard>
            </div>
          </div>
          </div>
        </main>
      </div>

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
              <SelectField
                label="Gender"
                options={['', 'Male', 'Female', 'Other']}
                value={editingProfile.gender}
                onChange={(event) => updateEditField('gender', event.target.value)}
              />
              <InputField
                label="Age"
                type="number"
                min="0"
                value={editingProfile.age}
                onChange={(event) => updateEditField('age', event.target.value)}
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
                  label="Daily wage"
                  type="number"
                  min="0"
                  value={editingProfile.dailyWage}
                  onChange={(event) => updateEditField('dailyWage', event.target.value)}
                />
                <InputField
                  label="Education"
                  value={editingProfile.education}
                  onChange={(event) => updateEditField('education', event.target.value)}
                />
                <InputField
                  label="Skills (comma separated)"
                  value={editingProfile.skills}
                  onChange={(event) => updateEditField('skills', event.target.value)}
                />
                <InputField
                  label="Languages (comma separated)"
                  value={editingProfile.languages}
                  onChange={(event) => updateEditField('languages', event.target.value)}
                />
                <InputField
                  label="About"
                  value={editingProfile.about}
                  onChange={(event) => updateEditField('about', event.target.value)}
                  className="sm:col-span-2"
                />
                <InputField
                  label="Previous work history"
                  value={editingProfile.previousWorkHistory}
                  onChange={(event) => updateEditField('previousWorkHistory', event.target.value)}
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

