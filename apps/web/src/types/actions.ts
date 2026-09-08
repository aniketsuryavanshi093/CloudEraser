import type { BoardListItem } from './board';

export interface ListBoardsResult {
  boards: BoardListItem[];
  error?: string;
}

export interface CreateBoardResult {
  board?: BoardListItem;
  error?: string;
}

export interface UpdateBoardTitleResult {
  title?: string;
  error?: string;
}
