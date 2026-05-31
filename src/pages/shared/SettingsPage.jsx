import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Info,
  LogOut,
  MapPin,
  Pencil,
  Search,
  Settings,
  UserRound,
  Wrench,
  X
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { SelectField } from '../../components/common/SelectField';
import { TextAreaField } from '../../components/common/TextAreaField';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { ProfileLocationPanel } from '../../components/location/ProfileLocationPanel';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { updateAvailability } from '../../services/labourService';
import { availabilityOptions, languageOptions, workCategories } from '../../utils/constants';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText } from '../../utils/location';

const toCommaText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');

const buildProfileForm = (profile, currentUser) => ({
  fullName: profile?.fullName || currentUser?.displayName || '',
  phoneNumber: profile?.phoneNumber || currentUser?.phoneNumber || '',
  email: profile?.email || currentUser?.email || '',
  location: getDisplayLocationText(profile?.location, ''),
  currentLocation: getDisplayLocationText(profile?.currentLocation || profile?.location, ''),
  coordinates: profile?.coordinates || null,
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
  const { currentUser, userProfile, createOrUpdateUserProfile, logout } = useAuth();
  const [formValues, setFormValues] = useState(() => buildProfileForm(userProfile, currentUser));
  const [savingProfile, setSavingProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availabilityOverride, setAvailabilityOverride] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setFormValues({
        ...buildProfileForm(userProfile, currentUser),
        ...(availabilityOverride ? { availability: availabilityOverride } : {})
      });
    }
  }, [availabilityOverride, currentUser, isEditing, userProfile]);

  useEffect(() => {
    if (availabilityOverride && userProfile?.availability === availabilityOverride) {
      setAvailabilityOverride('');
    }
  }, [availabilityOverride, userProfile?.availability]);

  const isLabour = userProfile?.role === 'labour';
  const isClient = userProfile?.role === 'client';
  const roleSummary = useMemo(
    () => (userProfile?.role ? `${userProfile.role} account` : 'Profile'),
    [userProfile?.role]
  );
  const profileInitial = useMemo(
    () => (userProfile?.fullName || currentUser?.displayName || 'U').trim().charAt(0).toUpperCase(),
    [currentUser?.displayName, userProfile?.fullName]
  );
  const canSaveProfile = isLabour
    ? Boolean(
        formValues.fullName.trim() &&
          (formValues.phoneNumber.trim() || formValues.email.trim()) &&
          (formValues.currentLocation.trim() || formValues.coordinates) &&
          formValues.category &&
          formValues.skills.trim()
      )
    : isClient
      ? Boolean(
          formValues.fullName.trim() &&
            (formValues.phoneNumber.trim() || formValues.email.trim()) &&
            (formValues.location.trim() || formValues.coordinates)
        )
      : Boolean(formValues.fullName.trim() && (formValues.phoneNumber.trim() || formValues.email.trim()));
  const profileFieldsDisabled = !isEditing || savingProfile;

  const updateFormValue = (key, value) =>
    setFormValues((prev) => ({
      ...prev,
      [key]: value
    }));

  const saveProfile = async () => {
    if (!currentUser || !userProfile?.role) {
      return;
    }

    setSavingProfile(true);

    try {
      await createOrUpdateUserProfile(currentUser, {
        ...formValues,
        role: userProfile.role,
        location: isClient ? formValues.location : formValues.currentLocation,
        currentLocation: isLabour ? formValues.currentLocation : '',
        coordinates: formValues.coordinates,
        about: isLabour ? formValues.about : '',
        previousWorkHistory: isLabour ? formValues.previousWorkHistory : ''
      });
      toast.success('Profile updated successfully.');
      setIsEditing(false);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    setFormValues(buildProfileForm(userProfile, currentUser));
    setIsEditing(false);
  };

  const changeAvailability = async (nextAvailability) => {
    if (!isLabour || !currentUser || formValues.availability === nextAvailability) {
      return;
    }

    const previousAvailability = formValues.availability;

    setAvailabilityOverride(nextAvailability);
    setFormValues((prev) => ({ ...prev, availability: nextAvailability }));

    if (isEditing) {
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
    await logout();
    navigate('/auth', { replace: true });
  };
  const locationLabel = isClient
    ? formValues.location || 'Location not set'
    : formValues.currentLocation || 'Location not set';
  const primarySkill = isLabour ? formValues.category || 'Skill' : 'Client';
  const completedJobs = Number(userProfile?.completedJobs) || 0;
  const rating = Number(userProfile?.rating) || 0;
  const currentAvailabilityStyle = availabilityStyles[formValues.availability] || availabilityStyles.Available;

  return (
    <AppShell>
      <PageSEO title="Profile & Settings" description="Manage your WorkLink profile details." />

      <section className="section-space bg-white sm:bg-transparent">
        <div className="page-shell max-w-[860px] space-y-3 sm:space-y-4">
          <div className="rounded-[18px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <div className="relative rounded-t-[18px] bg-slate-800 px-4 pb-6 pt-5 text-white sm:px-5 sm:py-7">
              <Button
                type="button"
                variant={isEditing ? 'secondary' : 'ghost'}
                className="absolute right-4 top-5 h-10 w-10 rounded-xl border border-white/15 bg-white/10 p-0 text-white hover:bg-white/15"
                onClick={() => (isEditing ? cancelProfileEdit() : setIsEditing(true))}
                disabled={savingProfile}
                aria-label={isEditing ? 'Cancel editing' : 'Edit profile details'}
                title={isEditing ? 'Cancel editing' : 'Edit profile'}
              >
                {isEditing ? <X size={18} /> : <Pencil size={17} />}
              </Button>
              <div className="flex min-w-0 items-center gap-3 pr-12 sm:gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-brand-600 text-2xl font-bold shadow-glow sm:h-20 sm:w-20">
                  {profileInitial}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-[1.65rem] font-extrabold leading-tight tracking-normal sm:text-3xl">
                    {formValues.fullName.trim() || 'Profile'}
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

            <div className="px-4 py-3 sm:px-5">
              <div className="flex items-stretch divide-x divide-slate-100 rounded-[16px] border border-slate-200 bg-white px-1 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <ProfileStat value={isLabour ? completedJobs : 'Client'} label={isLabour ? 'Jobs done' : 'Account'} tone="emerald" />
                <ProfileStat value={isLabour ? (rating ? rating.toFixed(1) : '0.0') : 'Live'} label={isLabour ? 'Rating' : 'Location'} tone="amber" />
                <ProfileStat value={primarySkill} label={isLabour ? 'Skills' : 'Profile'} tone="brand" />
              </div>
            </div>

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
            <FieldSectionTitle icon={UserRound}>Personal details</FieldSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField
                label="Full name"
                disabled={profileFieldsDisabled}
                value={formValues.fullName}
                onChange={(event) => updateFormValue('fullName', event.target.value)}
                placeholder="Your full name"
              />
              <InputField
                label="Phone number"
                disabled={profileFieldsDisabled}
                value={formValues.phoneNumber}
                onChange={(event) => updateFormValue('phoneNumber', event.target.value)}
                placeholder="+91 98765 43210"
              />
              <InputField
                label="Email"
                type="email"
                disabled={profileFieldsDisabled}
                value={formValues.email}
                onChange={(event) => updateFormValue('email', event.target.value)}
                placeholder="name@example.com"
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Gender"
                  placeholder="Select gender"
                  disabled={profileFieldsDisabled}
                  value={formValues.gender}
                  options={['Male', 'Female', 'Other']}
                  onChange={(event) => updateFormValue('gender', event.target.value)}
                />
                <InputField
                  label="Age"
                  type="number"
                  disabled={profileFieldsDisabled}
                  value={formValues.age}
                  onChange={(event) => updateFormValue('age', event.target.value)}
                  placeholder="28"
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
                  disabled={profileFieldsDisabled}
                  value={formValues.location}
                  onChange={(event) => updateFormValue('location', event.target.value)}
                  placeholder="Gachibowli, Hyderabad"
                />
                <ProfileLocationPanel
                  roleLabel="client"
                  locationValue={formValues.location}
                  savedCoordinates={formValues.coordinates}
                  disabled={profileFieldsDisabled}
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
                  disabled={profileFieldsDisabled}
                  value={formValues.currentLocation}
                  onChange={(event) => updateFormValue('currentLocation', event.target.value)}
                  placeholder="Madhapur, Hyderabad"
                />
                <ProfileLocationPanel
                  roleLabel="labour"
                  locationValue={formValues.currentLocation}
                  savedCoordinates={formValues.coordinates}
                  disabled={profileFieldsDisabled}
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
              <FieldSectionTitle icon={Wrench} tone="amber">Work details</FieldSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Work category"
                  placeholder="Select category"
                  disabled={profileFieldsDisabled}
                  value={formValues.category}
                  options={workCategories}
                  onChange={(event) => updateFormValue('category', event.target.value)}
                />
                <InputField
                  label="Experience (yrs)"
                  type="number"
                  disabled={profileFieldsDisabled}
                  value={formValues.experienceYears}
                  onChange={(event) => updateFormValue('experienceYears', event.target.value)}
                  placeholder="5"
                />
                <InputField
                  label="Education"
                  disabled={profileFieldsDisabled}
                  value={formValues.education}
                  onChange={(event) => updateFormValue('education', event.target.value)}
                  placeholder="SSC / ITI / Diploma / Degree"
                  className="sm:col-span-2"
                />
                <InputField
                  label="Skills"
                  disabled={profileFieldsDisabled}
                  value={formValues.skills}
                  onChange={(event) => updateFormValue('skills', event.target.value)}
                  placeholder="Arc welding, MIG welding..."
                  hint="Use commas to separate multiple skills."
                  className="sm:col-span-2"
                />
                <InputField
                  label="Languages known"
                  disabled={profileFieldsDisabled}
                  value={formValues.languages}
                  onChange={(event) => updateFormValue('languages', event.target.value)}
                  placeholder={languageOptions.join(', ')}
                  hint="Use commas to separate multiple languages."
                  className="sm:col-span-2"
                />
                <TextAreaField
                  label="About"
                  disabled={profileFieldsDisabled}
                  value={formValues.about}
                  onChange={(event) => updateFormValue('about', event.target.value)}
                  placeholder="Describe your work style, strengths..."
                  className="sm:col-span-2"
                />
                <TextAreaField
                  label="Previous work history"
                  disabled={profileFieldsDisabled}
                  value={formValues.previousWorkHistory}
                  onChange={(event) => updateFormValue('previousWorkHistory', event.target.value)}
                  placeholder="Apartment rewiring, RO repair..."
                  className="sm:col-span-2"
                />
              </div>
            </Card>
          ) : null}

          {isEditing ? (
            <div className="grid gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelProfileEdit} disabled={savingProfile}>
                <X size={16} />
                Cancel
              </Button>
              <Button type="button" onClick={saveProfile} disabled={savingProfile || !canSaveProfile}>
                <CheckCircle2 size={16} />
                {savingProfile ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          ) : null}

          <Card className="space-y-4 rounded-[18px] p-4 sm:p-5">
            <FieldSectionTitle icon={Settings} tone="slate">Settings</FieldSectionTitle>
            <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
              {[
                { label: 'About WorkLink', icon: Info },
                { label: 'Notifications', icon: Bell },
                { label: isLabour ? 'Browse labour' : 'Browse services', icon: Search }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                    <Icon size={18} className="text-slate-500" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{item.label}</span>
                    <ChevronRight size={17} className="text-slate-300" />
                  </div>
                );
              })}
            </div>
            <div className="rounded-[14px] border border-rose-100 bg-rose-50 p-3">
              <p className="mb-3 text-xs font-medium text-slate-500">
                Signed in to WorkLink as <span className="font-bold text-slate-700">{formValues.fullName || 'user'}</span>
              </p>
              <Button variant="danger" className="w-full" onClick={handleLogout}>
                <LogOut size={16} />
                Sign out
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

export default SettingsPage;
