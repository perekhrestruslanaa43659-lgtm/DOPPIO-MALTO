import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import AiAssistantWidget from "@/components/AiAssistantWidget";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
    title: "ScheduFlow - Gestione Turni",
    description: "Sistema di gestione turni per ristoranti",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="it" suppressHydrationWarning>
            <body className="antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    <Navigation>
                        {children}
                    </Navigation>
                    <AiAssistantWidget />
                </ThemeProvider>
            </body>
        </html>
    );
}
