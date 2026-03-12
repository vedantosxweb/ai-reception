import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/api-auth';
import { KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';
const pdf = require('pdf-parse');

export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const textSnippet = formData.get('text') as string | null;
    const receptionistId = formData.get('receptionistId') as string | null;
    const name = formData.get('name') as string || 'Manual Upload';

    const tenantId = session.user.tenantId;

    let content = '';
    let sourceType: 'TEXT' | 'PDF' = 'TEXT';

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const data = await pdf(buffer);
        content = data.text;
        sourceType = 'TEXT'; // We store extracted text as TEXT source for now
      } else {
        content = buffer.toString('utf-8');
      }
    } else if (textSnippet) {
      content = textSnippet;
    } else {
      return NextResponse.json({ success: false, error: 'No content provided' }, { status: 400 });
    }

    if (!content.trim()) {
      return NextResponse.json({ success: false, error: 'Extracted content is empty' }, { status: 400 });
    }

    // Add to knowledge base
    const sourceId = await KnowledgeBaseService.addTextSource(
      tenantId,
      receptionistId || '', // If empty, it will be linked later or remain global
      name,
      content
    );

    return NextResponse.json({
      success: true,
      data: {
        sourceId,
        contentPreview: content.slice(0, 200) + '...',
      }
    });

  } catch (err: any) {
    console.error('[Knowledge Upload] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Upload failed' }, { status: 500 });
  }
}
