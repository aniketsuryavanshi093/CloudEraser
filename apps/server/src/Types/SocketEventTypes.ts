interface DrawOperation {
  id: string;
  type: "canvas-op";
  payload: unknown;
  version?: number;
}

export interface JoinBoardPayload {
  boardId: string;
}

export interface JoinBoardResponse {
  ok: boolean;
  boardId?: string;
  error?: string;
}

export interface OperationResponse {
  ok: boolean;
  operationId?: string;
  error?: string;
}

export interface ServerToClientEvents {
  "user-joined": (payload: { userId: string; email?: string }) => void;
  "user-left": (payload: { userId: string }) => void;
  presence: (payload: {
    users: Array<{ userId: string; email?: string }>;
  }) => void;
  "board-snapshot": (payload: {
    boardId: string;
    data: unknown;
    version: number | null;
  }) => void;
  "draw-op": (payload: {
    operation: DrawOperation;
    userId?: string;
    version: number | null;
  }) => void;
  "cursor-move": (payload: { userId: string; x: number; y: number }) => void;
}

export interface ClientToServerEvents {
  "join-board": (
    payload: JoinBoardPayload,
    acknowledge?: (response: JoinBoardResponse) => void,
  ) => void;
  "resync-board": (
    payload: { boardId: string },
    acknowledge?: (response: JoinBoardResponse) => void,
  ) => void;
  "draw-op": (
    operation: DrawOperation,
    acknowledge?: (response: OperationResponse) => void,
  ) => void;
  "cursor-move": (position: { x: number; y: number }) => void;
}

export interface SocketData {
  userId: string;
  email?: string;
  boardId?: string;
}

export { DrawOperation };
