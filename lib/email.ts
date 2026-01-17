import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export async function sendWelcomeEmail(to: string, name: string, password: string, tenantKey: string) {
    try {
        // 1. Find the Owner of this tenant to get SMTP settings
        // We assume the one who registered the tenant (OWNER) has the config.
        const owner = await prisma.user.findFirst({
            where: {
                tenantKey: tenantKey,
                role: 'OWNER'
            }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            console.log('SMTP settings not found for tenant:', tenantKey);
            return { success: false, error: 'Configurazione SMTP non trovata. Contatta il proprietario.' };
        }

        // 2. Create Transporter
        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: owner.smtpUser,
                pass: owner.smtpPassword
            },
            tls: {
                rejectUnauthorized: false // Helpful for some shared hostings, use caution in strict prod
            }
        });

        // 3. Send Email
        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: 'Benvenuto in ScheduFlow - Le tue credenziali',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4F46E5;">Benvenuto, ${name}!</h2>
                    <p>Sei stato aggiunto al team su <strong>${owner.companyName || 'ScheduFlow'}</strong>.</p>
                    <p>Ecco le tue credenziali per accedere:</p>
                    <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
                        <p style="margin: 5px 0;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 1.2em; background-color: #fff; padding: 2px 5px; border: 1px solid #ccc; border-radius: 4px;">${password}</span></p>
                    </div>
                    <p>Accedi qui: <a href="https://scheduling-nextjs-mu.vercel.app/" style="color: #4F46E5;">Vai al Login</a></p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Ti consigliamo di cambiare la password dopo il primo accesso.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return { success: true };

    } catch (error: any) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}
