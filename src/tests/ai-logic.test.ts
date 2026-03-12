import { describe, it, expect } from 'vitest';
import { buildReceptionistPrompt } from '@/lib/ai';

describe('AI Prompt Building Logic', () => {
  it('should include the greeting in the system prompt', () => {
    const mockConfig = {
      businessName: 'Tenant Name',
      greeting: 'Main Greeting',
      description: 'Core Instructions',
      operatingMode: 'standard',
      channel: 'voice' as const,
    };
    
    const prompt = buildReceptionistPrompt(mockConfig);
    
    expect(prompt).toContain('PROFESSIONAL AI RECEPTIONIST');
    expect(prompt).toContain('Tenant Name');
    expect(prompt).toContain('Core Instructions');
    expect(prompt).toContain('Main Greeting');
  });
});
