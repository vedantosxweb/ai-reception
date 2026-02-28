/**
 * WhatsApp Business API Integration Module
 * Handles all WhatsApp messaging operations
 */

// WhatsApp API types
interface WhatsAppMessage {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  text?: {
    preview_url: boolean
    body: string
  }
  template?: {
    name: string
    language: {
      code: string
    }
    components?: Array<{
      type: string
      parameters: Array<{ type: string; text?: string }>
    }>
  }
  image?: {
    link: string
    caption?: string
  }
  document?: {
    link: string
    caption?: string
    filename?: string
  }
  audio?: {
    link: string
  }
}

interface WhatsAppResponse {
  messaging_product: string
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
  }>
}

// WhatsApp client singleton
let accessToken: string | null = null
let phoneNumberId: string | null = null

export function initWhatsApp(config?: { accessToken?: string; phoneNumberId?: string }) {
  accessToken = config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || null
  phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null
}

/**
 * Send a text message via WhatsApp
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  previewUrl = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/[^0-9]/g, ''),
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to send message')
    }

    const data: WhatsAppResponse = await response.json()
    return { success: true, messageId: data.messages[0]?.id }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Send a template message via WhatsApp
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components?: Array<{
    type: string
    parameters: Array<{ type: string; text?: string }>
  }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/[^0-9]/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to send template')
    }

    const data: WhatsAppResponse = await response.json()
    return { success: true, messageId: data.messages[0]?.id }
  } catch (error) {
    console.error('Error sending WhatsApp template:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Send an image via WhatsApp
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/[^0-9]/g, ''),
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to send image')
    }

    const data: WhatsAppResponse = await response.json()
    return { success: true, messageId: data.messages[0]?.id }
  } catch (error) {
    console.error('Error sending WhatsApp image:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Send a document via WhatsApp
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp not configured' }
  }

  try {
    const message: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/[^0-9]/g, ''),
      type: 'document',
      document: {
        link: documentUrl,
        filename,
        caption,
      },
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to send document')
    }

    const data: WhatsAppResponse = await response.json()
    return { success: true, messageId: data.messages[0]?.id }
  } catch (error) {
    console.error('Error sending WhatsApp document:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  if (!accessToken || !phoneNumberId) {
    return false
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    )

    return response.ok
  } catch (error) {
    console.error('Error marking message as read:', error)
    return false
  }
}

/**
 * Verify WhatsApp webhook
 */
export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return challenge
  }

  return null
}

/**
 * Parse incoming WhatsApp webhook
 */
export function parseWhatsAppWebhook(body: any): Array<{
  from: string
  messageId: string
  timestamp: string
  type: string
  text?: string
  imageId?: string
  audioId?: string
  documentId?: string
}> {
  const messages: Array<{
    from: string
    messageId: string
    timestamp: string
    type: string
    text?: string
    imageId?: string
    audioId?: string
    documentId?: string
  }> = []

  try {
    const entries = body?.entry || []
    
    for (const entry of entries) {
      const changes = entry?.changes || []
      
      for (const change of changes) {
        const value = change?.value
        const messagesData = value?.messages || []
        
        for (const msg of messagesData) {
          const parsed: {
            from: string
            messageId: string
            timestamp: string
            type: string
            text?: string
            imageId?: string
            audioId?: string
            documentId?: string
          } = {
            from: msg.from,
            messageId: msg.id,
            timestamp: msg.timestamp,
            type: msg.type,
          }

          if (msg.type === 'text') {
            parsed.text = msg.text?.body
          } else if (msg.type === 'image') {
            parsed.imageId = msg.image?.id
          } else if (msg.type === 'audio') {
            parsed.audioId = msg.audio?.id
          } else if (msg.type === 'document') {
            parsed.documentId = msg.document?.id
          }

          messages.push(parsed)
        }
      }
    }
  } catch (error) {
    console.error('Error parsing WhatsApp webhook:', error)
  }

  return messages
}

/**
 * Download WhatsApp media
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer | null> {
  if (!accessToken) {
    return null
  }

  try {
    // Get media URL
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!mediaResponse.ok) {
      throw new Error('Failed to get media URL')
    }

    const mediaData = await mediaResponse.json()
    const mediaUrl = mediaData.url

    // Download the media
    const downloadResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!downloadResponse.ok) {
      throw new Error('Failed to download media')
    }

    const arrayBuffer = await downloadResponse.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('Error downloading WhatsApp media:', error)
    return null
  }
}

// Initialize on module load
initWhatsApp()
