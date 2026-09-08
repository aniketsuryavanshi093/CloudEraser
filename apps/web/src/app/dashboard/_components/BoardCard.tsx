'use client';

import { useState, useTransition } from 'react';
import type { BoardListItem } from '@/types/board';
import { updateBoardTitle } from '../../actions/board';

export function BoardCard({ board }: { board: BoardListItem }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveTitle() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Title cannot be empty');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateBoardTitle(board.id, nextTitle);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle(result.title ?? nextTitle);
      setEditing(false);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md">
      <a href={`/board/${board.id}`} className="group block">
        <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-sky-50 text-3xl text-indigo-300">✦</div>
      </a>
      {editing ? (
        <div className="flex gap-2">
          <input autoFocus value={title} maxLength={120} disabled={isPending} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveTitle(); if (event.key === 'Escape') { setTitle(board.title); setEditing(false); } }} className="min-w-0 flex-1 rounded border px-2 py-1 text-sm" />
          <button type="button" disabled={isPending} onClick={saveTitle} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Save</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <a href={`/board/${board.id}`} className="min-w-0 flex-1 truncate font-semibold text-gray-900 hover:text-indigo-700">{title}</a>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-indigo-600">Edit</button>
        </div>
      )}
      <p className="mt-1 text-xs text-gray-500">Updated {new Date(board.updatedAt).toLocaleDateString()}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
