'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useState } from 'react';
import { Session } from '@supabase/supabase-js';

interface SupabaseProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

export function SupabaseProvider({ children, session }: SupabaseProviderProps) {
  const [supabaseClient] = useState(() => createClientComponentClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={session}>
      {children}
    </SessionContextProvider>
  );
}