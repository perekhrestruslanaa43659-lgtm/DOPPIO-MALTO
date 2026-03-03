import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { provider, smtpHost, smtpPort, smtpUser, smtpPassword } = body;

        if (provider === 'CUSTOM' && (!smtpHost || !smtpPort)) {
            return NextResponse.json({ success: false, error: 'Host e Porta sono richiesti per Custom SMTP' }, { status: 400 });
        }
        if (!smtpUser || !smtpPassword) {
            return NextResponse.json({ success: false, error: 'Utente e Password sono richiesti' }, { status: 400 });
        }

        // Determine settings based on provider or custom
        let host = smtpHost;
        let port = parseInt(smtpPort);
        let secure = port === 465;

        // Simplify for common providers if user selected them but didn't fill host (though UI usually handles this)
        if (provider === 'GMAIL') {
            host = 'smtp.gmail.com';
            port = 465;
            secure = true;
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: smtpUser,
                pass: smtpPassword
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify connection
        await transporter.verify();

        // Send a test email
        await transporter.sendMail({
            from: `"${smtpUser}" <${smtpUser}>`,
            to: smtpUser, // Send to self
            subject: 'ScheduFlow - Test Configurazione SMTP',
            text: 'Se leggi questa email, la configurazione SMTP è corretta! 🎉',
            html: '<div style="font-family: sans-serif; padding: 20px; color: #333;"><h2>Configurazione SMTP Corretta! ✅</h2><p>Questo è un messaggio di prova inviato da ScheduFlow.</p></div>'
        });

        return NextResponse.json({ success: true, message: 'Connessione riuscita! Email di prova inviata.' });

    } catch (error: any) {
        console.error('SMTP Test Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Errore di connessione',
            details: error.response || error.code
        }, { status: 500 });
    }
}
