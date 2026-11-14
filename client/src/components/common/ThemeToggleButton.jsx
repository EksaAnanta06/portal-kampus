// FILE: client/src/components/common/ThemeToggleButton.jsx
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import useThemeStore from '../../store/useThemeStore';

export function ThemeToggleButton() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return (
    <Tooltip title={mode === 'dark' ? 'Mode Terang' : 'Mode Gelap'}>
      <IconButton
        onClick={toggleMode}
        color="inherit"
        aria-label="Ganti tema"
        className="min-h-[44px] min-w-[44px]"
      >
        {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}

export default ThemeToggleButton;
