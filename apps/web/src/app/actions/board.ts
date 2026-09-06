'use server';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { BoardListItem } from '@/types/board';
import type { ListBoardsResult } from '@/types/actions';

export async function createBoard(title?: string): Promise<never> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const board = await prisma.board.create({
    data: {
      ownerId: session.user.id,
      title: title?.trim() || 'Untitled Board',
      members: { create: { userId: session.user.id, role: 'OWNER' } },
    },
  });

  redirect(`/board/${board.id}`);
}

export async function listBoards(): Promise<ListBoardsResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { boards: [], error: 'Authentication required' };

  try {
    const boards = await prisma.board.findMany({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        ownerId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        // owner: true,
      },
    });

    const serializedBoards: BoardListItem[] = boards.map((el: { id: string; ownerId: string; title: string; createdAt: Date; updatedAt: Date }) => ({
      ...el,
      createdAt: el.createdAt.toISOString(),
      updatedAt: el.updatedAt.toISOString(),
    }));

    return { boards: serializedBoards };
  } catch {
    return { boards: [], error: 'Unable to load boards' };
  }
}
