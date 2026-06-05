import {
  Apple,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  CircleHelp,
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
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { isHiddenAdminAccount } from '../../utils/adminAccount';
import { isProfileComplete, resolvePostAuthPath } from '../../utils/authFlow';
import { roles } from '../../utils/constants';
import { getFirebaseErrorMessage } from '../../utils/firebaseErrors';
import { readRedirectContext } from '../../utils/oauthRedirectContext';
import { getIndianLocalPhoneNumber, normalizeIndianPhoneNumber } from '../../utils/phone';

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
const showVerifiedTickBriefly = () => new Promise((resolve) => setTimeout(resolve, 650));

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
    sendPhoneLinkOtp,
    sendPhoneOtp,
    verifyPhoneLinkOtp,
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
  const [phoneOtpPurpose, setPhoneOtpPurpose] = useState('phoneAuth');
  const [pendingEmailSignupUser, setPendingEmailSignupUser] = useState(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEmailPasswordLogin, setShowEmailPasswordLogin] = useState(false);
  const [processingRedirectAuth, setProcessingRedirectAuth] = useState(() =>
    Boolean(readRedirectContext())
  );

  const canSubmitEmail =
    mode === 'signup'
      ? Boolean(
          formValues.phoneNumber.trim() &&
            (!formValues.email.trim() || formValues.password.trim())
        )
      : Boolean(formValues.email.trim() && formValues.password.trim());
  const isEmailSignupPhoneLink = phoneOtpPurpose === 'emailSignupLink';

  useEffect(() => {
    if (!processingRedirectAuth && currentUser && !submitting && !pendingEmailSignupUser) {
      navigate(resolvePostAuthPath({ profile: userProfile, fallbackRole: role }), {
        replace: true
      });
    }
  }, [currentUser, navigate, pendingEmailSignupUser, processingRedirectAuth, role, submitting, userProfile]);

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

  const handleChange = (key, value) => {
    if (key === 'phoneNumber') {
      setConfirmationResult(null);
      setOtp('');
      setPhoneOtpPurpose('phoneAuth');
      setPhoneVerified(false);
    }

    setFormValues((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'role' ? { role: value } : {})
    }));
  };

  const updateAuthUrl = (nextRole = role, nextMode = mode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('role', nextRole);
    nextParams.set('mode', nextMode);
    navigate(`/auth?${nextParams.toString()}`, { replace: true, state: location.state });
  };

  const switchAccount = (nextRole, nextMode = mode) => {
    setRole(nextRole);
    setMode(nextMode);
    setShowEmailPasswordLogin(false);
    setFormValues((prev) => ({ ...prev, role: nextRole }));
    updateAuthUrl(nextRole, nextMode);
  };

  const handleModeSelect = (nextMode) => {
    setMode(nextMode);
    setShowEmailPasswordLogin(false);
    setConfirmationResult(null);
    setOtp('');
    setPendingEmailSignupUser(null);
    setPhoneVerified(false);
    setPhoneOtpPurpose('phoneAuth');
    updateAuthUrl(role, nextMode);
  };

  const startSignupOtp = async () => {
    if (pendingEmailSignupUser) {
      toast.error('Verify the phone OTP to finish this signup.');
      return;
    }

    if (!formValues.phoneNumber.trim()) {
      toast.error('Enter your phone number before sending OTP.');
      return;
    }

    if (formValues.email.trim() && !formValues.password.trim()) {
      toast.error('Enter a password to enable email login, or clear the email field.');
      return;
    }

    setSubmitting(true);

    try {
      if (formValues.email.trim()) {
        const user = await registerWithEmail({
          email: formValues.email,
          password: formValues.password,
          fullName: formValues.fullName
        });

        setPendingEmailSignupUser(user);
        setPhoneOtpPurpose('emailSignupLink');
        const phoneLinkResult = await sendPhoneLinkOtp(formValues.phoneNumber);
        setConfirmationResult(phoneLinkResult);
        toast.success('Email verification link sent. Enter the phone OTP to finish signup.');
      } else {
        setPendingEmailSignupUser(null);
        setPhoneOtpPurpose('phoneAuth');
        const phoneResult = await sendPhoneOtp(formValues.phoneNumber);
        setConfirmationResult(phoneResult);
        toast.success('OTP sent to your phone number.');
      }

      setPhoneVerified(false);
      setOtp('');
    } catch (error) {
      toast.error(getFirebaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();

    if (mode === 'signup') {
      await startSignupOtp();
      return;
    }

    setSubmitting(true);

    try {
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
      setConfirmationResult(null);
      setOtp('');
      setPhoneVerified(false);
      const result =
        pendingEmailSignupUser && mode === 'signup'
          ? await sendPhoneLinkOtp(formValues.phoneNumber)
          : await sendPhoneOtp(formValues.phoneNumber);
      setConfirmationResult(result);
      setPhoneOtpPurpose(pendingEmailSignupUser && mode === 'signup' ? 'emailSignupLink' : 'phoneAuth');
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
      const isEmailSignupLink = phoneOtpPurpose === 'emailSignupLink';
      const user = isEmailSignupLink
        ? await verifyPhoneLinkOtp(confirmationResult, otp)
        : await verifyPhoneOtp(confirmationResult, otp, {
            requireExistingProfile: mode === 'login'
          });
      const profile = await ensureProfileRecord(user, {
        forceBaseWrite: mode === 'signup',
        fallbackRole: mode === 'signup' ? role : ''
      });

      if (mode === 'login' && !profile) {
        const { logoutUser } = await import('../../services/authService');
        await logoutUser();
        throw new Error('No existing Slivz profile was found for this phone number.');
      }

      setPendingEmailSignupUser(null);
      setPhoneOtpPurpose('phoneAuth');
      setOtp('');
      setPhoneVerified(true);
      toast.success(
        isEmailSignupLink
          ? 'Phone linked to your email account. Finish your profile on the next screen.'
          : mode === 'signup'
            ? 'Phone verification complete. Finish your profile on the next screen.'
          : isProfileComplete(profile)
            ? 'Phone verified. Logged in to your existing profile.'
            : 'Phone verification complete. Finish your profile to continue.'
      );
      await showVerifiedTickBriefly();
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

  const localPhoneNumber = getIndianLocalPhoneNumber(formValues.phoneNumber);
  const isOtpStep = Boolean(confirmationResult);
  const authModeTitle = mode === 'signup' ? 'Register' : 'Login';
  const authModeDescription =
    mode === 'signup'
      ? 'Create your Slivz account with your mobile number'
      : 'Login to Slivz with your mobile number';
  const handleLocalPhoneChange = (event) => {
    handleChange('phoneNumber', normalizeIndianPhoneNumber(event.target.value));
  };
  const handlePrimaryOtpSend = () => {
    if (mode === 'signup' && !confirmationResult && !pendingEmailSignupUser) {
      return startSignupOtp();
    }

    return handleSendOtp();
  };

  return (
    <AppShell hideBottomDock hideFooter hideNavbar>
      <PageSEO
        title="Login / Signup"
        description="Join Slivz as labour or client using phone OTP, Google login, Apple login, or email and password."
      />
      <style>{`
        .grecaptcha-badge {
          visibility: hidden !important;
        }
      `}</style>

      <section className="min-h-[100dvh] bg-white px-4 py-4 sm:bg-slate-100 sm:px-4 sm:py-5">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[430px] flex-col sm:min-h-0">
          <Card className="mobile-safe-bottom flex min-h-[calc(100dvh-2rem)] flex-col border-0 bg-white p-0 shadow-none sm:min-h-[620px] sm:rounded-[24px] sm:border sm:border-slate-200 sm:p-5 sm:shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              {isOtpStep ? (
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-950 transition hover:bg-slate-100"
                  onClick={() => {
                    setConfirmationResult(null);
                    setOtp('');
                    setPhoneVerified(false);
                  }}
                  aria-label="Back"
                >
                  <ArrowLeft size={30} strokeWidth={2.5} />
                </button>
              ) : (
                <Link to="/" className="text-3xl font-black leading-none tracking-tight text-slate-950">
                  Slivz
                </Link>
              )}

              {isOtpStep ? (
                <h1 className="min-w-0 flex-1 truncate text-3xl font-black leading-none tracking-tight text-slate-950">
                  Verify OTP
                </h1>
              ) : null}

              <Link
                to="/about-contact"
                className="inline-flex items-center gap-1.5 rounded-full text-base font-bold text-slate-950 transition hover:text-brand-700"
              >
                <CircleHelp size={21} className="text-brand-800" />
                Help
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1">
              {publicRoleOptions.map((item) => {
                const RoleIcon = item.value === 'client' ? UserRound : BriefcaseBusiness;

                return (
                  <button
                    key={item.value}
                    type="button"
                    className={clsx(
                      'inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold transition',
                      role === item.value
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )}
                    onClick={() => switchAccount(item.value, mode)}
                  >
                    <RoleIcon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {!isFirebaseConfigured ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-medium text-amber-900">
                Firebase keys missing. Authentication is disabled.
              </div>
            ) : null}

            <form className="flex flex-1 flex-col" onSubmit={handleEmailAuth}>
              {!isOtpStep ? (
                <>
                  <div className="mt-7">
                    <h2 className="text-[30px] font-black leading-[1.08] tracking-normal text-slate-950 sm:text-[34px]">
                      {authModeTitle}
                    </h2>
                    <p className="mt-2 text-lg font-medium leading-tight text-slate-700">
                      {authModeDescription}
                    </p>
                  </div>

                  <label className="mt-7 block">
                    <span className="sr-only">Phone number</span>
                    <span className="flex min-h-[58px] items-center overflow-hidden rounded-xl border-2 border-slate-950 bg-white transition focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
                      <span className="inline-flex flex-none items-center gap-2 px-3 text-[22px] font-black text-slate-950">
                        <span className="text-2xl" aria-hidden="true">
                          🇮🇳
                        </span>
                        +91
                      </span>
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent px-1 py-3 text-xl font-black text-slate-950 outline-none placeholder:text-slate-300 sm:text-[22px]"
                        value={localPhoneNumber}
                        onChange={handleLocalPhoneChange}
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="Enter Mobile Number"
                      />
                    </span>
                  </label>

                  <div className="mt-auto space-y-4 pt-8">
                    <p className="px-2 text-center text-sm font-medium leading-6 text-slate-500">
                      By continuing, you confirm that you are 18 years of age and agree to the{' '}
                      <Link to="/terms" className="font-semibold text-brand-700 underline underline-offset-2">
                        Terms & Conditions
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
                        Privacy Policy
                      </Link>
                      .
                    </p>

                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full rounded-2xl text-base font-black"
                      onClick={handlePrimaryOtpSend}
                      disabled={submitting || !formValues.phoneNumber.trim()}
                    >
                      {submitting ? 'Please wait...' : 'Next'}
                    </Button>

                    <div className="grid grid-cols-2 gap-3">
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

                    <button
                      type="button"
                      className="mx-auto block text-sm font-bold text-brand-700 hover:text-brand-800"
                      onClick={() => setShowEmailPasswordLogin((prev) => !prev)}
                      disabled={submitting}
                    >
                      {showEmailPasswordLogin
                        ? mode === 'signup'
                          ? 'Hide email password'
                          : 'Hide email login'
                        : mode === 'signup'
                          ? 'Add email password'
                          : 'Use email password'}
                    </button>

                    {showEmailPasswordLogin ? (
                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <InputField
                          label={mode === 'signup' ? 'Email (optional)' : 'Email'}
                          type="email"
                          autoComplete="email"
                          value={formValues.email}
                          onChange={(event) => handleChange('email', event.target.value)}
                          placeholder="name@example.com"
                        />
                        <InputField
                          label={mode === 'signup' ? 'Password (for email login)' : 'Password'}
                          type="password"
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                          value={formValues.password}
                          onChange={(event) => handleChange('password', event.target.value)}
                          placeholder={mode === 'signup' ? 'Needed only if email is entered' : 'Minimum 6 characters'}
                        />
                        <div className="flex items-center justify-between gap-3">
                          {mode === 'login' ? (
                            <button
                              type="button"
                              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                              onClick={handleForgotPassword}
                              disabled={submitting}
                            >
                              Forgot password?
                            </button>
                          ) : (
                            <span />
                          )}
                          <Button
                            type="submit"
                            size="sm"
                            className="rounded-xl"
                            disabled={submitting || !canSubmitEmail}
                          >
                            {submitting ? 'Please wait...' : mode === 'signup' ? 'Use email' : 'Login'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <p className="text-center text-sm font-medium text-slate-600">
                      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                      <button
                        type="button"
                        className="font-bold text-brand-700 hover:text-brand-800"
                        onClick={() => handleModeSelect(mode === 'login' ? 'signup' : 'login')}
                      >
                        {mode === 'login' ? 'Register' : 'Login'}
                      </button>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-10">
                    <h2 className="text-[28px] font-black leading-tight tracking-normal text-slate-950 sm:text-[32px]">
                      Enter verification code
                    </h2>
                    <p className="mt-2 text-lg font-medium text-slate-500">
                      Sent to {localPhoneNumber || 'your phone'}
                    </p>
                  </div>

                  <label className="mt-10 block">
                    <span className="sr-only">Enter OTP</span>
                    <input
                      className="w-full border-0 border-b-2 border-slate-300 bg-transparent px-2 pb-3 text-center text-[30px] font-black tracking-[0.4em] text-slate-950 outline-none transition placeholder:tracking-normal placeholder:text-slate-300 focus:border-brand-600 sm:text-[34px]"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      maxLength={6}
                      placeholder="------"
                    />
                  </label>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full px-5"
                      onClick={handleSendOtp}
                      disabled={submitting}
                    >
                      Resend OTP
                    </Button>
                    {phoneVerified ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
                        <CheckCircle2 size={17} />
                        Mobile verified
                      </span>
                    ) : null}
                  </div>

                  {pendingEmailSignupUser ? (
                    <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold leading-5 text-brand-800">
                      Email account created and verification link sent. Enter the phone OTP to connect this phone to the same login.
                    </div>
                  ) : null}

                  <div className="mt-auto pt-7">
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 w-full rounded-2xl text-base font-black"
                      onClick={handleVerifyOtp}
                      disabled={submitting || !otp.trim()}
                    >
                      {submitting ? 'Please wait...' : 'Verify OTP'}
                    </Button>
                  </div>
                </>
              )}

              <div
                id="recaptcha-container"
                className="pointer-events-none fixed bottom-0 right-0 h-0 w-0 overflow-hidden opacity-0"
                aria-hidden="true"
              />
            </form>
          </Card>
        </div>
      </section>
    </AppShell>
  );
};

export default AuthPage;
