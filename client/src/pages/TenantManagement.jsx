import { useState, useEffect } from 'react';
import { getTenants, updateTenantStatus, deleteTenant, permanentDeleteTenant, createTenant, getBanks, resolveAccountNumber, setupTenantSubaccount } from '../services/superAdminApi';
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
  const [showBankModal, setShowBankModal] = useState(null); // holds the tenant being edited, or null

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
                          onClick={() => setShowBankModal(tenant)}
                          className="btn-cancel"
                          title={tenant.paystackSubaccountCode ? 'Edit Payment Setup' : 'Set Up Payment Setup'}
                        >
                          {tenant.paystackSubaccountCode ? '💳' : '⚠️💳'}
                        </button>
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

      {/* Bank / Payment Setup Modal */}
      {showBankModal && (
        <BankSetupModal
          tenant={showBankModal}
          onClose={() => setShowBankModal(null)}
          onSuccess={() => {
            setShowBankModal(null);
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

  // Bank details for the Paystack subaccount (optional — can be set up later if skipped here)
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedAccountName, setResolvedAccountName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    getBanks().then(setBanks).catch(() => setBanks([]));
  }, []);

  // Any change to bank/account number invalidates a prior verification
  const handleBankCodeChange = (value) => {
    setBankCode(value);
    setResolvedAccountName('');
    setVerifyError(null);
  };
  const handleAccountNumberChange = (value) => {
    setAccountNumber(value);
    setResolvedAccountName('');
    setVerifyError(null);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const { accountName } = await resolveAccountNumber(accountNumber, bankCode);
      setResolvedAccountName(accountName);
    } catch (err) {
      setResolvedAccountName('');
      setVerifyError(err.response?.data?.error || 'Could not verify this account number');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Bank details are optional at creation time, but if either field was
    // touched, require a successful verification before proceeding — better
    // to block than silently create a subaccount against an unverified number.
    const settingUpBank = bankCode || accountNumber;
    if (settingUpBank && !resolvedAccountName) {
      setError('Verify the account number before creating the school, or clear the bank fields to set this up later.');
      return;
    }

    setLoading(true);
    try {
      const { tenant } = await createTenant(formData);

      if (settingUpBank) {
        try {
          await setupTenantSubaccount(tenant.tenantId, { bankCode, accountNumber });
        } catch (subaccountErr) {
          // The school account was already created — don't lose that. Let the admin
          // know payments aren't wired up yet so they can retry from the school's record.
          alert(
            `School created, but the Paystack subaccount could not be set up: ${
              subaccountErr.response?.data?.error || 'Unknown error'
            }. You can complete this later from the school's settings.`
          );
          onSuccess();
          return;
        }
      }

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

          <div className="form-group">
            <label>Settlement Bank (optional)</label>
            <select
              value={bankCode}
              onChange={(e) => handleBankCodeChange(e.target.value)}
            >
              <option value="">Set up later</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
            <small>Fee payments will settle directly into this account — the school keeps 100% (Paystack's own processing fee still applies).</small>
          </div>

          {bankCode && (
            <div className="form-group">
              <label>Account Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  placeholder="10-digit account number"
                />
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!accountNumber || verifying}
                  className="btn-cancel"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {resolvedAccountName && (
                <small style={{ color: 'green' }}>✓ Verified: {resolvedAccountName}</small>
              )}
              {verifyError && (
                <small style={{ color: 'red' }}>{verifyError}</small>
              )}
            </div>
          )}

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

// Bank / Payment Setup Modal — set up a school's Paystack subaccount after
// creation, or edit an existing one (e.g. the school changed bank accounts)
const BankSetupModal = ({ tenant, onClose, onSuccess }) => {
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState(tenant.settlementBank || '');
  const [accountNumber, setAccountNumber] = useState(tenant.accountNumber || '');
  const [resolvedAccountName, setResolvedAccountName] = useState(tenant.resolvedAccountName || '');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBanks().then(setBanks).catch(() => setBanks([]));
  }, []);

  // Changing either field invalidates whatever verification (existing or new) was in place
  const handleBankCodeChange = (value) => {
    setBankCode(value);
    setResolvedAccountName('');
    setVerifyError(null);
  };
  const handleAccountNumberChange = (value) => {
    setAccountNumber(value);
    setResolvedAccountName('');
    setVerifyError(null);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const { accountName } = await resolveAccountNumber(accountNumber, bankCode);
      setResolvedAccountName(accountName);
    } catch (err) {
      setResolvedAccountName('');
      setVerifyError(err.response?.data?.error || 'Could not verify this account number');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!bankCode || !accountNumber) {
      setError('Select a bank and enter an account number.');
      return;
    }
    if (!resolvedAccountName) {
      setError('Verify the account number before saving.');
      return;
    }

    setSaving(true);
    try {
      await setupTenantSubaccount(tenant.tenantId, { bankCode, accountNumber });
      alert('Bank details saved — fee payments will now settle directly to this account.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>💳 Payment Setup — {tenant.schoolName}</h2>
        {tenant.paystackSubaccountCode ? (
          <p style={{ color: 'green' }}>✓ Subaccount active ({tenant.paystackSubaccountCode})</p>
        ) : (
          <p style={{ color: '#b45309' }}>⚠️ No subaccount yet — online fee payments are blocked until this is saved.</p>
        )}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Settlement Bank</label>
            <select value={bankCode} onChange={(e) => handleBankCodeChange(e.target.value)}>
              <option value="">Select a bank</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Account Number</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => handleAccountNumberChange(e.target.value)}
                placeholder="10-digit account number"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={!accountNumber || !bankCode || verifying}
                className="btn-cancel"
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {resolvedAccountName && (
              <small style={{ color: 'green' }}>✓ Verified: {resolvedAccountName}</small>
            )}
            {verifyError && (
              <small style={{ color: 'red' }}>{verifyError}</small>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-create">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TenantManagement;
