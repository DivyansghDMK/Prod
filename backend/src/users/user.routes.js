const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roles");
const { createUser, listUsers, getUserById, updateUser, deleteUser, userErrorHandler } = require("./user.controller");

// Authenticate all routes
router.use(authenticate);

router.post("/", authorize("user:create"), createUser);
router.get("/", authorize("user:view"), listUsers);
router.get("/:id", authorize("user:view"), getUserById);
router.put("/:id", authorize("user:update"), updateUser);
router.delete("/:id", authorize("user:delete"), deleteUser);
router.use(userErrorHandler);

module.exports = router;

