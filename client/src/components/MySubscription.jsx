import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, Monitor } from 'lucide-react';

// Builds the "Up to N students · N staff accounts" bullet lines from real
// config values (fetched from GET /subscriptions/plans, sourced from
// server/config/plans.js) rather than retyping limits here — if a limit
// changes in config, these update on next load instead of going stale.
// `studentLimitText` lets the Enterprise card phrase its (also unlimited)
// student cap relative to Growth's real cap instead of a second hardcoded number.
function formatLimits({ studentLimit, staffLimit }, studentLimitText) {
  const students = studentLimitText || (studentLimit == null ? 'Unlimited students' : `Up to ${studentLimit} students`);
  const staff = staffLimit == null ? 'Unlimited staff accounts' : `${staffLimit} staff account${staffLimit === 1 ? '' : 's'}`;
  return [students, staff];
}

const PLAN_LABELS = {
  founding: 'Founding School',
  nano: 'Nano',
  micro: 'Micro',
  starter: 'Starter',
  standard: 'Standard',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

function MySubscription() {
  const [tenant, setTenant] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [selfServicePlans, setSelfServicePlans] = useState([]);
  const [enterprisePlan, setEnterprisePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgradingPlan, setUpgradingPlan] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [tenantRes, subRes, historyRes, plansRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/tenants/me`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/subscriptions/me`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/subscriptions/history`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/subscriptions/plans`, { headers }),
        ]);

        if (tenantRes.ok) setTenant(await tenantRes.json());
        // 404 just means no Subscription document exists yet — not an error state
        if (subRes.ok) setSubscription(await subRes.json());
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(Array.isArray(data) ? data : []);
        }
        if (plansRes.ok) {
          const data = await plansRes.json();
          setSelfServicePlans(Array.isArray(data.selfService) ? data.selfService : []);
          setEnterprisePlan(data.enterprise || null);
        }
      } catch (err) {
        setError('Failed to load subscription details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSelectPlan = async (plan) => {
    setUpgradingPlan(plan);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subscriptions/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err.message);
      setUpgradingPlan(null);
    }
  };

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading subscription details...</p>;

  const isTrialing = tenant?.isTrialing;
  const daysLeft = tenant?.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const trialExpired = isTrialing && daysLeft != null && daysLeft <= 0;

  const currentPlanLabel = isTrialing
    ? 'Free Trial'
    : PLAN_LABELS[subscription?.plan] || PLAN_LABELS[tenant?.subscriptionPlan] || 'No active plan';
  const currentStatus = isTrialing
    ? (trialExpired ? 'Trial expired' : 'Trialing')
    : (subscription?.status || tenant?.subscriptionStatus || 'none');
  const statusIsBad = trialExpired || currentStatus === 'past_due' || currentStatus === 'canceled' || currentStatus === 'none';

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">My Subscription</h2>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm mb-6">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6 mb-8">
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500 mb-1">Current Plan</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{currentPlanLabel}</h3>
            <span className={`inline-flex items-center gap-1 text-sm font-medium mt-1 capitalize ${
              statusIsBad ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {statusIsBad ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {currentStatus}
            </span>
          </div>
          {isTrialing && daysLeft != null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              trialExpired
                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
            }`}>
              <Clock size={16} />
              {trialExpired ? 'Trial has ended' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`}
            </div>
          )}
        </div>
      </div>

      {/* Available plans */}
      <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Available Plans</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {selfServicePlans.map(({ key, price, studentLimit, staffLimit, cbt }) => {
          const isCurrent = !isTrialing && subscription?.plan === key && subscription?.status === 'active';
          const [studentsText, staffText] = formatLimits({ studentLimit, staffLimit });
          return (
            <div
              key={key}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5 flex flex-col gap-3 ${
                isCurrent
                  ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900'
                  : 'border-slate-100 dark:border-gray-700'
              }`}
            >
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">{PLAN_LABELS[key] || key}</h4>
                <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                  ₦{price.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 dark:text-gray-500"> /term</span>
                </p>
              </div>
              <ul className="text-sm text-slate-500 dark:text-gray-400 space-y-1">
                <li>{studentsText}</li>
                <li>{staffText}</li>
              </ul>
              {cbt && (
                <span className="inline-flex items-center gap-1.5 w-fit bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Monitor size={13} /> Computer-Based Testing included
                </span>
              )}
              <button
                onClick={() => handleSelectPlan(key)}
                disabled={isCurrent || upgradingPlan === key}
                className="mt-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {isCurrent ? 'Current Plan' : upgradingPlan === key ? 'Redirecting...' : 'Select'}
              </button>
            </div>
          );
        })}

        {/* Enterprise — no self-service price/purchase, but limits still come from real config */}
        {enterprisePlan && (() => {
          const growthLimit = selfServicePlans.find((p) => p.key === 'growth')?.studentLimit;
          const studentsOverride = growthLimit != null ? `${growthLimit}+ students` : undefined;
          const [studentsText, staffText] = formatLimits(enterprisePlan, studentsOverride);
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 flex flex-col gap-3">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Enterprise</h4>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Custom pricing for large schools and school groups.</p>
              </div>
              <ul className="text-sm text-slate-500 dark:text-gray-400 space-y-1">
                <li>{studentsText}</li>
                <li>{staffText}</li>
                <li>Custom terms</li>
              </ul>
              {enterprisePlan.cbt && (
                <span className="inline-flex items-center gap-1.5 w-fit bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Monitor size={13} /> Computer-Based Testing included
                </span>
              )}
              <a
                href="mailto:sales@lemidaitsolutions.com?subject=Enterprise%20Plan%20Enquiry"
                className="mt-auto text-center bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 text-sm font-semibold py-2 rounded-lg transition"
              >
                Contact Us
              </a>
            </div>
          );
        })()}
      </div>

      {/* History */}
      <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Subscription History</h3>
      {history.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-gray-500">No past subscriptions yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Plan</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Amount</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Status</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Period</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{PLAN_LABELS[h.plan] || h.plan || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{h.amount ? `₦${h.amount.toLocaleString()}` : '—'}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-gray-300 capitalize">{h.status}</td>
                  <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">
                    {new Date(h.currentPeriodStart).toLocaleDateString()} – {new Date(h.currentPeriodEnd).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MySubscription;
