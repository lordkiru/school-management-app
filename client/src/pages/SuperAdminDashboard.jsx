import { useState, useEffect } from 'react';
import { getDashboard } from '../services/superAdminApi';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
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
        <div className="stat-card primary">
          <div className="stat-icon">🏫</div>
          <div className="stat-content">
            <h3>{overview?.totalTenants || 0}</h3>
            <p>Total Schools</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{overview?.activeTenants || 0}</h3>
            <p>Active Schools</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <h3>{overview?.trialTenants || 0}</h3>
            <p>Trial Schools</p>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <h3>{overview?.suspendedTenants || 0}</h3>
            <p>Suspended</p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{overview?.totalUsers || 0}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">🎓</div>
          <div className="stat-content">
            <h3>{overview?.totalStudents || 0}</h3>
            <p>Total Students</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <h3>{overview?.activeSubscriptions || 0}</h3>
            <p>Active Subscriptions</p>
          </div>
        </div>

        <div className="stat-card secondary">
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

      {/* Recent Tenants */}
      <div className="dashboard-section">
        <h2>🆕 Recent Schools</h2>
        <div className="recent-tenants">
          {recentTenants?.map((tenant) => (
            <div key={tenant._id} className="tenant-card">
              <div className="tenant-header">
                <h3>{tenant.name}</h3>
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
            onClick={() => window.location.href = '/superadmin/tenants'}
          >
            📋 Manage Schools
          </button>
          <button 
            className="action-btn success"
            onClick={() => window.location.href = '/superadmin/tenants/create'}
          >
            ➕ Create New School
          </button>
          <button 
            className="action-btn info"
            onClick={() => window.location.href = '/superadmin/subscriptions'}
          >
            💳 Manage Subscriptions
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => window.location.href = '/superadmin/users'}
          >
            👥 View All Users
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
