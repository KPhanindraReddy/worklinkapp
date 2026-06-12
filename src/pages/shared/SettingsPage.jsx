import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  LogOut,
  MapPin,
  Pencil,
  Send,
  Settings,
  UserRound,
  Wrench,
  X
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AutocompleteSelect } from '../../components/common/AutocompleteSelect';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { PhoneInputField } from '../../components/common/PhoneInputField';
import { ProfilePhotoUploader } from '../../components/common/ProfilePhotoUploader';
import { SelectField } from '../../components/common/SelectField';
import { TextAreaField } from '../../components/common/TextAreaField';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { ProfileLocationPanel } from '../../components/location/ProfileLocationPanel';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { subscribeBookingsForUser } from '../../services/bookingService';
import { submitCustomServiceRequest } from '../../services/customServiceService';
import { updateAvailability } from '../../services/labourService';
import { subscribeReviewsForLabour } from '../../services/reviewService';
import { createSupportTicket, listUserSupportTickets } from '../../services/supportTicketService';
import { availabilityOptions, languageOptions, workCategories } from '../../utils/constants';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText } from '../../utils/location';
import { getIndianLocalPhoneNumber } from '../../utils/phone';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';

const toCommaText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');
const isGmailAddress = (value) => /^[^\s@]+@gmail\.com$/i.test(String(value || '').trim());

const buildProfileForm = (profile, currentUser) => ({
  fullName: profile?.fullName || currentUser?.displayName || '',
  phoneNumber: profile?.phoneNumber || currentUser?.phoneNumber || '',
  email: profile?.email || currentUser?.email || '',
  location: getDisplayLocationText(profile?.location, ''),
  currentLocation: getDisplayLocationText(profile?.currentLocation || profile?.location, ''),
  coordinates: profile?.coordinates || null,
  profilePhotoUrl: profile?.profilePhoto || buildProfileAvatarDataUrl(profile?.fullName || currentUser?.displayName || 'Profile'),
  category: profile?.category || '',
  skills: toCommaText(profile?.skills),
  languages: toCommaText(profile?.languages),
  gender: profile?.gender || '',
  age: profile?.age ?? '',
  education: profile?.education || '',
  experienceYears: profile?.experienceYears ?? '',
  dailyWage: profile?.dailyWage ?? 0,
  availability: profile?.availability || 'Available',
  about: profile?.about || '',
  previousWorkHistory: toCommaText(profile?.previousWorkHistory)
});

const FieldSectionTitle = ({ icon: Icon, tone = 'brand', children }) => {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600'
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneClass}`}>
        <Icon size={17} />
      </span>
      <h2 className="text-base font-bold text-slate-950 sm:text-lg">{children}</h2>
    </div>
  );
};

const ProfileStat = ({ value, label, tone = 'slate' }) => {
  const toneClass = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-500',
    brand: 'text-brand-600',
    slate: 'text-slate-950'
  }[tone];

  return (
    <div className="min-w-0 flex-1 basis-0 px-2 text-center">
      <p className={`truncate text-sm font-extrabold leading-tight sm:text-xl ${toneClass}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-slate-400 sm:text-xs">{label}</p>
    </div>
  );
};

const availabilityStyles = {
  Available: {
    active: 'bg-emerald-600 text-white shadow-sm',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500'
  },
  Busy: {
    active: 'bg-amber-500 text-white shadow-sm',
    text: 'text-amber-600',
    dot: 'bg-amber-500'
  },
  Offline: {
    active: 'bg-rose-600 text-white shadow-sm',
    text: 'text-rose-600',
    dot: 'bg-rose-500'
  }
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    userProfile,
    createOrUpdateUserProfile,
    logout,
    refreshProfile
  } = useAuth();
  const [formValues, setFormValues] = useState(() => buildProfileForm(userProfile, currentUser));
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingSection, setEditingSection] = useState('');
  const [availabilityOverride, setAvailabilityOverride] = useState('');
  const [labourBookings, setLabourBookings] = useState([]);
  const [labourBookingsLoaded, setLabourBookingsLoaded] = useState(false);
  const [labourReviews, setLabourReviews] = useState([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [lastTicketNumber, setLastTicketNumber] = useState('');
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [userTickets, setUserTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    if (!editingSection) {
      setFormValues({
        ...buildProfileForm(userProfile, currentUser),
        ...(availabilityOverride ? { availability: availabilityOverride } : {})
      });
    }
  }, [availabilityOverride, currentUser, editingSection, userProfile]);

  useEffect(() => {
    if (availabilityOverride && userProfile?.availability === availabilityOverride) {
      setAvailabilityOverride('');
    }
  }, [availabilityOverride, userProfile?.availability]);

  useEffect(() => {
    if (!currentUser?.uid || userProfile?.role !== 'labour') {
      setLabourBookings([]);
      setLabourBookingsLoaded(false);
      setLabourReviews([]);
      return undefined;
    }

    setLabourBookingsLoaded(false);

    const unsubscribeBookings = subscribeBookingsForUser(
      { userId: currentUser.uid, role: 'labour' },
      (nextBookings) => {
        setLabourBookings(nextBookings);
        setLabourBookingsLoaded(true);
      },
      () => {
        setLabourBookings([]);
        setLabourBookingsLoaded(true);
      }
    );
    const unsubscribeReviews = subscribeReviewsForLabour(
      currentUser.uid,
      setLabourReviews,
      () => setLabourReviews([])
    );

    return () => {
      unsubscribeBookings();
      unsubscribeReviews();
    };
  }, [currentUser?.uid, userProfile?.role]);

  const isLabour = userProfile?.role === 'labour';
  const isClient = userProfile?.role === 'client';
  const roleSummary = useMemo(
    () => (userProfile?.role ? `${userProfile.role} account` : 'Profile'),
    [userProfile?.role]
  );
  const profileInitial = useMemo(
    () => (formValues.fullName || userProfile?.fullName || currentUser?.displayName || 'U').trim().charAt(0).toUpperCase(),
    [currentUser?.displayName, formValues.fullName, userProfile?.fullName]
  );
  const profilePhotoUrl =
    userProfile?.profilePhoto ||
    formValues.profilePhotoUrl ||
    buildProfileAvatarDataUrl(formValues.fullName || userProfile?.fullName || currentUser?.displayName || 'Profile');
  const isEditingPersonal = editingSection === 'personal';
  const isEditingWork = editingSection === 'work';
  const canSaveProfile = isEditingWork
    ? Boolean(formValues.category && formValues.skills.trim())
    : Boolean(formValues.fullName.trim() && (formValues.phoneNumber.trim() || formValues.email.trim()));
  const hasValidPhoneNumber = !formValues.phoneNumber.trim() || getIndianLocalPhoneNumber(formValues.phoneNumber).length === 10;
  const hasValidEmail = !formValues.email.trim() || isGmailAddress(formValues.email);
  const personalFieldsDisabled = !isEditingPersonal || savingProfile;
  const workFieldsDisabled = !isEditingWork || savingProfile;

  const updateFormValue = (key, value) =>
    setFormValues((prev) => ({
      ...prev,
      [key]: value
    }));

  const saveProfile = async () => {
    if (!currentUser || !userProfile?.role) {
      return;
    }

    if (!canSaveProfile) {
      if (isEditingWork) {
        toast.error('Enter service and skills before saving.');
      } else if (isClient || isLabour) {
        toast.error('Enter name and phone or email before saving.');
      } else {
        toast.error('Enter name and phone or email before saving.');
      }
      return;
    }

    if (!hasValidPhoneNumber) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }

    if (!hasValidEmail) {
      toast.error('Enter a valid Gmail address.');
      return;
    }

    setSavingProfile(true);

    try {
      const savedProfile = await createOrUpdateUserProfile(currentUser, {
        ...formValues,
        role: userProfile.role,
        location: isClient ? formValues.location : formValues.currentLocation,
        currentLocation: isLabour ? formValues.currentLocation : '',
        coordinates: formValues.coordinates,
        about: isLabour ? formValues.about : '',
        previousWorkHistory: isLabour ? formValues.previousWorkHistory : ''
      });
      if (isLabour && formValues.category) {
        await submitCustomServiceRequest({
          name: formValues.category,
          labourId: currentUser.uid,
          labourName: formValues.fullName,
          source: 'settings'
        });
      }
      toast.success('Profile updated successfully.');
      setFormValues({
        ...buildProfileForm({ ...userProfile, ...savedProfile }, currentUser),
        ...(availabilityOverride ? { availability: availabilityOverride } : {})
      });
      await refreshProfile();
      setEditingSection('');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    setFormValues(buildProfileForm(userProfile, currentUser));
    setEditingSection('');
  };

  const changeAvailability = async (nextAvailability) => {
    if (!isLabour || !currentUser || formValues.availability === nextAvailability) {
      return;
    }

    const previousAvailability = formValues.availability;

    setAvailabilityOverride(nextAvailability);
    setFormValues((prev) => ({ ...prev, availability: nextAvailability }));

    if (editingSection) {
      return;
    }

    setSavingProfile(true);

    try {
      await updateAvailability(currentUser.uid, nextAvailability);
    } catch (error) {
      setAvailabilityOverride('');
      setFormValues((prev) => ({ ...prev, availability: previousAvailability }));
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    navigate('/auth?role=client&mode=login', { replace: true });
    await logout();
  };

  const loadUserTickets = async () => {
    if (!currentUser?.uid) {
      setUserTickets([]);
      return;
    }

    setTicketsLoading(true);

    try {
      setUserTickets(await listUserSupportTickets(currentUser.uid));
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setTicketsLoading(false);
    }
  };

  const openTicketDialog = async () => {
    setTicketDialogOpen(true);
    await loadUserTickets();
  };

  const submitTicket = async () => {
    if (!currentUser || !userProfile?.role) {
      toast.error('Sign in before raising a ticket.');
      return;
    }

    setTicketSubmitting(true);

    try {
      const ticket = await createSupportTicket({
        userId: currentUser.uid,
        role: userProfile.role,
        fullName: formValues.fullName || userProfile.fullName || currentUser.displayName || '',
        phoneNumber: formValues.phoneNumber || userProfile.phoneNumber || currentUser.phoneNumber || '',
        email: formValues.email || userProfile.email || currentUser.email || '',
        subject: ticketForm.subject,
        description: ticketForm.description
      });

      setLastTicketNumber(ticket?.ticketNumber || '');
      setTicketForm({ subject: '', description: '' });
      await loadUserTickets();
      toast.success(ticket?.ticketNumber ? `Ticket ${ticket.ticketNumber} raised.` : 'Ticket raised.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setTicketSubmitting(false);
    }
  };
  const locationLabel = isClient
    ? formValues.location || 'Location not set'
    : formValues.currentLocation || 'Location not set';
  const primarySkill = formValues.category || 'Skill';
  const completedJobs = labourBookings.filter(
    (booking) => booking.status === 'completed' && booking.paymentStatus === 'paid'
  ).length;
  const completedJobsDisplay = labourBookingsLoaded ? completedJobs : '...';
  const rating = labourReviews.length
    ? labourReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / labourReviews.length
    : Number(userProfile?.rating) || 0;
  const currentAvailabilityStyle = availabilityStyles[formValues.availability] || availabilityStyles.Available;

  return (
    <AppShell>
      <PageSEO title="Profile & Settings" description="Manage your Slivz profile details." />

      <section className="section-space bg-white sm:bg-transparent">
        <div className="page-shell max-w-[860px] space-y-3 sm:space-y-4">
          <div className="rounded-[18px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <div className="relative rounded-t-[18px] bg-slate-800 px-4 pb-6 pt-5 text-white sm:px-5 sm:py-7">
              <div className="flex min-w-0 items-center gap-3 pr-12 sm:gap-4">
                <ProfilePhotoUploader
                  compact
                  persistOnUpload
                  uid={currentUser?.uid}
                  role={userProfile?.role}
                  value={profilePhotoUrl}
                  fullName={formValues.fullName || userProfile?.fullName || currentUser?.displayName || 'Profile'}
                  avatarClassName="h-16 w-16 sm:h-20 sm:w-20"
                  disabled={savingProfile}
                  onChange={(url) => updateFormValue('profilePhotoUrl', url)}
                  onError={(error) => toast.error(getFirebaseErrorMessage(error))}
                />
                <div className="min-w-0">
                  <h1 className="truncate text-[1.65rem] font-extrabold leading-tight tracking-normal sm:text-3xl">
                    {formValues.fullName.trim() || 'Not filled'}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/80">
                      {roleSummary}
                    </span>
                    {isLabour ? (
                      <VerificationBadge
                        verified={userProfile?.verified}
                        verifiedLabel="Verified"
                        pendingLabel="Not verified"
                      />
                    ) : (
                      <Badge tone="blue">Active</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isLabour ? (
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-stretch divide-x divide-slate-100 rounded-[16px] border border-slate-200 bg-white px-1 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                  <ProfileStat value={completedJobsDisplay} label="Jobs done" tone="emerald" />
                  <ProfileStat value={rating ? rating.toFixed(1) : '0.0'} label="Rating" tone="amber" />
                  <ProfileStat value={primarySkill} label="Skills" tone="brand" />
                </div>
              </div>
            ) : null}

            {isLabour ? (
              <div className="border-t border-slate-100 px-4 pb-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-950">Availability</h2>
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${currentAvailabilityStyle.text}`}>
                    <span className={`h-2 w-2 rounded-full ${currentAvailabilityStyle.dot}`} />
                    {formValues.availability}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-slate-200 bg-slate-50 p-1">
                  {availabilityOptions.map((option) => {
                    const value = option.value ?? option;
                    const label = option.label ?? option;
                    const selected = formValues.availability === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={savingProfile}
                        onClick={() => changeAvailability(value)}
                        className={`min-h-10 rounded-xl px-2 text-sm font-semibold transition ${
                          selected
                            ? (availabilityStyles[value]?.active || availabilityStyles.Available.active)
                            : 'text-slate-500 hover:bg-white hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FieldSectionTitle icon={UserRound}>Personal details</FieldSectionTitle>
              <div className="flex gap-2">
                {isEditingPersonal ? (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={cancelProfileEdit} disabled={savingProfile}>
                      <X size={15} />
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={saveProfile} disabled={savingProfile}>
                      <CheckCircle2 size={15} />
                      {savingProfile ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection('personal')} disabled={savingProfile || Boolean(editingSection)}>
                    <Pencil size={15} />
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField
                label="Full name"
                disabled={personalFieldsDisabled}
                value={formValues.fullName}
                onChange={(event) => updateFormValue('fullName', event.target.value)}
                placeholder=""
              />
              <PhoneInputField
                label="Phone number"
                disabled={personalFieldsDisabled || Boolean(userProfile?.phoneNumber || currentUser?.phoneNumber)}
                value={formValues.phoneNumber}
                onChange={(event) => updateFormValue('phoneNumber', event.target.value)}
              />
              <InputField
                label="Email"
                type="email"
                disabled={personalFieldsDisabled || Boolean(userProfile?.email || currentUser?.email)}
                value={formValues.email}
                onChange={(event) => updateFormValue('email', event.target.value)}
                placeholder=""
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Gender"
                  placeholder="Select gender"
                  disabled={personalFieldsDisabled}
                  value={formValues.gender}
                  options={['Male', 'Female', 'Other']}
                  onChange={(event) => updateFormValue('gender', event.target.value)}
                />
                <InputField
                  label="Age"
                  type="number"
                  disabled={personalFieldsDisabled}
                  value={formValues.age}
                  onChange={(event) => updateFormValue('age', event.target.value)}
                  placeholder="Not set"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
            <FieldSectionTitle icon={MapPin} tone="emerald">Location</FieldSectionTitle>
            {isClient ? (
              <>
                <InputField
                  label="Current location"
                  disabled={personalFieldsDisabled}
                  value={formValues.location}
                  onChange={(event) => updateFormValue('location', event.target.value)}
                  placeholder="Not set"
                />
                <ProfileLocationPanel
                  roleLabel="client"
                  locationValue={formValues.location}
                  savedCoordinates={formValues.coordinates}
                  disabled={personalFieldsDisabled}
                  onApplyLocation={({ label, coordinates }) =>
                    setFormValues((prev) => ({
                      ...prev,
                      location: label || getDisplayLocationText(prev.location, ''),
                      coordinates
                    }))
                  }
                />
              </>
            ) : (
              <>
                <InputField
                  label="Current location"
                  disabled={personalFieldsDisabled}
                  value={formValues.currentLocation}
                  onChange={(event) => updateFormValue('currentLocation', event.target.value)}
                  placeholder="Select or type service"
                />
                <ProfileLocationPanel
                  roleLabel="labour"
                  locationValue={formValues.currentLocation}
                  savedCoordinates={formValues.coordinates}
                  disabled={personalFieldsDisabled}
                  onApplyLocation={({ label, coordinates }) =>
                    setFormValues((prev) => ({
                      ...prev,
                      currentLocation: label || getDisplayLocationText(prev.currentLocation, ''),
                      coordinates
                    }))
                  }
                />
              </>
            )}
            <p className="truncate text-xs font-medium text-slate-400">{locationLabel}</p>
          </Card>

          {isLabour ? (
            <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FieldSectionTitle icon={Wrench} tone="amber">Work details</FieldSectionTitle>
                <div className="flex gap-2">
                  {isEditingWork ? (
                    <>
                      <Button type="button" size="sm" variant="outline" onClick={cancelProfileEdit} disabled={savingProfile}>
                        <X size={15} />
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={saveProfile} disabled={savingProfile}>
                        <CheckCircle2 size={15} />
                        {savingProfile ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection('work')} disabled={savingProfile || Boolean(editingSection)}>
                      <Pencil size={15} />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AutocompleteSelect
                  label="Work category"
                  placeholder="Select or type service"
                  disabled={workFieldsDisabled}
                  value={formValues.category}
                  options={workCategories}
                  onChange={(event) => updateFormValue('category', event.target.value)}
                  allowCustom
                  customOptionLabel="Add service"
                />
                <InputField
                  label="Experience (yrs)"
                  type="number"
                  disabled={workFieldsDisabled}
                  value={formValues.experienceYears}
                  onChange={(event) => updateFormValue('experienceYears', event.target.value)}
                  placeholder="5"
                />
                <InputField
                  label="Education"
                  disabled={workFieldsDisabled}
                  value={formValues.education}
                  onChange={(event) => updateFormValue('education', event.target.value)}
                  placeholder="SSC / ITI / Diploma / Degree"
                  className="sm:col-span-2"
                />
                <InputField
                  label="Skills"
                  disabled={workFieldsDisabled}
                  value={formValues.skills}
                  onChange={(event) => updateFormValue('skills', event.target.value)}
                  placeholder="Arc welding, MIG welding..."
                  hint="Use commas to separate multiple skills."
                  className="sm:col-span-2"
                />
                <InputField
                  label="Languages known"
                  disabled={workFieldsDisabled}
                  value={formValues.languages}
                  onChange={(event) => updateFormValue('languages', event.target.value)}
                  placeholder={languageOptions.join(', ')}
                  hint="Use commas to separate multiple languages."
                  className="sm:col-span-2"
                />
                <TextAreaField
                  label="About"
                  disabled={workFieldsDisabled}
                  value={formValues.about}
                  onChange={(event) => updateFormValue('about', event.target.value)}
                  placeholder="Describe your work style, strengths..."
                  className="sm:col-span-2"
                />
                <TextAreaField
                  label="Previous work history"
                  disabled={workFieldsDisabled}
                  value={formValues.previousWorkHistory}
                  onChange={(event) => updateFormValue('previousWorkHistory', event.target.value)}
                  placeholder="Apartment rewiring, RO repair..."
                  className="sm:col-span-2"
                />
              </div>
            </Card>
          ) : null}

          <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
            <FieldSectionTitle icon={Settings} tone="slate">Support</FieldSectionTitle>
            {lastTicketNumber ? (
              <div className="rounded-[14px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Ticket number: {lastTicketNumber}
              </div>
            ) : null}
            <Button type="button" className="w-full sm:w-auto" onClick={openTicketDialog}>
              <Send size={16} />
              Raise ticket
            </Button>
            <div className="rounded-[14px] border border-rose-100 bg-rose-50 p-3">
              <p className="mb-3 text-xs font-medium text-slate-500">
                Signed in to Slivz as <span className="font-bold text-slate-700">{formValues.fullName || 'user'}</span>
              </p>
              <Button variant="danger" className="w-full" onClick={handleLogout}>
                <LogOut size={16} />
                Sign out
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {ticketDialogOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center sm:p-5">
          <Card className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Raise ticket</h2>
                <p className="mt-1 text-sm text-slate-500">Track old tickets or send another one.</p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                onClick={() => setTicketDialogOpen(false)}
                aria-label="Close ticket popup"
              >
                <X size={17} />
              </button>
            </div>
            {lastTicketNumber ? (
              <div className="mt-4 rounded-[14px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Ticket ID: {lastTicketNumber}
              </div>
            ) : null}
            <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-950">Your tickets</h3>
                <Badge tone="slate">{userTickets.length} total</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {ticketsLoading ? (
                  <p className="text-sm font-medium text-slate-500">Loading tickets...</p>
                ) : userTickets.length ? (
                  userTickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-[14px] border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">{ticket.ticketNumber || ticket.id}</p>
                          <p className="mt-1 truncate text-xs font-medium text-slate-500">{ticket.subject}</p>
                        </div>
                        <Badge tone={ticket.status === 'solved' ? 'emerald' : 'amber'}>
                          {ticket.status === 'solved' ? 'Solved' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-medium text-slate-500">No tickets raised yet.</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <InputField
                label="Subject"
                value={ticketForm.subject}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Payment, booking, profile, or account issue"
              />
              <TextAreaField
                label="Description"
                value={ticketForm.description}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe what happened and what help you need."
              />
            </div>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setTicketDialogOpen(false)} disabled={ticketSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitTicket}
                disabled={ticketSubmitting || !ticketForm.subject.trim() || !ticketForm.description.trim()}
              >
                <Send size={16} />
                {ticketSubmitting ? 'Sending...' : 'Send ticket'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
};

export default SettingsPage;
