import { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

function TrialBanner() {
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setTenant(await res.json());
        }
      } catch {
        // Non-critical — just don't show the banner
      }
    };
    fetchTenant();
  }, []);

  if (!tenant || !tenant.isTrialing || !tenant.trialEndsAt) return null;

  const daysLeft = Math.ceil((new Date(tenant.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return (
      <div className="flex items-center gap-2 bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-lg mx-6 mt-6 mb-2">
        <AlertTriangle size={16} />
        Your free trial has ended — please upgrade to a paid plan to continue using Lemida SchoolManager.
      </div>
    );
  }

  if (daysLeft <= 3) {
    return (
      <div className="flex items-center gap-2 bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg mx-6 mt-6 mb-2">
        <AlertTriangle size={16} />
        Your free trial ends in {daysLeft} day{daysLeft === 1 ? '' : 's'} — upgrade to keep full access.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium px-4 py-2 rounded-lg mx-6 mt-6 mb-2">
      <Clock size={16} />
      {daysLeft} days left in your free trial.
    </div>
  );
}

export default TrialBanner;
