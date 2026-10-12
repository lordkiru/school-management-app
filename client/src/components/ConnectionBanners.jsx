import { WifiOff, RefreshCw } from 'lucide-react';

// Offline / background-sync banners pinned to the top of the screen. Shared by both dashboard
// layouts so the offline attendance queue looks and behaves the same in each.
function ConnectionBanners({ isOnline, pendingSync, syncStatus }) {
  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-700 text-white text-sm font-medium py-2 px-4">
          <WifiOff size={15} />
          You're offline — attendance will sync automatically when reconnected
          {pendingSync > 0 && (
            <span className="bg-white text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full ml-1">
              {pendingSync} queued
            </span>
          )}
        </div>
      )}
      {isOnline && syncStatus === 'syncing' && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium py-2 px-4">
          <RefreshCw size={15} className="animate-spin" />
          Syncing offline attendance records...
        </div>
      )}
      {isOnline && syncStatus === 'synced' && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-700 text-white text-sm font-medium py-2 px-4">
          ✅ Offline attendance synced successfully!
        </div>
      )}
    </>
  );
}

export default ConnectionBanners;
