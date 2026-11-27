import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { ServerMessage } from '../services/wsTypes';

type MessageHandler = (message: ServerMessage) => void;
type ReconnectHandler = () => void;

interface SocketContextValue {
  joinBoard: (boardId: string) => void;
  leaveBoard: (boardId: string) => void;
  subscribe: (handler: MessageHandler) => () => void;
  onReconnect: (handler: ReconnectHandler) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const MAX_BACKOFF_MS = 10_000;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const joinedBoardRef = useRef<string | null>(null);
  const listenersRef = useRef(new Set<MessageHandler>());
  const reconnectListenersRef = useRef(new Set<ReconnectHandler>());
  const hasConnectedOnceRef = useRef(false);
  const backoffRef = useRef(1000);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const closedByUsRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    closedByUsRef.current = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        backoffRef.current = 1000;
        if (joinedBoardRef.current) {
          socket.send(JSON.stringify({ type: 'join', boardId: joinedBoardRef.current }));
        }
        if (hasConnectedOnceRef.current) {
          for (const handler of reconnectListenersRef.current) handler();
        }
        hasConnectedOnceRef.current = true;
      };

      socket.onmessage = (event) => {
        let parsed: ServerMessage;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        for (const handler of listenersRef.current) handler(parsed);
      };

      socket.onclose = () => {
        if (closedByUsRef.current) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      hasConnectedOnceRef.current = false;
    };
  }, [user]);

  const value = useMemo<SocketContextValue>(
    () => ({
      joinBoard(boardId) {
        joinedBoardRef.current = boardId;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'join', boardId }));
        }
      },
      leaveBoard(boardId) {
        if (joinedBoardRef.current === boardId) joinedBoardRef.current = null;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'leave', boardId }));
        }
      },
      subscribe(handler) {
        listenersRef.current.add(handler);
        return () => listenersRef.current.delete(handler);
      },
      onReconnect(handler) {
        reconnectListenersRef.current.add(handler);
        return () => reconnectListenersRef.current.delete(handler);
      },
    }),
    [],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
}
