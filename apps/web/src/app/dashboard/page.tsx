import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listBoards } from '../actions/board';
import { NewBoardForm } from './_components/NewBoardForm';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const result = await listBoards();
  const boards = result.boards;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">
            Collaborative Whiteboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Page heading + New Board action */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Boards</h2>
            <p className="mt-1 text-sm text-gray-500">
              {boards.length === 0
                ? 'No boards yet — create your first one!'
                : `${boards.length} board${boards.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <NewBoardForm />
            {result.error && <p className="text-sm text-red-600">{result.error}</p>}
          </div>
        </div>

        {/* Board grid */}
        {boards.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/board/${board.id}`}
                  className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gray-100 text-4xl text-gray-300 group-hover:bg-indigo-50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.2}
                      stroke="currentColor"
                      className="h-10 w-10"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 3h16.5M3.75 3v13.5A2.25 2.25 0 006 18.75h12a2.25 2.25 0 002.25-2.25V3M3.75 3H2.25M20.25 3h1.5M9 9h6M9 12h3"
                      />
                    </svg>
                  </div>
                  <p className="truncate font-medium text-gray-900 group-hover:text-indigo-700">
                    {board.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Updated{' '}
                    {new Date(board.updatedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.2}
              stroke="currentColor"
              className="mb-4 h-14 w-14 text-gray-300"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3h16.5M3.75 3v13.5A2.25 2.25 0 006 18.75h12a2.25 2.25 0 002.25-2.25V3M3.75 3H2.25M20.25 3h1.5M9 9h6M9 12h3"
              />
            </svg>
            <p className="text-base font-medium text-gray-500">
              No boards yet
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Use the &ldquo;+ New Board&rdquo; button above to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
