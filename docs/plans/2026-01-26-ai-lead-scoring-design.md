# AI-Powered Lead Scoring System - Design Document

**Date:** 2026-01-26
**Status:** Design Approved
**Author:** Claude Code

## Overview

Implement AI-powered lead scoring that automatically analyzes captured profile data to predict lead quality on a 0-100 scale. Each pipeline has its own scoring configuration (ICP model), allowing different sales processes to have different qualification criteria.

## Goals

1. **Automatic Lead Prioritization** - Score leads on import to help sales teams focus on high-value prospects
2. **ICP Customization** - Allow users to define ideal customer profiles per pipeline
3. **Transparent Scoring** - Show users why leads received specific scores
4. **Continuous Improvement** - Re-score as data is enriched or criteria change

## Architecture

### Database Schema

#### New Model: ScoringModel

Defines the scoring criteria and weights for a pipeline.

```prisma
model ScoringModel {
  id              String   @id @default(cuid())
  name            String   // e.g., "Enterprise Sales", "SMB Pipeline"
  description     String?
  enabled         Boolean  @default(true)

  // Scoring criteria (the ICP definition)
  criteria        Json     @default("{}")  // Job titles, industries, company sizes
  weights         Json     @default("{}")  // Weight for each factor

  // Thresholds for lead classification
  thresholdHigh   Int      @default(80)    // Score >= 80 = "Hot lead"
  thresholdMedium Int      @default(50)    // Score >= 50 = "Warm lead"

  // AI prompts customization
  systemPrompt    String?  // Optional custom system prompt

  pipelineId      String   @unique  // One scoring model per pipeline
  pipeline        Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([pipelineId])
  @@map("scoring_models")
}
```

**Criteria Schema:**

```json
{
  "jobTitles": {
    "target": ["CEO", "CTO", "VP of Engineering", "Director of Marketing"],
    "exclude": ["Intern", "Student", "Assistant"],
    "seniority": ["C-level", "VP", "Director", "Manager", "Senior", "Junior"]
  },
  "companies": {
    "industries": ["SaaS", "Technology", "Finance"],
    "sizes": ["SIZE_51_200", "SIZE_201_500", "SIZE_501_1000"],
    "excludeIndustries": ["Consulting", "Agency"]
  },
  "engagement": {
    "minFollowers": 100,
    "minConnections": 50,
    "hasRecentPosts": true
  },
  "completeness": {
    "required": ["email", "jobTitle", "company", "bio"],
    "bonus": ["phone", "website", "experience"]
  }
}
```

**Weights Schema:**

```json
{
  "jobTitle": 1.0,
  "company": 1.0,
  "engagement": 0.8,
  "completeness": 0.6
}
```

#### New Model: ScoreHistory

Tracks score changes over time for analytics and debugging.

```prisma
model ScoreHistory {
  id          String   @id @default(cuid())

  leadId      String
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

  oldScore    Int?
  newScore    Int
  reason      String?  // AI explanation for the score
  factors     Json     @default("{}")  // Breakdown of scoring factors

  triggeredBy String   // 'import', 'enrichment', 'manual', 'batch_job'

  createdAt   DateTime @default(now())

  @@index([leadId, createdAt])
  @@map("score_history")
}
```

**Factors Schema:**

```json
{
  "jobTitle": { "score": 85, "reason": "C-level at target industry company" },
  "company": {
    "score": 90,
    "reason": "Matches target company size and industry"
  },
  "engagement": {
    "score": 70,
    "reason": "Good follower count, recent activity"
  },
  "completeness": { "score": 60, "reason": "Missing phone number" }
}
```

### Lead Model Updates

Add relationship to ScoreHistory:

```prisma
model Lead {
  // ... existing fields ...
  scoreHistories ScoreHistory[]  // Add this relation
}
```

## Scoring Algorithm

### Factors (each scored 0-100)

#### 1. Job Title Match

**Inputs:** `headline`, `jobTitle`, `experiences`
**Scoring:**

- Exact match to target titles: 90-100
- Partial match or related title: 70-89
- Same seniority, different function: 50-69
- Wrong seniority or excluded title: 0-49
- No data: 0

#### 2. Company Relevance

**Inputs:** `company`, `companySize`, `industry`, `experiences`
**Scoring:**

- Target industry + target size: 90-100
- Target industry, size unknown: 70-89
- Related industry: 50-69
- Excluded industry: 0-49
- No data: 0

#### 3. Engagement/Activity

**Inputs:** `followersCount`, `connectionCount`, `postsCount`, `verified`, recent posts
**Scoring:**

- High engagement (top 25%): 80-100
- Medium engagement: 50-79
- Low engagement: 20-49
- No data: 0

#### 4. Profile Completeness

**Inputs:** Count of populated fields (email, phone, bio, location, website, enrichment data)
**Scoring:**

- All required + bonus fields: 90-100
- All required fields: 70-89
- Most required fields: 50-69
- Some required fields: 20-49
- Minimal data: 0-19

### Final Score Calculation

```javascript
const weightedSum =
  jobTitleScore * weights.jobTitle +
  companyScore * weights.company +
  engagementScore * weights.engagement +
  completenessScore * weights.completeness;

const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
const finalScore = Math.round(weightedSum / totalWeight);
```

## API Endpoints

### Scoring Model Management

```typescript
// Create/Update scoring model for pipeline
POST /api/v1/pipelines/:pipelineId/scoring-model
Body: {
  name: string
  description?: string
  enabled: boolean
  criteria: CriteriaJson
  weights: WeightsJson
  thresholdHigh: number
  thresholdMedium: number
  systemPrompt?: string
}

// Get scoring model
GET /api/v1/pipelines/:pipelineId/scoring-model

// Delete scoring model
DELETE /api/v1/pipelines/:pipelineId/scoring-model
```

### Lead Scoring Operations

```typescript
// Manual re-score
POST /api/v1/leads/:id/rescore
Body: {
  force?: boolean  // Re-score even if recent
}
Response: {
  score: number
  factors: FactorBreakdown
  reason: string
}

// Batch re-score
POST /api/v1/leads/batch-rescore
Body: {
  pipelineId?: string
  leadIds?: string[]
  enrichAfterScore?: boolean
}
Response: {
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}

// Get score breakdown
GET /api/v1/leads/:id/score-breakdown
Response: {
  score: number
  factors: FactorBreakdown
  classification: 'hot' | 'warm' | 'cold'
  history: ScoreHistory[]
}

// Get score history
GET /api/v1/leads/:id/score-history
Query: ?limit=20
Response: {
  history: ScoreHistory[]
}
```

## OpenAI Integration

### Scoring Prompt

```
System: You are a lead qualification assistant. Score leads from 0-100 based on the given criteria.

User:
Analyze this lead and provide a score for each factor:

Criteria:
{criteria_json}

Lead Profile:
{profile_data}

For each factor (jobTitle, company, engagement, completeness):
1. Provide a score from 0-100
2. Explain the reasoning in 1 sentence

Respond in JSON:
{
  "jobTitle": { "score": 85, "reason": "..." },
  "company": { "score": 90, "reason": "..." },
  "engagement": { "score": 70, "reason": "..." },
  "completeness": { "score": 60, "reason": "..." },
  "overallReason": "Summary of why this lead scored {final_score}"
}
```

### Batch Scoring

For efficiency, use the existing `analyzeLeadBatch` pattern to score multiple leads in a single API call when re-scoring pipelines.

## Frontend Components

### New Components

#### ScoringModelEditor

- Form to create/edit scoring model
- Job title builder (add/remove titles, set seniority)
- Company criteria builder (industries, sizes)
- Weight sliders for each factor
- Threshold configuration
- Preview with sample lead

#### ScoreBadge

- Visual indicator (color-coded: red/yellow/green)
- Shows score prominently
- Click to view breakdown

#### ScoreBreakdownModal

- Detailed factor scores
- Visual progress bars for each factor
- AI reasoning for each factor
- Score history chart
- Rescore button

#### ScoreHistoryChart

- Line chart showing score over time
- Annotated with enrichment events
- Highlight significant changes

### Enhanced Components

#### KanbanCard

- Add `ScoreBadge` component
- Optional: sort by score within stage

#### LeadDetailModal

- Add "Scoring" tab/section
- Show score breakdown
- Show score history
- Rescore button

#### Pipeline Settings

- Add "Scoring Model" tab
- Configure model for pipeline
- Enable/disable auto-scoring
- View scoring statistics

## Implementation Phases

### Phase 1: Core Scoring Engine

1. Database schema (ScoringModel, ScoreHistory)
2. Scoring service with OpenAI integration
3. API endpoints for model management
4. Manual rescore endpoint

### Phase 2: Automation

1. Auto-score on lead import
2. Auto-score on enrichment
3. Scheduled batch jobs
4. Webhook notifications on score changes

### Phase 3: Frontend

1. ScoringModelEditor component
2. ScoreBadge component
3. ScoreBreakdownModal component
4. Enhance KanbanCard and LeadDetailModal

### Phase 4: Analytics

1. Score distribution charts
2. Score history trends
3. Scoring model effectiveness metrics
4. A/B testing for models

## Testing Strategy

### Unit Tests

- Scoring algorithm edge cases
- Weight calculations
- Score history tracking
- Criteria validation

### Integration Tests

- OpenAI API calls
- Database operations
- API endpoints
- Batch processing

### E2E Tests

- Lead import with auto-scoring
- Enrichment trigger re-scoring
- Model configuration UI
- Score breakdown display

### Performance Tests

- Batch rescore 1000 leads
- Concurrent scoring requests
- Database query optimization

## Success Criteria

- ✅ Each lead receives automatic score 0-100
- ✅ Scoring criteria include: job title, company, engagement, completeness
- ✅ Users can customize scoring per pipeline
- ✅ Score visible on lead cards and detail view
- ✅ Leads sortable/filterable by score
- ✅ Score updates on enrichment
- ✅ Manual rescore available
- ✅ Score breakdown shows AI reasoning
- ✅ Score history tracked over time

## Rollout Plan

1. **Alpha** - Manual scoring only, no automation
2. **Beta** - Add auto-scoring on import, basic UI
3. **GA** - Full automation, batch jobs, analytics

## Future Enhancements

- ML model training from historical conversions
- A/B testing scoring models
- Predictive scoring (likelihood to convert)
- Integration with CRM systems
- Score-based routing rules
- Custom scoring factors
