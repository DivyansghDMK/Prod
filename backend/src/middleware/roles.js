function getUserPermissions(req) {
  const direct = req.user?.permissions;
  const fromAuth = req.auth?.permissions;
  const permissions = direct || fromAuth || [];
  return Array.isArray(permissions) ? permissions : [];
}

function authorize(permissionName) {
  return (req, res, next) => {
    const permissions = getUserPermissions(req);
    if (!permissionName) {
      return res.status(500).json({ message: "Permission name is required" });
    }
    if (!permissions.includes(permissionName)) {
      return res.status(403).json({ message: "Forbidden", permission: permissionName });
    }
    next();
  };
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role || req.auth?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireRole, authorize };
