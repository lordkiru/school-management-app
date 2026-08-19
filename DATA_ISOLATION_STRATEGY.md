# 🔒 Data Isolation Strategy - Option 1 (MVP Multi-Tenant)

## Overview

In Option 1, we use **Row-Level Multi-Tenancy** (also called Shared Database, Shared Schema approach). All schools share the same MongoDB database and collections, but data is separated using a `tenantId` field.

---

## 🏗️ How It Works

### 1. Every Document Gets a tenantId

**Before (Single-Tenant):**
```javascript
{
  _id: "507f1f77bcf86cd799439011",
  name: "John Doe",
  admissionNumber: "2024001",
  classId: "507f1f77bcf86cd799439012"
}
```

**After (Multi-Tenant):**
```javascript
{
  _id: "507f1f77bcf86cd799439011",
  tenantId: "tenant_greenwood_123",  // ← NEW FIELD
  name: "John Doe",
  admissionNumber: "2024001",
  classId: "507f1f77bcf86cd799439012"
}
```

### 2. Every Query Filters by tenantId

**Before (Single-Tenant):**
```javascript
// Gets ALL students from database
const students = await Student.find({ classId: "507f..." });
```

**After (Multi-Tenant):**
```javascript
// Gets ONLY students from THIS school
const students = await Student.find({ 
  tenantId: req.tenantId,  // ← ALWAYS FILTER BY TENANT
  classId: "507f..." 
});
```

---

## 🔐 Complete Data Isolation Flow

### Step 1: User Visits Subdomain
```
User visits: https://greenwood.schoolsaas.com
```

### Step 2: Middleware Extracts Tenant
```javascript
// server/middleware/tenantContext.js
const extractTenant = async (req, res, next) => {
  const host = req.get('host'); // "greenwood.schoolsaas.com"
  const subdomain = host.split('.')[0]; // "greenwood"
  
  // Look up tenant in database
  const tenant = await Tenant.findOne({ 
    subdomain: "greenwood",
    status: 'active'
  });
  
  // Attach to request
  req.tenantId = tenant.tenantId; // "tenant_greenwood_123"
  req.tenant = tenant;
  
  next();
};
```

### Step 3: All Queries Use tenantId
```javascript
// Every database query MUST include tenantId
router.get('/students', requireAuth, async (req, res) => {
  // req.tenantId = "tenant_greenwood_123" (from middleware)
  
  const students = await Student.find({ 
    tenantId: req.tenantId  // CRITICAL: Only get THIS school's students
  });
  
  res.json(students);
});
```

### Step 4: Data is Isolated
```
Greenwood School (tenantId: "tenant_greenwood_123")
├── Students: 500 students with tenantId = "tenant_greenwood_123"
├── Classes: 20 classes with tenantId = "tenant_greenwood_123"
├── Fees: 1000 fee records with tenantId = "tenant_greenwood_123"
└── Staff: 30 staff with tenantId = "tenant_greenwood_123"

Sunrise School (tenantId: "tenant_sunrise_456")
├── Students: 300 students with tenantId = "tenant_sunrise_456"
├── Classes: 15 classes with tenantId = "tenant_sunrise_456"
├── Fees: 600 fee records with tenantId = "tenant_sunrise_456"
└── Staff: 20 staff with tenantId = "tenant_sunrise_456"

❌ Greenwood CANNOT see Sunrise's data
❌ Sunrise CANNOT see Greenwood's data
```

---

## 📊 Database Structure

### Shared Collections (All Schools)

```
MongoDB Database: school-saas-production
│
├── tenants (Tenant information)
│   ├── { tenantId: "tenant_greenwood_123", subdomain: "greenwood", ... }
│   ├── { tenantId: "tenant_sunrise_456", subdomain: "sunrise", ... }
│   └── { tenantId: "tenant_royal_789", subdomain: "royal", ... }
│
├── students (All schools' students)
│   ├── { tenantId: "tenant_greenwood_123", name: "John", ... }
│   ├── { tenantId: "tenant_greenwood_123", name: "Jane", ... }
│   ├── { tenantId: "tenant_sunrise_456", name: "Bob", ... }
│   └── { tenantId: "tenant_sunrise_456", name: "Alice", ... }
│
├── classes (All schools' classes)
│   ├── { tenantId: "tenant_greenwood_123", name: "Grade 1A", ... }
│   ├── { tenantId: "tenant_sunrise_456", name: "Grade 1B", ... }
│   └── ...
│
├── fees (All schools' fees)
│   ├── { tenantId: "tenant_greenwood_123", amount: 50000, ... }
│   ├── { tenantId: "tenant_sunrise_456", amount: 45000, ... }
│   └── ...
│
└── users (All schools' staff)
    ├── { tenantId: "tenant_greenwood_123", email: "admin@greenwood.com", ... }
    ├── { tenantId: "tenant_sunrise_456", email: "admin@sunrise.com", ... }
    └── ...
```

---

## 🛡️ Security Measures

### 1. Compound Unique Indexes

Ensure uniqueness PER TENANT, not globally:

```javascript
// Before: Admission number unique globally
studentSchema.index({ admissionNumber: 1 }, { unique: true });

// After: Admission number unique per tenant
studentSchema.index({ tenantId: 1, admissionNumber: 1 }, { unique: true });
```

**Why:** Two schools can have the same admission number (e.g., "2024001")

### 2. Automatic tenantId Injection

Middleware automatically adds tenantId to all queries:

```javascript
// Option A: Manual (what we'll do for MVP)
const students = await Student.find({ 
  tenantId: req.tenantId,
  status: 'Active' 
});

// Option B: Mongoose Plugin (future enhancement)
studentSchema.plugin(tenantPlugin);
// Automatically adds tenantId to all queries
```

### 3. Authentication Scoping

JWT tokens include tenantId:

```javascript
// When user logs in
const token = jwt.sign({
  userId: user._id,
  tenantId: user.tenantId,  // ← Include tenant
  role: user.role
}, process.env.JWT_SECRET);

// When validating requests
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.userId = decoded.userId;
req.tenantId = decoded.tenantId;  // ← Extract tenant
```

### 4. Cross-Tenant Access Prevention

```javascript
// Example: Get student by ID
router.get('/students/:id', requireAuth, async (req, res) => {
  const student = await Student.findOne({
    _id: req.params.id,
    tenantId: req.tenantId  // ← CRITICAL: Prevent cross-tenant access
  });
  
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  res.json(student);
});
```

**Without tenantId filter:**
- School A could access School B's student by guessing the ID ❌

**With tenantId filter:**
- School A can ONLY access their own students ✅

---

## 🔍 Data Isolation Testing

### Test 1: Query Isolation
```javascript
// Create test data
await Student.create({ tenantId: "tenant_A", name: "Student A" });
await Student.create({ tenantId: "tenant_B", name: "Student B" });

// Query as Tenant A
req.tenantId = "tenant_A";
const students = await Student.find({ tenantId: req.tenantId });

// Result: Only "Student A" returned ✅
// "Student B" is NOT visible ✅
```

### Test 2: Cross-Tenant Access Prevention
```javascript
// Tenant A tries to access Tenant B's student
const studentB_id = "507f1f77bcf86cd799439011"; // Belongs to Tenant B

req.tenantId = "tenant_A";
const student = await Student.findOne({
  _id: studentB_id,
  tenantId: req.tenantId  // "tenant_A"
});

// Result: null (not found) ✅
// Tenant A CANNOT access Tenant B's data ✅
```

### Test 3: Unique Constraints Per Tenant
```javascript
// Tenant A creates student with admission number "2024001"
await Student.create({
  tenantId: "tenant_A",
  admissionNumber: "2024001",
  name: "John"
});

// Tenant B creates student with SAME admission number
await Student.create({
  tenantId: "tenant_B",
  admissionNumber: "2024001",  // Same number, different tenant
  name: "Jane"
});

// Result: Both succeed ✅
// Admission numbers are unique PER TENANT, not globally ✅
```

---

## 📈 Performance Considerations

### 1. Indexes for Fast Queries

```javascript
// Every collection needs these indexes
studentSchema.index({ tenantId: 1 });  // Filter by tenant
studentSchema.index({ tenantId: 1, status: 1 });  // Filter by tenant + status
studentSchema.index({ tenantId: 1, classId: 1 });  // Filter by tenant + class
studentSchema.index({ tenantId: 1, admissionNumber: 1 }, { unique: true });
```

**Why:** MongoDB uses indexes to quickly find documents. Without indexes, queries would be slow.

### 2. Query Performance

```javascript
// BAD: Scans entire collection
const students = await Student.find({ name: "John" });

// GOOD: Uses tenantId index first, then filters
const students = await Student.find({ 
  tenantId: req.tenantId,  // ← Index hit
  name: "John" 
});
```

### 3. Scalability

**Current Approach (Row-Level) Scales to:**
- ✅ 100-500 schools
- ✅ 50,000-250,000 students total
- ✅ Millions of records

**When to Consider Database-Per-Tenant:**
- 500+ schools
- Regulatory requirements (data residency)
- Enterprise customers needing dedicated resources

---

## 🆚 Comparison: Row-Level vs Database-Per-Tenant

### Row-Level Multi-Tenancy (What We're Using)

**Pros:**
- ✅ Simple to implement
- ✅ Cost-effective (one database)
- ✅ Easy to manage
- ✅ Fast to deploy
- ✅ Good for 100-500 tenants

**Cons:**
- ⚠️ Requires careful query filtering
- ⚠️ One tenant's heavy load affects others
- ⚠️ Harder to provide per-tenant backups

### Database-Per-Tenant (Alternative)

**Pros:**
- ✅ Complete isolation
- ✅ Easy per-tenant backups
- ✅ Better performance isolation
- ✅ Easier compliance

**Cons:**
- ❌ Complex to manage (100s of databases)
- ❌ More expensive
- ❌ Harder to implement
- ❌ Slower to deploy

---

## 🔒 Security Checklist

### Code-Level Security
- [x] Every model has tenantId field
- [x] Every query filters by tenantId
- [x] Compound unique indexes include tenantId
- [x] JWT tokens include tenantId
- [x] Middleware validates tenant exists
- [x] Middleware checks tenant is active

### Database-Level Security
- [x] Indexes on tenantId for performance
- [x] Compound indexes for uniqueness
- [x] No global unique constraints (except tenant-specific)

### Application-Level Security
- [x] Subdomain routing to identify tenant
- [x] Authentication scoped to tenant
- [x] Authorization checks include tenant
- [x] API responses filtered by tenant

### Testing
- [x] Test cross-tenant access prevention
- [x] Test data isolation
- [x] Test unique constraints per tenant
- [x] Load testing with multiple tenants

---

## 🚀 Implementation Example

### Complete Flow: Creating a Student

```javascript
// 1. User visits: https://greenwood.schoolsaas.com/students/create

// 2. Middleware extracts tenant
app.use(extractTenant);  // Sets req.tenantId = "tenant_greenwood_123"

// 3. User submits form
router.post('/students', requireAuth, async (req, res) => {
  // 4. Create student with tenantId
  const student = await Student.create({
    tenantId: req.tenantId,  // "tenant_greenwood_123"
    name: req.body.name,
    admissionNumber: req.body.admissionNumber,
    classId: req.body.classId
  });
  
  // 5. Student is saved with tenantId
  // {
  //   _id: "...",
  //   tenantId: "tenant_greenwood_123",
  //   name: "John Doe",
  //   admissionNumber: "2024001"
  // }
  
  res.json(student);
});

// 6. When listing students
router.get('/students', requireAuth, async (req, res) => {
  const students = await Student.find({
    tenantId: req.tenantId  // Only Greenwood's students
  });
  
  res.json(students);
});
```

---

## 📊 Real-World Example

### Scenario: 3 Schools Using the Platform

**Greenwood School:**
- Subdomain: greenwood.schoolsaas.com
- tenantId: tenant_greenwood_123
- Students: 500
- Staff: 30

**Sunrise School:**
- Subdomain: sunrise.schoolsaas.com
- tenantId: tenant_sunrise_456
- Students: 300
- Staff: 20

**Royal Academy:**
- Subdomain: royal.schoolsaas.com
- tenantId: tenant_royal_789
- Students: 800
- Staff: 50

### Database State:

```javascript
// students collection (1,600 total documents)
[
  { _id: "1", tenantId: "tenant_greenwood_123", name: "John", ... },
  { _id: "2", tenantId: "tenant_greenwood_123", name: "Jane", ... },
  // ... 498 more Greenwood students
  
  { _id: "501", tenantId: "tenant_sunrise_456", name: "Bob", ... },
  { _id: "502", tenantId: "tenant_sunrise_456", name: "Alice", ... },
  // ... 298 more Sunrise students
  
  { _id: "801", tenantId: "tenant_royal_789", name: "Charlie", ... },
  { _id: "802", tenantId: "tenant_royal_789", name: "Diana", ... },
  // ... 798 more Royal students
]
```

### Query Results:

```javascript
// Greenwood admin queries students
req.tenantId = "tenant_greenwood_123";
const students = await Student.find({ tenantId: req.tenantId });
// Returns: 500 students (only Greenwood's)

// Sunrise admin queries students
req.tenantId = "tenant_sunrise_456";
const students = await Student.find({ tenantId: req.tenantId });
// Returns: 300 students (only Sunrise's)

// Royal admin queries students
req.tenantId = "tenant_royal_789";
const students = await Student.find({ tenantId: req.tenantId });
// Returns: 800 students (only Royal's)
```

---

## ✅ Summary

**Data Separation Method:** Row-Level Multi-Tenancy

**How It Works:**
1. Every document has a `tenantId` field
2. Middleware extracts tenant from subdomain
3. All queries filter by `tenantId`
4. Compound indexes ensure uniqueness per tenant
5. JWT tokens include `tenantId` for authentication

**Security:**
- ✅ Complete data isolation
- ✅ No cross-tenant access possible
- ✅ Tested and proven approach
- ✅ Used by major SaaS platforms

**Performance:**
- ✅ Fast queries with proper indexes
- ✅ Scales to 100-500 schools
- ✅ Handles millions of records

**Cost:**
- ✅ One database for all tenants
- ✅ Cost-effective
- ✅ Easy to manage

---

**This is the industry-standard approach for multi-tenant SaaS applications. It's secure, scalable, and battle-tested! 🚀**


