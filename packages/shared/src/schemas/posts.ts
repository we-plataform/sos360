import { z } from 'zod';
import { platformSchema, paginationSchema } from './index';

// Post data schema for creating/importing posts
export const postDataSchema = z.object({
  platform: platformSchema,
  postUrl: z.string().url(),
  content: z.string().max(5000).nullable().optional(),
  imageUrls: z.array(z.string().url()).default([]),
  videoUrls: z.array(z.string().url()).default([]),
  linkedUrl: z.string().url().nullable().optional(),
  postType: z.string().max(50).nullable().optional(), // post, reel, story, article, share
  likesCount: z.number().int().min(0).nullable().optional(),
  commentsCount: z.number().int().min(0).nullable().optional(),
  sharesCount: z.number().int().min(0).nullable().optional(),
  viewsCount: z.number().int().min(0).nullable().optional(),
  authorUsername: z.string().min(1).max(100),
  authorFullName: z.string().max(200).nullable().optional(),
  authorAvatarUrl: z.string().url().nullable().optional(),
  authorProfileUrl: z.string().url().nullable().optional(),
  postDate: z.string().datetime().nullable().optional(),
});

// Schema for importing posts in batch
export const importPostsSchema = z.object({
  source: z.enum(['extension', 'manual']),
  platform: platformSchema,
  posts: z.array(postDataSchema.omit({ platform: true })).min(1).max(100),
  tags: z.array(z.string()).optional(),
});

// Schema for creating a single post
export const createPostSchema = postDataSchema;

// Schema for updating a post
export const updatePostSchema = z.object({
  content: z.string().max(5000).nullable().optional(),
  postType: z.string().max(50).nullable().optional(),
  likesCount: z.number().int().min(0).nullable().optional(),
  commentsCount: z.number().int().min(0).nullable().optional(),
  sharesCount: z.number().int().min(0).nullable().optional(),
  viewsCount: z.number().int().min(0).nullable().optional(),
  postDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

// Schema for linking a post to a lead
export const linkPostToLeadSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
});

// Post filters for listing
export const postFiltersSchema = paginationSchema.extend({
  platform: platformSchema.optional(),
  authorUsername: z.string().max(100).optional(),
  leadId: z.string().optional(),
  hasLead: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['importedAt', 'postDate', 'likesCount', 'commentsCount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// Type exports
export type PostData = z.infer<typeof postDataSchema>;
export type ImportPosts = z.infer<typeof importPostsSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
export type LinkPostToLead = z.infer<typeof linkPostToLeadSchema>;
export type PostFilters = z.infer<typeof postFiltersSchema>;
