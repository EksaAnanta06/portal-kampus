// FILE: client/src/components/academic/LeaderboardModal.jsx
import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import Skeleton from '@mui/material/Skeleton';
import materialApi from '../../api/material.api';

export default function LeaderboardModal({ open, onClose }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      materialApi
        .getLeaderboard({ limit: 15 })
        .then((res) => setLeaders(res.data || []))
        .catch(() => setLeaders([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: '!rounded-3xl' }}>
      <DialogTitle className="!font-black !text-lg !text-amber-600 dark:!text-amber-400 !flex !items-center !gap-2">
        <EmojiEventsRoundedIcon />
        <span>Papan Peringkat Kontributor Teraktif</span>
      </DialogTitle>
      <DialogContent dividers className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Apresiasi bagi kakak tingkat dan alumni Universitas Nasional Pasim yang paling rajin membagikan materi dan paling banyak membantu adik tingkat.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Belum ada kontributor di papan peringkat. Jadilah yang pertama membagikan materi!
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((u, idx) => {
              const isTop3 = idx < 3;
              const badgeColors = [
                'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', // #1 Emas
                'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200', // #2 Perak
                'bg-amber-700/20 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300', // #3 Perunggu
              ];

              return (
                <div
                  key={u.user_id}
                  className={`flex items-center justify-between rounded-2xl p-3 border transition ${
                    isTop3
                      ? 'border-amber-300/80 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-950/20'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        isTop3 ? badgeColors[idx] : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Avatar src={u.avatar_url} sx={{ width: 36, height: 36 }} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{u.nama}</span>
                        {isTop3 && <WorkspacePremiumRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {u.role === 'alumni' ? 'Alumni' : `Mahasiswa Angkatan ${u.angkatan || '-'}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {u.total_points || 0} Poin
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      📚 {u.approved_materials_count} Materi • 👍 {u.total_helpful_votes} Vote
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" color="inherit" sx={{ borderRadius: 2 }}>
          Tutup
        </Button>
      </DialogActions>
    </Dialog>
  );
}
