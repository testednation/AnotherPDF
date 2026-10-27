import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, ShieldCheck } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 border border-amber-600/60 px-3.5 py-2 text-xs font-medium text-slate-200 shadow-2xl backdrop-blur-md">
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="text-amber-300 font-semibold">Offline Mode Active</span>
        <span className="text-slate-500 font-mono">·</span>
        <span className="text-slate-400">All XFA edits, preflight audits, &amp; resource extractions run 100% locally</span>
      </div>
    </div>
  );
};
