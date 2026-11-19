// FILE: client/src/components/poker/CardBack.jsx
import { useId } from 'react';

const BACK_PALETTES = {
  pasim_crest: {
    bg: '#71181d',
    bgDeep: '#3b0c0f',
    stroke: '#fbbf24',
    accent: '#fef3c7',
    label: 'PASIM',
  },
  emerald_lattice: {
    bg: '#065f46',
    bgDeep: '#022c22',
    stroke: '#34d399',
    accent: '#d1fae5',
    label: 'BIG 2',
  },
  midnight_rosette: {
    bg: '#0f172a',
    bgDeep: '#020617',
    stroke: '#38bdf8',
    accent: '#e0f2fe',
    label: 'POKER',
  },
};

export default function CardBack({ design = 'pasim_crest', className = '' }) {
  const uid = useId().replace(/:/g, '');
  const palette = BACK_PALETTES[design] || BACK_PALETTES.pasim_crest;
  const patternId = `cardback-pat-${design}-${uid}`;
  const gradId = `cardback-grad-${design}-${uid}`;

  return (
    <div
      className={`h-full w-full overflow-hidden rounded-[var(--poker-card-radius)] bg-white p-[3px] shadow-md select-none ${className}`}
      aria-label="Punggung kartu tertutup"
    >
      <svg
        viewBox="0 0 100 140"
        className="h-full w-full rounded-[7px]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bg} />
            <stop offset="100%" stopColor={palette.bgDeep} />
          </linearGradient>
          {design === 'emerald_lattice' ? (
            <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
              <path
                d="M0 7 L7 0 L14 7 L7 14 Z"
                fill="none"
                stroke={palette.stroke}
                strokeOpacity="0.34"
                strokeWidth="1"
              />
            </pattern>
          ) : design === 'midnight_rosette' ? (
            <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke={palette.stroke}
                strokeOpacity="0.28"
                strokeWidth="1"
              />
              <circle cx="8" cy="8" r="1.5" fill={palette.stroke} fillOpacity="0.35" />
            </pattern>
          ) : (
            <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
              <path
                d="M6 0 L12 6 L6 12 L0 6 Z"
                fill="none"
                stroke={palette.stroke}
                strokeOpacity="0.28"
                strokeWidth="0.9"
              />
            </pattern>
          )}
        </defs>

        <rect x="0" y="0" width="100" height="140" rx="6" fill={`url(#${gradId})`} />
        <rect
          x="5"
          y="5"
          width="90"
          height="130"
          rx="4"
          fill={`url(#${patternId})`}
          stroke={palette.stroke}
          strokeOpacity="0.65"
          strokeWidth="1.2"
        />
        <rect
          x="9"
          y="9"
          width="82"
          height="122"
          rx="3"
          fill="none"
          stroke={palette.accent}
          strokeOpacity="0.3"
          strokeWidth="0.8"
        />

        {/* Ornamen Medali Tengah */}
        <g transform="translate(50 70)">
          <polygon
            points="0,-22 18,0 0,22 -18,0"
            fill={palette.bgDeep}
            stroke={palette.stroke}
            strokeWidth="1.4"
          />
          <circle
            cx="0"
            cy="0"
            r="11"
            fill="none"
            stroke={palette.accent}
            strokeOpacity="0.55"
            strokeWidth="1"
          />
          <text
            x="0"
            y="2.5"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="900"
            letterSpacing="0.8"
            fill={palette.accent}
          >
            {palette.label}
          </text>
        </g>
      </svg>
    </div>
  );
}
