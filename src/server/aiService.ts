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
  // Map of model names to timestamp until which the model is in quota cooldown
  private static modelCooldowns = new Map<string, number>();

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

  private static isModelInCooldown(modelName: string): boolean {
    const cooldownUntil = IlAiService.modelCooldowns.get(modelName);
    if (!cooldownUntil) return false;
    if (Date.now() < cooldownUntil) {
      return true;
    }
    IlAiService.modelCooldowns.delete(modelName);
    return false;
  }

  private static setModelCooldown(modelName: string, err: any): void {
    let delayMs = 60 * 60 * 1000; // Default 1 hour cooldown for daily/per-model quota exhaustions

    try {
      // Parse retryDelay from Google RPC details if available
      const retryDelayStr = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')
        ? err?.details?.[2]?.retryDelay || err?.error?.details?.[2]?.retryDelay
        : null;

      if (retryDelayStr && typeof retryDelayStr === 'string' && retryDelayStr.endsWith('s')) {
        const seconds = parseFloat(retryDelayStr.slice(0, -1));
        if (!isNaN(seconds) && seconds > 0) {
          delayMs = Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
        }
      }
    } catch {
      // Use default delayMs
    }

    IlAiService.modelCooldowns.set(modelName, Date.now() + delayMs);
  }

  private async callModelWithTimeout(
    modelName: string,
    prompt: string,
    timeoutMs: number
  ): Promise<string> {
    if (!this.ai) throw new Error('AI client not initialized');

    if (IlAiService.isModelInCooldown(modelName)) {
      throw new Error(`Model ${modelName} is currently in quota backoff`);
    }

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

    try {
      const response = await Promise.race([aiCallPromise, timeoutPromise]);
      return response.text || '';
    } catch (err: any) {
      const isQuotaError =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      if (isQuotaError) {
        IlAiService.setModelCooldown(modelName, err);
      }
      throw err;
    }
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

    const isPrimaryCoolingDown = IlAiService.isModelInCooldown(primaryModel);

    if (!isPrimaryCoolingDown) {
      try {
        // 1. Attempt primary configured model with generous 14s timeout
        rawText = await this.callModelWithTimeout(primaryModel, prompt, 14000);
      } catch (primaryErr: any) {
        const isQuota =
          primaryErr?.status === 429 ||
          primaryErr?.message?.includes('429') ||
          primaryErr?.message?.includes('RESOURCE_EXHAUSTED');

        if (!isQuota) {
          console.warn(
            `[IlAiService] Primary model (${primaryModel}) unavailable (${primaryErr?.message || primaryErr}). Attempting resilient fallback to ${fallbackModel}...`
          );
        }
      }
    }

    if (!rawText || rawText.trim().length === 0) {
      const isFallbackCoolingDown = IlAiService.isModelInCooldown(fallbackModel);
      if (!isFallbackCoolingDown) {
        try {
          // 2. If primary in cooldown or failed, try fast fallback model with 10s timeout
          rawText = await this.callModelWithTimeout(fallbackModel, prompt, 10000);
        } catch (fallbackErr: any) {
          const isQuota =
            fallbackErr?.status === 429 ||
            fallbackErr?.message?.includes('429') ||
            fallbackErr?.message?.includes('RESOURCE_EXHAUSTED');

          if (!isQuota) {
            console.warn(
              `[IlAiService] Fallback model (${fallbackModel}) also unavailable (${fallbackErr?.message || fallbackErr}). Engaging deterministic fallback.`
            );
          }
        }
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
