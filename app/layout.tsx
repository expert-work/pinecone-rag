import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { SupabaseProvider } from './components/SupabaseProvider';
import { ClientThemeProvider } from './ClientThemeProvider';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AI Chat Bot',
  description: 'Chat with an AI assistant',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider session={session}>
          <ClientThemeProvider>
            {children}
          </ClientThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}