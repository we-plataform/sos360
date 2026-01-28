import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let openai: OpenAI | null = null;

if (env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
} else {
  logger.warn("OPENAI_API_KEY not set. Intelligent features will be disabled.");
}

export type LeadProfile = {
  username: string;
  fullName?: string | null;
  bio?: string | null;
  headline?: string | null; // Professional title (LinkedIn)
  company?: string | null; // Current company (LinkedIn)
  industry?: string | null; // Industry sector
  location?: string | null; // Geographic location
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  connectionCount?: number; // LinkedIn connections
  recentPosts?: string[]; // Captions or OCR text from posts
  platform?: string; // 'instagram' | 'linkedin' | etc
};

export type AnalysisResult = {
  qualified: boolean;
  score: number; // 0-100
  reason: string;
};

export type ScoreBreakdown = {
  jobTitleScore: number;
  companyScore: number;
  profileCompletenessScore: number;
  activityScore: number;
  enrichmentScore: number;
  finalScore: number;
};

export type DetailedScoringResult = {
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
};

export type MessageGenerationResult = {
  message: string;
  confidenceScore: number; // 0-100
  metadata: {
    agentType?: string;
    messageType?: string;
    model: string;
    tokensUsed?: number;
  };
};

export async function analyzeLead(
  profile: LeadProfile,
  criteria: string,
): Promise<AnalysisResult> {
  if (!openai) {
    return {
      qualified: true,
      score: 50,
      reason: "OpenAI not configured. Allowing by default.",
    };
  }

  try {
    const isLinkedIn =
      profile.platform === "linkedin" || profile.headline || profile.company;

    const profileDescription = isLinkedIn
      ? `
      - Username: ${profile.username}
      - Full Name: ${profile.fullName || "N/A"}
      - Headline: ${profile.headline || "N/A"}
      - Company: ${profile.company || "N/A"}
      - Industry: ${profile.industry || "N/A"}
      - Location: ${profile.location || "N/A"}
      - Bio/About: ${profile.bio || "N/A"}
      - Connections: ${profile.connectionCount || "N/A"}
      `
      : `
      - Username: ${profile.username}
      - Name: ${profile.fullName || "N/A"}
      - Bio: ${profile.bio || "N/A"}
      - Location: ${profile.location || "N/A"}
      - Followers: ${profile.followersCount || "N/A"}
      - Following: ${profile.followingCount || "N/A"}
      `;

    const platformContext = isLinkedIn
      ? "LinkedIn professional profile"
      : "Instagram social profile";

    const prompt = `
      Analyze the following ${platformContext} and determine if it matches the user's qualification criteria.
      
      User Criteria: "${criteria}"
      
      Profile:
      ${profileDescription}
      
      Scoring Guidelines:
      - 80-100: Highly qualified - strong match with criteria, ideal prospect
      - 60-79: Qualified - good match, worth contacting
      - 40-59: Marginally qualified - some relevant signals but not ideal
      - 20-39: Low qualification - weak match, probably not worth pursuing
      - 0-19: Not qualified - does not match criteria at all
      
      Respond in JSON format:
      {
        "qualified": boolean (true if score >= 50),
        "score": number (0-100),
        "reason": "concise explanation in Portuguese (1-2 sentences)"
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a lead qualification assistant. Analyze profiles and score them based on qualification criteria. Always respond in Portuguese.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const result = JSON.parse(content) as AnalysisResult;
    return result;
  } catch (error) {
    logger.error({ err: error }, "Lead analysis failed");
    return {
      qualified: false,
      score: 0,
      reason: "Análise falhou devido a erro.",
    };
  }
}

/**
 * Generate a personalized message using an AI agent
 * @param agentConfig - Agent configuration (systemPrompt, temperature, maxTokens, model)
 * @param leadProfile - Lead profile data
 * @param messageType - Type of message to generate (connection_request, first_message, follow_up)
 * @param additionalContext - Optional additional context for message generation
 * @returns Generated message with confidence score and metadata
 */
export async function generateMessage(
  agentConfig: {
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
    type?: string;
  },
  leadProfile: LeadProfile,
  messageType:
    | "connection_request"
    | "first_message"
    | "follow_up" = "first_message",
  additionalContext?: string,
): Promise<MessageGenerationResult> {
  if (!openai) {
    return {
      message:
        "Olá! Gostaria de conectar com você para discutir possíveis oportunidades de colaboração.",
      confidenceScore: 0,
      metadata: {
        agentType: agentConfig.type,
        messageType,
        model: "none",
      },
    };
  }

  try {
    const isLinkedIn =
      leadProfile.platform === "linkedin" ||
      leadProfile.headline ||
      leadProfile.company;

    const profileDescription = isLinkedIn
      ? `
      - Nome: ${leadProfile.fullName || "N/A"}
      - Cargo/Headline: ${leadProfile.headline || "N/A"}
      - Empresa: ${leadProfile.company || "N/A"}
      - Setor: ${leadProfile.industry || "N/A"}
      - Localização: ${leadProfile.location || "N/A"}
      - Bio/About: ${leadProfile.bio || "N/A"}
      - Conexões: ${leadProfile.connectionCount || "N/A"}
      `
      : `
      - Nome: ${leadProfile.fullName || "N/A"}
      - Username: @${leadProfile.username}
      - Bio: ${leadProfile.bio || "N/A"}
      - Localização: ${leadProfile.location || "N/A"}
      - Seguidores: ${leadProfile.followersCount || "N/A"}
      `;

    const messageContext = getMessageTypeContext(messageType);
    const contextSection = additionalContext
      ? `\n\nCONTEXTO ADICIONAL:\n${additionalContext}`
      : "";

    const prompt = `
      Você é um assistente de vendas B2B especializado em outreach personalizado. Sua tarefa é gerar uma mensagem ${messageContext} para um lead.

      DADOS DO LEAD:
      ${profileDescription}${contextSection}

      DIRETRIZES PARA A MENSAGEM:
      - Seja autêntico e profissional, mas conversacional
      - Personalize a mensagem com base nos dados específicos do lead (cargo, empresa, interesses)
      - Menções específicas do perfil (cargo, empresa, achievements) geram maior engajamento
      - Seja conciso: 2-4 frases no máximo
      - Evite linguagem de vendas agressiva ou genérica
      - O tom deve ser amigável e focado em construir relacionamento
      - Para LinkedIn: mais formal e profissional
      - Para Instagram: mais casual e descontraído
      - SEMPRE em português brasileiro nativo

      Responda em JSON:
      {
        "message": "a mensagem gerada (2-4 frases, em português)",
        "confidenceScore": number (0-100, baseado em quão personalizada e relevante é a mensagem)
      }
    `;

    const model = agentConfig.model || "gpt-4o-mini";
    const temperature =
      agentConfig.temperature !== undefined ? agentConfig.temperature : 0.7;
    const maxTokens = agentConfig.maxTokens || 500;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: agentConfig.systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const result = JSON.parse(content) as {
      message: string;
      confidenceScore: number;
    };

    return {
      message: result.message,
      confidenceScore: result.confidenceScore || 50,
      metadata: {
        agentType: agentConfig.type,
        messageType,
        model,
        tokensUsed: response.usage?.total_tokens,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "Message generation failed");
    return {
      message:
        "Olá! Gostaria de conectar com você para discutir possíveis oportunidades de colaboração.",
      confidenceScore: 0,
      metadata: {
        agentType: agentConfig.type,
        messageType,
        model: agentConfig.model || "gpt-4o-mini",
      },
    };
  }
}

/**
 * Get message type context for prompt
 */
function getMessageTypeContext(messageType: string): string {
  switch (messageType) {
    case "connection_request":
      return "de solicitação de conexão (curta, 300 caracteres máx, focada em apresentação e valor)";
    case "first_message":
      return "de primeiro contato após conexão (focada em iniciar conversa, identificar interesse)";
    case "follow_up":
      return "de follow-up (focada em avançar conversa, agendar call/meeting)";
    default:
      return "personalizada";
  }
}

/**
 * Analyze multiple leads in a single API call for efficiency
 * @param profiles - Array of lead profiles to analyze
 * @param criteria - Qualification criteria
 * @returns Array of analysis results in the same order as input
 */
export async function analyzeLeadBatch(
  profiles: LeadProfile[],
  criteria: string,
): Promise<AnalysisResult[]> {
  if (!openai) {
    // Return default scores for all profiles
    return profiles.map(() => ({
      qualified: true,
      score: 50,
      reason: "OpenAI não configurado. Permitindo por padrão.",
    }));
  }

  if (profiles.length === 0) {
    return [];
  }

  try {
    // Build profiles description
    const profilesText = profiles
      .map((profile, index) => {
        return `
Profile ${index + 1} (@${profile.username}):
- Name: ${profile.fullName || "N/A"}
- Bio: ${profile.bio || "N/A"}
- Followers: ${profile.followersCount || "N/A"}
- Following: ${profile.followingCount || "N/A"}
- Location: ${profile.location || "N/A"}`;
      })
      .join("\n");

    const prompt = `
You are analyzing Instagram profiles from a followers/following list. IMPORTANT: These profiles have LIMITED data - usually only name and username are available, bio is often empty.

User Criteria: "${criteria}"

${profilesText}

CRITICAL SCORING RULES for LIMITED DATA:
1. When bio is empty or "N/A", focus ENTIRELY on the NAME and USERNAME for clues
2. Look for professional signals in names like:
   - Job titles: CEO, Founder, Dev, Designer, Marketing, Vendas, Consultor, Coach, Mentor
   - Emoji patterns: 🚀, 💼, 📈, 💻, 🎯 (often indicate entrepreneurs/professionals)
   - Company indicators: @company, "| Company", "at Company"
   - Professional formatting: "Name | Role", "Name - Company", "Name • Profession"
3. Business-looking usernames (company names, brandnames) should score higher
4. Generic personal names without any professional signals = lower score but NOT zero

Scoring Guidelines (adjusted for limited data):
- 70-100: Strong professional signals in name matching criteria
- 50-69: Some professional signals or business-looking profile
- 30-49: Neutral - no clear signals either way (give benefit of doubt)
- 10-29: Appears to be personal account with no professional signals
- 0-9: Clearly doesn't match (spam, fake, unrelated)

IMPORTANT: Be GENEROUS when data is limited. If someone's name is "João Empreendedor" or "Maria | Marketing", score them HIGH even without bio.

Respond in JSON format with an array of results, one for each profile IN THE SAME ORDER:
{
  "results": [
    {
      "username": "username1",
      "qualified": true/false,
      "score": 0-100,
      "reason": "brief explanation in Portuguese"
    }
  ]
}

Mark as qualified (true) if score >= 50.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a lead qualification assistant analyzing Instagram profiles with LIMITED data (often just name and username, no bio). Be GENEROUS with scoring - any professional signal in the name (titles, emojis, company mentions) should result in a decent score. When data is minimal, give benefit of doubt. Always respond in Portuguese for the reason field. Be concise.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: Math.min(profiles.length * 100, 4000), // Scale tokens with batch size
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(content) as {
      results: Array<{
        username: string;
        qualified: boolean;
        score: number;
        reason: string;
      }>;
    };

    // Map results back to profiles order
    const resultsMap = new Map(
      parsed.results.map((r) => [r.username.toLowerCase(), r]),
    );

    return profiles.map((profile) => {
      const result = resultsMap.get(profile.username.toLowerCase());
      if (result) {
        return {
          qualified: result.qualified,
          score: result.score,
          reason: result.reason,
        };
      }
      // Fallback if username not found in response
      return {
        qualified: false,
        score: 0,
        reason: "Perfil não analisado",
      };
    });
  } catch (error) {
    logger.error({ err: error }, "Batch lead analysis failed");
    // Return default low scores on error
    return profiles.map(() => ({
      qualified: false,
      score: 0,
      reason: "Análise em batch falhou.",
    }));
  }
}

export type DeepAnalysisResult = {
  maritalStatus: "married" | "single" | "unknown";
  hasChildren: boolean;
  deviceType: "iphone" | "android" | "unknown";
  interests: string[];
  personalityType: string;
  buyingIntent: "High" | "Medium" | "Low";
  confidenceScore: number;
  reason: string;
};

export type PostContext = {
  text?: string;
  imageUrls?: string[];
  date?: string;
};

/**
 * Deeply analyze a lead using multimodal signals (Text + Vision)
 * Infers behavioral traits like marital status, devices used, and lifestyle.
 */
export async function analyzeLeadDeep(
  profile: LeadProfile,
  posts: PostContext[],
): Promise<DeepAnalysisResult> {
  if (!openai) {
    return {
      maritalStatus: "unknown",
      hasChildren: false,
      deviceType: "unknown",
      interests: [],
      personalityType: "N/A",
      buyingIntent: "Low",
      confidenceScore: 0,
      reason: "OpenAI disabled",
    };
  }

  try {
    // 1. Prepare Content for AI
    const profileSummary = `
      Name: ${profile.fullName}
      Bio: ${profile.bio}
      Headline: ${profile.headline}
      Company: ${profile.company}
      Location: ${profile.location}
    `;

    const postsContext = posts
      .map(
        (p, i) => `
      Post ${i + 1} (${p.date || "Unknown Date"}):
      Text: "${p.text || ""}"
      Images: ${p.imageUrls?.length || 0} images present.
    `,
      )
      .join("\n");

    // Collect all images for vision analysis (limit to 5 to save tokens/complexity)
    const allImages = posts.flatMap((p) => p.imageUrls || []).slice(0, 5);

    const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
      [
        {
          type: "text",
          text: `You are an expert behavioural analyst (like Sherlock Holmes). Analyze this LinkedIn/Social profile deeply.
        
        Profile Data:
        ${profileSummary}

        Recent Activity:
        ${postsContext}

        TASK: Infer the following attributes based on subtle clues in text and images:
        1. Marital Status (Look for "my wife", "husband", wedding rings in photos, family mentions)
        2. Has Children (Look for "my kids", "son", "daughter", family photos)
        3. Device Type (Look for "Sent from iPhone", mirror selfies with visible phones, Apple ecosystem mentions)
        4. Interests (Hobbies, sports, topics frequently posted about)
        5. Personality (Tone: Formal, Casual, aggressive, analytical?)
        6. Buying Intent (Are they asking for solutions? Complaining about current tools?)

        Return JSON:
        {
            "maritalStatus": "married" | "single" | "unknown",
            "hasChildren": boolean,
            "deviceType": "iphone" | "android" | "unknown",
            "interests": ["visual list"],
            "personalityType": "string descriptor",
            "buyingIntent": "High" | "Medium" | "Low",
            "confidenceScore": number (0-100),
            "reason": "Explain your deductions in Portuguese. Citations like 'Found ring in photo 2' or 'Mentioned wife in post 1'."
        }`,
        },
      ];

    // Append images if available
    for (const url of allImages) {
      if (url && url.startsWith("http")) {
        messageContent.push({
          type: "image_url",
          image_url: { url: url },
        });
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use powerful model for vision/reasoning
      messages: [
        {
          role: "system",
          content: "You are a behavioral profiling AI. Return only JSON.",
        },
        { role: "user", content: messageContent as any },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response");

    return JSON.parse(content) as DeepAnalysisResult;
  } catch (error) {
    logger.error({ err: error }, "Deep analysis failed");
    return {
      maritalStatus: "unknown",
      hasChildren: false,
      deviceType: "unknown",
      interests: [],
      personalityType: "Error",
      buyingIntent: "Low",
      confidenceScore: 0,
      reason: "Analysis failed due to error",
    };
  }
}

/**
 * Generate detailed AI-powered scoring explanation based on breakdown scores
 * @param profile - The lead profile data
 * @param criteria - Scoring criteria description
 * @param breakdown - The calculated score breakdown
 * @returns Detailed scoring analysis with explanation and recommendations
 */
export async function generateDetailedScoringExplanation(
  profile: LeadProfile,
  criteria: string,
  breakdown: ScoreBreakdown,
): Promise<DetailedScoringResult> {
  if (!openai) {
    return {
      explanation: "OpenAI não configurado. Análise detalhada indisponível.",
      strengths: [],
      weaknesses: [],
      recommendation: "Configure OpenAI para análises detalhadas.",
    };
  }

  try {
    const isLinkedIn =
      profile.platform === "linkedin" || profile.headline || profile.company;

    const profileDescription = isLinkedIn
      ? `
      - Nome: ${profile.fullName || "N/A"}
      - Cargo: ${profile.headline || "N/A"}
      - Empresa: ${profile.company || "N/A"}
      - Setor: ${profile.industry || "N/A"}
      - Localização: ${profile.location || "N/A"}
      - Bio: ${profile.bio || "N/A"}
      - Conexões: ${profile.connectionCount || "N/A"}
      `
      : `
      - Nome: ${profile.fullName || "N/A"}
      - Username: ${profile.username}
      - Bio: ${profile.bio || "N/A"}
      - Localização: ${profile.location || "N/A"}
      - Seguidores: ${profile.followersCount || "N/A"}
      - Seguindo: ${profile.followingCount || "N/A"}
      `;

    const breakdownDescription = `
      - Pontuação de Cargo: ${breakdown.jobTitleScore}/100
      - Pontuação de Empresa: ${breakdown.companyScore}/100
      - Completude de Perfil: ${breakdown.profileCompletenessScore}/100
      - Atividade Social: ${breakdown.activityScore}/100
      - Dados Enriquecidos: ${breakdown.enrichmentScore}/100
      - PONTUAÇÃO FINAL: ${breakdown.finalScore}/100
    `;

    const platformContext = isLinkedIn
      ? "perfil profissional do LinkedIn"
      : "perfil social do Instagram";

    const prompt = `
      Você é um especialista em qualificação de leads B2B. Analise este ${platformContext} e forneça uma explicação detalhada da pontuação calculada.

      CRITÉRIOS DE QUALIFICAÇÃO DO CLIENTE:
      ${criteria}

      DADOS DO LEAD:
      ${profileDescription}

      PONTUAÇÕES CALCULADAS (algoritmo):
      ${breakdownDescription}

      TAREFA:
      Com base nas pontuações calculadas e nos dados do perfil, forneça uma análise detalhada que explique:

      1. POR QUE o lead recebeu esta pontuação (correlacione os dados do perfil com as pontuações específicas)
      2. PONTOS FORTES específicos que elevam a pontuação (cite dados reais do perfil)
      3. PONTOS FRACOS específicos que reduzem a pontuação (cite o que falta ou está fraco)
      4. RECOMENDAÇÃO de ação (vale a pena entrar em contato? Como priorizar?)

      DIRETRIZES:
      - Seja específico e cite dados reais do perfil
      - Explique como cada pontuação componente contribui para o score final
      - Para scores altos (70+): enfatize por que é um lead valioso
      - Para scores médios (40-69): explique o potencial e o que poderia melhorar
      - Para scores baixos (<40): seja honesto sobre as limitações
      - A linguagem deve ser profissional mas conversacional
      - Mantenha a explicação concisa mas informativa (2-4 sentenças)
      - Limite pontos fortes e fracos a 2-3 itens cada (os mais relevantes)

      Responda em JSON:
      {
        "explanation": "Explicação clara e concisa da pontuação em 2-4 sentenças",
        "strengths": ["ponto forte 1", "ponto forte 2", ...],
        "weaknesses": ["ponto fraco 1", "ponto fraco 2", ...],
        "recommendation": "Recomendação de ação clara e prática em 1 sentença"
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente de qualificação de leads B2B especializado em análise detalhada. Forneça explicações claras, específicas e acionáveis em português. Use dados concretos do perfil do lead.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const result = JSON.parse(content) as DetailedScoringResult;

    // Validate result structure
    if (
      !result.explanation ||
      !Array.isArray(result.strengths) ||
      !Array.isArray(result.weaknesses) ||
      !result.recommendation
    ) {
      throw new Error("Invalid response structure from OpenAI");
    }

    return result;
  } catch (error) {
    logger.error({ err: error }, "Detailed scoring explanation failed");

    // Return fallback explanation based on final score
    const { finalScore } = breakdown;
    let explanation = "";
    let recommendation = "";

    if (finalScore >= 70) {
      explanation =
        "Lead altamente qualificado com boa correspondência aos critérios.";
      recommendation = "Priorize este lead para contato imediato.";
    } else if (finalScore >= 50) {
      explanation = "Lead qualificado com potencial razoável.";
      recommendation = "Considere contato após leads de maior prioridade.";
    } else if (finalScore >= 30) {
      explanation = "Lead parcialmente qualificado com sinais mistos.";
      recommendation = "Avalie com cautela antes de investir tempo.";
    } else {
      explanation = "Lead com baixa qualificação segundo os critérios.";
      recommendation = "Baixa prioridade - foque em leads mais qualificados.";
    }

    return {
      explanation,
      strengths: [],
      weaknesses: ["Análise detalhada indisponível"],
      recommendation,
    };
  }
}
