const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const {
  createPermission,
  listPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
  listPermissionsByRole,
  setRolePermissions,
  permissionErrorHandler,
} = require("./permission.controller");

// Authenticate all routes
router.use(authenticate);

router.post("/", authorize("user:update"), createPermission);
router.get("/", authorize("user:view"), listPermissions);
router.get("/role/:roleId", authorize("user:view"), listPermissionsByRole);
router.get("/:id", authorize("user:view"), getPermissionById);
router.put("/:id", authorize("user:update"), updatePermission);
router.delete("/:id", authorize("user:update"), deletePermission);
router.post("/role-mapping", authorize("user:update"), setRolePermissions);
router.use(permissionErrorHandler);

module.exports = router;

