# Super Admin Dashboard - Complete Guide 🎯

**Created:** August 19, 2026  
**Git Commit:** 7ab19c1

## Overview

The Super Admin Dashboard provides a centralized platform for managing all schools/tenants, subscriptions, users, and analytics across your entire SaaS platform.

## 🔐 Super Admin Access

### Creating a Super Admin User

Run the creation script:
```bash
node server/scripts/createSuperAdmin.js
```

**Default Credentials:**
- **Email:** admin@platform.com
- **Password:** Admin@123
- **Role:** super_admin

⚠️ **IMPORTANT:** Change the password immediately after first login!

### Super Admin Tenant

Super admins belong to a special tenant:
- **Tenant ID:** `tenant_super_admin_platform`
- **Name:** Platform Administration
- **Subdomain:** admin
- **Subscription:** Enterprise (100 years)

## 📊 Dashboard Endpoints

All super admin endpoints require:
1. Authentication (JWT token)
2. `super_admin` role

Base URL: `/superadmin`

### 1. Platform Overview Dashboard

**GET `/superadmin/dashboard`**

Get comprehensive platform statistics and overview.

**Response:**
```json
{
  "overview": {
    "totalTenants": 25,
    "activeTenants": 20,
    "trialTenants": 3,
    "suspendedTenants": 1,
    "cancelledTenants": 1,
    "totalUsers": 150,
    "totalStudents": 3500,
    "activeSubscriptions": 23,
    "expiredSubscriptions": 2
  },
  "subscriptionsByPlan": [
    { "_id": "trial", "count": 3 },
    { "_id": "basic", "count": 8 },
    { "_id": "professional", "count": 10 },
    { "_id": "enterprise", "count": 2 }
  ],
  "recentTenants": [
    {
      "_id": "...",
      "tenantId": "tenant_123",
      "name": "ABC School",
      "subdomain": "abc-school",
      "status": "active",
      "ownerId": {
        "name": "John Doe",
        "email": "john@abc.com"
      },
      "createdAt": "2026-08-15T10:00:00.000Z"
    }
  ],
  "monthlyRevenue": [...]
}
```

**Use Cases:**
- Platform health monitoring
- Quick overview of all tenants
- Revenue tracking
- Growth metrics

---

### 2. Tenant Management

#### List All Tenants

**GET `/superadmin/tenants`**

Get paginated list of all tenants with filters.

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20) - Items per page
- `status` - Filter by status (active, trial, suspended, cancelled)
- `search` - Search by name, subdomain, or tenantId

**Example:**
```bash
GET /superadmin/tenants?page=1&limit=20&status=active&search=school
```

**Response:**
```json
{
  "tenants": [...],
  "totalPages": 5,
  "currentPage": 1,
  "total": 100
}
```

#### Get Tenant Details

**GET `/superadmin/tenants/:tenantId`**

Get detailed information about a specific tenant.

**Response:**
```json
{
  "tenant": {
    "tenantId": "tenant_123",
    "name": "ABC School",
    "subdomain": "abc-school",
    "status": "active",
    "ownerId": {
      "name": "John Doe",
      "email": "john@abc.com",
      "phone": "+234..."
    },
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  "statistics": {
    "userCount": 15,
    "studentCount": 350,
    "totalRevenue": 1500000
  },
  "subscription": {
    "plan": "professional",
    "status": "active",
    "startDate": "2026-08-01T00:00:00.000Z",
    "endDate": "2027-08-01T00:00:00.000Z"
  }
}
```

#### Update Tenant Status

**PATCH `/superadmin/tenants/:tenantId/status`**

Change a tenant's status.

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Statuses:**
- `active` - Tenant is active
- `suspended` - Tenant is suspended (no access)
- `trial` - Tenant is on trial
- `cancelled` - Tenant is cancelled

**Use Cases:**
- Suspend tenants for non-payment
- Reactivate suspended tenants
- Cancel problematic tenants

#### Delete Tenant (Soft Delete)

**DELETE `/superadmin/tenants/:tenantId`**

Soft delete a tenant (sets status to cancelled).

**Response:**
```json
{
  "message": "Tenant cancelled successfully",
  "tenant": {...}
}
```

---

### 3. Subscription Management

#### List All Subscriptions

**GET `/superadmin/subscriptions`**

Get paginated list of all subscriptions.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` - Filter by status
- `plan` - Filter by plan

**Example:**
```bash
GET /superadmin/subscriptions?status=active&plan=professional
```

**Response:**
```json
{
  "subscriptions": [
    {
      "_id": "...",
      "tenantId": "tenant_123",
      "plan": "professional",
      "billingCycle": "yearly",
      "status": "active",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2027-08-01T00:00:00.000Z",
      "tenant": {
        "name": "ABC School",
        "subdomain": "abc-school"
      }
    }
  ],
  "totalPages": 3,
  "currentPage": 1,
  "total": 50
}
```

#### Update Subscription Status

**PATCH `/superadmin/subscriptions/:id/status`**

Update subscription status.

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Statuses:**
- `active`
- `cancelled`
- `expired`
- `suspended`

---

### 4. User Management

#### List All Users

**GET `/superadmin/users`**

Get all users across all tenants.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `role` - Filter by role
- `tenantId` - Filter by tenant
- `search` - Search by name or email

**Example:**
```bash
GET /superadmin/users?role=proprietor&search=john
```

**Response:**
```json
{
  "users": [
    {
      "_id": "...",
      "tenantId": "tenant_123",
      "name": "John Doe",
      "email": "john@abc.com",
      "role": "proprietor",
      "createdAt": "2026-08-01T00:00:00.000Z"
    }
  ],
  "totalPages": 8,
  "currentPage": 1,
  "total": 150
}
```

---

### 5. Analytics & Reports

#### Get Platform Analytics

**GET `/superadmin/analytics`**

Get platform-wide analytics and trends.

**Query Parameters:**
- `period` (default: 30) - Number of days to analyze

**Example:**
```bash
GET /superadmin/analytics?period=90
```

**Response:**
```json
{
  "newTenants": [
    { "_id": "2026-08-01", "count": 3 },
    { "_id": "2026-08-02", "count": 5 }
  ],
  "subscriptionTrends": [
    {
      "_id": {
        "date": "2026-08-01",
        "plan": "professional"
      },
      "count": 2
    }
  ],
  "tenantStatusDistribution": [
    { "_id": "active", "count": 20 },
    { "_id": "trial", "count": 3 },
    { "_id": "suspended", "count": 1 }
  ]
}
```

#### Export Platform Data

**GET `/superadmin/export`**

Export data for reporting.

**Query Parameters:**
- `type` - Data type to export (tenants, subscriptions, users)

**Example:**
```bash
GET /superadmin/export?type=tenants
```

**Response:**
```json
{
  "data": [...],
  "exportedAt": "2026-08-19T15:00:00.000Z"
}
```

---

## 🎯 Common Use Cases

### 1. Monitor Platform Health

```bash
# Get dashboard overview
GET /superadmin/dashboard

# Check recent tenant registrations
GET /superadmin/tenants?page=1&limit=10

# View subscription status
GET /superadmin/subscriptions?status=active
```

### 2. Manage Problematic Tenant

```bash
# Get tenant details
GET /superadmin/tenants/tenant_123

# Suspend tenant
PATCH /superadmin/tenants/tenant_123/status
Body: { "status": "suspended" }

# Suspend their subscription
PATCH /superadmin/subscriptions/sub_id/status
Body: { "status": "suspended" }
```

### 3. Track Growth Metrics

```bash
# Get 90-day analytics
GET /superadmin/analytics?period=90

# Export tenant data
GET /superadmin/export?type=tenants

# Get subscription trends
GET /superadmin/subscriptions?page=1&limit=100
```

### 4. Search and Filter

```bash
# Find specific school
GET /superadmin/tenants?search=ABC+School

# Find all trial tenants
GET /superadmin/tenants?status=trial

# Find all proprietors
GET /superadmin/users?role=proprietor
```

---

## 🔒 Security Features

### Access Control
- ✅ Only users with `super_admin` role can access
- ✅ All endpoints require authentication
- ✅ JWT token validation on every request
- ✅ Role-based middleware protection

### Data Protection
- ✅ Passwords excluded from user listings
- ✅ Soft delete for tenants (no data loss)
- ✅ Audit trail for all actions
- ✅ Rate limiting on all endpoints

### Best Practices
1. **Change default password immediately**
2. **Use strong passwords** (min 8 chars, mixed case, numbers, symbols)
3. **Limit super admin accounts** (only create when necessary)
4. **Monitor super admin activity** (check audit logs)
5. **Use 2FA** (implement in future)

---

## 📱 Integration Examples

### JavaScript/Node.js

```javascript
// Login as super admin
const loginResponse = await fetch('http://localhost:5000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@platform.com',
    password: 'Admin@123'
  })
});

const { token } = await loginResponse.json();

// Get dashboard data
const dashboardResponse = await fetch('http://localhost:5000/superadmin/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const dashboard = await dashboardResponse.json();
console.log('Total Tenants:', dashboard.overview.totalTenants);
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.com","password":"Admin@123"}' \
  | jq -r '.token')

# Get dashboard
curl -X GET http://localhost:5000/superadmin/dashboard \
  -H "Authorization: Bearer $TOKEN"

# List tenants
curl -X GET "http://localhost:5000/superadmin/tenants?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Suspend tenant
curl -X PATCH http://localhost:5000/superadmin/tenants/tenant_123/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"suspended"}'
```

---

## 🎨 Frontend Integration

### Dashboard Components Needed

1. **Overview Dashboard**
   - Total tenants card
   - Active/Trial/Suspended counts
   - Revenue metrics
   - Recent registrations list
   - Charts (tenant growth, subscription distribution)

2. **Tenant Management**
   - Tenant list table with pagination
   - Search and filter controls
   - Tenant detail modal
   - Status update buttons
   - Delete confirmation dialog

3. **Subscription Management**
   - Subscription list table
   - Filter by plan/status
   - Status update controls
   - Expiry date warnings

4. **User Management**
   - User list across all tenants
   - Role filters
   - Tenant association display
   - Search functionality

5. **Analytics Dashboard**
   - Growth charts (line/bar)
   - Status distribution (pie chart)
   - Subscription trends
   - Export buttons

---

## 📊 Metrics to Track

### Key Performance Indicators (KPIs)

1. **Growth Metrics**
   - New tenant registrations per day/week/month
   - Trial to paid conversion rate
   - Churn rate (cancelled tenants)
   - User growth rate

2. **Revenue Metrics**
   - Monthly Recurring Revenue (MRR)
   - Annual Recurring Revenue (ARR)
   - Average Revenue Per User (ARPU)
   - Lifetime Value (LTV)

3. **Health Metrics**
   - Active tenant percentage
   - Subscription renewal rate
   - Support ticket volume
   - System uptime

4. **Engagement Metrics**
   - Daily Active Users (DAU)
   - Monthly Active Users (MAU)
   - Feature adoption rates
   - Average session duration

---

## 🚀 Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Custom date range selection
   - Cohort analysis
   - Retention metrics
   - Revenue forecasting

2. **Automated Actions**
   - Auto-suspend on payment failure
   - Trial expiry notifications
   - Subscription renewal reminders
   - Usage limit enforcement

3. **Communication Tools**
   - Broadcast announcements
   - Email campaigns
   - In-app notifications
   - Support ticket system

4. **Billing Integration**
   - Paystack integration
   - Invoice generation
   - Payment tracking
   - Refund management

5. **Advanced Security**
   - Two-Factor Authentication (2FA)
   - IP whitelisting
   - Activity logs
   - Suspicious activity alerts

---

## 📝 Notes

- Super admin has read/write access to ALL tenant data
- Use super admin access responsibly
- Regular backups recommended before bulk operations
- Monitor super admin activity logs
- Consider implementing approval workflows for critical actions

---

## 🆘 Troubleshooting

### Can't Access Dashboard

**Problem:** 403 Forbidden error

**Solutions:**
1. Verify you're logged in as super_admin role
2. Check JWT token is valid and not expired
3. Ensure super admin user was created correctly
4. Verify Authorization header format: `Bearer <token>`

### No Data Showing

**Problem:** Empty arrays in responses

**Solutions:**
1. Run data migration script first
2. Create some test tenants
3. Check MongoDB connection
4. Verify database has data

### Script Errors

**Problem:** createSuperAdmin.js fails

**Solutions:**
1. Check MongoDB connection string in .env
2. Ensure MongoDB is running
3. Verify no existing super_admin user
4. Check for network/firewall issues

---

**Status:** ✅ COMPLETE  
**Version:** 1.0  
**Last Updated:** August 19, 2026
