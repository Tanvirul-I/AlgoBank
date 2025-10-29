CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS risk_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    exposure NUMERIC(20, 4) NOT NULL,
    leverage NUMERIC(20, 4) NOT NULL,
    loss_ratio NUMERIC(10, 6) NOT NULL,
    observation_window INTEGER NOT NULL DEFAULT 90,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_metrics_account_id_created_at
    ON risk_metrics (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledgement TEXT
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_triggered_at
    ON risk_alerts (triggered_at DESC);

CREATE TABLE IF NOT EXISTS risk_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    anomaly_score NUMERIC(10, 6) NOT NULL,
    score_threshold NUMERIC(10, 6) NOT NULL,
    detector_version TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_risk_anomalies_transaction_id
    ON risk_anomalies (transaction_id);

CREATE TABLE IF NOT EXISTS compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_id UUID REFERENCES transactions(id),
    check_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_user_id_created_at
    ON compliance_checks (user_id, created_at DESC);
