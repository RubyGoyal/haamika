import React from 'react';
import { useI18n } from '../i18n/index.js';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useI18n();

  const toggle = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-secondary"
      aria-label={`Change language. Currently ${lang === 'en' ? 'English' : 'हिंदी'}`}
      style={{
        padding: '0.4rem 0.8rem',
        fontSize: '0.95rem',
        fontWeight: 700,
        borderRadius: '20px',
      }}
    >
      🌐 {lang === 'en' ? 'हिंदी में देखें' : 'Switch to English'}
    </button>
  );
};
