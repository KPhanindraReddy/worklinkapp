import React from 'react';
import { getRuntimeRecoveryReason, recoverRuntimeApp } from '../../utils/runtimeRecovery';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    const recoveryReason = getRuntimeRecoveryReason(error);
    const didRecover = recoverRuntimeApp(recoveryReason);

    if (!didRecover) {
      console.error('Slivz runtime error:', error);

      if (typeof window !== 'undefined') {
        window.location.replace('/auth?role=client&mode=login');
      }
    }
  }

  render() {
    if (this.state.error) {
      return null;
    }

    return this.props.children;
  }
}
