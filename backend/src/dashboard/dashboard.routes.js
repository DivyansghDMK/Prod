const router = require("express").Router();

router.get("/", (_req, res) => {
  res.json({ message: "Dashboard API" });
});

module.exports = router;
