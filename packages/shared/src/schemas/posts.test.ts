import { describe, it, expect } from 'vitest';
import {
  postDataSchema,
  importPostsSchema,
  createPostSchema,
  updatePostSchema,
  linkPostToLeadSchema,
  postFiltersSchema,
} from './posts';

describe('Post Data Schema', () => {
  describe('Required Fields', () => {
    it('accepts valid post data with all required fields', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(true);
    });

    it('rejects post data without platform', () => {
      const result = postDataSchema.safeParse({
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(false);
    });

    it('rejects post data without postUrl', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(false);
    });

    it('rejects post data without authorUsername', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
      });

      expect(result.success).toBe(false);
    });

    it('rejects empty authorUsername', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Platform Validation', () => {
    it('accepts valid platform values', () => {
      const platforms = [
        'instagram',
        'facebook',
        'linkedin',
        'twitter',
        'tiktok',
        'whatsapp',
        'telegram',
        'discord',
        'reddit',
        'skool',
        'slack',
        'pinterest',
        'youtube',
        'nextdoor',
        'gohighlevel',
        'other',
      ];

      platforms.forEach((platform) => {
        const result = postDataSchema.safeParse({
          platform,
          postUrl: 'https://example.com/posts/123',
          authorUsername: 'johndoe',
        });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid platform value', () => {
      const result = postDataSchema.safeParse({
        platform: 'invalid-platform',
        postUrl: 'https://example.com/posts/123',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('accepts valid URLs', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        videoUrls: ['https://example.com/video1.mp4'],
        linkedUrl: 'https://example.com/article',
        authorAvatarUrl: 'https://example.com/avatar.jpg',
        authorProfileUrl: 'https://linkedin.com/in/johndoe',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid postUrl', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'not-a-url',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid URL in imageUrls', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        imageUrls: ['https://example.com/image.jpg', 'not-a-url'],
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid URL in videoUrls', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        videoUrls: ['not-a-url'],
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid linkedUrl', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        linkedUrl: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Array Field Defaults', () => {
    it('uses default empty array for imageUrls when not provided', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toEqual([]);
      }
    });

    it('uses default empty array for videoUrls when not provided', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoUrls).toEqual([]);
      }
    });
  });

  describe('String Length Validation', () => {
    it('accepts content within max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        content: 'a'.repeat(5000),
      });

      expect(result.success).toBe(true);
    });

    it('rejects content exceeding max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        content: 'a'.repeat(5001),
      });

      expect(result.success).toBe(false);
    });

    it('accepts null for optional content', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        content: null,
      });

      expect(result.success).toBe(true);
    });

    it('accepts postType within max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        postType: 'a'.repeat(50),
      });

      expect(result.success).toBe(true);
    });

    it('rejects postType exceeding max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        postType: 'a'.repeat(51),
      });

      expect(result.success).toBe(false);
    });

    it('accepts authorUsername within max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'a'.repeat(100),
      });

      expect(result.success).toBe(true);
    });

    it('rejects authorUsername exceeding max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it('accepts authorFullName within max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        authorFullName: 'a'.repeat(200),
      });

      expect(result.success).toBe(true);
    });

    it('rejects authorFullName exceeding max length', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        authorFullName: 'a'.repeat(201),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Count Fields Validation', () => {
    it('accepts zero counts', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
      });

      expect(result.success).toBe(true);
    });

    it('accepts positive integer counts', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        likesCount: 100,
        commentsCount: 50,
        sharesCount: 25,
        viewsCount: 1000,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative counts', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        likesCount: -1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer counts', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        likesCount: 10.5,
      });

      expect(result.success).toBe(false);
    });

    it('accepts null for optional count fields', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        likesCount: null,
        commentsCount: null,
        sharesCount: null,
        viewsCount: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Datetime Validation', () => {
    it('accepts valid datetime string', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        postDate: '2024-01-15T10:30:00Z',
      });

      expect(result.success).toBe(true);
    });

    it('accepts null for optional postDate', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        postDate: null,
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid datetime string', () => {
      const result = postDataSchema.safeParse({
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        authorUsername: 'johndoe',
        postDate: 'not-a-datetime',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Import Posts Schema', () => {
  describe('Valid Import', () => {
    it('accepts valid import with extension source', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: [
          {
            postUrl: 'https://linkedin.com/posts/123',
            authorUsername: 'johndoe',
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid import with manual source', () => {
      const result = importPostsSchema.safeParse({
        source: 'manual',
        platform: 'instagram',
        posts: [
          {
            postUrl: 'https://instagram.com/p/123',
            authorUsername: 'janedoe',
            content: 'Test post',
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('accepts import with tags', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: [
          {
            postUrl: 'https://linkedin.com/posts/123',
            authorUsername: 'johndoe',
          },
        ],
        tags: ['tag1', 'tag2', 'tag3'],
      });

      expect(result.success).toBe(true);
    });

    it('accepts import with multiple posts', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: Array.from({ length: 50 }, (_, i) => ({
          postUrl: `https://linkedin.com/posts/${i}`,
          authorUsername: `user${i}`,
        })),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Source Validation', () => {
    it('rejects invalid source value', () => {
      const result = importPostsSchema.safeParse({
        source: 'invalid',
        platform: 'linkedin',
        posts: [
          {
            postUrl: 'https://linkedin.com/posts/123',
            authorUsername: 'johndoe',
          },
        ],
      });

      expect(result.success).toBe(false);
    });

    it('rejects missing source', () => {
      const result = importPostsSchema.safeParse({
        platform: 'linkedin',
        posts: [
          {
            postUrl: 'https://linkedin.com/posts/123',
            authorUsername: 'johndoe',
          },
        ],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Posts Array Validation', () => {
    it('rejects empty posts array', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: [],
      });

      expect(result.success).toBe(false);
    });

    it('rejects posts array exceeding maximum', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: Array.from({ length: 101 }, (_, i) => ({
          postUrl: `https://linkedin.com/posts/${i}`,
          authorUsername: `user${i}`,
        })),
      });

      expect(result.success).toBe(false);
    });

    it('accepts posts array at maximum boundary', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: Array.from({ length: 100 }, (_, i) => ({
          postUrl: `https://linkedin.com/posts/${i}`,
          authorUsername: `user${i}`,
        })),
      });

      expect(result.success).toBe(true);
    });

    it('rejects non-array posts', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: 'not-an-array',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Platform in Posts', () => {
    it('omits platform field from individual posts', () => {
      const result = importPostsSchema.safeParse({
        source: 'extension',
        platform: 'linkedin',
        posts: [
          {
            postUrl: 'https://linkedin.com/posts/123',
            authorUsername: 'johndoe',
            platform: 'linkedin', // This should be omitted/ignored
          },
        ],
      });

      // The schema uses .omit({ platform: true }), so platform in posts is not required
      // If included, it should be accepted since Zod omit removes it from validation
      expect(result.success).toBe(true);
    });
  });
});

describe('Create Post Schema', () => {
  it('is identical to postDataSchema', () => {
    const result1 = createPostSchema.safeParse({
      platform: 'linkedin',
      postUrl: 'https://linkedin.com/posts/123',
      authorUsername: 'johndoe',
    });

    const result2 = postDataSchema.safeParse({
      platform: 'linkedin',
      postUrl: 'https://linkedin.com/posts/123',
      authorUsername: 'johndoe',
    });

    expect(result1.success).toBe(result2.success);
  });
});

describe('Update Post Schema', () => {
  describe('Partial Updates', () => {
    it('accepts empty update object', () => {
      const result = updatePostSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it('accepts updating content only', () => {
      const result = updatePostSchema.safeParse({
        content: 'Updated content',
      });

      expect(result.success).toBe(true);
    });

    it('accepts updating counts only', () => {
      const result = updatePostSchema.safeParse({
        likesCount: 100,
        commentsCount: 50,
        sharesCount: 25,
        viewsCount: 1000,
      });

      expect(result.success).toBe(true);
    });

    it('accepts updating all fields', () => {
      const result = updatePostSchema.safeParse({
        content: 'Updated content',
        postType: 'article',
        likesCount: 100,
        commentsCount: 50,
        sharesCount: 25,
        viewsCount: 1000,
        postDate: '2024-01-15T10:30:00Z',
        tags: ['tag1', 'tag2'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Field Type Validation', () => {
    it('rejects invalid content type', () => {
      const result = updatePostSchema.safeParse({
        content: 123,
      });

      expect(result.success).toBe(false);
    });

    it('rejects content exceeding max length', () => {
      const result = updatePostSchema.safeParse({
        content: 'a'.repeat(5001),
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative count values', () => {
      const result = updatePostSchema.safeParse({
        likesCount: -1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer count values', () => {
      const result = updatePostSchema.safeParse({
        likesCount: 10.5,
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid postDate format', () => {
      const result = updatePostSchema.safeParse({
        postDate: 'not-a-datetime',
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-array tags', () => {
      const result = updatePostSchema.safeParse({
        tags: 'not-an-array',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Optional Fields', () => {
    it('accepts null for optional fields', () => {
      const result = updatePostSchema.safeParse({
        content: null,
        postType: null,
        likesCount: null,
        commentsCount: null,
        sharesCount: null,
        viewsCount: null,
        postDate: null,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Link Post to Lead Schema', () => {
  describe('Valid Lead ID', () => {
    it('accepts valid leadId', () => {
      const result = linkPostToLeadSchema.safeParse({
        leadId: 'lead-123',
      });

      expect(result.success).toBe(true);
    });

    it('accepts UUID as leadId', () => {
      const result = linkPostToLeadSchema.safeParse({
        leadId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Lead ID Validation', () => {
    it('rejects missing leadId', () => {
      const result = linkPostToLeadSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        expect(errorMessages).toContain('Required');
      }
    });

    it('rejects empty string leadId', () => {
      const result = linkPostToLeadSchema.safeParse({
        leadId: '',
      });

      expect(result.success).toBe(false);
    });

    it('accepts whitespace-only leadId (schema does not trim)', () => {
      const result = linkPostToLeadSchema.safeParse({
        leadId: '   ',
      });

      // Schema only checks min(1), doesn't trim, so whitespace passes
      expect(result.success).toBe(true);
    });
  });
});

describe('Post Filters Schema', () => {
  describe('Pagination Fields', () => {
    it('accepts valid pagination parameters', () => {
      const result = postFiltersSchema.safeParse({
        page: 1,
        limit: 20,
      });

      expect(result.success).toBe(true);
    });

    it('accepts page at minimum boundary', () => {
      const result = postFiltersSchema.safeParse({
        page: 1,
      });

      expect(result.success).toBe(true);
    });

    it('rejects page below minimum', () => {
      const result = postFiltersSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });

    it('accepts limit at minimum boundary', () => {
      const result = postFiltersSchema.safeParse({
        limit: 1,
      });

      expect(result.success).toBe(true);
    });

    it('accepts limit at maximum boundary', () => {
      const result = postFiltersSchema.safeParse({
        limit: 100,
      });

      expect(result.success).toBe(true);
    });

    it('rejects limit exceeding maximum', () => {
      const result = postFiltersSchema.safeParse({
        limit: 101,
      });

      expect(result.success).toBe(false);
    });

    it('coerces string numbers to integers', () => {
      const result = postFiltersSchema.safeParse({
        page: '2',
        limit: '30',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page).toBe('number');
        expect(typeof result.data.limit).toBe('number');
      }
    });
  });

  describe('Filter Fields', () => {
    it('accepts platform filter', () => {
      const result = postFiltersSchema.safeParse({
        platform: 'linkedin',
      });

      expect(result.success).toBe(true);
    });

    it('accepts authorUsername filter', () => {
      const result = postFiltersSchema.safeParse({
        authorUsername: 'johndoe',
      });

      expect(result.success).toBe(true);
    });

    it('accepts leadId filter', () => {
      const result = postFiltersSchema.safeParse({
        leadId: 'lead-123',
      });

      expect(result.success).toBe(true);
    });

    it('accepts hasLead boolean filter', () => {
      const result = postFiltersSchema.safeParse({
        hasLead: true,
      });

      expect(result.success).toBe(true);
    });

    it('coerces hasLead string to boolean', () => {
      const result = postFiltersSchema.safeParse({
        hasLead: 'true',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.hasLead).toBe('boolean');
      }
    });

    it('accepts search filter', () => {
      const result = postFiltersSchema.safeParse({
        search: 'search term',
      });

      expect(result.success).toBe(true);
    });

    it('rejects search exceeding max length', () => {
      const result = postFiltersSchema.safeParse({
        search: 'a'.repeat(201),
      });

      expect(result.success).toBe(false);
    });

    it('rejects authorUsername exceeding max length', () => {
      const result = postFiltersSchema.safeParse({
        authorUsername: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Sort and Order', () => {
    it('accepts valid sort values', () => {
      const sortValues = ['importedAt', 'postDate', 'likesCount', 'commentsCount'];

      sortValues.forEach((sort) => {
        const result = postFiltersSchema.safeParse({
          sort,
        });

        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid sort value', () => {
      const result = postFiltersSchema.safeParse({
        sort: 'invalidField',
      });

      expect(result.success).toBe(false);
    });

    it('accepts asc order', () => {
      const result = postFiltersSchema.safeParse({
        order: 'asc',
      });

      expect(result.success).toBe(true);
    });

    it('accepts desc order', () => {
      const result = postFiltersSchema.safeParse({
        order: 'desc',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid order value', () => {
      const result = postFiltersSchema.safeParse({
        order: 'invalid',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Complete Filter Query', () => {
    it('accepts complete filter with all fields', () => {
      const result = postFiltersSchema.safeParse({
        page: 2,
        limit: 50,
        platform: 'linkedin',
        authorUsername: 'johndoe',
        leadId: 'lead-123',
        hasLead: true,
        search: 'search term',
        sort: 'likesCount',
        order: 'desc',
      });

      expect(result.success).toBe(true);
    });
  });
});
