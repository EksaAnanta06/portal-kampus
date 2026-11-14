// FILE: client/src/components/common/Footer.jsx
import { Link } from 'react-router-dom';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MailRoundedIcon from '@mui/icons-material/MailRounded';
import { BrandLogo } from './Navbar';
import { CAMPUS_INFO } from '../../utils/constants';

const LINKS = [
  {
    title: 'Jelajahi',
    items: [
      { to: '/angkatan', label: 'Galeri Angkatan' },
      { to: '/pengumuman', label: 'Pengumuman' },
      { to: '/agenda', label: 'Agenda Kampus' },
      { to: '/direktori', label: 'Direktori Alumni' },
    ],
  },
  {
    title: 'Akun',
    items: [
      { to: '/login', label: 'Masuk' },
      { to: '/register', label: 'Daftar Akun' },
      { to: '/lupa-password', label: 'Lupa Password' },
      { to: '/profil', label: 'Profil Saya' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 bg-navy text-slate-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <BrandLogo light />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Wadah resmi sivitas akademika {CAMPUS_INFO.name} untuk mengarsipkan kenangan per angkatan, berbagi
            informasi kampus, dan memperluas jejaring mahasiswa serta alumni.
          </p>
          <ul className="mt-5 list-none space-y-2 p-0 text-sm text-slate-400">
            <li className="flex gap-2">
              <LocationOnRoundedIcon fontSize="small" className="text-gold-light" />
              {CAMPUS_INFO.address}
            </li>
            <li className="flex gap-2">
              <LanguageRoundedIcon fontSize="small" className="text-gold-light" />
              <a href={CAMPUS_INFO.website} target="_blank" rel="noreferrer" className="hover:text-white">
                pasim.ac.id
              </a>
            </li>
            <li className="flex gap-2">
              <MailRoundedIcon fontSize="small" className="text-gold-light" />
              {CAMPUS_INFO.email}
            </li>
          </ul>
        </div>

        {LINKS.map((group) => (
          <div key={group.title}>
            <h4 className="m-0 mb-4 text-sm font-bold uppercase tracking-wider text-white">{group.title}</h4>
            <ul className="m-0 list-none space-y-2.5 p-0">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-slate-400 transition hover:text-gold-light">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-0 border-t border-solid border-slate-800">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} {CAMPUS_INFO.name} Bandung. Hak cipta dilindungi.</span>
          <span>Dikembangkan oleh Pusat Komputer & Kemahasiswaan UNAS PASIM</span>
        </div>
      </div>
    </footer>
  );
}
