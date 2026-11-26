import type { User } from '@prisma/client';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  authorColour: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    authorColour: user.authorColour,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
