import {
  Apple,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  House,
  UserRound
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { InputField } from '../../components/common/InputField';
import { PageSEO } from '../../components/common/PageSEO';
import { PhoneInputField } from '../../components/common/PhoneInputField';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { isHiddenAdminAccount } from '../../utils/adminAccount';
import { isProfileComplete, resolvePostAuthPath } from '../../utils/authFlow';
import { roles } from '../../utils/constants';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { readRedirectContext } from '../../utils/oauthRedirectContext';

const initialFormState = {
  fullName: '',
  phoneNumber: '',
  email: '',
  password: '',
  role: 'client'
};

const providerNames = {
  'google.com': 'Google',
  'apple.com': 'Apple'
};

const roleCopy = {
  client: {
    icon: UserRound,
    label: 'Client',
    otherLabel: 'Labour worker',
    otherRole: 'labour'
  },
  labour: {
    icon: BriefcaseBusiness,
    label: 'Labour worker',
    otherLabel: 'Client',
    otherRole: 'client'
  }
};

const publicRoleOptions = [
  { label: 'Client', value: 'client' },
  { label: 'Labour', value: 'labour' }
];

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4A9.6 9.6 0 0 0 2.4 12 9.6 9.6 0 0 0 12 21.6c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1.1-.2-1.6H12Z"
    />
    <path
      fill="#34A853"
      d="M2.4 7.6 5.6 10A6 6 0 0 1 12 6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4c-3.7 0-6.9 2.1-8.6 5.2Z"
    />
    <path
      fill="#FBBC05"
      d="M12 21.6c2.6 0 4.8-.9 6.4-2.4l-3-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.8L3.2 16.7A9.6 9.6 0 0 0 12 21.6Z"
    />
    <path
      fill="#4285F4"
      d="M21.2 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.3-1.1 2.3-2.1 3.1l3 2.4c1.8-1.7 2.8-4.2 2.8-7.8Z"
    />
  </svg>
);

const getStoredFromLocation = (from) =>
  from?.pathname
    ? {
        pathname: from.pathname,
        search: from.search ?? '',
        hash: from.hash ?? ''
      }
    : null;

const resolveInitialRole = (queryRole) =>
  roles.some((item) => item.value === queryRole) ? queryRole : 'client';

const resolveInitialMode = (queryMode) => (queryMode === 'signup' ? 'signup' : 'login');

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryMode = searchParams.get('mode');
  const queryRole = searchParams.get('role');
  const {
    currentUser,
    userProfile,
    isFirebaseConfigured,
    registerWithEmail,
    loginWithApple,
    loginWithEmail,
    loginWithGoogle,
    sendPasswordReset,
    sendPhoneOtp,
    verifyPhoneOtp,
    consumeRedirectAuthResult,
    createBaseUserProfile
  } = useAuth();

  const [mode, setMode] = useState(() => resolveInitialMode(queryMode));
  const [role, setRole] = useState(() => resolveInitialRole(queryRole));
  const [formValues, setFormValues] = useState(() => ({
    ...initialFormState,
    role: resolveInitialRole(queryRole)
  }));
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOtpOptions, setShowOtpOptions] = useState(false);
  const [processingRedirectAuth, setProcessingRedirectAuth] = useState(() =>
    Boolean(readRedirectContext())
  );

  const activeRole = roleCopy[role] ?? roleCopy.client;
  const actionLabel = mode === 'signup' ? 'Register' : 'Login';
  const canSubmitEmail =
    mode === 'signup'
      ? Boolean(formValues.fullName.trim() && formValues.email.trim() && formValues.password.trim())
      : Boolean(formValues.email.trim() && formValues.password.trim());

  useEffect(() => {
    if (!processingRedirectAuth && currentUser && !submitting) {
      navigate(resolvePostAuthPath({ profile: userProfile, fallbackRole: role }), {
        replace: true
      });
    }
  }, [currentUser, navigate, processingRedirectAuth, role, submitting, userProfile]);

  useEffect(() => {
    const nextMode = resolveInitialMode(queryMode);
    const nextRole = resolveInitialRole(queryRole);

    setMode(nextMode);
    setRole(nextRole);
    setFormValues((prev) => ({ ...prev, role: nextRole }));
  }, [queryMode, queryRole]);

  const redirectAfterAuth = async (
    profile,
    fallbackRole = role,
    redirectedFrom = location.state?.from
  ) => {
    const from = redirectedFrom;

    if (
      isProfileComplete(profile) &&
      from?.pathname &&
      !['/auth', '/complete-profile'].includes(from.pathname)
    ) {
      navigate(`${from.pathname}${from.search ?? ''}${from.hash ?? ''}`, { replace: true });
      return;
    }

    navigate(resolvePostAuthPath({ profile, fallbackRole }), { replace: true });
  };

  const persistBaseProfile = async (user, fallbackRole = role) => {
    const profile = await createBaseUserProfile(user, {
      fullName: formValues.fullName || user.displayName || '',
      phoneNumber: formValues.phoneNumber || user.phoneNumber || '',
      email: formValues.email || user.email || '',
      role: fallbackRole
    });

    return profile;
  };

  const ensureProfileRecord = async (user, { forceBaseWrite = false, fallbackRole = role } = {}) => {
    const { getUserProfile } = await import('../../services/userService');
    let profile = await getUserProfile(user.uid);
    const shouldUpgradeHiddenAdmin =
      isHiddenAdminAccount(
        user,
        {
          email: formValues.email,
          fullName: formValues.fullName
        },
        profile
      ) && profile?.role !== 'admin';

    if (!profile) {
      if (!fallbackRole && !shouldUpgradeHiddenAdmin) {
        return null;
      }

      profile = await persistBaseProfile(user, fallbackRole);
      return profile;
    }

    if (
      shouldUpgradeHiddenAdmin ||
      (fallbackRole && !profile.role) ||
      (forceBaseWrite && fallbackRole && !isProfileComplete(profile))
    ) {
      profile = await persistBaseProfile(user, fallbackRole);
    }

    return profile;
  };

  useEffect(() => {
    let isMounted = true;

    const resumeRedirectAuth = async () => {
      if (!processingRedirectAuth) {
        return;
      }

      if (!isFirebaseConfigured) {
        if (isMounted) {
          setProcessingRedirectAuth(false);
        }
        return;
      }

      try {
        const redirectResult = await consumeRedirectAuthResult();

        if (!redirectResult?.user || !isMounted) {
          return;
        }

        setSubmitting(true);

        const fallbackRole = redirectResult.context?.role || role;
        const redirectMode = redirectResult.context?.mode || mode;
        const profile = await ensureProfileRecord(redirectResult.user, {
          forceBaseWrite: redirectMode === 'signup',
          fallbackRole
        });
        const providerName = providerNames[redirectResult.providerId] || 'Social';

        toast.success(
          redirectMode === 'signup'
            ? `${providerName} sign up complete. Finish your profile on the next screen.`
            : isProfileComplete(profile)
              ? `${providerName} login complete.`
              : `${providerName} login complete. Finish your profile to continue.`
        );
        await redirectAfterAuth(profile, fallbackRole, redirectResult.context?.from);
      } catch (error) {
        if (isMounted) {
          toast.error(getFirebaseErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setSubmitting(false);
          setProcessingRedirectAuth(false);
        }
      }
    };

    resumeRedirectAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (key, value) =>
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'role' ? { role: value } : {})
    }));

  const updateAuthUrl = (nextRole = role, nextMode = mode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('role', nextRole);
    nextParams.set('mode', nextMode);
    navigate(`/auth?${nextParams.toString()}`, { replace: true, state: location.state });
  };

  const switchAccount = (nextRole, nextMode = mode) => {
    setRole(nextRole);
    setMode(nextMode);
    setFormValues((prev) => ({ ...prev, role: nextRole }));
    updateAuthUrl(nextRole, nextMode);
  };

  const handleModeSelect = (nextMode) => {
    setMode(nextMode);
    updateAuthUrl(role, nextMode);
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        const user = await registerWithEmail({
          email: formValues.email,
          password: formValues.password,
          fullName: formValues.fullName
        });

        const profile = await ensureProfileRecord(user, {
          forceBaseWrite: true,
          fallbackRole: role
        });

        toast.success(
          profile?.role === 'admin'
            ? 'Admin account created. Opening the admin page.'
            : 'Account created. Complete your profile on the next screen.'
        );
        await redirectAfterAuth(profile, role);
      } else {
        const user = await loginWithEmail({
          email: formValues.email,
          password: formValues.password
        });
        const profile = await ensureProfileRecord(user, { fallbackRole: role });

        toast.success(
          isProfileComplete(profile)
            ? 'Welcome back to Slivz.'
            : 'Login successful. Complete your profile to continue.'
        );
        await redirectAfterAuth(profile, role);
      }
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = formValues.email.trim();

    if (!email) {
      toast.error('Enter your email first, then tap Forgot password.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      toast.success('Password reset link sent to your email.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setSubmitting(true);

    try {
      const user = await loginWithGoogle({
        mode,
        role,
        from: getStoredFromLocation(location.state?.from)
      });

      if (!user) {
        return;
      }

      const profile = await ensureProfileRecord(user, {
        forceBaseWrite: mode === 'signup',
        fallbackRole: role
      });

      toast.success(
        mode === 'signup'
          ? 'Google sign up complete. Finish your profile on the next screen.'
          : isProfileComplete(profile)
            ? 'Google login complete.'
            : 'Google login complete. Finish your profile to continue.'
      );
      await redirectAfterAuth(profile, role);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    setSubmitting(true);

    try {
      const user = await loginWithApple({
        mode,
        role,
        from: getStoredFromLocation(location.state?.from)
      });

      if (!user) {
        return;
      }

      const profile = await ensureProfileRecord(user, {
        forceBaseWrite: mode === 'signup',
        fallbackRole: role
      });

      toast.success(
        mode === 'signup'
          ? 'Apple sign up complete. Finish your profile on the next screen.'
          : isProfileComplete(profile)
            ? 'Apple login complete.'
            : 'Apple login complete. Finish your profile to continue.'
      );
      await redirectAfterAuth(profile, role);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    if (!formValues.phoneNumber.trim()) {
      toast.error('Enter your phone number before requesting an OTP.');
      return;
    }

    setSubmitting(true);
    try {
      setShowOtpOptions(true);
      const result = await sendPhoneOtp(formValues.phoneNumber);
      setConfirmationResult(result);
      toast.success('OTP sent to your phone number.');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmationResult) {
      return;
    }

    setSubmitting(true);
    try {
      const user = await verifyPhoneOtp(confirmationResult, otp);
      const profile = await ensureProfileRecord(user, {
        forceBaseWrite: mode === 'signup',
        fallbackRole: role
      });

      toast.success(
        mode === 'signup'
          ? 'Phone verification complete. Finish your profile on the next screen.'
          : isProfileComplete(profile)
            ? 'Phone verification complete.'
            : 'Phone verification complete. Finish your profile to continue.'
      );
      await redirectAfterAuth(profile, role);
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (processingRedirectAuth) {
    return (
      <AppShell hideBottomDock hideFooter hideNavbar>
        <PageSEO
          title="Login / Signup"
          description="Join Slivz as labour or client using phone OTP, Google login, Apple login, or email and password."
        />
      </AppShell>
    );
  }

  return (
    <AppShell hideBottomDock hideFooter hideNavbar>
      <PageSEO
        title="Login / Signup"
        description="Join Slivz as labour or client using phone OTP, Google login, Apple login, or email and password."
      />

      <section className="min-h-[100dvh] bg-slate-100 px-2 py-2 sm:px-4 sm:py-5">
        <div className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-[440px] flex-col sm:min-h-0">
          <Card className="mobile-safe-bottom flex min-h-[calc(100dvh-1rem)] flex-col rounded-[28px] border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.1)] sm:min-h-0 sm:p-5">
            <div className="sticky top-0 z-10 -mx-3 -mt-3 rounded-t-[28px] border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:static sm:m-0 sm:border-b-0 sm:bg-transparent sm:p-0">
              <div className="flex items-center justify-between gap-3">
                <Button as={Link} to="/" type="button" variant="ghost" size="sm" className="h-10 w-10 p-0" aria-label="Home">
                  <House size={17} />
                </Button>
                <div className="min-w-0 text-center">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
                    {activeRole.label}
                  </p>
                  <h1 className="truncate text-xl font-bold text-slate-950">
                    {mode === 'signup' ? 'Register' : 'Login'}
                  </h1>
                </div>
                <span className="h-10 w-10" aria-hidden="true" />
              </div>

              <div className="mt-3 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1">
                {publicRoleOptions
                  .map((item) => {
                    const RoleIcon = item.value === 'client' ? UserRound : BriefcaseBusiness;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={clsx(
                          'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition sm:px-3 sm:text-sm',
                          role === item.value
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        )}
                        onClick={() => switchAccount(item.value, mode)}
                      >
                        <RoleIcon size={15} />
                        {item.label}
                      </button>
                    );
                  })}
              </div>
            </div>

            {!isFirebaseConfigured ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-medium text-amber-900">
                Firebase keys missing. Authentication is disabled.
              </div>
            ) : null}

            <form className="mt-4 space-y-3" onSubmit={handleEmailAuth}>
              {mode === 'signup' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField
                    label="Full name"
                    value={formValues.fullName}
                    onChange={(event) => handleChange('fullName', event.target.value)}
                    placeholder="Your full name"
                  />
                  <PhoneInputField
                    label="Phone number"
                    value={formValues.phoneNumber}
                    onChange={(event) => handleChange('phoneNumber', event.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid gap-3">
                <InputField
                  label="Email"
                  type="email"
                  value={formValues.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  placeholder="name@example.com"
                />
                <InputField
                  label="Password"
                  type="password"
                  value={formValues.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>

              {mode === 'login' ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                    onClick={handleForgotPassword}
                    disabled={submitting}
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="h-12 w-full rounded-2xl" disabled={submitting || !canSubmitEmail}>
                {submitting ? 'Please wait...' : `${actionLabel} as ${activeRole.label}`}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm font-medium text-slate-600">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="font-bold text-brand-700 hover:text-brand-800"
                onClick={() => handleModeSelect(mode === 'login' ? 'signup' : 'login')}
              >
                {mode === 'login' ? 'Register' : 'Login'}
              </button>
            </p>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                or
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-12 rounded-2xl px-2"
                  onClick={handleGoogleAuth}
                  disabled={submitting}
                >
                  <GoogleIcon />
                  Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-12 rounded-2xl px-2"
                  onClick={handleAppleAuth}
                  disabled={submitting}
                >
                  <Apple size={16} />
                  Apple
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-between rounded-xl"
                  onClick={() => setShowOtpOptions((prev) => !prev)}
                >
                  <span>Sign in with phone</span>
                  {showOtpOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>

                {showOtpOptions || confirmationResult ? (
                  <div className="mt-3 grid gap-3 px-1 pb-1">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <PhoneInputField
                        label="Phone number"
                        value={formValues.phoneNumber}
                        onChange={(event) => handleChange('phoneNumber', event.target.value)}
                      />
                      <div className="self-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={handleSendOtp}
                          disabled={submitting || !formValues.phoneNumber.trim()}
                        >
                          Send OTP
                        </Button>
                      </div>
                    </div>

                    {confirmationResult ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <InputField
                          label="Enter OTP"
                          value={otp}
                          onChange={(event) => setOtp(event.target.value)}
                          placeholder="6 digit code"
                        />
                        <div className="self-end">
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={handleVerifyOtp}
                            disabled={submitting || !otp.trim()}
                          >
                            Verify OTP
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div id="recaptcha-container" />
              </div>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

export default AuthPage;
