import twilio from 'twilio';

export interface TwilioNumberResult {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  isoCountry: string;
  monthlyCost?: string; // Formatted price if available
}

/**
 * Service for interacting with the Twilio API for phone number provisioning.
 */
export class TwilioService {
  private static getClient() {
    // We defer initialization so it doesn't crash on import if env vars are missing
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
       throw new Error('Twilio credentials missing. Cannot initialize client.');
    }
    return twilio(accountSid, authToken);
  }

  /**
   * Searches for available Twilio numbers in a specific area.
   * 
   * @param countryCode 2-letter ISO country code (e.g., 'US', 'GB')
   * @param areaCode Optional specific area code to search within
   * @param limit Maximum number of results to return (default 10)
   */
  static async searchAvailableNumbers(
    countryCode: string = 'US', 
    areaCode?: string,
    limit: number = 10
  ): Promise<TwilioNumberResult[]> {
    try {
      const client = this.getClient();
      
      const searchParams: any = {
        limit,
        voiceEnabled: true,
        smsEnabled: true
      };

      if (areaCode) {
        searchParams.areaCode = areaCode;
      }

      const numbers = await client.availablePhoneNumbers(countryCode)
        .local
        .list(searchParams);

      return numbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality,
        region: num.region,
        isoCountry: num.isoCountry,
        // Standard Twilio monthly cost for local numbers is generally $1.15 in the US,
        // but can vary. We hardcode a display string here since the pricing API is complex.
        monthlyCost: countryCode === 'US' ? '$1.15/mo' : 'Varied' 
      }));

    } catch (error: any) {
      console.error('[TwilioService] Search failed:', error.message);
      throw new Error(`Failed to search Twilio numbers: ${error.message}`);
    }
  }

  /**
   * Purchases a specific phone number and immediately binds it to our production webhooks.
   * 
   * @param phoneNumber The E.164 formatted phone number to purchase (e.g., +1234567890)
   * @returns The newly created Twilio IncomingPhoneNumber object sid
   */
  static async purchaseAndConfigureNumber(phoneNumber: string): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_APP_URL is not defined. Cannot configure webhooks.');
    }

    try {
      const client = this.getClient();

      // Ensure the base URL doesn't end with a slash
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const webhookUrls = {
        voiceUrl: `${cleanBaseUrl}/api/v1/webhooks/twilio/voice`,
        smsUrl: `${cleanBaseUrl}/api/v1/webhooks/twilio/sms`,
        statusCallback: `${cleanBaseUrl}/api/v1/webhooks/twilio/status`
      };

      console.log(`[TwilioService] Purchasing ${phoneNumber} and binding to ${cleanBaseUrl}...`);

      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl: webhookUrls.voiceUrl,
        voiceMethod: 'POST',
        smsUrl: webhookUrls.smsUrl,
        smsMethod: 'POST',
        statusCallback: webhookUrls.statusCallback,
        statusCallbackMethod: 'POST'
      });

      console.log(`[TwilioService] Successfully provisioned ${phoneNumber} (SID: ${purchasedNumber.sid})`);
      
      return purchasedNumber.sid;

    } catch (error: any) {
      console.error('[TwilioService] Purchase/Config failed:', error.message);
      throw new Error(`Failed to provision Twilio number: ${error.message}`);
    }
  }
}
