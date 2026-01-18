import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let openai: OpenAI | null = null;

if (env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
    });
} else {
    logger.warn('OPENAI_API_KEY not set. Intelligent features will be disabled.');
}

export type LeadProfile = {
    username: string;
    fullName?: string | null;
    bio?: string | null;
    postsCount?: number;
    followersCount?: number;
    followingCount?: number;
    recentPosts?: string[]; // Captions or OCR text from posts
};

export type AnalysisResult = {
    qualified: boolean;
    score: number; // 0-100
    reason: string;
};

export async function analyzeLead(profile: LeadProfile, criteria: string): Promise<AnalysisResult> {
    if (!openai) {
        return {
            qualified: true,
            score: 50,
            reason: 'OpenAI not configured. Allowing by default.',
        };
    }

    try {
        const prompt = `
      Analyze the following Instagram profile and determine if it matches the user's qualification criteria.
      
      User Criteria: "${criteria}"
      
      Profile:
      - Username: ${profile.username}
      - Name: ${profile.fullName || 'N/A'}
      - Bio: ${profile.bio || 'N/A'}
      - Followers: ${profile.followersCount}
      - Following: ${profile.followingCount}
      
      Respond in JSON format:
      {
        "qualified": boolean,
        "score": number (0-100),
        "reason": "short explanation"
      }
    `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: 'You are a lead qualification assistant.' }, { role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('Empty response from OpenAI');

        const result = JSON.parse(content) as AnalysisResult;
        return result;
    } catch (error) {
        logger.error({ err: error }, 'Lead analysis failed');
        return {
            qualified: false,
            score: 0,
            reason: 'Analysis failed error.',
        };
    }
}
