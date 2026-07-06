const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  organizationErrorHandler,
} = require("./organization.controller");

// Authenticate all routes
router.use(authenticate);

router.post("/", authorize("organization:create"), createOrganization);
router.get("/", authorize("organization:view"), listOrganizations);
router.get("/:id", authorize("organization:view"), getOrganizationById);
router.put("/:id", authorize("organization:update"), updateOrganization);
router.delete("/:id", authorize("organization:delete"), deleteOrganization);
router.use(organizationErrorHandler);

module.exports = router;
