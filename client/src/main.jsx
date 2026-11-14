// FILE: client/src/main.jsx
import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StyledEngineProvider, ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import App from './App';
import useThemeStore from './store/useThemeStore';
import './index.css';

const BRAND = {
  maroon: '#8B1E24',
  maroonLight: '#A82B32',
  maroonDark: '#6B151A',
  navy: '#0F172A',
  navyPaper: '#1E293B',
  gold: '#D97706',
};

const buildTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#C44A51' : BRAND.maroon,
        light: BRAND.maroonLight,
        dark: BRAND.maroonDark,
        contrastText: '#FFFFFF',
      },
      secondary: { main: BRAND.gold, contrastText: '#FFFFFF' },
      background:
        mode === 'dark'
          ? { default: BRAND.navy, paper: BRAND.navyPaper }
          : { default: '#F8FAFC', paper: '#FFFFFF' },
      text:
        mode === 'dark'
          ? { primary: '#F1F5F9', secondary: '#94A3B8' }
          : { primary: '#0F172A', secondary: '#64748B' },
      divider: mode === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.08)',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10, paddingInline: 18 } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTooltip: { defaultProps: { arrow: true } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({
            fontWeight: 700,
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04),
          }),
        },
      },
    },
  });

function GlobalSnackbar() {
  const snackbar = useThemeStore((s) => s.snackbar);
  const closeToast = useThemeStore((s) => s.closeToast);

  return (
    <Snackbar
      key={snackbar.key}
      open={snackbar.open}
      autoHideDuration={4500}
      onClose={(_e, reason) => reason !== 'clickaway' && closeToast()}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={closeToast} severity={snackbar.severity} variant="filled" className="!rounded-xl shadow-lg">
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}

function AppProviders({ children }) {
  const mode = useThemeStore((s) => s.mode);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  // Sinkronkan class `dark` untuk Tailwind (darkMode: 'class')
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
  }, [mode]);

  return (
    // injectFirst: style MUI dimasukkan lebih dulu sehingga class Tailwind bisa meng-override
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        <GlobalSnackbar />
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>
);
