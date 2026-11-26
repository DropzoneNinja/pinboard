const authorSelect = { select: { id: true, displayName: true, authorColour: true } } as const;

/** Shared Prisma `include` so every note the API returns carries resolved author info. */
export const noteInclude = {
  creator: authorSelect,
  updater: authorSelect,
} as const;
