/**
 * Browser Speech Recognition & Synthesis hook for VoiceModal.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface BrowserSpeechRecognitionEvent {
  results: {
    0: {
      0: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechConstructor = new () => BrowserSpeechRecognition;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechConstructor;
  webkitSpeechRecognition?: SpeechConstructor;
}

export function speakBrowserText(text: string, language: 'en' | 'hi'): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  }
}

export function useVoiceAssistant(language: 'en' | 'hi', onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as WindowWithSpeech;
      const ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!ctor) setSpeechSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    try {
      const win = window as unknown as WindowWithSpeech;
      const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!Ctor) return;
      const rec = new Ctor();
      rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setListening(false);
        onResult(text);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setSpeechSupported(false);
    }
  }, [language, onResult, speechSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  }, []);

  return { listening, speechSupported, startListening, stopListening };
}
