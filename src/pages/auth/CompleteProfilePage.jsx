import { AlertCircle, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AutocompleteSelect } from '../../components/common/AutocompleteSelect';
import { InputField } from '../../components/common/InputField';
import { AddressAutocomplete } from '../../components/common/AddressAutocomplete';
import { PageSEO } from '../../components/common/PageSEO';
import { PhoneInputField } from '../../components/common/PhoneInputField';
import { ProfilePhotoUploader } from '../../components/common/ProfilePhotoUploader';
import { SelectField } from '../../components/common/SelectField';
import { TextAreaField } from '../../components/common/TextAreaField';
import { ProfileLocationPanel } from '../../components/location/ProfileLocationPanel';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { submitCustomServiceRequest } from '../../services/customServiceService';
import { routeByRole, isProfileComplete } from '../../utils/authFlow';
import { availabilityOptions, languageOptions, workCategories } from '../../utils/constants';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { getDisplayLocationText } from '../../utils/location';
import { buildProfileAvatarDataUrl } from '../../utils/profileAvatar';

const toCommaText = (value) => (Array.isArray(value) ? value.join(', ') : value || '');
const placeholderNames = new Set(['slivz user', 'slivzuser', 'profile']);
const cleanProfileName = (value) => {
  const name = String(value || '').trim();

  return placeholderNames.has(name.toLowerCase()) ? '' : name;
};

const requiredInputClass =
  'border-red-300 bg-red-50/80 focus:border-red-500 focus:ring-red-100';
const requiredBoxClass =
  'rounded-2xl border border-red-200 bg-red-50/70 p-2 [&>label>div>div]:border-red-300 [&>label>div>div]:bg-red-50/80 [&>label>div>div]:focus-within:border-red-500 [&>label>div>div]:focus-within:ring-red-100';

const initialFormState = {
  fullName: '',
  phoneNumber: '',
  email: '',
  gender: '',
  age: '',
  education: '',
  experienceYears: '',
  category: '',
  skills: '',
  languages: '',
  currentLocation: '',
  location: '',
  coordinates: null,
  profilePhotoUrl: '',
  about: '',
  availability: 'Available',
  dailyWage: '',
  previousWorkHistory: '',
  role: 'labour'
};

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    currentUser,
    userProfile,
    createOrUpdateUserProfile
  } = useAuth();

  const queryRole = searchParams.get('role');
  const [role, setRole] = useState(queryRole || userProfile?.role || 'labour');
  const [formValues, setFormValues] = useState({
    ...initialFormState,
    role: queryRole || userProfile?.role || 'labour'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isProfileComplete(userProfile)) {
      navigate(routeByRole(userProfile.role), { replace: true });
    }
  }, [navigate, userProfile]);

  useEffect(() => {
    const resolvedRole = userProfile?.role || queryRole || 'labour';

    setRole(resolvedRole);
    setFormValues((prev) => ({
      ...prev,
      role: resolvedRole,
      fullName: cleanProfileName(
        prev.fullName || userProfile?.fullName || currentUser?.displayName || ''
      ),
      phoneNumber: prev.phoneNumber || userProfile?.phoneNumber || currentUser?.phoneNumber || '',
      email: prev.email || userProfile?.email || currentUser?.email || '',
      currentLocation:
        getDisplayLocationText(prev.currentLocation, '') ||
        getDisplayLocationText(userProfile?.currentLocation || userProfile?.location, ''),
      location:
        getDisplayLocationText(prev.location, '') ||
        getDisplayLocationText(userProfile?.location || userProfile?.currentLocation, ''),
      coordinates: prev.coordinates || userProfile?.coordinates || null,
      profilePhotoUrl:
        prev.profilePhotoUrl ||
        userProfile?.profilePhoto ||
        buildProfileAvatarDataUrl(prev.fullName || userProfile?.fullName || currentUser?.displayName || 'Profile'),
      gender: prev.gender || userProfile?.gender || '',
      age: prev.age || userProfile?.age || '',
      education: prev.education || userProfile?.education || '',
      experienceYears: prev.experienceYears || userProfile?.experienceYears || '',
      category: prev.category || userProfile?.category || '',
      skills: prev.skills || toCommaText(userProfile?.skills),
      languages: prev.languages || toCommaText(userProfile?.languages),
      about: prev.about || userProfile?.about || '',
      availability: prev.availability || userProfile?.availability || 'Available',
      dailyWage: prev.dailyWage || userProfile?.dailyWage || '',
      previousWorkHistory: prev.previousWorkHistory || toCommaText(userProfile?.previousWorkHistory)
    }));
  }, [
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.phoneNumber,
    queryRole,
    userProfile?.fullName,
    userProfile?.currentLocation,
    userProfile?.location,
    userProfile?.phoneNumber,
    userProfile?.coordinates,
    userProfile?.profilePhoto,
    userProfile?.gender,
    userProfile?.age,
    userProfile?.education,
    userProfile?.experienceYears,
    userProfile?.category,
    userProfile?.skills,
    userProfile?.languages,
    userProfile?.about,
    userProfile?.availability,
    userProfile?.dailyWage,
    userProfile?.previousWorkHistory,
    userProfile?.email,
    userProfile?.role
  ]);

  const handleChange = (key, value) =>
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'role' ? { role: value } : {})
    }));

  const canSaveProfile =
    role === 'labour'
      ? Boolean(
          formValues.fullName.trim() &&
            formValues.phoneNumber.trim() &&
            formValues.category &&
            formValues.skills.trim() &&
            formValues.currentLocation.trim()
        )
      : Boolean(
          formValues.fullName.trim() &&
          formValues.phoneNumber.trim() &&
            (formValues.location.trim() || formValues.coordinates)
        );
  const missingRequiredFields = [
    !formValues.fullName.trim() ? 'Full name' : '',
    !formValues.phoneNumber.trim() ? 'Phone number' : '',
    role === 'labour' && !formValues.category ? 'Work category' : '',
    role === 'labour' && !formValues.skills.trim() ? 'Skills' : '',
    role === 'labour' && !formValues.currentLocation.trim()
      ? 'Current location'
      : '',
    role === 'client' && !(formValues.location.trim() || formValues.coordinates) ? 'Location' : ''
  ].filter(Boolean);
  const isMissing = (field) => missingRequiredFields.includes(field);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      toast.error('Login is required before completing your profile.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrUpdateUserProfile(currentUser, {
        ...formValues,
        role,
        location: role === 'client' ? formValues.location : formValues.currentLocation,
        currentLocation: role === 'labour' ? formValues.currentLocation : '',
        coordinates: formValues.coordinates
      });

      if (role === 'labour') {
        await submitCustomServiceRequest({
          name: formValues.category,
          labourId: currentUser.uid,
          labourName: formValues.fullName,
          source: 'complete_profile'
        });
      }

      toast.success('Profile completed successfully.');
      navigate(routeByRole(role), { replace: true });
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageSEO
        title="Complete Profile"
        description="Finish your labour or client profile after login so Slivz can unlock dashboard access."
      />

      <section className="section-space">
        <div className="page-shell max-w-[920px]">
          <Card className="rounded-[28px] p-4 sm:p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
                  <UserRound size={16} />
                  Profile
                </div>
                <h1 className="mt-4 break-words text-2xl font-bold text-slate-950 sm:text-3xl">Complete your profile</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Enter your details in order, then save to open your dashboard.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-900">Profile type</p>
              <div className="mt-3 inline-flex rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold capitalize text-brand-800">
                {role === 'labour' ? 'Labour' : 'Client'}
              </div>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <InputField
                  label="Full name"
                  value={formValues.fullName}
                  onChange={(event) => handleChange('fullName', event.target.value)}
                  placeholder="Your full name"
                  inputClassName={isMissing('Full name') ? requiredInputClass : ''}
                />
                <PhoneInputField
                  label="Phone number"
                  disabled={Boolean(userProfile?.phoneNumber || currentUser?.phoneNumber)}
                  value={formValues.phoneNumber}
                  onChange={(event) => handleChange('phoneNumber', event.target.value)}
                  className={isMissing('Phone number') ? 'rounded-2xl border border-red-200 bg-red-50/70 p-2' : ''}
                />
                <ProfilePhotoUploader
                  uid={currentUser?.uid}
                  role={role}
                  value={formValues.profilePhotoUrl}
                  fullName={formValues.fullName}
                  disabled={!currentUser || submitting}
                  onChange={(url) => handleChange('profilePhotoUrl', url)}
                  onError={(error) => toast.error(getFirebaseErrorMessage(error))}
                />
                <InputField
                  label="Email (optional)"
                  type="email"
                  disabled={Boolean(userProfile?.email || currentUser?.email)}
                  value={formValues.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  placeholder="name@example.com"
                />
                {role === 'client' ? (
                  <div className="space-y-3">
                    <AddressAutocomplete
                      label="Location"
                      value={formValues.location}
                      placeholder="Gachibowli, Hyderabad"
                      className={isMissing('Location') ? requiredBoxClass : ''}
                      onSelect={(suggestion) => {
                        if (suggestion) {
                          setFormValues((prev) => ({
                            ...prev,
                            location: suggestion.label,
                            coordinates: suggestion.coordinates
                          }));
                        }
                      }}
                    />
                    <ProfileLocationPanel
                      roleLabel="client"
                      locationValue={formValues.location}
                      savedCoordinates={formValues.coordinates}
                      autoRequest
                      onApplyLocation={({ label, coordinates }) =>
                        setFormValues((prev) => ({
                          ...prev,
                          location: label || getDisplayLocationText(prev.location, ''),
                          coordinates
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AddressAutocomplete
                      label="Current location"
                      value={formValues.currentLocation}
                      placeholder="Madhapur, Hyderabad"
                      className={isMissing('Current location') ? requiredBoxClass : ''}
                      onSelect={(suggestion) => {
                        if (suggestion) {
                          setFormValues((prev) => ({
                            ...prev,
                            currentLocation: suggestion.label,
                            coordinates: suggestion.coordinates
                          }));
                        }
                      }}
                    />
                    <ProfileLocationPanel
                      roleLabel="labour"
                      locationValue={formValues.currentLocation}
                      savedCoordinates={formValues.coordinates}
                      autoRequest
                      onApplyLocation={({ label, coordinates }) =>
                        setFormValues((prev) => ({
                          ...prev,
                          currentLocation: label || getDisplayLocationText(prev.currentLocation, ''),
                          coordinates
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {role === 'labour' ? (
                <div className="space-y-4">
                  <AutocompleteSelect
                    label="Work category"
                    placeholder="Select or type service"
                    value={formValues.category}
                    options={workCategories}
                    onChange={(event) => handleChange('category', event.target.value)}
                    allowCustom
                    customOptionLabel="Add service"
                    className={isMissing('Work category') ? requiredBoxClass : ''}
                  />
                  <SelectField
                    label="Availability"
                    value={formValues.availability}
                    options={availabilityOptions}
                    onChange={(event) => handleChange('availability', event.target.value)}
                  />
                  <InputField
                    label="Skills"
                    value={formValues.skills}
                    onChange={(event) => handleChange('skills', event.target.value)}
                    placeholder="Electrician, CCTV installation, Internet/WiFi setup"
                    hint="Use commas to separate multiple skills."
                    className="md:col-span-2"
                    inputClassName={isMissing('Skills') ? requiredInputClass : ''}
                  />
                  <InputField
                    label="Languages known"
                    value={formValues.languages}
                    onChange={(event) => handleChange('languages', event.target.value)}
                    placeholder={languageOptions.join(', ')}
                    hint="Use commas to separate multiple languages."
                    className="md:col-span-2"
                  />
                  <SelectField
                    label="Gender"
                    placeholder="Select gender"
                    value={formValues.gender}
                    options={['Male', 'Female', 'Other']}
                    onChange={(event) => handleChange('gender', event.target.value)}
                  />
                  <InputField
                    label="Age"
                    type="number"
                    value={formValues.age}
                    onChange={(event) => handleChange('age', event.target.value)}
                    placeholder="28"
                  />
                  <InputField
                    label="Education"
                    value={formValues.education}
                    onChange={(event) => handleChange('education', event.target.value)}
                    placeholder="SSC / ITI / Diploma / Degree"
                  />
                  <InputField
                    label="Experience (years)"
                    type="number"
                    value={formValues.experienceYears}
                    onChange={(event) => handleChange('experienceYears', event.target.value)}
                    placeholder="5"
                  />
                  <TextAreaField
                    label="About"
                    value={formValues.about}
                    onChange={(event) => handleChange('about', event.target.value)}
                    placeholder="Describe your work style, strengths, and preferred jobs."
                    className="md:col-span-2"
                  />
                  <TextAreaField
                    label="Previous work history"
                    value={formValues.previousWorkHistory}
                    onChange={(event) => handleChange('previousWorkHistory', event.target.value)}
                    placeholder="Apartment rewiring, RO repair, CCTV setup..."
                    className="md:col-span-2"
                  />
                </div>
              ) : null}

              {missingRequiredFields.length ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                  <div className="flex items-start gap-2 font-bold">
                    <AlertCircle size={17} className="mt-0.5 flex-none" />
                    <span>Pending details</span>
                  </div>
                  <p className="mt-1 pl-7 text-xs font-semibold leading-5">
                    Add {missingRequiredFields.join(', ')} to save your profile.
                  </p>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={submitting || !canSaveProfile}>
                {submitting ? 'Saving profile...' : 'Save and continue'}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

export default CompleteProfilePage;
