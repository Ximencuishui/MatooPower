-- v1.4 T-2d X2:website 询盘 → h5-app 工单对接需要 system-web-inquiry actor
-- (Ticket.userId FK to User.id,匿名询盘需要一个固定 author)
-- 用 phone='+00000000001' 作哨兵(与 system-sla 共用 +00 段,便于识别系统用户)
-- displayName='System (Web Inquiry)' / role='support' (系统角色,演示期只读)
-- 演示期不允许登录(没 OTP/密码 hash)

INSERT OR IGNORE INTO User (id, phone, email, role, displayName, createdAt, updatedAt)
VALUES ('system-web-inquiry', '+00000000001', 'system-web-inquiry@matoo.local', 'support', 'System (Web Inquiry)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);