import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
});

export const metadata = {
  title: 'PIXEL QUEST: Gamified Task RPG',
  description: 'Transform daily productivity into a 2D retro RPG.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${pixelFont.className} bg-white text-black min-h-screen`}>
        {children}
      </body>
    </html>
  );
}