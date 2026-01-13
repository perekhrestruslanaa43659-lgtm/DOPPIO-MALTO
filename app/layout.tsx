import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
    title: "Scheduling App - Gestione Turni",
    description: "Sistema di gestione turni per ristoranti",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="it">
            <body>
                <Navigation>{children}</Navigation>
            </body>
        </html>
    );
}
