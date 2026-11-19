// FILE: client/src/components/poker/BetSlider.jsx
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import {
  clampBetAmount,
  computeBetSliderBounds,
  formatCompactChips,
} from '../../utils/pokerUiHelpers';

/**
 * Minimalist Raise Slider with THREE quick preset buttons (Min, ½ Pot, All-in)
 * and one confirmation button when rendered inside the Raise Bottom Sheet.
 */
export default function BetSlider({
  value,
  onChange,
  onConfirm = null,
  minBetOrRaiseTo = 20,
  maxBetOrRaiseTo = 1000,
  callAmount = 0,
  totalPot = 0,
  step = 5,
  disabled = false,
  isRaise = false,
}) {
  const bounds = computeBetSliderBounds({
    minBetOrRaiseTo,
    maxBetOrRaiseTo,
    callAmount,
    totalPot,
    step,
  });

  const currentValue = clampBetAmount(
    value === undefined || value === null ? bounds.min : value,
    bounds.min,
    bounds.max
  );

  // Tiga tombol cepat sesuai spesifikasi minimalis: Min, ½ Pot, All-in
  const presetItems = [
    { key: 'min', label: 'Min', amount: bounds.presets.min },
    { key: 'halfPot', label: '½ Pot', amount: bounds.presets.halfPot },
    { key: 'allIn', label: 'All-in', amount: bounds.presets.allIn },
  ];

  const handleSliderChange = (_, nextVal) => {
    const numeric = Array.isArray(nextVal) ? nextVal[0] : nextVal;
    onChange?.(clampBetAmount(numeric, bounds.min, bounds.max));
  };

  const isAllInSelected = bounds.max > 0 && currentValue >= bounds.max;

  return (
    <div className="space-y-3">
      {/* Angka Besar Tabular */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="poker-text-sm font-bold text-slate-400">
          {isRaise ? 'Raise Ke' : 'Jumlah Taruhan'}
        </span>
        <span className="poker-text-lg font-extrabold poker-tabular text-amber-400">
          {Number(currentValue).toLocaleString('id-ID')}
        </span>
      </div>

      {/* Slider Halus */}
      <div className="px-1.5">
        <Slider
          value={currentValue}
          min={bounds.min}
          max={Math.max(bounds.min + 1, bounds.max)}
          step={bounds.step}
          disabled={disabled || !bounds.canSlide}
          onChange={handleSliderChange}
          aria-label="Atur jumlah raise"
          color="success"
          sx={{
            py: '20px',
            minHeight: 44,
            color: '#10b981',
            '& .MuiSlider-thumb': {
              width: 24,
              height: 24,
              backgroundColor: '#f8fafc',
              border: '3px solid #10b981',
            },
            '& .MuiSlider-rail': {
              opacity: 0.35,
              backgroundColor: '#334155',
            },
          }}
        />
      </div>

      {/* Tiga Tombol Cepat: Min, ½ Pot, All-in */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Preset jumlah raise">
        {presetItems.map((preset) => {
          const isSelected = !disabled && currentValue === preset.amount;
          return (
            <button
              key={preset.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(preset.amount)}
              className={`min-h-[44px] rounded-xl border px-2 py-1 flex items-center justify-center gap-1 poker-text-sm font-bold poker-tabular transition ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/60 text-slate-200'
              }`}
              aria-label={`${preset.label} (${preset.amount} chip)`}
            >
              <span>{preset.label}</span>
              <span className="text-slate-400">({formatCompactChips(preset.amount)})</span>
            </button>
          );
        })}
      </div>

      {/* Satu Tombol Konfirmasi */}
      {onConfirm && (
        <Button
          variant="contained"
          color={isAllInSelected ? 'warning' : 'success'}
          fullWidth
          disabled={disabled}
          onClick={() => onConfirm(currentValue, isAllInSelected)}
          className={`!min-h-[48px] !rounded-xl !font-extrabold poker-text-md !normal-case !shadow-none ${
            isAllInSelected ? '!bg-amber-600 !text-white' : '!bg-emerald-600 !text-white'
          }`}
        >
          {isAllInSelected
            ? `Konfirmasi All-in (${formatCompactChips(currentValue)})`
            : `Konfirmasi ${isRaise ? 'Raise' : 'Bet'} ${formatCompactChips(currentValue)}`}
        </Button>
      )}
    </div>
  );
}
