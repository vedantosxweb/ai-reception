// =============================================================================
// FAQ Builder Service - AI-driven FAQ generation from transcripts
// =============================================================================

import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { generateAIResponse, getOrCreateSession } from '@/lib/ai';

export class FAQBuilderService {
  /**
   * Analyze recent call transcripts for a tenant and suggest FAQ entries.
   */
  static async suggestFAQs(tenantId: string) {
    log.ai.info({ tenantId }, 'Analyzing transcripts for FAQ suggestions');

    try {
      // 1. Fetch recent transcripts
      const transcripts = await db.transcript.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200, // Process last 200 transcript segments
      });

      if (transcripts.length === 0) {
        log.ai.warn({ tenantId }, 'No transcripts found for FAQ analysis');
        return [];
      }

      // 2. Consolidate into a conversation block
      const transcriptBlock = transcripts
        .map((t) => `${t.speaker}: ${t.content}`)
        .join('\n');

      // 3. Use AI to extract common questions and answers
      const systemPrompt = `
        You are an expert FAQ researcher. Analyze the provided conversation transcripts from an AI Receptionist service. 
        Identify the most common questions callers ask that aren't already answered.
        Return your findings as a JSON array of objects with "question" and "answer" fields.
        Keep answers concise and professional.
      `;

      // Use a temporary session for analysis
      const context = await getOrCreateSession(`faq-builder-${tenantId}`, tenantId, '', 'chat');
      
      const response = await generateAIResponse(
        `Transcripts:\n\n${transcriptBlock}`,
        context,
        {
          llmProvider: 'openai',
          llmModel: 'gpt-4o-mini',
          systemPrompt,
          temperature: 0.2,
          maxTokens: 1000,
        }
      );

      // 4. Parse suggestions
      try {
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        
        log.ai.info({ tenantId, count: suggestions.length }, 'FAQ suggestions generated');
        return suggestions;
      } catch (parseErr) {
        log.ai.error({ tenantId, error: parseErr, text: response.text }, 'Failed to parse FAQ suggestions');
        return [];
      }
    } catch (error) {
      log.ai.error({ tenantId, error }, 'FAQ suggestion analysis failed');
      throw error;
    }
  }
}
