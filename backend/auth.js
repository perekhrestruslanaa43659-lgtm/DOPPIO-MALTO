const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Middleware to protect routes
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

async function login(req, res) {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ msg: "Utente non trovato" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ msg: "Password errata" });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '12h' });
        res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

const nodemailer = require('nodemailer');

// --- EMAIL CONFIG ---
// Setup transporter (use env vars for real credentials)
const transportConfig = {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'user@example.com',
        pass: process.env.SMTP_PASS || 'pass'
    }
};

const transporter = nodemailer.createTransport(transportConfig);

async function sendWelcomeEmail(to, name, rawPassword) {
    if (!process.env.SMTP_USER) {
        console.log("------------------------------------------");
        console.log("EMAIL LOG (MOCK):");
        console.log(`To: ${to}`);
        console.log(`Subject: Benvenuto in ScheduFlow!`);
        console.log(`Body: Ciao ${name}, il tuo account è pronto. La tua password è: ${rawPassword}. Puoi cambiarla nel tuo profilo.`);
        console.log("------------------------------------------");
        return;
    }

    const mailOptions = {
        from: `"ScheduFlow Team" <${process.env.SMTP_USER}>`,
        to: to,
        subject: 'Benvenuto in ScheduFlow!',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Benvenuto in ScheduFlow, ${name}!</h2>
                <p>Il tuo account operatore è stato creato con successo.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Dati di accesso:</strong></p>
                    <p>Email: ${to}</p>
                    <p>Password temporanea: <strong>${rawPassword}</strong></p>
                </div>
                <p>Ti consigliamo di accedere e cambiare la password nella sezione "Profilo".</p>
                <br/>
                <p>Saluti,<br/>Team ScheduFlow</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error("Failed to send welcome email:", err);
    }
}

async function register(req, res) {
    const { email, password, name, surname, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hash,
                name,
                surname: surname || '',
                role: role || 'USER'
            }
        });

        // Send email (async, don't block response)
        sendWelcomeEmail(email, name, password);

        res.json({ id: user.id, email: user.email });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}

// Init Admin if not exists
async function initAdmin() {
    try {
        const count = await prisma.user.count();
        if (count === 0) {
            console.log("Creating default admin...");
            const hash = await bcrypt.hash("admin", 10);
            await prisma.user.create({
                data: { email: "admin@scheduling.com", password: hash, name: "Admin", role: "ADMIN" }
            });
            console.log("Default Admin created: admin@scheduling.com / admin");
        }
    } catch (e) {
        console.error("Init Admin failed:", e);
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true }
        });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function deleteUser(req, res) {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id: parseInt(id) } });
        res.json({ msg: "User deleted" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function getProfile(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, surname: true, dob: true, address: true, role: true }
        });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

async function updateProfile(req, res) {
    const { name, surname, dob, address, password } = req.body;
    console.log("UpdateProfile User:", req.user); // DEBUG
    console.log("UpdateProfile Body:", req.body);
    try {
        const data = { name, surname, dob, address };
        if (password && password.length > 0) {
            data.password = await bcrypt.hash(password, 10);
        }

        const userId = parseInt(req.user.id, 10);
        console.log("Update via Prisma ID:", userId, typeof userId);

        await prisma.user.update({
            where: { id: userId },
            data
        });
        res.json({ msg: "Profile updated" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

module.exports = { authenticateToken, login, register, initAdmin, getAllUsers, deleteUser, getProfile, updateProfile };
