import './globals.css';
import AppHeadBrand from '@/components/AppHeadBrand';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS System',
  description: 'ລະບົບຈັດການຂາຍໜ້າຮ້ານ',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="lo">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppHeadBrand />
        {children}
      </body>
    </html>
  );
}
