import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getQuestionBankStats } from '../services/superAdminApi';
import './SuperAdminDashboard.css';

// Where Lemida Content Studio (the separate question bank admin app) lives; set per environment.
const CONTENT_STUDIO_URL = import.meta.env.VITE_CONTENT_STUDIO_URL;

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [bank, setBank] = useState(null); // { stats } | { error: true } | null while loading
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Loaded on its own so the dashboard still opens if the question bank can't be reached
  useEffect(() => {
    getQuestionBankStats()
      .then((stats) => setBank({ stats }))
      .catch(() => setBank({ error: true }));
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await getDashboard();
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="super-admin-dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="super-admin-dashboard">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchDashboard}>Retry</button>
        </div>
      </div>
    );
  }

  const { overview, subscriptionsByPlan, recentTenants } = dashboard || {};

  return (
    <div className="super-admin-dashboard">
      <div className="dashboard-header">
        <h1>🎯 Super Admin Dashboard</h1>
        <p>Platform Overview & Management</p>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div
          className="stat-card primary clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants')}
          title="View all schools"
        >
          <div className="stat-icon">🏫</div>
          <div className="stat-content">
            <h3>{overview?.totalTenants || 0}</h3>
            <p>Total Schools</p>
          </div>
        </div>

        <div
          className="stat-card success clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants?status=active')}
          title="View active schools"
        >
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{overview?.activeTenants || 0}</h3>
            <p>Active Schools</p>
          </div>
        </div>

        <div
          className="stat-card warning clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants?status=trial')}
          title="View trial schools"
        >
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <h3>{overview?.trialTenants || 0}</h3>
            <p>Trial Schools</p>
          </div>
        </div>

        <div
          className="stat-card danger clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants?status=suspended')}
          title="View suspended schools"
        >
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <h3>{overview?.suspendedTenants || 0}</h3>
            <p>Suspended</p>
          </div>
        </div>

        <div
          className="stat-card info clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants')}
          title="View all users"
        >
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{overview?.totalUsers || 0}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div
          className="stat-card info clickable"
          onClick={() => navigate('/dashboard/superadmin/tenants')}
          title="View all students"
        >
          <div className="stat-icon">🎓</div>
          <div className="stat-content">
            <h3>{overview?.totalStudents || 0}</h3>
            <p>Total Students</p>
          </div>
        </div>

        <div
          className="stat-card success clickable"
          onClick={() => navigate('/dashboard/superadmin/subscriptions')}
          title="View active subscriptions"
        >
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <h3>{overview?.activeSubscriptions || 0}</h3>
            <p>Active Subscriptions</p>
          </div>
        </div>

        <div
          className="stat-card secondary clickable"
          onClick={() => navigate('/dashboard/superadmin/subscriptions')}
          title="View expired subscriptions"
        >
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{overview?.expiredSubscriptions || 0}</h3>
            <p>Expired</p>
          </div>
        </div>
      </div>

      {/* Subscriptions by Plan */}
      <div className="dashboard-section">
        <h2>📈 Subscriptions by Plan</h2>
        <div className="plan-stats">
          {subscriptionsByPlan?.map((plan) => (
            <div key={plan._id} className="plan-card">
              <div className="plan-name">{plan._id}</div>
              <div className="plan-count">{plan.count}</div>
            </div>
          ))}
          {(!subscriptionsByPlan || subscriptionsByPlan.length === 0) && (
            <p className="no-data">No subscription data available</p>
          )}
        </div>
      </div>

      {/* Question Bank */}
      <div className="dashboard-section">
        <h2>📚 Question Bank</h2>
        {!bank ? (
          <p className="no-data">Loading question bank...</p>
        ) : bank.error ? (
          <p className="no-data">Question bank counts are unavailable right now.</p>
        ) : (
          <>
            <div className="plan-stats">
              {bank.stats.subjects.map((s) => (
                <div key={s.subject} className="plan-card">
                  <div className="plan-name">{s.subject}</div>
                  <div className="plan-count">{s.approved}</div>
                  <small>approved · {s.draft} draft</small>
                </div>
              ))}
              {bank.stats.subjects.length === 0 && <p className="no-data">No questions imported yet</p>}
            </div>
            <p className="no-data">
              {bank.stats.totals.approved} approved, {bank.stats.totals.draft} draft, {bank.stats.totals.rejected} rejected
            </p>
          </>
        )}
        <div className="quick-actions">
          <button
            className="action-btn primary"
            onClick={() => window.open(CONTENT_STUDIO_URL, '_blank', 'noopener,noreferrer')}
            disabled={!CONTENT_STUDIO_URL}
            title={CONTENT_STUDIO_URL ? 'Import, review and approve questions' : 'Set VITE_CONTENT_STUDIO_URL to enable this link'}
          >
            📝 Open Content Studio
          </button>
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="dashboard-section">
        <h2>🆕 Recent Schools</h2>
        <div className="recent-tenants">
          {recentTenants?.map((tenant) => (
            <div key={tenant._id} className="tenant-card">
              <div className="tenant-header">
                <h3>{tenant.schoolName}</h3>
                <span className={`status-badge ${tenant.status}`}>
                  {tenant.status}
                </span>
              </div>
              <div className="tenant-details">
                <p><strong>Subdomain:</strong> {tenant.subdomain}</p>
                <p><strong>Owner:</strong> {tenant.ownerId?.name || 'N/A'}</p>
                <p><strong>Email:</strong> {tenant.ownerId?.email || 'N/A'}</p>
                <p><strong>Created:</strong> {new Date(tenant.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {(!recentTenants || recentTenants.length === 0) && (
            <p className="no-data">No recent schools</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2>⚡ Quick Actions</h2>
        <div className="quick-actions">
          <button
            className="action-btn primary"
            onClick={() => navigate('/dashboard/superadmin/tenants')}
          >
            📋 Manage Schools
          </button>
          <button
            className="action-btn success"
            onClick={() => navigate('/dashboard/superadmin/tenants')}
          >
            ➕ Create New School
          </button>
          <button
            className="action-btn info"
            onClick={() => navigate('/dashboard/superadmin/subscriptions')}
          >
            💳 Manage Subscriptions
          </button>
          <button
            className="action-btn secondary"
            onClick={() => navigate('/dashboard/superadmin/tenants')}
          >
            👥 View All Users
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
