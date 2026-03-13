
import axios from 'axios';

const VAPI_WEBHOOK_URL = process.env.VAPI_SERVER_URL 
  ? `${process.env.VAPI_SERVER_URL}/api/webhooks/vapi` 
  : 'http://localhost:3000/api/webhooks/vapi';

async function testVapiToolCall() {
  console.log('--- Testing Vapi Tool Call (Check Availability) ---');
  try {
    const payload = {
      type: 'tool-call',
      message: {
        toolCalls: [
          {
            id: 'call_123',
            name: 'checkAvailability',
            parameters: {
              date: new Date().toISOString().split('T')[0],
              duration: 30
            }
          }
        ],
        call: {
          id: 'vapi_test_call_123',
          assistantId: 'test_assistant_id', // Make sure to use a real ID from your DB if testing live
          customer: { number: '+1234567890' }
        }
      }
    };

    const response = await axios.post(VAPI_WEBHOOK_URL, payload);
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));

    if (response.data.results?.[0]?.result?.slots) {
      console.log('✅ PASS: Successfully retrieved availability slots');
    } else {
      console.log('❌ FAIL: Availability slots Missing');
    }
  } catch (error: any) {
    console.error('❌ ERROR:', error.response?.data || error.message);
  }
}

async function testVapiEndReport() {
  console.log('\n--- Testing Vapi End of Call Report ---');
  try {
    const payload = {
      type: 'end-of-call-report',
      message: {
        call: {
          id: 'vapi_test_call_123',
          assistantId: 'test_assistant_id',
          customer: { number: '+1234567890' },
          duration: 125,
          phoneNumber: { number: '+19998887777' }
        },
        analysis: {
          summary: 'The user called to book an appointment.',
          structuredData: {
            intent: 'booking',
            sentiment: 'positive'
          }
        },
        artifact: {
          transcript: 'User: Hello, I want to book a slot.\nAssistant: Sure, let me check availability.\nUser: 2 PM sounds good.\nAssistant: Booked!'
        }
      }
    };

    const response = await axios.post(VAPI_WEBHOOK_URL, payload);
    console.log('Response Status:', response.status);
    console.log('✅ PASS: Call report sync triggered');
  } catch (error: any) {
    console.error('❌ ERROR:', error.response?.data || error.message);
  }
}

async function runTests() {
  await testVapiToolCall();
  await testVapiEndReport();
}

runTests();
