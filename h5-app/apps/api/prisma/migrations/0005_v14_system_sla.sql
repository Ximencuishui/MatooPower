-- v1.4 P1-3:SLA 自动升级需要一个 system actor user
-- (TicketStatusLog.actorUserId FK to User.id)
-- 用 phone='+00000000000' 作哨兵,真实用户不可能有这号段
-- displayName='System (SLA Sweep)' / role='support' (系统角色)
-- 演示期只读:不允许登录(没 OTP)

INSERT OR IGNORE INTO User (id, phone, email, role, displayName, createdAt, updatedAt)
VALUES ('system-sla', '+00000000000', 'system-sla@matoo.local', 'support', 'System (SLA Sweep)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS User_phone_sentinel_idx ON User(phone) WHERE phone = '+00000000000';
