import React, { useState, useCallback } from 'react';
import { Dialog } from './Dialog.js';
import { LiveRegion } from './LiveRegion.js';
import { api } from '../api/client.js';
import type { VoiceIntent } from '../../shared/schemas.js';
import { useVoiceAssistant, speakBrowserText } from './useVoiceAssistant.js';
import { VoiceListenButton, VoiceConfirmBox, VoiceTextInputForm } from './VoiceModalComponents.js';

interface VoiceResponse {
  intent: VoiceIntent;
  replyText: string;
  requiresConfirmation: boolean;
  actionPayload?: Record<string, unknown>;
  isDosingAdviceQuery?: boolean;
}

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'hi';
  onEmergency: () => void;
  onCallFamily: () => void;
  onConfirmAction: (intent: VoiceIntent, payload?: Record<string, unknown>) => void;
}

function useVoiceModalState(
  language: 'en' | 'hi',
  onEmergency: () => void,
  onCallFamily: () => void,
  onClose: () => void,
) {
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<VoiceResponse | null>(null);

  const handleSendTranscript = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setLoading(true);
      setReplyText('');
      setPendingAction(null);
      try {
        const res = await api.post<VoiceResponse>('/api/voice/intent', { transcript: text });
        setReplyText(res.replyText);
        setLiveAnnouncement(res.replyText);
        speakBrowserText(res.replyText, language);
        if (res.intent === 'EMERGENCY') {
          onEmergency();
          onClose();
          return;
        }
        if (res.intent === 'CALL_FAMILY') onCallFamily();
        if (res.requiresConfirmation) setPendingAction(res);
      } catch {
        const msg =
          language === 'hi'
            ? 'माफ़ कीजिए, उत्तर प्राप्त नहीं हो सका।'
            : 'Sorry, could not process request.';
        setReplyText(msg);
        setLiveAnnouncement(msg);
        speakBrowserText(msg, language);
      } finally {
        setLoading(false);
      }
    },
    [language, onCallFamily, onClose, onEmergency],
  );

  return {
    transcript,
    setTranscript,
    replyText,
    liveAnnouncement,
    loading,
    pendingAction,
    setPendingAction,
    handleSendTranscript,
  };
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  language,
  onEmergency,
  onCallFamily,
  onConfirmAction,
}) => {
  const {
    transcript,
    setTranscript,
    replyText,
    liveAnnouncement,
    loading,
    pendingAction,
    setPendingAction,
    handleSendTranscript,
  } = useVoiceModalState(language, onEmergency, onCallFamily, onClose);

  const onSpeechResult = useCallback(
    (text: string) => {
      setTranscript(text);
      handleSendTranscript(text);
    },
    [handleSendTranscript, setTranscript],
  );

  const { listening, speechSupported, startListening, stopListening } = useVoiceAssistant(
    language,
    onSpeechResult,
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Talk to Haamika — हामिका से बात करें">
      <LiveRegion message={liveAnnouncement} />
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <VoiceListenButton
          speechSupported={speechSupported}
          listening={listening}
          transcript={transcript}
          language={language}
          onToggleListen={listening ? stopListening : startListening}
        />
        <VoiceTextInputForm
          loading={loading}
          language={language}
          onSubmitText={handleSendTranscript}
        />
        {loading && <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Haamika is thinking...</p>}
        {replyText && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              border: '2px solid #22c55e',
              marginBottom: '1rem',
              textAlign: 'left',
            }}
          >
            <p style={{ fontSize: '1.25rem', color: '#14532d', fontWeight: 600 }}>🔊 {replyText}</p>
          </div>
        )}
        {pendingAction && (
          <VoiceConfirmBox
            language={language}
            onConfirm={() => {
              onConfirmAction(pendingAction.intent, pendingAction.actionPayload);
              setPendingAction(null);
              onClose();
            }}
            onCancel={() => setPendingAction(null)}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="btn"
          style={{ width: '100%', marginTop: '1.5rem', backgroundColor: '#f1f5f9' }}
        >
          Close
        </button>
      </div>
    </Dialog>
  );
};
