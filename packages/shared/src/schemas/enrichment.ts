import { z } from 'zod';

// ============================================
// LINKEDIN ENRICHMENT SCHEMAS
// ============================================

// Helper for optional string
const optionalString = z.union([z.string(), z.literal(''), z.null(), z.undefined()])
    .transform((val) => (val === '' || val === null || val === undefined ? null : val));

// Helper for optional URL
const optionalUrl = z.union([z.string().url(), z.literal(''), z.null(), z.undefined()])
    .transform((val) => (val === '' || val === null || val === undefined ? null : val));

// Helper for optional number
const optionalInt = z.union([z.number().int().min(0), z.null(), z.undefined()]).optional();

// ============================================
// Individual Entity Schemas
// ============================================

export const leadExperienceSchema = z.object({
    companyName: z.string().min(1),
    companyUrl: optionalUrl.optional(),
    companyLogo: optionalUrl.optional(),
    roleTitle: z.string().min(1),
    employmentType: optionalString.optional(),
    location: optionalString.optional(),
    startDate: optionalString.optional(),
    endDate: optionalString.optional(),
    duration: optionalString.optional(),
    description: optionalString.optional(),
    skills: z.array(z.string()).optional().default([]),
});

export const leadEducationSchema = z.object({
    school: z.string().min(1),
    schoolUrl: optionalUrl.optional(),
    schoolLogo: optionalUrl.optional(),
    degree: optionalString.optional(),
    fieldOfStudy: optionalString.optional(),
    startDate: optionalString.optional(),
    endDate: optionalString.optional(),
    grade: optionalString.optional(),
    activities: optionalString.optional(),
    description: optionalString.optional(),
});

export const leadCertificationSchema = z.object({
    name: z.string().min(1),
    issuer: optionalString.optional(),
    issuerUrl: optionalUrl.optional(),
    issuerLogo: optionalUrl.optional(),
    issueDate: optionalString.optional(),
    expirationDate: optionalString.optional(),
    credentialId: optionalString.optional(),
    credentialUrl: optionalUrl.optional(),
});

export const leadSkillSchema = z.object({
    name: z.string().min(1),
    endorsementsCount: optionalInt,
    category: optionalString.optional(),
});

export const leadLanguageSchema = z.object({
    name: z.string().min(1),
    proficiency: optionalString.optional(),
});

export const leadRecommendationSchema = z.object({
    authorName: z.string().min(1),
    authorUrl: optionalUrl.optional(),
    authorHeadline: optionalString.optional(),
    authorAvatar: optionalUrl.optional(),
    relationship: optionalString.optional(),
    date: optionalString.optional(),
    text: optionalString.optional(),
});

export const leadVolunteerSchema = z.object({
    organization: z.string().min(1),
    role: optionalString.optional(),
    cause: optionalString.optional(),
    startDate: optionalString.optional(),
    endDate: optionalString.optional(),
    description: optionalString.optional(),
});

export const leadPublicationSchema = z.object({
    title: z.string().min(1),
    publisher: optionalString.optional(),
    date: optionalString.optional(),
    url: optionalUrl.optional(),
    description: optionalString.optional(),
    authors: z.array(z.string()).optional().default([]),
});

export const leadPatentSchema = z.object({
    title: z.string().min(1),
    patentNumber: optionalString.optional(),
    status: optionalString.optional(),
    date: optionalString.optional(),
    url: optionalUrl.optional(),
    description: optionalString.optional(),
    inventors: z.array(z.string()).optional().default([]),
});

export const leadProjectSchema = z.object({
    title: z.string().min(1),
    url: optionalUrl.optional(),
    startDate: optionalString.optional(),
    endDate: optionalString.optional(),
    description: optionalString.optional(),
    collaborators: z.array(z.string()).optional().default([]),
});

export const leadCourseSchema = z.object({
    name: z.string().min(1),
    courseNumber: optionalString.optional(),
    associatedWith: optionalString.optional(),
});

export const leadHonorSchema = z.object({
    title: z.string().min(1),
    issuer: optionalString.optional(),
    date: optionalString.optional(),
    description: optionalString.optional(),
});

export const leadOrganizationSchema = z.object({
    name: z.string().min(1),
    position: optionalString.optional(),
    startDate: optionalString.optional(),
    endDate: optionalString.optional(),
    description: optionalString.optional(),
});

export const leadFeaturedSchema = z.object({
    type: z.string().min(1), // post, article, link, media
    title: optionalString.optional(),
    url: optionalUrl.optional(),
    thumbnailUrl: optionalUrl.optional(),
    description: optionalString.optional(),
});

export const leadContactInfoSchema = z.object({
    email: optionalString.optional(),
    phone: optionalString.optional(),
    website: optionalUrl.optional(),
    twitter: optionalString.optional(),
    birthday: optionalString.optional(),
    address: optionalString.optional(),
    profileUrl: optionalUrl.optional(),
});

export const leadPostSchema = z.object({
    content: optionalString.optional(),
    date: optionalString.optional(),
    likes: optionalInt,
    comments: optionalInt,
    shares: optionalInt,
    imageUrls: z.array(z.string()).optional().default([]),
    videoUrls: z.array(z.string()).optional().default([]),
    linkedUrl: optionalUrl.optional(),
    postUrl: optionalUrl.optional(),
    postType: optionalString.optional(),
});

// ============================================
// Aggregated Enrichment Payload
// ============================================

export const linkedInEnrichmentPayloadSchema = z.object({
    experiences: z.array(leadExperienceSchema).optional().default([]),
    educations: z.array(leadEducationSchema).optional().default([]),
    certifications: z.array(leadCertificationSchema).optional().default([]),
    skills: z.array(leadSkillSchema).optional().default([]),
    languages: z.array(leadLanguageSchema).optional().default([]),
    recommendations: z.array(leadRecommendationSchema).optional().default([]),
    volunteers: z.array(leadVolunteerSchema).optional().default([]),
    publications: z.array(leadPublicationSchema).optional().default([]),
    patents: z.array(leadPatentSchema).optional().default([]),
    projects: z.array(leadProjectSchema).optional().default([]),
    courses: z.array(leadCourseSchema).optional().default([]),
    honors: z.array(leadHonorSchema).optional().default([]),
    organizations: z.array(leadOrganizationSchema).optional().default([]),
    featured: z.array(leadFeaturedSchema).optional().default([]),
    contactInfo: leadContactInfoSchema.optional(),
    posts: z.array(leadPostSchema).optional().default([]),
});

export const enrichLeadSchema = z.object({
    enrichment: linkedInEnrichmentPayloadSchema,
});

// ============================================
// Type Exports
// ============================================

export type LeadExperience = z.infer<typeof leadExperienceSchema>;
export type LeadEducation = z.infer<typeof leadEducationSchema>;
export type LeadCertification = z.infer<typeof leadCertificationSchema>;
export type LeadSkill = z.infer<typeof leadSkillSchema>;
export type LeadLanguage = z.infer<typeof leadLanguageSchema>;
export type LeadRecommendation = z.infer<typeof leadRecommendationSchema>;
export type LeadVolunteer = z.infer<typeof leadVolunteerSchema>;
export type LeadPublication = z.infer<typeof leadPublicationSchema>;
export type LeadPatent = z.infer<typeof leadPatentSchema>;
export type LeadProject = z.infer<typeof leadProjectSchema>;
export type LeadCourse = z.infer<typeof leadCourseSchema>;
export type LeadHonor = z.infer<typeof leadHonorSchema>;
export type LeadOrganization = z.infer<typeof leadOrganizationSchema>;
export type LeadFeatured = z.infer<typeof leadFeaturedSchema>;
export type LeadContactInfo = z.infer<typeof leadContactInfoSchema>;
export type LeadPost = z.infer<typeof leadPostSchema>;
export type LinkedInEnrichmentPayload = z.infer<typeof linkedInEnrichmentPayloadSchema>;
