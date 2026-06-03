import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCompleteProfilePath, isProfileComplete, routeByRole } from '../../utils/authFlow';
import { AppLoadingState } from '../common/AppLoadingState';

export const ProtectedRoute = ({ children, allowedRoles = [], allowIncompleteProfile = false }) => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppLoadingState title="Checking account" description="Verifying your login and profile..." />;
  }

  if (!currentUser) {
    const roleLoginPath =
      allowedRoles.length === 1 && ['client', 'labour'].includes(allowedRoles[0])
        ? `/auth?role=${allowedRoles[0]}&mode=login`
        : '/auth';

    return <Navigate to={roleLoginPath} replace state={{ from: location }} />;
  }

  if (!allowIncompleteProfile && !isProfileComplete(userProfile)) {
    return (
      <Navigate
        to={getCompleteProfilePath(userProfile?.role)}
        replace
        state={{ from: location }}
      />
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userProfile?.role)) {
    const redirectPath = isProfileComplete(userProfile)
      ? routeByRole(userProfile?.role)
      : getCompleteProfilePath(userProfile?.role);

    return <Navigate to={redirectPath} replace />;
  }

  return children;
};
