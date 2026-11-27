import type { PresenceUser } from '../services/types';

export function PresenceIndicator({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="presence">
      {users.map((u) => (
        <span
          key={u.userId}
          className="presence__dot"
          style={{ background: u.authorColour }}
          title={`${u.displayName} is viewing this board`}
        >
          {u.displayName.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  );
}
