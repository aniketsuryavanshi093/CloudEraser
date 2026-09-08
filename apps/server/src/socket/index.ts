import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { getBoard, getSnapshot, upsertSnapshot } from '../db/boards';
import { verifyToken } from '../middleware/verifyToken';
import { getCanvasDocument, submitCanvasOperation } from '../ot/sharedb';
import { ClientToServerEvents, DrawOperation, JoinBoardPayload, JoinBoardResponse, OperationResponse, ServerToClientEvents, SocketData } from '../Types/SocketEventTypes';


export async function createSocketServer(
  httpServer: HttpServer,
): Promise<Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (error: Error) => console.error('Redis publisher error', error));
    subClient.on('error', (error: Error) => console.error('Redis subscriber error', error));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter enabled');
  } else {
    console.warn('REDIS_URL is not configured; using the in-memory Socket.IO adapter');
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const verified = await verifyToken(typeof token === 'string' ? token : '');
      socket.data.userId = verified.sub;
      socket.data.email = typeof verified.email === 'string' ? verified.email : undefined;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  const wiredDocuments = new Set<string>();
  const boardUsers = new Map<string, Map<string, { userId: string; email?: string }>>();
  const snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const snapshotIntervals = new Map<string, ReturnType<typeof setInterval>>();

  const persistBoardSnapshot = async (boardId: string, userId: string) => {
    const document = await getCanvasDocument(boardId);
    await upsertSnapshot(boardId, userId, document.data as never);
  };

  const scheduleSnapshot = (boardId: string, userId: string) => {
    const oldTimer = snapshotTimers.get(boardId);
    if (oldTimer) clearTimeout(oldTimer);
    snapshotTimers.set(boardId, setTimeout(() => {
      snapshotTimers.delete(boardId);
      void persistBoardSnapshot(boardId, userId).catch((error: unknown) => console.error('Snapshot persistence failed', error));
    }, 1500));
    if (!snapshotIntervals.has(boardId)) {
      snapshotIntervals.set(boardId, setInterval(() => {
        void persistBoardSnapshot(boardId, userId).catch((error: unknown) => console.error('Periodic snapshot failed', error));
      }, 30000));
    }
  };

  const emitPresence = (boardId: string) => {
    io.to(boardId).emit('presence', {
      users: Array.from(boardUsers.get(boardId)?.values() ?? []),
    });
  };

  io.on('connection', (socket) => {
    socket.on('join-board', async (payload: JoinBoardPayload, acknowledge?: (response: JoinBoardResponse) => void) => {
      try {
        if (!payload?.boardId) throw new Error('boardId is required');
        await getBoard(payload.boardId, socket.data.userId);
        const persisted = await getSnapshot(payload.boardId, socket.data.userId);
        const document = await getCanvasDocument(payload.boardId, (persisted?.state ?? undefined) as { objects: Record<string, unknown>; background?: string } | undefined);

        if (!wiredDocuments.has(payload.boardId)) {
          wiredDocuments.add(payload.boardId);
          document.on('op', (operation: unknown, source: unknown) => {
            io.to(payload.boardId).emit('draw-op', {
              operation: {
                id: `server-${document.version ?? 0}`,
                type: 'canvas-op',
                payload: operation,
                version: document.version ?? undefined,
              },
              userId: typeof source === 'string' ? source : undefined,
              version: document.version,
            });
          });
        }

        if (socket.data.boardId) {
          socket.leave(socket.data.boardId);
        }
        socket.join(payload.boardId);
        socket.data.boardId = payload.boardId;
        let users = boardUsers.get(payload.boardId);
        if (!users) {
          users = new Map();
          boardUsers.set(payload.boardId, users);
        }
        users.set(socket.id, { userId: socket.data.userId, email: socket.data.email });
        socket.emit('board-snapshot', {
          boardId: payload.boardId,
          data: document.data,
          version: document.version,
        });

        socket.to(payload.boardId).emit('user-joined', {
          userId: socket.data.userId,
          email: socket.data.email,
        });
        emitPresence(payload.boardId);
        scheduleSnapshot(payload.boardId, socket.data.userId);
        acknowledge?.({ ok: true, boardId: payload.boardId });
      } catch {
        acknowledge?.({ ok: false, error: 'Board access denied' });
      }
    });

    socket.on('draw-op', (operation: DrawOperation, acknowledge?: (response: OperationResponse) => void) => {
      const boardId = socket.data.boardId;
      if (!boardId || !operation?.id || !operation.type) {
        acknowledge?.({ ok: false, error: 'Invalid drawing operation' });
        return;
      }

      void getCanvasDocument(boardId)
        .then((document) => submitCanvasOperation(document, operation.payload, socket.data.userId))
        .then(() => {
          scheduleSnapshot(boardId, socket.data.userId);
          acknowledge?.({ ok: true, operationId: operation.id });
        })
        .catch(() => acknowledge?.({ ok: false, error: 'Operation rejected' }));
    });

    socket.on('resync-board', async (payload, acknowledge) => {
      try {
        if (!payload?.boardId || payload.boardId !== socket.data.boardId) throw new Error('Invalid board');
        await getBoard(payload.boardId, socket.data.userId);
        const document = await getCanvasDocument(payload.boardId);
        socket.emit('board-snapshot', { boardId: payload.boardId, data: document.data, version: document.version });
        acknowledge?.({ ok: true, boardId: payload.boardId });
      } catch {
        acknowledge?.({ ok: false, error: 'Unable to resynchronize board' });
      }
    });

    socket.on('cursor-move', (position: { x: number; y: number }) => {
      const boardId = socket.data.boardId;
      if (!boardId || !Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
      socket.to(boardId).emit('cursor-move', {
        userId: socket.data.userId,
        x: position.x,
        y: position.y,
      });
    });

    socket.on('disconnect', () => {
      const boardId = socket.data.boardId;
      if (boardId) {
        socket.to(boardId).emit('user-left', { userId: socket.data.userId });
        const users = boardUsers.get(boardId);
        users?.delete(socket.id);
        if (users && users.size === 0) boardUsers.delete(boardId);
        emitPresence(boardId);
        const timer = snapshotTimers.get(boardId);
        if (timer) clearTimeout(timer);
        snapshotTimers.delete(boardId);
        const interval = snapshotIntervals.get(boardId);
        if (interval) clearInterval(interval);
        snapshotIntervals.delete(boardId);
      }
    });
  });

  return io;
}
