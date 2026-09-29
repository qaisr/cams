'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../src/lib/auth/AuthContext';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? '/secure' : '/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return <div aria-busy="true">Loading...</div>;
}
