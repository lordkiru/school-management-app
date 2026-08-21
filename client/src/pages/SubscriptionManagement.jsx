import { useState, useEffect } from 'react';
import { getSubscriptions, updateSubscriptionStatus } from '../services/superAdminApi';
import './TenantManagement.css';

const PLAN_LABELS = {
  trial: 'Trial',
  basic: 'Basic',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const SubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchSubscriptions();
  }, [currentPage, statusFilter, planFilter]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 20,
        ...(statusFilter && { status: statusFilter }),
        ...(planFilter && { plan: planFilter }),
      };
      const data = await getSubscriptions(params);
      setSubscriptions(data.subscriptions || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!confirm(`Change subscription status to "${newStatus}"?`)) return;

    try {
      await updateSubscriptionStatus(id, newStatus);
      fetchSubscriptions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update subscription status');
    }
  };

  return (
    <div className="tenant-management">
      <div className="page-header">
        <div>
          <h1>💳 Subscription Management</h1>
          <p>{total} subscription{total === 1 ? '' : 's'} across all schools</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="status-filter"
        >
          <option value="">All Status</option>
          <option value="trialing">Trialing</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="incomplete">Incomplete</option>
          <option value="canceled">Canceled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}
          className="status-filter"
        >
          <option value="">All Plans</option>
          <option value="trial">Trial</option>
          <option value="basic">Basic</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading subscriptions...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="tenants-table">
            <table>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Interval</th>
                  <th>Current Period Ends</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub._id}>
                    <td>
                      <strong>{sub.tenant?.name || sub.tenantId}</strong>
                      <br />
                      <small>{sub.tenantId}</small>
                    </td>
                    <td>{PLAN_LABELS[sub.plan] || sub.plan}</td>
                    <td>
                      <span className={`status-badge ${sub.status}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td>{sub.interval}</td>
                    <td>{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div className="action-buttons">
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleStatusChange(sub._id, e.target.value);
                            e.target.value = '';
                          }}
                          value=""
                          className="action-select"
                        >
                          <option value="">Change Status</option>
                          <option value="active">Active</option>
                          <option value="trialing">Trialing</option>
                          <option value="past_due">Past Due</option>
                          <option value="incomplete">Incomplete</option>
                          <option value="canceled">Cancel</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                      No subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SubscriptionManagement;
