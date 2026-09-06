export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/** Serializable board shape returned to the web application. */
export interface BoardListItem {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
