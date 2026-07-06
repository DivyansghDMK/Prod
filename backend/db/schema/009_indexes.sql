-- CardioX Production Database Index Tuning
-- Migration 009: Foreign Key Indexes

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_device ON reports(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON ecg_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON ecg_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_report_reviews_report ON report_reviews(report_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

COMMIT;
