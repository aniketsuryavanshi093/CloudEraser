import { Socket } from "socket.io-client";

interface BoardSnapshot { objects?: Record<string, any>; background?: string }
interface DrawOperation { id: string; type: 'canvas-op'; payload: any[]; version?: number }
interface RemoteOperation { operation: DrawOperation; userId?: string; version: number | null }
interface PresenceUser { userId: string; email?: string }
interface SocketEvents {
  'board-snapshot': (payload: { data: BoardSnapshot; version: number | null }) => void;
  'draw-op': (payload: RemoteOperation) => void;
  'user-joined': (payload: PresenceUser) => void;
  'user-left': (payload: { userId: string }) => void;
  presence: (payload: { users: PresenceUser[] }) => void;
  'cursor-move': (payload: { userId: string; x: number; y: number }) => void;
}
interface ServerEvents {
  'join-board': (payload: { boardId: string }, callback?: (response: { ok: boolean; error?: string }) => void) => void;
  'resync-board': (payload: { boardId: string }, callback?: (response: { ok: boolean; error?: string }) => void) => void;
  'draw-op': (operation: DrawOperation, callback?: (response: { ok: boolean; error?: string; operationId?: string }) => void) => void;
  'cursor-move': (position: { x: number; y: number }) => void;
}
type BoardSocket = Socket<SocketEvents, ServerEvents>;
type Tool = 'select' | 'pencil' | 'rectangle' | 'circle' | 'line' | 'text';
export type { BoardSocket, Tool };
export type { BoardSnapshot, DrawOperation, RemoteOperation, PresenceUser, SocketEvents, ServerEvents };