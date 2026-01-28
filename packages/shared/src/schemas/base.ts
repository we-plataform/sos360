import { z } from "zod";
import { PLATFORMS } from "../constants";

// Platform schema
export const platformSchema = z.enum(PLATFORMS);

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
