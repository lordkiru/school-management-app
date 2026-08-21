# How to Resume Your MongoDB Atlas Cluster 🔧

## Step-by-Step Visual Guide

### **Step 1: Go to MongoDB Atlas**
1. Open your browser
2. Go to: **https://cloud.mongodb.com**
3. Login with your MongoDB Atlas credentials

---

### **Step 2: Find Your Cluster**

After logging in, you'll see the **Database Deployments** page.

**Look for:**
- A card/box labeled **"Cluster0"**
- It will show your cluster name and status

**The cluster card will show:**
- Cluster name: **Cluster0**
- Status indicator (might say "Paused" or show a pause icon)
- A **"Resume"** button (if paused)

---

### **Step 3: Resume the Cluster**

**If you see a "Resume" button:**
1. Click the **"Resume"** button on the Cluster0 card
2. A confirmation dialog may appear
3. Click **"Resume"** again to confirm
4. Wait 1-2 minutes for the cluster to start

**If you see "..." (three dots) menu:**
1. Click the **"..."** (three dots) on the right side of the Cluster0 card
2. Select **"Resume"** from the dropdown menu
3. Confirm if prompted
4. Wait 1-2 minutes

---

### **Step 4: Verify Cluster is Active**

After resuming, the cluster card should show:
- Status: **"Active"** or a green indicator
- No "Resume" button (it disappears when active)
- You can see metrics and graphs

---

### **Step 5: Test Connection**

Once the cluster shows "Active", run:

```bash
node server/scripts/testConnection.js
```

**Expected output:**
```
✅ MongoDB Connected Successfully!
Database: schooldb
Host: cluster0-shard-00-00.dnfk9.mongodb.net
```

---

### **Step 6: Create Super Admin**

Once connection works, run:

```bash
node server/scripts/createSuperAdmin.js
```

**Expected output:**
```
✅ Super admin created successfully!
Email: admin@platform.com
Password: Admin@123
```

---

## 🎯 **Visual Reference:**

### **What the Dashboard Looks Like:**

```
┌─────────────────────────────────────────────────────┐
│  MongoDB Atlas                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Database Deployments                                │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Cluster0                          [Resume]  │  │
│  │  M0 Sandbox                                   │  │
│  │  Status: Paused                               │  │
│  │  Region: AWS / US East (N. Virginia)         │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Click the [Resume] button!**

---

## 🔍 **Can't Find the Resume Button?**

### **Option A: Check the Overview Tab**
1. Click on **"Cluster0"** name (the cluster card itself)
2. You'll see the cluster details page
3. Look for a **"Resume"** button at the top
4. Or check the **"..."** menu in the top right

### **Option B: Check Cluster Actions**
1. On the main Database page
2. Find your **Cluster0** card
3. Look for **"..."** (three dots) on the right side
4. Click it to see the menu
5. Select **"Resume"**

### **Option C: Cluster Might Already Be Active**
If you don't see a "Resume" button, your cluster might already be active!

**Check if it shows:**
- Green status indicator
- "Active" status
- Metrics/graphs are visible

If it's already active but connection fails, try:
1. **Restart your terminal**
2. **Run the test again:** `node server/scripts/testConnection.js`
3. **Check Network Access** (make sure 0.0.0.0/0 is there)

---

## 🚨 **Still Having Issues?**

### **Alternative: Get Fresh Connection String**

1. On your Cluster0 card, click **"Connect"** button
2. Choose **"Connect your application"**
3. Select **"Node.js"** and version **"4.1 or later"**
4. Copy the connection string
5. Update your `server/.env` file:
   ```
   MONGO_URI=<paste-new-connection-string-here>
   ```
6. Replace `<password>` with your actual password: `cF6jENncoMXOFW9X`
7. Test again

---

## ✅ **Success Checklist:**

- [ ] Logged into MongoDB Atlas
- [ ] Found Cluster0 card
- [ ] Clicked Resume button
- [ ] Waited 1-2 minutes
- [ ] Cluster shows "Active" status
- [ ] Ran test script successfully
- [ ] Created super admin account

---

**Once your cluster is active and super admin is created, your entire Super Admin Dashboard will be ready to use!** 🚀
