/**
 * Vitest setup file - runs before all tests
 * This ensures database is mocked before any module imports
 */

import { vi } from 'vitest';

// Mock the database module BEFORE any imports
vi.mock('@lia360/database', () => ({
  prisma: {
    lead: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leadTag: {
      createMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    importJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
    scoringConfig: {
      findUnique: vi.fn(),
    },
  },
}));
