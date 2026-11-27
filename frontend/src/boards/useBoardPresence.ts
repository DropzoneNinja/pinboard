import { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import type { PresenceUser } from '../services/types';

/**
 * Which other user(s) currently have this board open. Joining/leaving the socket room is owned
 * by useBoardNotes (always mounted alongside this for the same board) — this just listens.
 */
export function useBoardPresence(boardId: string | undefined): PresenceUser[] {
  const { subscribe } = useSocket();
  const { user } = useAuth();
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    setOthers([]);
  }, [boardId]);

  useEffect(() => {
    return subscribe((message) => {
      if (message.type === 'presence' && message.boardId === boardId) {
        setOthers(message.users.filter((u) => u.userId !== user?.id));
      }
    });
  }, [subscribe, boardId, user?.id]);

  return others;
}
