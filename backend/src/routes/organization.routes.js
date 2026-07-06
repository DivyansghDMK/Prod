const router = require("express").Router();

router.get("/", (_req, res) => res.json([]));
router.post("/", (_req, res) => res.status(201).json({ message: "organization create placeholder" }));

module.exports = router;
