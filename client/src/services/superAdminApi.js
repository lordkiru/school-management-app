import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance with auth token
const createAuthAxios = () => {
  const token = localStorage.getItem('token');
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

// Dashboard
export const getDashboard = async () => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/dashboard');
  return response.data;
};

// Tenants
export const getTenants = async (params = {}) => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/tenants', { params });
  return response.data;
};

export const getTenantDetails = async (tenantId) => {
  const api = createAuthAxios();
  const response = await api.get(`/superadmin/tenants/${tenantId}`);
  return response.data;
};

export const createTenant = async (data) => {
  const api = createAuthAxios();
  const response = await api.post('/superadmin/tenants/create', data);
  return response.data;
};

export const getBanks = async () => {
  const api = createAuthAxios();
  const response = await api.get('/tenants/banks');
  return response.data;
};

export const resolveAccountNumber = async (accountNumber, bankCode) => {
  const api = createAuthAxios();
  const response = await api.get('/tenants/resolve-account', { params: { accountNumber, bankCode } });
  return response.data;
};

export const setupTenantSubaccount = async (tenantId, data) => {
  const api = createAuthAxios();
  const response = await api.post(`/tenants/${tenantId}/setup-subaccount`, data);
  return response.data;
};

export const updateTenantStatus = async (tenantId, status) => {
  const api = createAuthAxios();
  const response = await api.patch(`/superadmin/tenants/${tenantId}/status`, { status });
  return response.data;
};

export const deleteTenant = async (tenantId) => {
  const api = createAuthAxios();
  const response = await api.delete(`/superadmin/tenants/${tenantId}`);
  return response.data;
};

export const permanentDeleteTenant = async (tenantId) => {
  const api = createAuthAxios();
  const response = await api.delete(`/superadmin/tenants/${tenantId}/permanent`, {
    data: { confirm: 'DELETE_PERMANENTLY' }
  });
  return response.data;
};

// Subscriptions
export const getSubscriptions = async (params = {}) => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/subscriptions', { params });
  return response.data;
};

export const updateSubscriptionStatus = async (id, status) => {
  const api = createAuthAxios();
  const response = await api.patch(`/superadmin/subscriptions/${id}/status`, { status });
  return response.data;
};

// Users
export const getUsers = async (params = {}) => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/users', { params });
  return response.data;
};

// Analytics
export const getAnalytics = async (period = 30) => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/analytics', { params: { period } });
  return response.data;
};

// Export
export const exportData = async (type = 'tenants') => {
  const api = createAuthAxios();
  const response = await api.get('/superadmin/export', { params: { type } });
  return response.data;
};
