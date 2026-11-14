// FILE: client/src/components/common/EmptyState.jsx
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';

export default function EmptyState({
  icon = <InboxRoundedIcon fontSize="large" />,
  title = 'Belum ada data',
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pasim-50 text-pasim dark:bg-pasim-900/30 dark:text-pasim-300">
        {icon}
      </div>
      <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="text-muted mx-auto mb-0 mt-2 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
