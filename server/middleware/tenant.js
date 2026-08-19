/**
 * Tenant Middleware
 * Extracts tenantId from JWT token and attaches it to req.tenantId
 * This middleware should be used after requireAuth middleware
 */

function attachTenant(req, res, next) {
  // req.user is set by requireAuth middleware
  if (!req.user || !req.user.tenantId) {
    return res.status(403).json({ 
      error: 'Tenant context missing. Please login again with a valid account.' 
    });
  }

  // Attach tenantId to request for easy access in routes
  req.tenantId = req.user.tenantId;
  
  next();
}

module.exports = attachTenant;
