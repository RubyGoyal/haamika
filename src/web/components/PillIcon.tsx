import React from 'react';
import type { PillColor, PillShape } from '../../shared/types.js';

interface PillIconProps {
  color: PillColor;
  shape: PillShape;
  size?: number;
}

interface Palette {
  bg: string;
  border: string;
}

const COLOR_MAP: Record<PillColor, Palette> = {
  white: { bg: '#ffffff', border: '#475569' },
  yellow: { bg: '#fef08a', border: '#854d0e' },
  pink: { bg: '#fbcfe8', border: '#9d174d' },
  orange: { bg: '#fed7aa', border: '#9a3412' },
  blue: { bg: '#bae6fd', border: '#0369a1' },
  green: { bg: '#bbf7d0', border: '#15803d' },
  red: { bg: '#fecaca', border: '#991b1b' },
  brown: { bg: '#d7ccc8', border: '#4e342e' },
};

const ShapeRenderer: React.FC<{ shape: PillShape; palette: Palette }> = ({ shape, palette }) => {
  if (shape === 'round')
    return (
      <circle cx="24" cy="24" r="16" fill={palette.bg} stroke={palette.border} strokeWidth="3" />
    );
  if (shape === 'oval')
    return (
      <ellipse
        cx="24"
        cy="24"
        rx="18"
        ry="12"
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth="3"
      />
    );
  if (shape === 'capsule') {
    return (
      <g>
        <rect
          x="10"
          y="14"
          width="28"
          height="20"
          rx="10"
          fill={palette.bg}
          stroke={palette.border}
          strokeWidth="3"
        />
        <line
          x1="24"
          y1="14"
          x2="24"
          y2="34"
          stroke={palette.border}
          strokeWidth="2"
          strokeDasharray="2 2"
        />
      </g>
    );
  }
  if (shape === 'liquid')
    return (
      <path
        d="M24 8 C24 8 12 24 12 32 A12 12 0 0 0 36 32 C36 24 24 8 24 8 Z"
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth="3"
      />
    );
  if (shape === 'drops')
    return (
      <path
        d="M24 10 C24 10 16 22 16 28 A8 8 0 0 0 32 28 C32 22 24 10 24 10 Z"
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth="3"
      />
    );
  if (shape === 'inhaler')
    return (
      <path
        d="M16 12 H28 V24 H34 V36 H16 Z"
        fill={palette.bg}
        stroke={palette.border}
        strokeWidth="3"
      />
    );
  if (shape === 'injection') {
    return (
      <g>
        <rect
          x="20"
          y="14"
          width="8"
          height="20"
          fill={palette.bg}
          stroke={palette.border}
          strokeWidth="3"
        />
        <line x1="24" y1="34" x2="24" y2="42" stroke={palette.border} strokeWidth="3" />
        <line x1="16" y1="14" x2="32" y2="14" stroke={palette.border} strokeWidth="3" />
      </g>
    );
  }
  return (
    <circle cx="24" cy="24" r="14" fill={palette.bg} stroke={palette.border} strokeWidth="3" />
  );
};

export const PillIcon: React.FC<PillIconProps> = ({ color, shape, size = 36 }) => {
  const palette = COLOR_MAP[color] || { bg: '#ffffff', border: '#000000' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${color} ${shape} pill`}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <ShapeRenderer shape={shape} palette={palette} />
    </svg>
  );
};
