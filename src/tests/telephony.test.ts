import { describe, it, expect } from 'vitest';
import { 
  buildGreetingTwiML, 
  buildResponseTwiML, 
  buildTransferTwiML, 
  buildVoicemailTwiML 
} from '@/lib/telephony/twilio.service';

describe('Telephony Service TwiML Builders', () => {
  it('should build a greeting TwiML with gather', () => {
    const twiml = buildGreetingTwiML({
      greeting: 'Hello world',
      gatherUrl: '/api/gather'
    });
    
    expect(twiml).toContain('<Say voice="Polly.Joanna" language="en-US">Hello world</Say>');
    expect(twiml).toContain('<Gather action="/api/gather"');
    expect(twiml).toContain('input="speech dtmf"');
  });

  it('should build a response TwiML with hangup', () => {
    const twiml = buildResponseTwiML({
      text: 'Goodbye',
      gatherUrl: '/api/gather',
      shouldHangup: true
    });
    
    expect(twiml).toContain('<Say voice="Polly.Joanna" language="en-US">Goodbye</Say>');
    expect(twiml).toContain('<Hangup/>');
    expect(twiml).not.toContain('<Gather');
  });

  it('should build a transfer TwiML with dial', () => {
    const twiml = buildTransferTwiML({
      message: 'Transferring you now',
      transferTo: '+1234567890'
    });
    
    expect(twiml).toContain('<Say voice="Polly.Joanna" language="en-US">Transferring you now</Say>');
    expect(twiml).toContain('<Dial');
    expect(twiml).toContain('+1234567890');
  });

  it('should build a voicemail TwiML with record', () => {
    const twiml = buildVoicemailTwiML({
      message: 'Please leave a message',
      callbackUrl: '/api/voicemail'
    });
    
    expect(twiml).toContain('<Say voice="Polly.Joanna" language="en-US">Please leave a message</Say>');
    expect(twiml).toMatch(/<Record[^>]+action="\/api\/voicemail"/);
  });
});
