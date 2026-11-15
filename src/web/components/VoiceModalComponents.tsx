import React from 'react';

interface VoiceControlsProps {
  speechSupported: boolean;
  listening: boolean;
  transcript: string;
  language: 'en' | 'hi';
  onToggleListen: () => void;
}

export const VoiceListenButton: React.FC<VoiceControlsProps> = ({
  speechSupported,
  listening,
  transcript,
  language,
  onToggleListen,
}) => {
  if (!speechSupported) {
    return (
      <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '1.1rem' }}>
        Speech recognition is not supported in this browser. You can type below:
      </p>
    );
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <button
        type="button"
        onClick={onToggleListen}
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
  );
};

export const VoiceConfirmBox: React.FC<{
  language: 'en' | 'hi';
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ language, onConfirm, onCancel }) => (
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
        onClick={onConfirm}
        className="btn btn-primary btn-elder-big"
        style={{ flex: 1, backgroundColor: '#15803d' }}
      >
        {language === 'hi' ? 'हाँ (Yes)' : 'Yes, Confirm'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-secondary btn-elder-big"
        style={{ flex: 1 }}
      >
        {language === 'hi' ? 'रद्द करें' : 'Cancel'}
      </button>
    </div>
  </div>
);

export const VoiceTextInputForm: React.FC<{
  loading: boolean;
  language: 'en' | 'hi';
  onSubmitText: (text: string) => void;
}> = ({ loading, language, onSubmitText }) => {
  const [val, setVal] = React.useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmitText(val);
        setVal('');
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
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={language === 'hi' ? 'यहाँ लिखें (उदा. क्या दवाई लेनी है?)' : 'Type here...'}
        style={{ fontSize: '1.1rem' }}
      />
      <button type="submit" disabled={loading || !val.trim()} className="btn btn-secondary">
        Send
      </button>
    </form>
  );
};
