const router = require("express").Router();

router.post("/send-otp", (_req, res) => {
  res.json({ message: "send-otp placeholder" });
});

router.post("/verify-otp", (_req, res) => {
  res.json({ message: "verify-otp placeholder" });
});

module.exports = router;
