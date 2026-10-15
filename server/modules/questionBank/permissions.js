// The one place that decides who may manage the Question Bank. Every bank route goes through
// requireBankManager, so adding a "content_reviewer" role later is a one-line change here.
// For now only a super admin passes.
function canManageBank(user) {
  return !!user && user.role === 'super_admin';
}

function requireBankManager(req, res, next) {
  if (!canManageBank(req.user)) {
    return res.status(403).json({ error: 'You do not have permission to manage the question bank' });
  }
  next();
}

module.exports = { canManageBank, requireBankManager };
