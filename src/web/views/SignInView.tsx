import React from 'react';
import { StepCircleCode, StepMemberList, StepPinPad } from '../components/signin/SignInSteps.js';
import { useSignInFlow } from '../components/signin/useSignInFlow.js';

interface SignInViewProps {
  onSuccess: (role: 'elder' | 'family' | 'caretaker') => void;
  onBack: () => void;
  prefillCode?: string;
  prefillRole?: 'elder' | 'family' | 'caretaker';
  prefillPin?: string;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onSuccess,
  onBack,
  prefillCode,
  prefillRole,
  prefillPin,
}) => {
  const {
    step,
    setStep,
    circleCode,
    setCircleCode,
    circleId,
    elderName,
    members,
    selectedMember,
    setSelectedMember,
    pin,
    setPin,
    error,
    loading,
    handleLookup,
    handlePinSubmit,
  } = useSignInFlow({ prefillCode, prefillRole, prefillPin, onSuccess });

  const handleBackStep = () => {
    if (step === 'pin') setStep('member');
    else if (step === 'member') setStep('code');
    else onBack();
  };

  return (
    <div
      className="container"
      style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '1.5rem' }}
    >
      <button
        type="button"
        onClick={handleBackStep}
        className="btn btn-secondary"
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem' }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {error && (
        <div
          role="alert"
          style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            color: '#991b1b',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          {error}
        </div>
      )}

      {step === 'code' && (
        <StepCircleCode
          circleCode={circleCode}
          loading={loading}
          onChangeCode={setCircleCode}
          onSubmitCode={() => handleLookup(circleCode)}
        />
      )}
      {step === 'member' && (
        <StepMemberList
          elderName={elderName}
          members={members}
          onSelectMember={(m) => {
            setSelectedMember(m);
            setPin('');
            setStep('pin');
          }}
        />
      )}
      {step === 'pin' && selectedMember && (
        <StepPinPad
          member={selectedMember}
          pin={pin}
          loading={loading}
          onChangePin={setPin}
          onSubmitPin={(p) => handlePinSubmit(circleId, selectedMember.id, p)}
        />
      )}
    </div>
  );
};
