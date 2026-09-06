/**
 * apps/server/src/db/index.ts
 *
 * Central export point for all server-side database helpers.
 */

export {
  createBoard,
  getBoard,
  listBoardsForUser,
  updateBoardTitle,
  getSnapshot,
  upsertSnapshot,
  addBoardMember,
  removeBoardMember,
} from './boards';

export type {
  Board,
  BoardSnapshot,
  BoardMember,
  BoardRole,
} from './boards';
