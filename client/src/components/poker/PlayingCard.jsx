// FILE: client/src/components/poker/PlayingCard.jsx
import CardBack from './CardBack';

const SUIT_META = {
  S: { name: 'Sekop', twoColor: '#0f172a', fourColor: '#0f172a' },
  H: { name: 'Hati', twoColor: '#dc2626', fourColor: '#e11d48' },
  D: { name: 'Wajik', twoColor: '#dc2626', fourColor: '#0284c7' },
  C: { name: 'Keriting', twoColor: '#0f172a', fourColor: '#047857' },
};

const rankDisplay = (rank) => {
  if (Number(rank) === 14) return 'A';
  if (Number(rank) === 13) return 'K';
  if (Number(rank) === 12) return 'Q';
  if (Number(rank) === 11) return 'J';
  return String(rank);
};

const SIZE_CLASSES = {
  xs: 'h-11 w-8',
  sm: 'h-14 w-10',
  md: 'h-[70px] w-[50px] sm:h-20 sm:w-14',
  lg: 'h-[76px] w-[52px] sm:h-24 sm:w-[66px]',
};

const FONT_SIZE_BY_PRESET = {
  xs: { corner: 'poker-text-sm leading-none', pipCorner: 'h-2.5 w-2.5', pipCenter: 'h-3.5 w-3.5' },
  sm: { corner: 'poker-text-sm leading-none', pipCorner: 'h-3 w-3', pipCenter: 'h-5 w-5' },
  md: { corner: 'text-xs sm:text-sm leading-none', pipCorner: 'h-3 w-3', pipCenter: 'h-6 w-6 sm:h-7 sm:w-7' },
  lg: { corner: 'text-sm sm:text-base leading-none', pipCorner: 'h-3.5 w-3.5', pipCenter: 'h-7 w-7 sm:h-8 sm:w-8' },
};

function SuitGlyph({ suit, color, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden="true">
      {suit === 'S' && (
        <path d="M12 2C9.5 5.8 4 10 4 14.5C4 17.3 6.2 19.2 8.7 19.2C10.1 19.2 11.1 18.6 11.7 17.8L10.3 22H13.7L12.3 17.8C12.9 18.6 13.9 19.2 15.3 19.2C17.8 19.2 20 17.3 20 14.5C20 10 14.5 5.8 12 2Z" />
      )}
      {suit === 'H' && (
        <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" />
      )}
      {suit === 'D' && <path d="M12 2L20.5 12L12 22L3.5 12L12 2Z" />}
      {suit === 'C' && (
        <path d="M12 2.5C9.8 2.5 8 4.3 8 6.5C8 7.5 8.4 8.4 9 9.1C8.4 8.9 7.8 8.8 7.1 8.8C4.8 8.8 3 10.6 3 12.9C3 15.1 4.8 17 7.1 17C8.8 17 10.2 16 10.9 14.6L9.7 21.5H14.3L13.1 14.6C13.8 16 15.2 17 16.9 17C19.2 17 21 15.1 21 12.9C21 10.6 19.2 8.8 16.9 8.8C16.2 8.8 15.6 8.9 15 9.1C15.6 8.4 16 7.5 16 6.5C16 4.3 14.2 2.5 12 2.5Z" />
      )}
    </svg>
  );
}

export default function PlayingCard({
  card = null,
  faceDown = false,
  cardBackDesign = 'pasim_crest',
  fourColor = false,
  size = 'md',
  landscapeRole = null, // 'hole' | 'community' | 'opponent' | null
  highlight = false,
  selected = false,
  dimmed = false,
  onClick = null,
  className = '',
  style = undefined,
}) {
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const lsRoleCls =
    landscapeRole === 'hole'
      ? 'poker-ls-hole-card'
      : landscapeRole === 'community'
      ? 'poker-ls-comm-card'
      : landscapeRole === 'opponent'
      ? 'poker-ls-opp-card'
      : '';
  const lsScaleTypography = landscapeRole === 'hole' || landscapeRole === 'community';

  const typography = FONT_SIZE_BY_PRESET[size] || FONT_SIZE_BY_PRESET.md;
  const meta = SUIT_META[card?.suit] || SUIT_META.S;
  const suitColor = fourColor ? meta.fourColor : meta.twoColor;
  const rankText = card ? rankDisplay(card.rank) : '';
  const isBackOnly = faceDown || !card;

  const interactiveCls = onClick
    ? 'cursor-pointer transition-transform duration-150 motion-reduce:transition-none active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
    : '';

  const stateCls = selected
    ? 'poker-card-selected ring-2 ring-amber-400'
    : highlight
    ? 'poker-card-highlight ring-2 ring-amber-400/90'
    : '';

  const dimCls = dimmed ? 'opacity-45' : '';
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick || undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={isBackOnly ? 'Kartu tertutup' : `${rankText} ${meta.name}`}
      style={style}
      className={`${sizeCls} ${lsRoleCls} ${interactiveCls} ${stateCls} ${dimCls} ${className} poker-perspective relative select-none shrink-0 bg-transparent p-0 text-left rounded-[var(--poker-radius-sm)]`}
    >
      <div className={`poker-flip-inner ${isBackOnly ? 'is-facedown' : ''}`}>
        {/* Sisi Depan (Wajah Kartu SVG Tajam & Proporsional) */}
        <div
          className={`poker-flip-face poker-flip-front rounded-[var(--poker-radius-sm)] bg-white border ${
            highlight || selected ? 'border-amber-400' : 'border-slate-300'
          } flex flex-col justify-between p-1 sm:p-1.5 overflow-hidden`}
        >
          {card && (
            <>
              <div className="flex flex-col items-center self-start leading-none gap-[1px]">
                <span
                  className={`${typography.corner} ${
                    lsScaleTypography ? 'poker-ls-card-rank' : ''
                  } font-black tracking-tighter leading-none`}
                  style={{ color: suitColor }}
                >
                  {rankText}
                </span>
                <SuitGlyph
                  suit={card.suit}
                  color={suitColor}
                  className={`${typography.pipCorner} ${
                    lsScaleTypography ? 'poker-ls-pip-corner' : ''
                  }`}
                />
              </div>

              <div className="flex items-center justify-center self-center" aria-hidden="true">
                <SuitGlyph
                  suit={card.suit}
                  color={suitColor}
                  className={`${typography.pipCenter} ${
                    lsScaleTypography ? 'poker-ls-pip-center' : ''
                  }`}
                />
              </div>

              <div
                className="flex flex-col items-center self-end rotate-180 leading-none gap-[1px]"
                aria-hidden="true"
              >
                <span
                  className={`${typography.corner} ${
                    lsScaleTypography ? 'poker-ls-card-rank' : ''
                  } font-black tracking-tighter leading-none`}
                  style={{ color: suitColor }}
                >
                  {rankText}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Sisi Belakang (CardBack Desain Pilihan) */}
        <div className="poker-flip-face poker-flip-back">
          <CardBack design={cardBackDesign} />
        </div>
      </div>
    </Wrapper>
  );
}
