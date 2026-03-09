// =============================================================================
// HubSpot CRM Service - Contact sync, deal management
// =============================================================================

import { db } from '@/lib/db';
import { deserializeIntegrationCredentials } from '@/lib/security/integration-credentials';
import { log } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobtitle?: string;
    [key: string]: string | undefined;
  };
}

interface HubSpotConfig {
  accessToken: string;
}

// =============================================================================
// HubSpot API Helpers
// =============================================================================

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

async function hubspotFetch(
  path: string,
  accessToken: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }

  return res.json();
}

// =============================================================================
// HubSpot Service
// =============================================================================

export class HubSpotService {
  /**
   * Get HubSpot integration config for a tenant.
   */
  static async getIntegration(tenantId: string): Promise<{
    integration: { id: string; status: string; config: unknown; credentials: unknown } | null;
    accessToken: string | null;
  }> {
    const integration = await db.integration.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'hubspot' } },
    });

    if (!integration || integration.status !== 'active' || !integration.credentials) {
      return { integration: null, accessToken: null };
    }

    const creds = deserializeIntegrationCredentials(integration.credentials) as HubSpotConfig | null;
    if (!creds?.accessToken) {
      return { integration: null, accessToken: null };
    }
    return { integration, accessToken: creds.accessToken };
  }

  /**
   * Sync a local Contact to HubSpot.
   * Creates if new, updates if hubspotContactId exists.
   */
  static async syncContact(
    tenantId: string,
    contactId: string
  ): Promise<{ success: boolean; hubspotId?: string; error?: string }> {
    try {
      const { accessToken } = await this.getIntegration(tenantId);
      if (!accessToken) return { success: false, error: 'HubSpot not connected' };

      const contact = await db.contact.findFirst({
        where: { id: contactId, tenantId },
      });

      if (!contact) return { success: false, error: 'Contact not found' };

      const properties: Record<string, string> = {
        firstname: contact.firstName || '',
        lastname: contact.lastName || '',
      };
      if (contact.email) properties.email = contact.email;
      if (contact.phone) properties.phone = contact.phone;
      if (contact.company) properties.company = contact.company;
      if (contact.position) properties.jobtitle = contact.position;
      if (contact.source) properties.hs_lead_status = contact.source;

      if (contact.hubspotContactId) {
        // Update existing
        await hubspotFetch(
          `/crm/v3/objects/contacts/${contact.hubspotContactId}`,
          accessToken,
          { method: 'PATCH', body: { properties } }
        );
        return { success: true, hubspotId: contact.hubspotContactId };
      } else {
        // Create new
        const result = await hubspotFetch(
          '/crm/v3/objects/contacts',
          accessToken,
          { method: 'POST', body: { properties } }
        ) as HubSpotContact;

        // Save hubspotContactId
        await db.contact.update({
          where: { id: contactId },
          data: { hubspotContactId: result.id },
        });

        return { success: true, hubspotId: result.id };
      }
    } catch (err) {
      log.api.error({ error: err, tenantId, contactId }, 'HubSpot sync contact error');
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Log a call engagement in HubSpot when a call ends.
   */
  static async logCallEngagement(
    tenantId: string,
    opts: {
      contactId: string;
      callDuration: number;
      summary?: string;
      sentiment?: string;
      intent?: string;
      direction: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { accessToken } = await this.getIntegration(tenantId);
      if (!accessToken) return { success: false, error: 'HubSpot not connected' };

      const contact = await db.contact.findFirst({
        where: { id: opts.contactId, tenantId },
      });

      if (!contact?.hubspotContactId) {
        // Try syncing first
        const syncResult = await this.syncContact(tenantId, opts.contactId);
        if (!syncResult.success || !syncResult.hubspotId) {
          return { success: false, error: 'Could not sync contact to HubSpot' };
        }
      }

      // Re-fetch to get hubspotContactId
      const updatedContact = await db.contact.findFirst({
        where: { id: opts.contactId, tenantId },
      });

      if (!updatedContact?.hubspotContactId) {
        return { success: false, error: 'No HubSpot contact ID' };
      }

      // Create a call engagement
      const body = `AI Receptionist Call\n` +
        `Duration: ${Math.ceil(opts.callDuration / 60)} min\n` +
        `Direction: ${opts.direction}\n` +
        (opts.intent ? `Intent: ${opts.intent}\n` : '') +
        (opts.sentiment ? `Sentiment: ${opts.sentiment}\n` : '') +
        (opts.summary ? `Summary: ${opts.summary}\n` : '');

      await hubspotFetch('/crm/v3/objects/calls', accessToken, {
        method: 'POST',
        body: {
          properties: {
            hs_call_title: `AI Call - ${opts.intent || 'General'}`,
            hs_call_body: body,
            hs_call_duration: String(opts.callDuration * 1000), // ms
            hs_call_direction: opts.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
            hs_call_status: 'COMPLETED',
            hs_timestamp: new Date().toISOString(),
          },
          associations: [
            {
              to: { id: updatedContact.hubspotContactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 194, // call_to_contact
                },
              ],
            },
          ],
        },
      });

      // Update last sync
      await db.integration.update({
        where: { tenantId_provider: { tenantId, provider: 'hubspot' } },
        data: { lastSyncAt: new Date() },
      });

      return { success: true };
    } catch (err) {
      log.api.error({ error: err, tenantId, contactId: opts.contactId }, 'HubSpot log call error');
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Test the HubSpot connection by fetching account info.
   */
  static async testConnection(accessToken: string): Promise<{
    success: boolean;
    portalId?: string;
    error?: string;
  }> {
    try {
      const result = await hubspotFetch('/account-info/v3/api-usage/daily/private-apps', accessToken) as {
        currentUsage?: number;
      };
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Bulk sync all contacts for a tenant to HubSpot.
   */
  static async bulkSync(tenantId: string): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const { accessToken } = await this.getIntegration(tenantId);
    if (!accessToken) return { synced: 0, failed: 0, errors: ['HubSpot not connected'] };

    const contacts = await db.contact.findMany({
      where: { tenantId },
      take: 500, // Batch limit
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      const result = await this.syncContact(tenantId, contact.id);
      if (result.success) {
        synced++;
      } else {
        failed++;
        errors.push(`${contact.firstName} ${contact.lastName}: ${result.error}`);
      }
    }

    // Update last sync
    await db.integration.update({
      where: { tenantId_provider: { tenantId, provider: 'hubspot' } },
      data: { lastSyncAt: new Date() },
    }).catch(() => {});

    return { synced, failed, errors };
  }
}
