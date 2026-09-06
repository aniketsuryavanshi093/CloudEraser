import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { getBoard } from '../db/boards';
import { verifyToken } from '../middleware/verifyToken';

export interface DrawOperation {
  id: string;
  type: string;
  payload: unknown;
}

interface JoinBoardPayload {
  boardId: string;
}

interface SocketData {
  userId: string;
  email?: string;
  boardId?: string;
}

export async function createSocketServer(httpServer: HttpServer): Promise<Server<never, never, never, SocketData>> {
  const io = new Server<never, never, never, SocketData>(httpServer, {
    cors: {
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (error) => console.error('Redis publisher error', error));
    subClient.on('error', (error) => console.error('Redis subscriber error', error));
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

  io.on('connection', (socket) => {
    socket.on('join-board', async (payload: JoinBoardPayload, acknowledge?: (response: unknown) => void) => {
      try {
        if (!payload?.boardId) throw new Error('boardId is required');
        await getBoard(payload.boardId, socket.data.userId);

        if (socket.data.boardId) {
          socket.leave(socket.data.boardId);
        }
        socket.join(payload.boardId);
        socket.data.boardId = payload.boardId;

        socket.to(payload.boardId).emit('user-joined', {
          userId: socket.data.userId,
          email: socket.data.email,
        });
        acknowledge?.({ ok: true, boardId: payload.boardId });
      } catch {
        acknowledge?.({ ok: false, error: 'Board access denied' });
      }
    });

    socket.on('draw-op', (operation: DrawOperation, acknowledge?: (response: unknown) => void) => {
      const boardId = socket.data.boardId;
      if (!boardId || !operation?.id || !operation.type) {
        acknowledge?.({ ok: false, error: 'Invalid drawing operation' });
        return;
      }

      socket.to(boardId).emit('draw-op', {
        operation,
        userId: socket.data.userId,
      });
      acknowledge?.({ ok: true, operationId: operation.id });
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
      }
    });
  });

  return io;
}
