import { describe, it, expect } from 'vitest';
import {
  leadExperienceSchema,
  leadEducationSchema,
  leadCertificationSchema,
  leadSkillSchema,
  leadLanguageSchema,
  leadRecommendationSchema,
  leadVolunteerSchema,
  leadPublicationSchema,
  leadPatentSchema,
  leadProjectSchema,
  leadCourseSchema,
  leadHonorSchema,
  leadOrganizationSchema,
  leadFeaturedSchema,
  leadContactInfoSchema,
  leadPostSchema,
  linkedInEnrichmentPayloadSchema,
  enrichLeadSchema,
} from './enrichment';

describe('Enrichment Schema Validation', () => {
  describe('leadExperienceSchema', () => {
    it('accepts valid experience with all fields', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        companyUrl: 'https://techcorp.com',
        companyLogo: 'https://techcorp.com/logo.png',
        roleTitle: 'Senior Developer',
        employmentType: 'Full-time',
        location: 'San Francisco, CA',
        startDate: '2020-01',
        endDate: '2023-12',
        duration: '3 years',
        description: 'Led development of core features',
        skills: ['JavaScript', 'React', 'Node.js'],
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid experience', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
      });

      expect(result.success).toBe(true);
    });

    it('rejects experience without companyName', () => {
      const result = leadExperienceSchema.safeParse({
        roleTitle: 'Developer',
      });

      expect(result.success).toBe(false);
    });

    it('rejects experience without roleTitle', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid URL', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });

    it('transforms empty strings to null for optional fields', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: '',
        employmentType: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.companyUrl).toBe(null);
        expect(result.data.employmentType).toBe(null);
      }
    });
  });

  describe('leadEducationSchema', () => {
    it('accepts valid education with all fields', () => {
      const result = leadEducationSchema.safeParse({
        school: 'Stanford University',
        schoolUrl: 'https://stanford.edu',
        schoolLogo: 'https://stanford.edu/logo.png',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-09',
        endDate: '2019-06',
        grade: '3.8 GPA',
        activities: 'CS Club President',
        description: 'Focus on AI and Machine Learning',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid education', () => {
      const result = leadEducationSchema.safeParse({
        school: 'Stanford University',
      });

      expect(result.success).toBe(true);
    });

    it('rejects education without school', () => {
      const result = leadEducationSchema.safeParse({
        degree: 'Bachelor of Science',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadCertificationSchema', () => {
    it('accepts valid certification with all fields', () => {
      const result = leadCertificationSchema.safeParse({
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
        issuerUrl: 'https://aws.amazon.com',
        issuerLogo: 'https://aws.amazon.com/logo.png',
        issueDate: '2023-01',
        expirationDate: '2026-01',
        credentialId: 'AWS-ASA-12345',
        credentialUrl: 'https://aws.amazon.com/verify/12345',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid certification', () => {
      const result = leadCertificationSchema.safeParse({
        name: 'AWS Certified',
      });

      expect(result.success).toBe(true);
    });

    it('rejects certification without name', () => {
      const result = leadCertificationSchema.safeParse({
        issuer: 'Amazon Web Services',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadSkillSchema', () => {
    it('accepts valid skill with endorsements', () => {
      const result = leadSkillSchema.safeParse({
        name: 'React',
        endorsementsCount: 42,
        category: 'Frontend Development',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid skill', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
      });

      expect(result.success).toBe(true);
    });

    it('rejects skill without name', () => {
      const result = leadSkillSchema.safeParse({
        endorsementsCount: 10,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadLanguageSchema', () => {
    it('accepts valid language with proficiency', () => {
      const result = leadLanguageSchema.safeParse({
        name: 'Spanish',
        proficiency: 'Fluent',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid language', () => {
      const result = leadLanguageSchema.safeParse({
        name: 'English',
      });

      expect(result.success).toBe(true);
    });

    it('rejects language without name', () => {
      const result = leadLanguageSchema.safeParse({
        proficiency: 'Fluent',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadRecommendationSchema', () => {
    it('accepts valid recommendation with all fields', () => {
      const result = leadRecommendationSchema.safeParse({
        authorName: 'John Doe',
        authorUrl: 'https://linkedin.com/in/johndoe',
        authorHeadline: 'CTO at Tech Corp',
        authorAvatar: 'https://example.com/avatar.jpg',
        relationship: 'Manager',
        date: '2023-06',
        text: 'Excellent developer and team player',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid recommendation', () => {
      const result = leadRecommendationSchema.safeParse({
        authorName: 'John Doe',
      });

      expect(result.success).toBe(true);
    });

    it('rejects recommendation without authorName', () => {
      const result = leadRecommendationSchema.safeParse({
        text: 'Great work!',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadVolunteerSchema', () => {
    it('accepts valid volunteer experience', () => {
      const result = leadVolunteerSchema.safeParse({
        organization: 'Red Cross',
        role: 'Volunteer',
        cause: 'Disaster Relief',
        startDate: '2020-01',
        endDate: '2021-12',
        description: 'Helped organize relief efforts',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid volunteer', () => {
      const result = leadVolunteerSchema.safeParse({
        organization: 'Red Cross',
      });

      expect(result.success).toBe(true);
    });

    it('rejects volunteer without organization', () => {
      const result = leadVolunteerSchema.safeParse({
        role: 'Volunteer',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadPublicationSchema', () => {
    it('accepts valid publication with authors', () => {
      const result = leadPublicationSchema.safeParse({
        title: 'Advanced React Patterns',
        publisher: 'Tech Blog',
        date: '2023-05',
        url: 'https://techblog.com/react-patterns',
        description: 'Deep dive into React hooks',
        authors: ['Jane Doe', 'John Smith'],
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid publication', () => {
      const result = leadPublicationSchema.safeParse({
        title: 'My Article',
      });

      expect(result.success).toBe(true);
    });

    it('rejects publication without title', () => {
      const result = leadPublicationSchema.safeParse({
        publisher: 'Tech Blog',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadPatentSchema', () => {
    it('accepts valid patent', () => {
      const result = leadPatentSchema.safeParse({
        title: 'Novel Algorithm',
        patentNumber: 'US12345678',
        status: 'Granted',
        date: '2023-01',
        url: 'https://patents.google.com/patent/US12345678',
        description: 'Revolutionary approach',
        inventors: ['Jane Doe', 'John Smith'],
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid patent', () => {
      const result = leadPatentSchema.safeParse({
        title: 'My Patent',
      });

      expect(result.success).toBe(true);
    });

    it('rejects patent without title', () => {
      const result = leadPatentSchema.safeParse({
        patentNumber: 'US12345678',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadProjectSchema', () => {
    it('accepts valid project', () => {
      const result = leadProjectSchema.safeParse({
        title: 'Open Source Library',
        url: 'https://github.com/user/repo',
        startDate: '2022-01',
        endDate: '2022-12',
        description: 'A useful library',
        collaborators: ['Alice', 'Bob'],
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid project', () => {
      const result = leadProjectSchema.safeParse({
        title: 'My Project',
      });

      expect(result.success).toBe(true);
    });

    it('rejects project without title', () => {
      const result = leadProjectSchema.safeParse({
        url: 'https://github.com/user/repo',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadCourseSchema', () => {
    it('accepts valid course', () => {
      const result = leadCourseSchema.safeParse({
        name: 'Machine Learning Fundamentals',
        courseNumber: 'CS101',
        associatedWith: 'Stanford University',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid course', () => {
      const result = leadCourseSchema.safeParse({
        name: 'My Course',
      });

      expect(result.success).toBe(true);
    });

    it('rejects course without name', () => {
      const result = leadCourseSchema.safeParse({
        courseNumber: 'CS101',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadHonorSchema', () => {
    it('accepts valid honor', () => {
      const result = leadHonorSchema.safeParse({
        title: 'Employee of the Year',
        issuer: 'Tech Corp',
        date: '2023-12',
        description: 'Outstanding performance',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid honor', () => {
      const result = leadHonorSchema.safeParse({
        title: 'Best Speaker',
      });

      expect(result.success).toBe(true);
    });

    it('rejects honor without title', () => {
      const result = leadHonorSchema.safeParse({
        issuer: 'Tech Corp',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadOrganizationSchema', () => {
    it('accepts valid organization affiliation', () => {
      const result = leadOrganizationSchema.safeParse({
        name: 'IEEE',
        position: 'Member',
        startDate: '2020-01',
        endDate: '2023-12',
        description: 'Professional organization',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid organization', () => {
      const result = leadOrganizationSchema.safeParse({
        name: 'ACM',
      });

      expect(result.success).toBe(true);
    });

    it('rejects organization without name', () => {
      const result = leadOrganizationSchema.safeParse({
        position: 'Member',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadFeaturedSchema', () => {
    it('accepts valid featured content', () => {
      const result = leadFeaturedSchema.safeParse({
        type: 'article',
        title: 'My Latest Article',
        url: 'https://blog.com/article',
        thumbnailUrl: 'https://blog.com/thumb.jpg',
        description: 'Interesting insights',
      });

      expect(result.success).toBe(true);
    });

    it('accepts minimal valid featured content', () => {
      const result = leadFeaturedSchema.safeParse({
        type: 'post',
      });

      expect(result.success).toBe(true);
    });

    it('rejects featured content without type', () => {
      const result = leadFeaturedSchema.safeParse({
        title: 'My Post',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('leadContactInfoSchema', () => {
    it('accepts valid contact info', () => {
      const result = leadContactInfoSchema.safeParse({
        email: 'user@example.com',
        phone: '+1-555-0123',
        website: 'https://example.com',
        twitter: '@username',
        birthday: '1990-01-01',
        address: '123 Main St, San Francisco, CA',
        profileUrl: 'https://linkedin.com/in/user',
      });

      expect(result.success).toBe(true);
    });

    it('accepts empty contact info', () => {
      const result = leadContactInfoSchema.safeParse({});

      expect(result.success).toBe(true);
    });
  });

  describe('leadPostSchema', () => {
    it('accepts valid post with engagement metrics', () => {
      const result = leadPostSchema.safeParse({
        content: 'Great article about tech trends',
        date: '2023-06-15',
        likes: 150,
        comments: 25,
        shares: 10,
        imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        videoUrls: ['https://example.com/video.mp4'],
        linkedUrl: 'https://blog.com/article',
        postUrl: 'https://linkedin.com/posts/post123',
        postType: 'article',
      });

      expect(result.success).toBe(true);
    });

    it('accepts empty post', () => {
      const result = leadPostSchema.safeParse({});

      expect(result.success).toBe(true);
    });
  });

  describe('linkedInEnrichmentPayloadSchema', () => {
    it('accepts complete enrichment payload', () => {
      const result = linkedInEnrichmentPayloadSchema.safeParse({
        experiences: [
          {
            companyName: 'Tech Corp',
            roleTitle: 'Developer',
          },
        ],
        educations: [
          {
            school: 'Stanford University',
          },
        ],
        certifications: [
          {
            name: 'AWS Certified',
          },
        ],
        skills: [
          {
            name: 'JavaScript',
          },
        ],
        languages: [
          {
            name: 'English',
          },
        ],
        recommendations: [
          {
            authorName: 'John Doe',
          },
        ],
        volunteers: [
          {
            organization: 'Red Cross',
          },
        ],
        publications: [
          {
            title: 'My Article',
          },
        ],
        patents: [
          {
            title: 'My Patent',
          },
        ],
        projects: [
          {
            title: 'My Project',
          },
        ],
        courses: [
          {
            name: 'My Course',
          },
        ],
        honors: [
          {
            title: 'Best Speaker',
          },
        ],
        organizations: [
          {
            name: 'IEEE',
          },
        ],
        featured: [
          {
            type: 'article',
          },
        ],
        contactInfo: {
          email: 'user@example.com',
        },
        posts: [
          {
            content: 'My post',
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it('accepts empty enrichment payload with defaults', () => {
      const result = linkedInEnrichmentPayloadSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experiences).toEqual([]);
        expect(result.data.educations).toEqual([]);
        expect(result.data.certifications).toEqual([]);
        expect(result.data.skills).toEqual([]);
        expect(result.data.languages).toEqual([]);
        expect(result.data.recommendations).toEqual([]);
        expect(result.data.volunteers).toEqual([]);
        expect(result.data.publications).toEqual([]);
        expect(result.data.patents).toEqual([]);
        expect(result.data.projects).toEqual([]);
        expect(result.data.courses).toEqual([]);
        expect(result.data.honors).toEqual([]);
        expect(result.data.organizations).toEqual([]);
        expect(result.data.featured).toEqual([]);
        expect(result.data.posts).toEqual([]);
      }
    });

    it('accepts partial enrichment payload', () => {
      const result = linkedInEnrichmentPayloadSchema.safeParse({
        experiences: [
          {
            companyName: 'Tech Corp',
            roleTitle: 'Developer',
          },
        ],
        skills: [
          {
            name: 'JavaScript',
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experiences).toHaveLength(1);
        expect(result.data.skills).toHaveLength(1);
        expect(result.data.educations).toEqual([]);
      }
    });
  });

  describe('enrichLeadSchema', () => {
    it('accepts valid enrichment request', () => {
      const result = enrichLeadSchema.safeParse({
        enrichment: {
          experiences: [
            {
              companyName: 'Tech Corp',
              roleTitle: 'Developer',
            },
          ],
          skills: [
            {
              name: 'JavaScript',
            },
          ],
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects request without enrichment field', () => {
      const result = enrichLeadSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it('rejects request with invalid enrichment data', () => {
      const result = enrichLeadSchema.safeParse({
        enrichment: {
          experiences: [
            {
              companyName: 'Tech Corp',
              // Missing required roleTitle
            },
          ],
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('accepts valid HTTPS URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: 'https://example.com',
      });

      expect(result.success).toBe(true);
    });

    it('accepts valid HTTP URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: 'http://example.com',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });

    it('transforms empty string to null for optional URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.companyUrl).toBe(null);
      }
    });

    it('transforms null to null for optional URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.companyUrl).toBe(null);
      }
    });

    it('accepts undefined for optional URLs', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        companyUrl: undefined,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // When undefined is passed to optional field, it remains undefined
        expect(result.data.companyUrl).toBe(undefined);
      }
    });
  });

  describe('Array Field Defaults', () => {
    it('defaults skills array to empty array', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skills).toEqual([]);
      }
    });

    it('accepts custom skills array', () => {
      const result = leadExperienceSchema.safeParse({
        companyName: 'Tech Corp',
        roleTitle: 'Developer',
        skills: ['JavaScript', 'React', 'Node.js'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skills).toEqual(['JavaScript', 'React', 'Node.js']);
      }
    });

    it('defaults authors array to empty array', () => {
      const result = leadPublicationSchema.safeParse({
        title: 'My Article',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authors).toEqual([]);
      }
    });

    it('defaults imageUrls array to empty array', () => {
      const result = leadPostSchema.safeParse({
        content: 'My post',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrls).toEqual([]);
      }
    });
  });

  describe('Optional Integer Validation', () => {
    it('accepts valid positive integer', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: 42,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.endorsementsCount).toBe(42);
      }
    });

    it('accepts zero as valid integer', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: 0,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative integers', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: -5,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer numbers', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: 42.5,
      });

      expect(result.success).toBe(false);
    });

    it('accepts null for optional integer', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: null,
      });

      expect(result.success).toBe(true);
    });

    it('accepts undefined for optional integer', () => {
      const result = leadSkillSchema.safeParse({
        name: 'JavaScript',
        endorsementsCount: undefined,
      });

      expect(result.success).toBe(true);
    });
  });
});
