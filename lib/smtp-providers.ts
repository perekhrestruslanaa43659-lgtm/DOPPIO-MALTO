// SMTP Provider Configuration Mapping
export const SMTP_PROVIDERS = {
    GMAIL: {
        name: 'Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        note: 'Richiede App Password da myaccount.google.com/apppasswords'
    },
    OUTLOOK: {
        name: 'Outlook / Hotmail',
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false, // STARTTLS
        note: ''
    },
    YAHOO: {
        name: 'Yahoo Mail',
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true, // SSL
        note: ''
    },
    ICLOUD: {
        name: 'iCloud',
        host: 'smtp.mail.me.com',
        port: 587,
        secure: false, // TLS
        note: ''
    },
    ARUBA: {
        name: 'Aruba (PEC)',
        host: 'smtps.pec.aruba.it',
        port: 465,
        secure: true, // SSL
        note: ''
    },
    CUSTOM: {
        name: 'Personalizzato',
        host: '',
        port: 587,
        secure: false,
        note: 'Inserisci manualmente host e porta'
    }
} as const;

export type SMTPProviderKey = keyof typeof SMTP_PROVIDERS;

export function getSMTPConfig(provider: string) {
    const key = provider.toUpperCase() as SMTPProviderKey;
    return SMTP_PROVIDERS[key] || SMTP_PROVIDERS.CUSTOM;
}
