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

export async function sendScheduleEmail(to: string[], htmlTable: string, weekRange: string, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'Configurazione SMTP non trovata.' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            bcc: to, // Use BCC for privacy broadcast
            subject: `📅 Turni Settimana: ${weekRange}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4F46E5;">Nuovi Turni Pubblicati</h2>
                    <p>Sono disponibili i turni per la settimana <strong>${weekRange}</strong>.</p>
                    <div style="overflow-x: auto; margin: 20px 0;">
                        ${htmlTable}
                    </div>
                    <p>Accedi all'app per maggiori dettagli: <a href="https://scheduling-nextjs-mu.vercel.app/" style="color: #4F46E5;">Vai al Gestionale</a></p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Questa è una notifica automatica.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };

    } catch (error: any) {
        console.error('Error sending schedule email:', error);
        return { success: false, error: error.message };
    }
}

export async function sendRequestStatusEmail(to: string, userName: string, type: string, status: string, notes: string | null, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const color = status === 'APPROVED' ? '#10B981' : '#EF4444';
        const label = status === 'APPROVED' ? 'APPROVATA' : 'RIFIUTATA';

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `Aggiornamento Richiesta ${type}: ${label}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: ${color};">La tua richiesta è stata ${label}</h2>
                    <p>Ciao <strong>${userName}</strong>,</p>
                    <p>La tua richiesta di <strong>${type}</strong> è stata aggiornata.</p>
                    ${notes ? `<p><strong>Note dall'amministratore:</strong> <br/>"${notes}"</p>` : ''}
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Accedi all'app per visualizzare i dettagli.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('Email status error:', e);
        return { success: false, error: e.message };
    }
}

interface ClosingSection {
    title: string;
    sales: { budget: string[]; real: string[]; diffVal: string[]; diffPerc: string[] };
    covers: { budget: string[]; real: string[]; diffVal: string[]; diffPerc: string[] };
    ticket: { budget: string[]; real: string[]; diffVal: string[]; diffPerc: string[] };
    hours: { salaBudget: string[]; cucinaBudget: string[]; salaReal: string[]; cucinaReal: string[] };
    productivity: { budget: string[]; real: string[]; diffVal: string[]; diffPerc: string[] };
}

interface ClosingData {
    week: string;
    dates: string[];
    lunch: ClosingSection | null;
    dinner: ClosingSection | null;
    total: ClosingSection | null;
}

export async function sendClosingSummaryEmail(to: string, data: ClosingData, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        // Helper to generating Table HTML for a section
        const renderSection = (sec: ClosingSection | null) => {
            if (!sec) return '';
            const th = (t: string) => `<th style="padding: 8px; border: 1px solid #ddd; background: #f3f4f6; text-align: right; font-size: 11px;">${t}</th>`;
            const td = (t: string, bold = false, color = '') => `<td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 11px; ${bold ? 'font-weight: bold;' : ''} ${color ? 'color: ' + color + ';' : ''}">${t}</td>`;
            const row = (label: string, vals: string[], bold = false, color = '') => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 11px; ${bold ? 'font-weight: bold;' : ''} ${color ? 'color: ' + color + ';' : ''}">${label}</td>
                    ${vals.map(v => td(v, bold, color)).join('')}
                </tr>
            `;

            return `
                <div style="margin-bottom: 20px;">
                    <h3 style="background: #e5e7eb; padding: 10px; border-left: 4px solid #4F46E5; margin-bottom: 0;">${sec.title}</h3>
                    <table style="width: 100%; border-collapse: collapse; font-family: sans-serif;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; border: 1px solid #ddd; background: #f9fafb; text-align: left;">Voce</th>
                                ${['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom', 'TOT'].map(d => th(d)).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${row('Vendite Reali', sec.sales.real, true, '#065f46')}
                            ${row('Budget', sec.sales.budget, false, '#6b7280')}
                            ${row('Diff %', sec.sales.diffPerc, false, '#ea580c')}
                            
                            ${row('Coperti Reali', sec.covers.real, true, '#3730a3')}
                            ${row('Budget', sec.covers.budget, false, '#6b7280')}
                            
                            ${row('Prod. Oraria Reale', sec.productivity.real, true, '#9a3412')}
                            ${row('Budget', sec.productivity.budget, false, '#6b7280')}
                        </tbody>
                    </table>
                </div>
            `;
        };

        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 800px; margin: 0 auto;">
                <h2 style="color: #4F46E5; text-align: center;">Riepilogo Chiusure Settimanali</h2>
                <p style="text-align: center; color: #666;">Settimana: <strong>${data.week}</strong> (${data.dates[0]} - ${data.dates[6]})</p>
                
                ${renderSection(data.lunch)}
                ${renderSection(data.dinner)}
                ${renderSection(data.total)}

                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #666; text-align: center;">Report generato automaticamente da ScheduFlow.</p>
            </div>
        `;

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `Riepilogo Chiusure: ${data.week}`,
            html: html
        };

        await transporter.sendMail(mailOptions);
        return { success: true };

    } catch (e: any) {
        console.error('Email summary error:', e);
        return { success: false, error: e.message };
    }
}

export async function sendLoginNotification(to: string, userName: string, time: string, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `Nuovo accesso rilevato`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4F46E5;">Nuovo accesso al tuo account</h2>
                    <p>Ciao <strong>${userName}</strong>,</p>
                    <p>È stato rilevato un nuovo accesso al tuo account ScheduFlow.</p>
                    <p><strong>Data e Ora:</strong> ${time}</p>
                    <p>Se non sei stato tu, ti consigliamo di cambiare immediatamente la password.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Notifica di sicurezza automatica.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('Email login notification error:', e);
        return { success: false, error: e.message };
    }
}

export async function sendPasswordResetEmail(to: string, token: string, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const resetLink = `https://scheduling-nextjs-mu.vercel.app/auth/reset-password?token=${token}`;

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `Richiesta Reset Password`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4F46E5;">Password Reset</h2>
                    <p>Hai richiesto di reimpostare la tua password.</p>
                    <p>Clicca sul pulsante qui sotto per procedere:</p>
                    <a href="${resetLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reimposta Password</a>
                    <p>Se non hai richiesto il reset, ignora questa email.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Link valido per 1 ora.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('Email reset password error:', e);
        return { success: false, error: e.message };
    }
}

export async function sendVerificationEmail(to: string, token: string, tenantKey: string, name: string, baseUrl?: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const appBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://scheduling-nextjs-mu.vercel.app';
        const verificationLink = `${appBaseUrl}/verify?token=${token}`;

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `Verifica il tuo account ScheduFlow`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4F46E5;">Benvenuto, ${name}!</h2>
                    <p>Per attivare il tuo account, conferma il tuo indirizzo email cliccando sul pulsante qui sotto.</p>
                    <a href="${verificationLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Verifica Email</a>
                    <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
                    <p style="background-color: #f3f4f6; padding: 10px; font-size: 12px; word-break: break-all;">${verificationLink}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666;">Se non hai creato un account, ignora questa email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('Email verification error:', e);
        return { success: false, error: e.message };
    }
}

export async function sendVerificationSuccessEmail(to: string, name: string, tenantKey: string) {
    try {
        const owner = await prisma.user.findFirst({
            where: { tenantKey, role: 'OWNER' }
        });

        if (!owner || !owner.smtpHost || !owner.smtpUser || !owner.smtpPassword) {
            return { success: false, error: 'SMTP non configurato' };
        }

        const transporter = nodemailer.createTransport({
            host: owner.smtpHost,
            port: owner.smtpPort || 587,
            secure: owner.smtpPort === 465,
            auth: { user: owner.smtpUser, pass: owner.smtpPassword },
            tls: { rejectUnauthorized: false }
        });

        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://scheduling-nextjs-mu.vercel.app';

        const mailOptions = {
            from: `"${owner.companyName || 'ScheduFlow'}" <${owner.smtpUser}>`,
            to: to,
            subject: `✅ Email verificata con successo - ${owner.companyName || 'ScheduFlow'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="background-color: #10B981; width: 70px; height: 70px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                            <span style="color: white; font-size: 36px;">✓</span>
                        </div>
                        <h2 style="color: #10B981; margin: 0;">Email Verificata!</h2>
                    </div>
                    <p>Ciao <strong>${name}</strong>,</p>
                    <p>Il tuo indirizzo email è stato verificato con successo. Il tuo account è ora attivo e puoi accedere all'applicazione.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${appBaseUrl}/login" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Accedi ora
                        </a>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        Se non hai richiesto questa verifica, contatta il supporto.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('Verification success email error:', e);
        return { success: false, error: e.message };
    }
}

