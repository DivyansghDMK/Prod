const router = require("express").Router();

router.get("/", (_req, res) => res.json({ message: "dashboard placeholder" }));

module.exports = router;
