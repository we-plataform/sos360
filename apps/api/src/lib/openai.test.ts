import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateMessage,
  type LeadProfile,
  type LeadExperience,
  type LeadSkill,
  type LeadEducation,
  type LeadCertification,
  type LeadPost,
} from './openai.js';

// Mock env module BEFORE importing anything else
vi.mock('../config/env.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    DIRECT_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-secret-key-min-32-chars',
    JWT_EXPIRES_IN: '30d',
    REFRESH_TOKEN_EXPIRES_IN: '30d',
    PORT: 3001,
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    REDIS_URL: '',
  },
}));

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('generateMessage - Enhanced Message Generation', () => {
  const mockAgentConfig = {
    systemPrompt: 'You are a helpful sales assistant.',
    temperature: 0.7,
    maxTokens: 500,
    model: 'gpt-4o-mini',
    type: 'sales',
  };

  const basicProfile: LeadProfile = {
    username: 'john-doe',
    fullName: 'John Doe',
    bio: 'Software Engineer',
    headline: 'Senior Software Engineer',
    company: 'Tech Corp',
    industry: 'Technology',
    location: 'San Francisco, CA',
    platform: 'linkedin',
  };

  const enrichedProfile: LeadProfile = {
    ...basicProfile,
    experiences: [
      {
        companyName: 'Tech Corp',
        roleTitle: 'Senior Software Engineer',
        employmentType: 'Full-time',
        location: 'San Francisco, CA',
        startDate: '2020-01',
        description: 'Leading development of cloud infrastructure',
      },
      {
        companyName: 'Startup Inc',
        roleTitle: 'Software Engineer',
        startDate: '2017-06',
        endDate: '2019-12',
      },
    ] as LeadExperience[],
    skills: [
      { name: 'TypeScript', endorsementsCount: 25 },
      { name: 'React', endorsementsCount: 20 },
      { name: 'Node.js', endorsementsCount: 18 },
      { name: 'Python', endorsementsCount: 15 },
      { name: 'AWS', endorsementsCount: 12 },
    ] as LeadSkill[],
    education: [
      {
        school: 'MIT',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2013',
        endDate: '2017',
      },
    ] as LeadEducation[],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: '2021-06',
      },
    ] as LeadCertification[],
    leadPosts: [
      {
        content: 'Just launched our new microservices architecture! #cloud #devops',
        date: '2024-01-15',
        likes: 45,
        comments: 8,
      },
      {
        content: 'Excited to speak at TechConf 2024 about serverless computing',
        date: '2024-01-10',
        likes: 120,
        comments: 22,
        shares: 15,
      },
    ] as LeadPost[],
    deepAnalysis: {
      interests: ['Cloud Computing', 'Serverless', 'DevOps', 'Microservices'],
      personalityType: 'Analytical and technical',
      buyingIntent: 'Medium',
    },
  };

  describe('message generation structure', () => {
    it('should accept enriched profile data without errors', async () => {
      const result = await generateMessage(mockAgentConfig, enrichedProfile, 'first_message');
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });

    it('should handle profiles with only basic data', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'first_message');
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata about the generation', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'connection_request');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.messageType).toBe('connection_request');
      expect(result.metadata.agentType).toBe('sales');
    });
  });

  describe('enriched data fields', () => {
    it('should process experience data', async () => {
      const profileWithExperience: LeadProfile = {
        ...basicProfile,
        experiences: [
          {
            companyName: 'Tech Corp',
            roleTitle: 'Senior Engineer',
            description: 'Building cloud systems',
          },
        ] as LeadExperience[],
      };
      const result = await generateMessage(mockAgentConfig, profileWithExperience, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should process skills data', async () => {
      const profileWithSkills: LeadProfile = {
        ...basicProfile,
        skills: [
          { name: 'TypeScript', endorsementsCount: 25 },
          { name: 'React', endorsementsCount: 20 },
        ] as LeadSkill[],
      };
      const result = await generateMessage(mockAgentConfig, profileWithSkills, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should process education data', async () => {
      const profileWithEducation: LeadProfile = {
        ...basicProfile,
        education: [
          {
            school: 'MIT',
            degree: 'BS',
            fieldOfStudy: 'Computer Science',
          },
        ] as LeadEducation[],
      };
      const result = await generateMessage(mockAgentConfig, profileWithEducation, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should process certifications data', async () => {
      const profileWithCertifications: LeadProfile = {
        ...basicProfile,
        certifications: [
          {
            name: 'AWS Certified',
            issuingOrganization: 'Amazon',
          },
        ] as LeadCertification[],
      };
      const result = await generateMessage(mockAgentConfig, profileWithCertifications, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should process recent posts data', async () => {
      const profileWithPosts: LeadProfile = {
        ...basicProfile,
        leadPosts: [
          {
            content: 'Great article about cloud architecture',
            likes: 50,
          },
        ] as LeadPost[],
      };
      const result = await generateMessage(mockAgentConfig, profileWithPosts, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should process deep analysis data', async () => {
      const profileWithAnalysis: LeadProfile = {
        ...basicProfile,
        deepAnalysis: {
          interests: ['Cloud', 'DevOps'],
          personalityType: 'Technical',
          buyingIntent: 'High',
        },
      };
      const result = await generateMessage(mockAgentConfig, profileWithAnalysis, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle fully enriched profile', async () => {
      const result = await generateMessage(mockAgentConfig, enrichedProfile, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('message types', () => {
    it('should generate connection request messages', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'connection_request');
      expect(result.message).toBeDefined();
      expect(result.metadata.messageType).toBe('connection_request');
    });

    it('should generate first message', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.metadata.messageType).toBe('first_message');
    });

    it('should generate follow up message', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'follow_up');
      expect(result.message).toBeDefined();
      expect(result.metadata.messageType).toBe('follow_up');
    });
  });

  describe('platform differences', () => {
    it('should generate messages for LinkedIn', async () => {
      const linkedinProfile: LeadProfile = {
        ...basicProfile,
        platform: 'linkedin',
      };
      const result = await generateMessage(mockAgentConfig, linkedinProfile, 'first_message');
      expect(result.message).toBeDefined();
    });

    it('should generate messages for Instagram', async () => {
      const instagramProfile: LeadProfile = {
        username: 'john.doe',
        fullName: 'John Doe',
        bio: 'Tech enthusiast',
        followersCount: 1500,
        platform: 'instagram',
      };
      const result = await generateMessage(mockAgentConfig, instagramProfile, 'first_message');
      expect(result.message).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing OpenAI API key gracefully', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await generateMessage(mockAgentConfig, basicProfile, 'first_message');

      expect(result.message).toBeDefined();
      expect(result.confidenceScore).toBe(0);

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should return fallback message on errors', async () => {
      const result = await generateMessage(mockAgentConfig, basicProfile, 'first_message');
      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('customization options', () => {
    it('should respect custom model configuration', async () => {
      const customConfig = {
        ...mockAgentConfig,
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 300,
      };

      const result = await generateMessage(customConfig, basicProfile, 'first_message');

      expect(result.message).toBeDefined();
      expect(result.metadata.model).toBe('gpt-4o');
    });

    it('should include additional context when provided', async () => {
      const additionalContext = 'Lead expressed interest in cloud solutions';

      const result = await generateMessage(
        mockAgentConfig,
        basicProfile,
        'first_message',
        additionalContext
      );

      expect(result.message).toBeDefined();
    });
  });
});
