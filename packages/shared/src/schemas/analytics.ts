import { z } from 'zod';
import { PLATFORMS, LEAD_STATUSES } from '../constants';

// Common analytics query schemas
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const platformFilterSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Overview endpoint schemas
export const analyticsOverviewQuerySchema = dateRangeSchema
  .merge(platformFilterSchema)
  .extend({
    compareWithPrevious: z.boolean().optional(),
  });

// Funnel endpoint schemas
export const analyticsFunnelQuerySchema = platformFilterSchema.extend({
  pipelineId: z.string().optional(),
});

// Timeline/Trends endpoint schemas
export const analyticsIntervalSchema = z.enum(['day', 'week', 'month']);
export const analyticsMetricSchema = z.enum([
  'leads',
  'conversations',
  'messages',
  'emails_sent',
  'emails_opened',
  'emails_replied',
  'conversions',
]);

export const analyticsTimelineQuerySchema = dateRangeSchema.extend({
  interval: analyticsIntervalSchema.optional(),
  metric: analyticsMetricSchema.optional(),
  platform: z.enum(PLATFORMS).optional(),
});

// Pipeline Velocity endpoint schemas
export const analyticsVelocityQuerySchema = dateRangeSchema
  .extend({
    pipelineId: z.string().optional(),
    stageId: z.string().optional(),
    includeConversions: z.boolean().optional(),
  })
  .merge(platformFilterSchema);

// Team Performance endpoint schemas
export const analyticsPerformanceQuerySchema = dateRangeSchema
  .extend({
    userId: z.string().optional(),
    includeTeamAverage: z.boolean().optional(),
    metrics: z.array(analyticsMetricSchema).optional(),
  })
  .merge(platformFilterSchema);

// Export endpoint schemas
export const analyticsExportFormatSchema = z.enum(['csv', 'pdf', 'json']);
export const analyticsExportTypeSchema = z.enum([
  'overview',
  'funnel',
  'velocity',
  'performance',
  'trends',
  'leads',
  'conversations',
]);

export const analyticsExportQuerySchema = dateRangeSchema.extend({
  format: analyticsExportFormatSchema,
  type: analyticsExportTypeSchema,
  platform: z.enum(PLATFORMS).optional(),
  includeCharts: z.boolean().optional(),
});

// Enhanced Trends endpoint with drill-down support
export const analyticsTrendsQuerySchema = analyticsTimelineQuerySchema.extend({
  groupBy: z.enum(['status', 'platform', 'source', 'assigned_to']).optional(),
  drillDownStage: z.enum(LEAD_STATUSES).optional(),
  drillDownPlatform: z.enum(PLATFORMS).optional(),
  minCount: z.coerce.number().int().min(0).optional(),
});

// Response schemas for type validation

// Overview response
export const analyticsOverviewResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    period: z.object({
      start: z.string(),
      end: z.string(),
    }),
    leads: z.object({
      total: z.number(),
      new: z.number(),
      growth: z.number(),
    }),
    conversations: z.object({
      total: z.number(),
      started: z.number(),
      responseRate: z.number(),
    }),
    byPlatform: z.record(z.number()),
    byStatus: z.record(z.number()),
  }),
});

// Funnel response
export const analyticsFunnelResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    stages: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
        rate: z.number(),
      })
    ),
    conversionRates: z.record(z.number()),
  }),
});

// Timeline/Trends response
export const analyticsTimelineResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    interval: analyticsIntervalSchema,
    metric: analyticsMetricSchema,
    points: z.array(
      z.object({
        date: z.string(),
        value: z.number(),
      })
    ),
  }),
});

// Velocity response
export const analyticsVelocityResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    stages: z.array(
      z.object({
        stageId: z.string(),
        stageName: z.string(),
        avgDuration: z.number(),
        leadCount: z.number(),
        conversionRate: z.number(),
      })
    ),
    overallVelocity: z.number(),
    bottleneck: z
      .object({
        stageId: z.string(),
        stageName: z.string(),
        avgDuration: z.number(),
      })
      .nullable(),
  }),
});

// Performance response
export const analyticsPerformanceResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    users: z.array(
      z.object({
        userId: z.string(),
        userName: z.string(),
        metrics: z.record(z.number()),
      })
    ),
    teamAverage: z.record(z.number()).optional(),
    period: z.object({
      start: z.string(),
      end: z.string(),
    }),
  }),
});

// Export response
export const analyticsExportResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([
    z.string(), // File content for CSV/JSON
    z.object({
      downloadUrl: z.string(),
      expiresAt: z.string(),
    }), // Download URL for PDF
  ]),
});

// Enhanced trends response
export const analyticsTrendsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    metric: analyticsMetricSchema,
    interval: analyticsIntervalSchema,
    points: z.array(
      z.object({
        date: z.string(),
        value: z.number(),
        breakdown: z
          .record(
            z.array(
              z.object({
                label: z.string(),
                value: z.number(),
              })
            )
          )
          .optional(),
      })
    ),
    summary: z.object({
      total: z.number(),
      trend: z.enum(['up', 'down', 'stable']),
      changePercent: z.number(),
    }),
  }),
});
