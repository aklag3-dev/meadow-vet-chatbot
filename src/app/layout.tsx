import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meadow Vet Care — Virtual Assistant',
  description: 'Chat with our virtual assistant to find services, pricing, and availability for your pet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Muli:wght@400;600;700&family=Lato:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
