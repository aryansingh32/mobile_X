import { useShallow } from 'zustand/react/shallow';
import React, { useState } from 'react';
import { AuthScreen } from './AuthScreen';
import WelcomeScreen from './WelcomeScreen';
import InterestsScreen from './InterestsScreen';
import AllSetScreen from './AllSetScreen';
import { useAppStore } from '../store/useAppStore';

type Step = 'welcome' | 'auth' | 'interests' | 'allSet';

/**
 * Composes the first-run flow. Phone/OTP sign-in (OTPScreen.tsx) is built but
 * NOT wired in here — AuthScreen only supports Google today, and adding a
 * phone number field is a real auth-scope decision, not just UI (see
 * CHANGES.md). Wire OTPScreen in once that's decided.
 */
export const OnboardingFlow = () => {
  const { token, setHasCompletedOnboarding } = useAppStore(useShallow(s => ({ token: s.token, setHasCompletedOnboarding: s.setHasCompletedOnboarding })));
  const [step, setStep] = useState<Step>(token ? 'interests' : 'welcome');

  // Once Google sign-in succeeds, `token` gets set by AuthScreen itself
  // (via setUser in useAppStore) — move on to interests automatically.
  React.useEffect(() => {
    if (token && step === 'auth') {
      setStep('interests');
    }
  }, [token, step]);

  if (step === 'welcome') {
    return <WelcomeScreen onGetStarted={() => setStep('auth')} onLogin={() => setStep('auth')} />;
  }

  if (step === 'auth' && !token) {
    return <AuthScreen />;
  }

  if (step === 'interests') {
    return <InterestsScreen onContinue={() => setStep('allSet')} />;
  }

  return <AllSetScreen onExplore={() => setHasCompletedOnboarding(true)} />;
};

export default OnboardingFlow;
