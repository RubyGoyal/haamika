import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../../api/client.js';
import type { MemberTile } from './SignInSteps.js';

interface UseSignInFlowProps {
  prefillCode?: string;
  prefillRole?: 'elder' | 'family' | 'caretaker';
  prefillPin?: string;
  onSuccess: (role: 'elder' | 'family' | 'caretaker') => void;
}

interface LookupResult {
  circleId: string;
  elderName: string;
  preferredName: string;
  members: MemberTile[];
}

async function fetchLookup(code: string): Promise<LookupResult> {
  return api.post<LookupResult>('/api/auth/lookup', { circleCode: code });
}

export function useSignInFlow({
  prefillCode,
  prefillRole,
  prefillPin,
  onSuccess,
}: UseSignInFlowProps) {
  const [step, setStep] = useState<'code' | 'member' | 'pin'>('code');
  const [circleCode, setCircleCode] = useState(prefillCode || '');
  const [circleId, setCircleId] = useState('');
  const [elderName, setElderName] = useState('');
  const [members, setMembers] = useState<MemberTile[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberTile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = useCallback(
    async (cId?: string, mId?: string, pinVal?: string) => {
      const activeCircleId = cId || circleId;
      const activeMemberId = mId || selectedMember?.id;
      const activePin = pinVal || pin;
      if (!activeCircleId || !activeMemberId || !activePin) return;

      setError(null);
      setLoading(true);
      try {
        const res = await api.post<{
          memberId: string;
          name: string;
          role: 'elder' | 'family' | 'caretaker';
        }>('/api/auth/signin', {
          circleId: activeCircleId,
          memberId: activeMemberId,
          pin: activePin,
        });
        onSuccess(res.role);
      } catch (err: unknown) {
        setPin('');
        setError((err as ApiError).message || 'Incorrect PIN');
      } finally {
        setLoading(false);
      }
    },
    [circleId, onSuccess, pin, selectedMember?.id],
  );

  const handleLookup = useCallback(
    async (codeToLookup: string, roleToSelect?: string, pinToSubmit?: string) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetchLookup(codeToLookup);
        setCircleId(res.circleId);
        setElderName(res.preferredName || res.elderName);
        setMembers(res.members);
        const found = roleToSelect ? res.members.find((m) => m.role === roleToSelect) : null;
        if (found) {
          setSelectedMember(found);
          setStep('pin');
          if (pinToSubmit) await handlePinSubmit(res.circleId, found.id, pinToSubmit);
        } else {
          setStep('member');
        }
      } catch (err: unknown) {
        setError((err as ApiError).message || 'Failed to find circle');
      } finally {
        setLoading(false);
      }
    },
    [handlePinSubmit],
  );

  useEffect(() => {
    if (prefillCode) handleLookup(prefillCode, prefillRole, prefillPin);
  }, [handleLookup, prefillCode, prefillPin, prefillRole]);

  return {
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
  };
}
