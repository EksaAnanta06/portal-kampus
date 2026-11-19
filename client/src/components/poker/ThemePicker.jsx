// FILE: client/src/components/poker/ThemePicker.jsx
import Switch from '@mui/material/Switch';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { TABLE_THEMES, CARD_BACK_DESIGNS } from './pokerThemes';
import CardBack from './CardBack';
import PlayingCard from './PlayingCard';

const SAMPLE_SUIT_CARDS = [
  { rank: 14, suit: 'S', code: 'AS' },
  { rank: 13, suit: 'H', code: 'KH' },
  { rank: 12, suit: 'D', code: 'QD' },
  { rank: 11, suit: 'C', code: 'JC' },
];

/**
 * Interactive Theme & Card Back selector with flat live preview and >=12px typography.
 */
export default function ThemePicker({
  tableTheme = 'emerald_royal',
  cardBack = 'pasim_crest',
  fourColorDeck = false,
  animationSpeed = 'full',
  onChangeTheme,
  onChangeCardBack,
  onChangeFourColorDeck,
  onChangeAnimationSpeed,
}) {
  return (
    <div className="space-y-3">
      {/* Pratinjau Langsung Miniatur Meja Datar & Kartu */}
      <div
        data-poker-theme={tableTheme}
        className="poker-stage poker-flat-elevated p-3 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="space-y-0.5 min-w-0">
          <span className="poker-text-sm font-bold text-amber-400">Pratinjau Langsung</span>
          <p className="m-0 poker-text-sm font-bold text-slate-100 truncate">
            {TABLE_THEMES.find((t) => t.id === tableTheme)?.name || 'Zamrud Datar'} ·{' '}
            {CARD_BACK_DESIGNS.find((b) => b.id === cardBack)?.name || 'PASIM Crest'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-10 h-14 rounded-lg overflow-hidden">
            <CardBack design={cardBack} />
          </div>
          {SAMPLE_SUIT_CARDS.map((card) => (
            <PlayingCard
              key={card.code}
              card={card}
              size="sm"
              fourColor={fourColorDeck}
              cardBackDesign={cardBack}
            />
          ))}
        </div>
      </div>

      {/* Pilihan Tema (3 Pilihan) */}
      <div className="space-y-1.5">
        <span className="poker-text-sm font-bold text-slate-300">Tema Meja (3 Pilihan)</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TABLE_THEMES.map((theme) => {
            const active = tableTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeTheme?.(theme.id)}
                className={`min-h-[48px] rounded-xl border p-2.5 text-left flex items-center gap-2 transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/20 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-200'
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: theme.swatch }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="poker-text-sm font-extrabold truncate">{theme.name}</div>
                  <div className="poker-text-sm text-slate-400 truncate">{theme.subtitle}</div>
                </div>
                {active && (
                  <CheckCircleRoundedIcon fontSize="small" className="text-emerald-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pilihan Punggung Kartu (3 Desain SVG) */}
      <div className="space-y-1.5">
        <span className="poker-text-sm font-bold text-slate-300">Punggung Kartu (3 Pilihan)</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CARD_BACK_DESIGNS.map((back) => {
            const active = cardBack === back.id;
            return (
              <button
                key={back.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeCardBack?.(back.id)}
                className={`min-h-[52px] rounded-xl border p-2 text-left flex items-center gap-2 transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/20 text-white'
                    : 'border-slate-700 bg-slate-900/50 text-slate-200'
                }`}
              >
                <div className="w-8 h-11 rounded-md overflow-hidden shrink-0">
                  <CardBack design={back.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="poker-text-sm font-extrabold truncate">{back.name}</div>
                  <div className="poker-text-sm text-slate-400 truncate">{back.subtitle}</div>
                </div>
                {active && (
                  <CheckCircleRoundedIcon fontSize="small" className="text-amber-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opsi Dek 4-Warna (Aksesibilitas Buta Warna) */}
      <div className="poker-flat-elevated px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <div className="poker-text-sm font-extrabold text-white">
            Dek 4-Warna (Ramah Buta Warna)
          </div>
          <div className="poker-text-sm text-slate-400">
            ♦ Biru dan ♣ Hijau agar kembang terbedakan jelas.
          </div>
        </div>
        <Switch
          color="success"
          checked={Boolean(fourColorDeck)}
          onChange={(e) => onChangeFourColorDeck?.(e.target.checked)}
          inputProps={{ 'aria-label': 'Aktifkan dek 4 warna' }}
        />
      </div>
      {/* Setelan Kecepatan Animasi (Penuh / Cepat / Mati) */}
      <div className="space-y-1.5">
        <span className="poker-text-sm font-bold text-slate-300">
          Animasi Lemparan Meja
        </span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'full', label: 'Penuh', desc: 'Realistis' },
            { id: 'fast', label: 'Cepat', desc: '2x lipat' },
            { id: 'off', label: 'Mati', desc: 'Instan' },
          ].map((spd) => {
            const active = animationSpeed === spd.id;
            return (
              <button
                key={spd.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeAnimationSpeed?.(spd.id)}
                className={`min-h-[44px] rounded-xl border p-2 text-center transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300'
                }`}
              >
                <div className="poker-text-sm font-extrabold">{spd.label}</div>
                <div className="text-xs text-slate-400">{spd.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
