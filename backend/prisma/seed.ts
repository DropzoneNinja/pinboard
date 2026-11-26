import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

interface SeedUser {
  username: string;
  password: string;
  displayName: string;
  authorColour: string;
}

function readSeedUsers(): SeedUser[] {
  const users: SeedUser[] = [];
  for (const n of [1, 2]) {
    const username = process.env[`SEED_USER${n}_USERNAME`];
    const password = process.env[`SEED_USER${n}_PASSWORD`];
    const displayName = process.env[`SEED_USER${n}_DISPLAY_NAME`];
    const authorColour = process.env[`SEED_USER${n}_COLOUR`];
    if (username && password && displayName && authorColour) {
      users.push({ username, password, displayName, authorColour });
    }
  }
  return users;
}

async function main() {
  const seedUsers = readSeedUsers();
  if (seedUsers.length === 0) {
    console.log('[seed] No SEED_USER*_USERNAME/PASSWORD env vars set — skipping user seeding.');
  }

  const createdUsers = [];
  for (const seedUser of seedUsers) {
    const existing = await prisma.user.findUnique({ where: { username: seedUser.username } });
    if (existing) {
      console.log(`[seed] User "${seedUser.username}" already exists — leaving as-is.`);
      createdUsers.push(existing);
      continue;
    }
    const passwordHash = await argon2.hash(seedUser.password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        username: seedUser.username,
        passwordHash,
        displayName: seedUser.displayName,
        authorColour: seedUser.authorColour,
      },
    });
    console.log(`[seed] Created user "${user.username}".`);
    createdUsers.push(user);
  }

  const boardCount = await prisma.board.count();
  if (boardCount === 0 && createdUsers.length > 0) {
    const board = await prisma.board.create({
      data: {
        name: 'Household',
        createdBy: createdUsers[0]!.id,
      },
    });
    console.log(`[seed] Created initial board "${board.name}".`);
  } else if (boardCount === 0) {
    console.log('[seed] No boards exist yet, but no seed users were created to own one — skipping.');
  } else {
    console.log('[seed] Boards already exist — not creating the default board.');
  }
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
