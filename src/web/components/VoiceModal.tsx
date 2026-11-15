/**
 * Voice Assistant Modal "Talk to Haamika" (R8, R9, SPEC §4.3).
 * Integrates browser SpeechRecognition (hi-IN/en-IN), speechSynthesis,
 * aria-live polite region, text input fallback, and action confirmations.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from './Dialog.js';
import { LiveRegion } from './LiveRegion.js';
import { api } from '../api/client.js';
import type { VoiceIntent } from '../../shared/schemas.js';

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

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  language,
  onEmergency,
  onCallFamily,
  onConfirmAction,
}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<VoiceResponse | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    if (!speechSupported) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setListening(false);
        handleSendTranscript(text);
      };

      recognition.onerror = () => {
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setSpeechSupported(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  const handleSendTranscript = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setLoading(true);
    setReplyText('');
    setPendingAction(null);

    try {
      const res = await api.post<VoiceResponse>('/api/voice/intent', {
        transcript: textToSend,
      });

      setReplyText(res.replyText);
      setLiveAnnouncement(res.replyText);
      speakText(res.replyText);

      if (res.intent === 'EMERGENCY') {
        onEmergency();
        onClose();
        return;
      }

      if (res.intent === 'CALL_FAMILY') {
        onCallFamily();
      }

      if (res.requiresConfirmation) {
        setPendingAction(res);
      }
    } catch {
      const errMsg =
        language === 'hi'
          ? 'माफ़ कीजिए, उत्तर प्राप्त नहीं हो सका। कृपया दोबारा प्रयास करें।'
          : 'Sorry, could not process request. Please try again.';
      setReplyText(errMsg);
      setLiveAnnouncement(errMsg);
      speakText(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      onConfirmAction(pendingAction.intent, pendingAction.actionPayload);
      setPendingAction(null);
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Talk to Haamika — हामिका से बात करें">
      <LiveRegion message={liveAnnouncement} />
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        {speechSupported ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className={`btn ${listening ? 'btn-danger' : 'btn-primary'} btn-elder-big`}
              style={{
                width: '100%',
                minHeight: '70px',
                fontSize: '1.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
              aria-label={listening ? 'Stop listening' : 'Start listening to voice'}
            >
              <span aria-hidden="true" style={{ fontSize: '1.75rem' }}>
                {listening ? '⏹️' : '🎙️'}
              </span>
              <span>
                {listening
                  ? language === 'hi'
                    ? 'सुन रही हूँ... (टैप करके रोकें)'
                    : 'Listening... (tap to stop)'
                  : language === 'hi'
                    ? 'बोलने के लिए टैप करें'
                    : 'Tap to speak'}
              </span>
            </button>
            {transcript && (
              <p style={{ marginTop: '0.75rem', fontStyle: 'italic', fontSize: '1.1rem' }}>
                "{transcript}"
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '1.1rem' }}>
            Speech recognition is not supported in this browser. You can type below:
          </p>
        )}

        {/* Manual text input fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendTranscript(manualText);
            setManualText('');
          }}
          style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}
        >
          <label htmlFor="voice-text-fallback" className="sr-only">
            Type message for Haamika
          </label>
          <input
            id="voice-text-fallback"
            type="text"
            className="form-input"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={language === 'hi' ? 'यहाँ लिखें (उदा. क्या दवाई लेनी है?)' : 'Type here...'}
            style={{ fontSize: '1.1rem' }}
          />
          <button type="submit" disabled={loading || !manualText.trim()} className="btn btn-secondary">
            Send
          </button>
        </form>

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
            <p style={{ fontSize: '1.25rem', color: '#14532d', fontWeight: 600 }}>
              🔊 {replyText}
            </p>
          </div>
        )}

        {/* Confirmation prompt for state-changing voice intents */}
        {pendingAction && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '2px solid #f59e0b',
              marginTop: '1rem',
            }}
          >
            <p style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '1rem' }}>
              {language === 'hi' ? 'पुष्टि करें (Confirm)' : 'Confirmation required'}
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleConfirm}
                className="btn btn-primary btn-elder-big"
                style={{ flex: 1, backgroundColor: '#15803d' }}
              >
                {language === 'hi' ? 'हाँ (Yes)' : 'Yes, Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="btn btn-secondary btn-elder-big"
                style={{ flex: 1 }}
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          </div>
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
