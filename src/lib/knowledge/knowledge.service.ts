// =============================================================================
// Knowledge Base Service - Web scraping, PDF processing, embeddings
// =============================================================================

import { db } from '@/lib/db';
import type { WebScrapingResult, KnowledgeChunk } from '@/types';

// =============================================================================
// Web Scraping
// =============================================================================

export class WebScraperService {
  static async scrapeWebsite(url: string): Promise<WebScrapingResult> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AI-Receptionist-Bot/1.0 (Knowledge Base Builder)',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const html = await response.text();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Remove scripts, styles, nav, footer
      $('script, style, nav, footer, header, noscript, iframe').remove();

      const title = $('title').text().trim() || $('h1').first().text().trim() || '';
      const description = $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') || '';

      // Extract services
      const services: string[] = [];
      $('h2, h3, h4').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 3 && text.length < 100 && !text.includes('©')) {
          services.push(text);
        }
      });

      // Extract FAQs
      const faqs: Array<{ question: string; answer: string }> = [];
      $('[itemtype*="FAQPage"] [itemprop="mainEntity"], .faq-item, .accordion-item, details').each((_, el) => {
        const question = $(el).find('[itemprop="name"], summary, .faq-question, h3, h4').first().text().trim();
        const answer = $(el).find('[itemprop="text"], .faq-answer, p').first().text().trim();
        if (question && answer) {
          faqs.push({ question, answer });
        }
      });

      // Extract business hours
      const businessHours: string[] = [];
      const hoursPattern = /(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*[\s:]+\d{1,2}[:\s]*\d{0,2}\s*(?:am|pm)/gi;
      const bodyText = $('body').text();
      const hoursMatches = bodyText.match(hoursPattern);
      if (hoursMatches) {
        businessHours.push(...hoursMatches.slice(0, 7));
      }

      // Extract contact info
      const contactInfo: { phone?: string; email?: string; address?: string } = {};
      const phoneMatch = bodyText.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) contactInfo.phone = phoneMatch[0];

      const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) contactInfo.email = emailMatch[0];

      // Extract location
      const addressEl = $('[itemprop="address"], .address, [class*="address"]');
      const location = addressEl.text().trim() || '';

      // Get main content
      const rawContent = $('main, article, .content, #content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50000); // Limit to 50k chars

      return {
        title,
        description,
        services: services.slice(0, 20),
        businessHours,
        faqs: faqs.slice(0, 30),
        location,
        contactInfo,
        rawContent,
      };
    } catch (error) {
      console.error('[WebScraper] Error:', error);
      throw error;
    }
  }
}

// =============================================================================
// Knowledge Base Service
// =============================================================================

export class KnowledgeBaseService {
  // =========================================================================
  // Source Management
  // =========================================================================

  static async addWebsiteSource(tenantId: string, receptionistId: string, url: string): Promise<string> {
    const source = await db.knowledgeSource.create({
      data: {
        tenantId,
        receptionistId,
        type: 'WEBSITE',
        name: new URL(url).hostname,
        url,
        status: 'PENDING',
      },
    });

    // Process in background (simulated)
    this.processWebsiteSource(source.id, tenantId, url).catch(console.error);

    return source.id;
  }

  static async addFAQSource(tenantId: string, receptionistId: string, faqs: Array<{ question: string; answer: string }>): Promise<string> {
    const content = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

    const source = await db.knowledgeSource.create({
      data: {
        tenantId,
        receptionistId,
        type: 'FAQ',
        name: 'Custom FAQs',
        content,
        status: 'PENDING',
      },
    });

    await this.processTextContent(source.id, tenantId, content);
    return source.id;
  }

  static async addTextSource(tenantId: string, receptionistId: string, name: string, content: string): Promise<string> {
    const source = await db.knowledgeSource.create({
      data: {
        tenantId,
        receptionistId,
        type: 'TEXT',
        name,
        content,
        status: 'PENDING',
      },
    });

    await this.processTextContent(source.id, tenantId, content);
    return source.id;
  }

  static async deleteSource(sourceId: string, tenantId: string): Promise<void> {
    await db.embedding.deleteMany({ where: { knowledgeSourceId: sourceId, tenantId } });
    await db.knowledgeSource.delete({ where: { id: sourceId } });
  }

  // =========================================================================
  // Processing
  // =========================================================================

  private static async processWebsiteSource(sourceId: string, tenantId: string, url: string): Promise<void> {
    try {
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: 'PROCESSING' },
      });

      const scraped = await WebScraperService.scrapeWebsite(url);

      // Build structured content
      let content = '';
      if (scraped.title) content += `Company: ${scraped.title}\n\n`;
      if (scraped.description) content += `About: ${scraped.description}\n\n`;
      if (scraped.services.length > 0) content += `Services:\n${scraped.services.map((s) => `- ${s}`).join('\n')}\n\n`;
      if (scraped.businessHours.length > 0) content += `Business Hours:\n${scraped.businessHours.join('\n')}\n\n`;
      if (scraped.contactInfo.phone) content += `Phone: ${scraped.contactInfo.phone}\n`;
      if (scraped.contactInfo.email) content += `Email: ${scraped.contactInfo.email}\n`;
      if (scraped.location) content += `Location: ${scraped.location}\n`;

      if (scraped.faqs.length > 0) {
        content += '\nFrequently Asked Questions:\n';
        for (const faq of scraped.faqs) {
          content += `\nQ: ${faq.question}\nA: ${faq.answer}\n`;
        }
      }

      // Add raw content
      if (scraped.rawContent) {
        content += `\n\nAdditional Information:\n${scraped.rawContent.slice(0, 20000)}`;
      }

      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: {
          content,
          metadata: {
            title: scraped.title,
            description: scraped.description,
            services: scraped.services,
            businessHours: scraped.businessHours,
            faqs: scraped.faqs,
            contactInfo: scraped.contactInfo,
            location: scraped.location,
          },
        },
      });

      await this.processTextContent(sourceId, tenantId, content);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: 'ERROR', errorMessage: errMsg },
      });
    }
  }

  private static async processTextContent(sourceId: string, tenantId: string, content: string): Promise<void> {
    try {
      // Chunk content
      const chunks = this.chunkText(content, 500, 50);

      // Create embeddings
      const embeddingRecords = chunks.map((chunk, index) => ({
        tenantId,
        knowledgeSourceId: sourceId,
        content: chunk,
        chunkIndex: index,
      }));

      await db.embedding.createMany({ data: embeddingRecords });

      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: 'READY',
          chunkCount: chunks.length,
          lastSyncedAt: new Date(),
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.knowledgeSource.update({
        where: { id: sourceId },
        data: { status: 'ERROR', errorMessage: errMsg },
      });
    }
  }

  // =========================================================================
  // Retrieval
  // =========================================================================

  static async getRelevantContext(
    tenantId: string,
    receptionistId: string,
    query: string,
    maxChunks: number = 5
  ): Promise<string> {
    // For now, use simple keyword matching
    // In production with vector DB, this would do similarity search
    const embeddings = await db.embedding.findMany({
      where: {
        tenantId,
        knowledgeSource: {
          receptionistId,
          status: 'READY',
        },
      },
      select: { content: true },
    });

    if (embeddings.length === 0) return '';

    // Simple relevance scoring
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = embeddings.map((e) => {
      const lower = e.content.toLowerCase();
      const score = queryWords.reduce((s, word) => s + (lower.includes(word) ? 1 : 0), 0);
      return { content: e.content, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.slice(0, maxChunks).filter((s) => s.score > 0);

    if (relevant.length === 0) {
      // Return first few chunks as general context
      return embeddings.slice(0, maxChunks).map((e) => e.content).join('\n\n');
    }

    return relevant.map((r) => r.content).join('\n\n');
  }

  // =========================================================================
  // Text Chunking
  // =========================================================================

  private static chunkText(text: string, maxChunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep overlap
        const words = currentChunk.split(' ');
        currentChunk = words.slice(-overlap).join(' ') + ' ' + sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
