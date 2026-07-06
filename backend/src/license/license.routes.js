const router = require("express").Router();

router.get("/", (_req, res) => {
  res.json({ message: "License API" });
});

module.exports = router;
