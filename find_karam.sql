-- Find Karam's staff record
SELECT id,
    nome,
    cognome,
    email,
    "tenantKey"
FROM "Staff"
WHERE nome ILIKE '%karam%'
    OR cognome ILIKE '%karam%';