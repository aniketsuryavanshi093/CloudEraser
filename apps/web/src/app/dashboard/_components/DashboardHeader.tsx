'use client';

import { signOut } from 'next-auth/react';

export function DashboardHeader({ name, email, image }: { name?: string | null; email?: string | null; image?: string | null }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900"><span className="rounded-lg bg-indigo-600 px-2 py-1 text-white">C</span> CollabSpace</a>
        <div className="flex items-center gap-3">
          {image ? <img src={image} alt="" className="h-8 w-8 rounded-full" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{(name ?? email ?? 'U').charAt(0).toUpperCase()}</div>}
          <div className="hidden text-right sm:block"><p className="text-sm font-medium text-gray-800">{name ?? 'User'}</p><p className="text-xs text-gray-500">{email}</p></div>
          <button onClick={() => void signOut({ callbackUrl: '/login' })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Sign out</button>
        </div>
      </div>
    </header>
  );
}
