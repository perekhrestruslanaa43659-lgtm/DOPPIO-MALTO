UPDATE "User"
SET "isVerified" = true,
    "verificationToken" = NULL
WHERE email = 'rusliperekhrest@gmail.com';
SELECT id,
    email,
    "isVerified",
    role
FROM "User"
WHERE email = 'rusliperekhrest@gmail.com';