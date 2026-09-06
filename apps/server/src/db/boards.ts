import { Prisma, BoardRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export { BoardRole };
export type Board = Prisma.BoardGetPayload<{}>;
export type BoardSnapshot = Prisma.BoardSnapshotGetPayload<{}>;
export type BoardMember = Prisma.BoardMemberGetPayload<{}>;

function requireValue(value: string, name: string) {
  if (!value?.trim()) throw new Error(`${name} is required`);
}

async function assertMember(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  if (!member) throw new Error('Access denied: you are not a member of this board');
  return member;
}

async function assertOwner(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board) throw new Error('Board not found');
  if (board.ownerId !== userId) throw new Error('Access denied: only the board owner can perform this action');
}

export async function createBoard(ownerId: string, title = 'Untitled Board') {
  requireValue(ownerId, 'ownerId');
  const cleanTitle = title.trim() || 'Untitled Board';
  return prisma.board.create({
    data: {
      ownerId,
      title: cleanTitle,
      members: { create: { userId: ownerId, role: BoardRole.OWNER } },
    },
  });
}

export async function getBoard(boardId: string, userId: string) {
  requireValue(boardId, 'boardId');
  requireValue(userId, 'userId');
  await assertMember(boardId, userId);
  return prisma.board.findUniqueOrThrow({ where: { id: boardId } });
}

export function listBoardsForUser(userId: string) {
  requireValue(userId, 'userId');
  return prisma.board.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function updateBoardTitle(boardId: string, userId: string, title: string) {
  requireValue(boardId, 'boardId');
  requireValue(userId, 'userId');
  if (!title?.trim()) throw new Error('title must be a non-empty string');
  await assertOwner(boardId, userId);
  return prisma.board.update({ where: { id: boardId }, data: { title: title.trim() } });
}

export async function getSnapshot(boardId: string, userId: string) {
  requireValue(boardId, 'boardId');
  requireValue(userId, 'userId');
  await assertMember(boardId, userId);
  return prisma.boardSnapshot.findUnique({ where: { boardId } });
}

export async function upsertSnapshot(boardId: string, userId: string, state: Prisma.InputJsonValue) {
  requireValue(boardId, 'boardId');
  requireValue(userId, 'userId');
  const member = await assertMember(boardId, userId);
  if (member.role === BoardRole.VIEWER) throw new Error('Access denied: viewers cannot modify this board');
  return prisma.boardSnapshot.upsert({
    where: { boardId },
    create: { boardId, state },
    update: { state },
  });
}

export async function addBoardMember(boardId: string, ownerId: string, memberUserId: string, role: BoardRole) {
  requireValue(boardId, 'boardId');
  requireValue(ownerId, 'ownerId');
  requireValue(memberUserId, 'memberUserId');
  await assertOwner(boardId, ownerId);
  if (role === BoardRole.OWNER) throw new Error('A board can have only one owner');
  return prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId: memberUserId } },
    create: { boardId, userId: memberUserId, role },
    update: { role },
  });
}

export async function removeBoardMember(boardId: string, ownerId: string, memberUserId: string) {
  requireValue(boardId, 'boardId');
  requireValue(ownerId, 'ownerId');
  requireValue(memberUserId, 'memberUserId');
  if (ownerId === memberUserId) throw new Error('The board owner cannot remove themselves');
  await assertOwner(boardId, ownerId);
  await prisma.boardMember.deleteMany({ where: { boardId, userId: memberUserId } });
}
