import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Customer Management System",
  description: "Modern CRM for managing customer data, subscriptions, and renewals.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',theme==='light'?'light':'dark')}catch(e){}})();` }} />
      </head>
      <body suppressHydrationWarning>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '0.85rem'
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
