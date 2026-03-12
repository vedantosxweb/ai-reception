// =============================================================================
// Receptionist Setup Wizard API - Onboarding flow
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwnerOrAdmin, requireSession } from '@/lib/api-auth';
import { WebScraperService, KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';
import type { WebScrapingResult } from '@/types';

// POST /api/v1/receptionists/wizard - Complete setup wizard
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const {
      // Step 1: Voice
      voiceProvider,
      voiceId,
      voiceSpeed,
      // Step 2: Company
      companyDescription,
      // Step 3: Website
      websiteUrl,
      // Step 4: Scrape (automatic)
      // Step 5: Knowledge base (auto-generated)
      // Step 6: Greeting
      greeting,
      // Step 7: Transfer rules
      transferRules,
      directory,
      // Step 8: Review & Deploy
      name,
      operatingMode,
      llmProvider,
      llmModel,
      systemPrompt,
      enableWelcomeSms,
      knowledgeSourceIds,
    } = body;

    const tenantId = session.user.tenantId;

    // 1. Update tenant description
    if (companyDescription) {
      await db.tenant.update({
        where: { id: tenantId },
        data: { description: companyDescription, website: websiteUrl },
      });
    }

    // 2. Create AI Receptionist
    const receptionist = await db.aIReceptionist.create({
      data: {
        tenantId,
        name: name || 'AI Receptionist',
        description: companyDescription,
        status: 'ACTIVE',
        voiceProvider: voiceProvider || 'openai',
        voiceId: voiceId || 'alloy',
        voiceSpeed: voiceSpeed ?? 1.0,
        llmProvider: llmProvider || 'openai',
        llmModel: llmModel || 'gpt-4o-mini',
        greeting: greeting || 'Hello! Thank you for calling. How can I help you today?',
        systemPrompt,
        operatingMode: operatingMode || 'standard',
        enableSmsFollowup: enableWelcomeSms ?? true,
      },
    });

    // 3. Website scraping & knowledge base
    let scrapedData: WebScrapingResult | null = null;
    if (websiteUrl) {
      try {
        scrapedData = await WebScraperService.scrapeWebsite(websiteUrl);

        // Auto-create knowledge source
        await KnowledgeBaseService.addWebsiteSource(tenantId, receptionist.id, websiteUrl);

        // Auto-add FAQs if found
        if (scrapedData.faqs.length > 0) {
          await KnowledgeBaseService.addFAQSource(tenantId, receptionist.id, scrapedData.faqs);
        }

        // Auto-add business info as text source
        const businessInfo = [
          scrapedData.title ? `Business: ${scrapedData.title}` : '',
          scrapedData.description ? `Description: ${scrapedData.description}` : '',
          scrapedData.services.length > 0 ? `Services: ${scrapedData.services.join(', ')}` : '',
          scrapedData.contactInfo.phone ? `Phone: ${scrapedData.contactInfo.phone}` : '',
          scrapedData.contactInfo.email ? `Email: ${scrapedData.contactInfo.email}` : '',
          scrapedData.location ? `Location: ${scrapedData.location}` : '',
        ].filter(Boolean).join('\n');

        if (businessInfo) {
          await KnowledgeBaseService.addTextSource(tenantId, receptionist.id, 'Business Info', businessInfo);
        }
      } catch (scrapeErr) {
        console.error('[Wizard] Website scraping failed:', scrapeErr);
        // Non-fatal - continue wizard
      }
    }

    // 4. Link existing knowledge sources (manual uploads)
    if (knowledgeSourceIds && Array.isArray(knowledgeSourceIds)) {
      await db.knowledgeSource.updateMany({
        where: { id: { in: knowledgeSourceIds }, tenantId },
        data: { receptionistId: receptionist.id },
      });
    }

    // 5. Create directory entries
    if (directory && Array.isArray(directory)) {
      for (const entry of directory) {
        await db.directoryEntry.create({
          data: {
            tenantId,
            name: entry.name,
            title: entry.title,
            department: entry.department,
            extension: entry.extension,
            phoneNumber: entry.phoneNumber,
            email: entry.email,
          },
        });
      }
    }

    // 5. Create transfer rules
    if (transferRules && Array.isArray(transferRules)) {
      for (const rule of transferRules) {
        await db.transferRule.create({
          data: {
            tenantId,
            name: rule.name,
            triggerType: rule.triggerType,
            triggerValue: rule.triggerValue,
            targetType: rule.targetType,
            targetValue: rule.targetValue,
            priority: rule.priority || 0,
            isActive: true,
          },
        });
      }
    }

    // Audit
    await db.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: 'receptionist.wizard_completed',
        resource: 'ai_receptionist',
        resourceId: receptionist.id,
        details: {
          hasWebsite: !!websiteUrl,
          scrapedFaqs: scrapedData?.faqs.length || 0,
          directoryEntries: directory?.length || 0,
          transferRules: transferRules?.length || 0,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        receptionist,
        scrapedData: scrapedData ? {
          title: scrapedData.title,
          description: scrapedData.description,
          services: scrapedData.services,
          faqs: scrapedData.faqs.length,
          contactInfo: scrapedData.contactInfo,
        } : null,
      },
      message: 'AI Receptionist created and deployed successfully!',
    });
  } catch (err) {
    console.error('[Wizard] Error:', err);
    return NextResponse.json({ success: false, error: 'Failed to complete wizard' }, { status: 500 });
  }
}

// GET /api/v1/receptionists/wizard - Scrape website preview
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
  }

  try {
    const scraped = await WebScraperService.scrapeWebsite(url);
    return NextResponse.json({ success: true, data: scraped });
  } catch (err) {
    console.error('[Wizard] Scrape error:', err);
    return NextResponse.json({ success: false, error: 'Failed to scrape website' }, { status: 500 });
  }
}
