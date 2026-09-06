'use client';

import { useRef, useState, useTransition } from 'react';
import { createBoard } from '../../actions/board';

export function NewBoardForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = inputRef.current?.value?.trim() || 'Untitled Board';
    setError(null);

    startTransition(async () => {
      try {
        await createBoard(title);
      } catch {
        setError('Unable to create board. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        placeholder="Board title (optional)"
        maxLength={120}
        disabled={isPending}
        className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Creating…' : '+ New Board'}
      </button>
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </form>
  );
}
