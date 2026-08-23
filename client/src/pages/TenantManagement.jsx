import { useState, useEffect } from 'react';
import { getTenants, updateTenantStatus, deleteTenant, permanentDeleteTenant, createTenant } from '../services/superAdminApi';
import './TenantManagement.css';

const TenantManagement = ({ initialStatusFilter = '' }) => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  useEffect(() => {
    fetchTenants();
  }, [currentPage, statusFilter, searchTerm]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 20,
        ...(statusFilter && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      };
      const data = await getTenants(params);
      setTenants(data.tenants);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tenantId, newStatus) => {
    if (!confirm(`Change tenant status to "${newStatus}"?`)) return;
    
    try {
      await updateTenantStatus(tenantId, newStatus);
      alert('Status updated successfully!');
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleSoftDelete = async (tenantId) => {
    if (!confirm('Cancel this school? (Can be reactivated later)')) return;
    
    try {
      await deleteTenant(tenantId);
      alert('School cancelled successfully!');
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel school');
    }
  };

  const handlePermanentDelete = async (tenantId) => {
    setShowDeleteModal(tenantId);
  };

  const confirmPermanentDelete = async () => {
    try {
      await permanentDeleteTenant(showDeleteModal);
      alert('School permanently deleted!');
      setShowDeleteModal(null);
      fetchTenants();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete school');
    }
  };

  return (
    <div className="tenant-management">
      <div className="page-header">
        <div>
          <h1>🏫 School Management</h1>
          <p>Manage all schools on the platform</p>
        </div>
        <button 
          className="btn-create"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create New School
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by name, subdomain, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Tenants Table */}
      {loading ? (
        <div className="loading">Loading schools...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="tenants-table">
            <table>
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Subdomain</th>
                  <th>Owner</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant._id}>
                    <td>
                      <strong>{tenant.schoolName}</strong>
                      <br />
                      <small>{tenant.tenantId}</small>
                    </td>
                    <td>{tenant.subdomain}</td>
                    <td>
                      {tenant.ownerId?.name || 'N/A'}
                      <br />
                      <small>{tenant.ownerId?.email || ''}</small>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                        {tenant.studentCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${tenant.status}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <select
                          onChange={(e) => handleStatusChange(tenant.tenantId, e.target.value)}
                          value=""
                          className="action-select"
                        >
                          <option value="">Change Status</option>
                          <option value="active">Active</option>
                          <option value="trial">Trial</option>
                          <option value="suspended">Suspend</option>
                          <option value="cancelled">Cancel</option>
                        </select>
                        <button
                          onClick={() => handleSoftDelete(tenant.tenantId)}
                          className="btn-delete"
                          title="Cancel School"
                        >
                          🗑️
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(tenant.tenantId)}
                          className="btn-danger"
                          title="Permanent Delete"
                        >
                          ⚠️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTenants();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Permanent Delete</h2>
            <p>This will <strong>PERMANENTLY DELETE</strong> this school and ALL associated data:</p>
            <ul>
              <li>All users</li>
              <li>All students</li>
              <li>All classes, subjects, scores</li>
              <li>All fees and payments</li>
              <li>Everything!</li>
            </ul>
            <p><strong>This action CANNOT be undone!</strong></p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(null)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={confirmPermanentDelete} className="btn-danger">
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Tenant Modal Component
const CreateTenantModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    schoolName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    subdomain: '',
    plan: 'trial'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createTenant(formData);
      alert('School created successfully!');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <h2>➕ Create New School</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>School Name *</label>
            <input
              type="text"
              required
              value={formData.schoolName}
              onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
              placeholder="e.g., Bright Future Academy"
            />
          </div>

          <div className="form-group">
            <label>Subdomain *</label>
            <input
              type="text"
              required
              value={formData.subdomain}
              onChange={(e) => setFormData({...formData, subdomain: e.target.value})}
              placeholder="e.g., brightfuture"
            />
            <small>Used for school identification</small>
          </div>

          <div className="form-group">
            <label>Owner Name *</label>
            <input
              type="text"
              required
              value={formData.ownerName}
              onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
              placeholder="e.g., John Smith"
            />
          </div>

          <div className="form-group">
            <label>Owner Email *</label>
            <input
              type="email"
              required
              value={formData.ownerEmail}
              onChange={(e) => setFormData({...formData, ownerEmail: e.target.value})}
              placeholder="e.g., john@brightfuture.com"
            />
          </div>

          <div className="form-group">
            <label>Owner Password *</label>
            <input
              type="password"
              required
              value={formData.ownerPassword}
              onChange={(e) => setFormData({...formData, ownerPassword: e.target.value})}
              placeholder="Secure password"
            />
          </div>

          <div className="form-group">
            <label>Subscription Plan *</label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData({...formData, plan: e.target.value})}
            >
              <option value="trial">Trial (14 days)</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-create">
              {loading ? 'Creating...' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantManagement;
