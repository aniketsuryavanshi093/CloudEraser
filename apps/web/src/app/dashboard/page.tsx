import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listBoards } from '../actions/board';
import { NewBoardForm } from './_components/NewBoardForm';
import { BoardCard } from './_components/BoardCard';
import { DashboardHeader } from './_components/DashboardHeader';

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
      <DashboardHeader name={session.user.name} email={session.user.email} image={session.user.image} />
      <main className="mx-auto max-w-6xl px-6 py-10">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => <BoardCard key={board.id} board={board} />)}
          </div>
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
