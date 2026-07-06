const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { createRole, listRoles, getRoleById, updateRole, deleteRole, roleErrorHandler } = require("./role.controller");

// Authenticate all routes
router.use(authenticate);

router.post("/", authorize("user:create"), createRole);
router.get("/", listRoles); // Users need to view roles upon user creation/edit
router.get("/:id", authorize("user:view"), getRoleById);
router.put("/:id", authorize("user:update"), updateRole);
router.delete("/:id", authorize("user:delete"), deleteRole);
router.use(roleErrorHandler);

module.exports = router;

