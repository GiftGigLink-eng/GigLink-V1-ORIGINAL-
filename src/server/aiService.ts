import { GoogleGenAI } from '@google/genai';
import { SanitizedAiContext, IlAiGuidanceResponse } from './aiContextDTOs';
import { buildIlAiPrompt, validateAndSanitizeAiResponse } from './aiPromptEngine';

/**
 * Server-side AI Service Layer.
 * Interacts with @google/genai using gemini-3.8-flash (with automatic fallback to gemini-3.1-flash-lite),
 * telemetry headers, JSON response enforcement, max token bounds, timeout protections, and safe fallbacks.
 */
export class IlAiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  private async callModelWithTimeout(
    modelName: string,
    prompt: string,
    timeoutMs: number
  ): Promise<string> {
    if (!this.ai) throw new Error('AI client not initialized');

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI Inference Timeout (${timeoutMs}ms on ${modelName})`)), timeoutMs)
    );

    const aiCallPromise = this.ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            greeting: { type: 'STRING' },
            summary: { type: 'STRING' },
            guidance: { type: 'STRING' },
            suggestedActions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING' },
                  actionType: { type: 'STRING', enum: ['navigate', 'filter', 'review', 'info'] },
                  target: { type: 'STRING' },
                },
                required: ['label', 'actionType'],
              },
            },
            contextualTip: { type: 'STRING' },
            trustInvariantNote: { type: 'STRING' },
          },
          required: ['greeting', 'summary', 'guidance', 'suggestedActions'],
        },
        maxOutputTokens: 1200,
        temperature: 0.2,
      },
    });

    const response = await Promise.race([aiCallPromise, timeoutPromise]);
    return response.text || '';
  }

  public async generateGuidance(
    context: SanitizedAiContext,
    userMessage?: string
  ): Promise<IlAiGuidanceResponse> {
    const memberName = context.user.displayName || 'Member';
    const fallbackGreeting = context.time.isReturningToday
      ? `Welcome back, ${memberName} — good to see you again today`
      : context.time.isReturningSession
      ? `Welcome back, ${memberName}`
      : `Good ${context.time.timeOfDay}, ${memberName}`;

    if (!this.ai) {
      console.warn('[IlAiService] GEMINI_API_KEY missing, using deterministic fallback.');
      return {
        greeting: fallbackGreeting,
        summary: `Guidance for ${context.user.activePersona} persona in ${context.workspace.workspaceType.replace(/_/g, ' ')}.`,
        guidance: 'GigLink AI service is operating in deterministic guidance mode. Your Trust Passport and workspace controls are active.',
        suggestedActions: [
          { label: 'View Trust Passport', actionType: 'navigate', target: '/passport' },
          { label: 'Explore Opportunities', actionType: 'navigate', target: '/opportunities' },
        ],
        contextualTip: 'Keep your proofs of work verified to maintain your Trust Score above 75.',
        trustInvariantNote: 'IL AI operates strictly as an advisory companion.',
      };
    }

    const prompt = buildIlAiPrompt(context, userMessage);
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const fallbackModel = 'gemini-3.1-flash-lite';

    let rawText = '';

    try {
      // 1. Attempt primary configured model with generous 14s timeout
      rawText = await this.callModelWithTimeout(primaryModel, prompt, 14000);
    } catch (primaryErr: any) {
      console.warn(
        `[IlAiService] Primary model (${primaryModel}) unavailable (${primaryErr?.message || primaryErr}). Attempting resilient fallback to ${fallbackModel}...`
      );

      try {
        // 2. If primary timed out or hit 503 spike, try fast fallback model with 10s timeout
        rawText = await this.callModelWithTimeout(fallbackModel, prompt, 10000);
      } catch (fallbackErr: any) {
        console.warn(
          `[IlAiService] Fallback model (${fallbackModel}) also unavailable (${fallbackErr?.message || fallbackErr}). Engaging deterministic fallback.`
        );
      }
    }

    if (rawText && rawText.trim().length > 0) {
      return validateAndSanitizeAiResponse(rawText, fallbackGreeting);
    }

    // Graceful, safe, authoritative fallback without throwing or breaking client rendering
    return {
      greeting: fallbackGreeting,
      summary: `Verified workspace assistance for ${context.user.displayName}.`,
      guidance: 'All verified opportunities, Trust Passport credentials, and milestone actions can be accessed directly from this workspace.',
      suggestedActions: [
        { label: 'View Trust Passport', actionType: 'navigate', target: '/passport' },
        { label: 'Explore Opportunities', actionType: 'navigate', target: '/opportunities' },
      ],
      trustInvariantNote: 'Cryptographic milestone reviews and signatures remain authoritative.',
    };
  }
}

export const defaultIlAiService = new IlAiService();
