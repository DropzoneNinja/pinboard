import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../services/logger.js';
import { authenticateUpgrade } from './auth.js';
import type { PresenceUser, ServerMessage } from './types.js';

const WS_PATH = '/api/v1/ws';
const HEARTBEAT_INTERVAL_MS = 30_000;

interface ConnectionState {
  socket: WebSocket;
  user: PresenceUser;
  boardId: string | null;
  isAlive: boolean;
}

export interface WsHub {
  broadcastGlobal(message: ServerMessage): void;
  broadcastToBoard(boardId: string, message: ServerMessage): void;
  shutdown(): void;
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function initWebSocket(httpServer: HttpServer): WsHub {
  const wss = new WebSocketServer({ noServer: true });
  const connections = new Set<ConnectionState>();
  // boardId -> connections currently joined to that board's room
  const rooms = new Map<string, Set<ConnectionState>>();

  function presenceFor(boardId: string): PresenceUser[] {
    const room = rooms.get(boardId);
    if (!room) return [];
    const byUser = new Map<string, PresenceUser>();
    for (const conn of room) byUser.set(conn.user.userId, conn.user);
    return [...byUser.values()];
  }

  function broadcastPresence(boardId: string): void {
    const message: ServerMessage = { type: 'presence', boardId, users: presenceFor(boardId) };
    for (const conn of rooms.get(boardId) ?? []) send(conn.socket, message);
  }

  function joinBoard(conn: ConnectionState, boardId: string): void {
    if (conn.boardId === boardId) return;
    leaveBoard(conn);
    conn.boardId = boardId;
    let room = rooms.get(boardId);
    if (!room) {
      room = new Set();
      rooms.set(boardId, room);
    }
    room.add(conn);
    broadcastPresence(boardId);
  }

  function leaveBoard(conn: ConnectionState): void {
    if (!conn.boardId) return;
    const boardId = conn.boardId;
    const room = rooms.get(boardId);
    room?.delete(conn);
    conn.boardId = null;
    if (room && room.size === 0) {
      rooms.delete(boardId);
    } else if (room) {
      broadcastPresence(boardId);
    }
  }

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://internal');
    if (url.pathname !== WS_PATH) {
      // Not ours — leave it for any other upgrade listener, otherwise reject.
      return;
    }

    authenticateUpgrade(req)
      .then((auth) => {
        if (!auth) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, auth);
        });
      })
      .catch((err) => {
        logger.error('WebSocket auth error', { err });
        socket.destroy();
      });
  });

  wss.on(
    'connection',
    (socket: WebSocket, auth: { userId: string; displayName: string; authorColour: string }) => {
      const conn: ConnectionState = {
        socket,
        user: {
          userId: auth.userId,
          displayName: auth.displayName,
          authorColour: auth.authorColour,
        },
        boardId: null,
        isAlive: true,
      };
      connections.add(conn);

      socket.on('pong', () => {
        conn.isAlive = true;
      });

      socket.on('message', (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (typeof parsed !== 'object' || parsed === null) return;
        const msg = parsed as { type?: unknown; boardId?: unknown };
        if (typeof msg.boardId !== 'string') return;
        if (msg.type === 'join') joinBoard(conn, msg.boardId);
        else if (msg.type === 'leave' && conn.boardId === msg.boardId) leaveBoard(conn);
      });

      socket.on('close', () => {
        leaveBoard(conn);
        connections.delete(conn);
      });

      socket.on('error', (err) => {
        logger.warn('WebSocket connection error', { err });
      });
    },
  );

  // Periodically drop dead connections (e.g. a laptop that went to sleep without a clean close).
  const heartbeat = setInterval(() => {
    for (const conn of connections) {
      if (!conn.isAlive) {
        conn.socket.terminate();
        continue;
      }
      conn.isAlive = false;
      conn.socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    broadcastGlobal(message) {
      for (const conn of connections) send(conn.socket, message);
    },
    broadcastToBoard(boardId, message) {
      for (const conn of rooms.get(boardId) ?? []) send(conn.socket, message);
    },
    shutdown() {
      clearInterval(heartbeat);
      for (const conn of connections) conn.socket.close();
      wss.close();
    },
  };
}

let hub: WsHub | null = null;

export function setWsHub(instance: WsHub): void {
  hub = instance;
}

/** Routes call this to broadcast; safe to call before the server is ready (no-op then). */
export function getWsHub(): WsHub {
  return (
    hub ?? {
      broadcastGlobal: () => {},
      broadcastToBoard: () => {},
      shutdown: () => {},
    }
  );
}
