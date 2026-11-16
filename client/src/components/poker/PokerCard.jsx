// FILE: client/src/components/poker/PokerCard.jsx
const SUIT_META = {
  S: { symbol: '♠', name: 'Sekop', twoColor: 'text-slate-900', fourColor: 'text-slate-900' },
  H: { symbol: '♥', name: 'Hati', twoColor: 'text-rose-600', fourColor: 'text-rose-600' },
  D: { symbol: '♦', name: 'Wajik', twoColor: 'text-rose-600', fourColor: 'text-sky-600' },
  C: { symbol: '♣', name: 'Keriting', twoColor: 'text-slate-900', fourColor: 'text-emerald-700' },
};

const rankDisplay = (rank) => {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
};

const SIZE_CLASSES = {
  xs: 'h-10 w-7 text-[11px] rounded-md',
  sm: 'h-14 w-10 text-xs rounded-lg',
  md: 'h-[70px] w-[50px] sm:h-20 sm:w-14 text-sm sm:text-base rounded-xl',
  lg: 'h-20 w-14 sm:h-24 sm:w-16 text-base sm:text-lg rounded-xl',
};

export default function PokerCard({
  card = null,
  faceDown = false,
  fourColor = false,
  size = 'md',
  highlight = false,
}) {
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (faceDown || !card) {
    return (
      <div
        aria-label="Kartu tertutup"
        className={`${sizeCls} relative select-none border border-emerald-200/40 bg-gradient-to-br from-slate-800 via-pasim-900 to-slate-900 shadow-md flex items-center justify-center shrink-0`}
      >
        <div className="h-[78%] w-[76%] rounded border border-white/15 bg-white/5 flex items-center justify-center">
          <span className="text-[10px] font-black tracking-tighter text-white/40">PASIM</span>
        </div>
      </div>
    );
  }

  const meta = SUIT_META[card.suit] || SUIT_META.S;
  const colorCls = fourColor ? meta.fourColor : meta.twoColor;
  const rText = rankDisplay(card.rank);

  return (
    <div
      role="img"
      aria-label={`${rText} ${meta.name}`}
      className={`${sizeCls} ${colorCls} relative select-none bg-white border ${
        highlight
          ? 'border-amber-400 ring-2 ring-amber-400/70 shadow-lg'
          : 'border-slate-300 shadow-md'
      } flex flex-col justify-between p-1 sm:p-1.5 font-black leading-none shrink-0`}
    >
      <div className="flex flex-col items-start leading-none">
        <span>{rText}</span>
        <span className="text-[0.8em]">{meta.symbol}</span>
      </div>
      <div className="self-center text-[1.25em] leading-none" aria-hidden="true">
        {meta.symbol}
      </div>
      <div className="flex flex-col items-end rotate-180 leading-none" aria-hidden="true">
        <span>{rText}</span>
      </div>
    </div>
  );
}
