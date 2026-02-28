/**
 * AI Service Layer - Professional Receptionist
 * Handles Chat, Voice Calls, and SMS with proper booking flow
 * 
 * SUPPORTED PROVIDERS:
 * - Gemini (default, free tier) - Set GEMINI_API_KEY
 * - OpenAI (paid) - Set OPENAI_API_KEY and uncomment OpenAI code
 * - Groq (free tier) - Set GROQ_API_KEY and uncomment Groq code
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// ===== GEMINI (Default - Free Tier) =====
// npm install @google/generative-ai
// Set GEMINI_API_KEY in .env
// ========================================

// ===== OPENAI (Commented for future use) =====
// npm install openai
// Set OPENAI_API_KEY in .env
// Uncomment the code below and comment out Gemini code
/*
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// In generateResponse function, use:
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',  // or 'gpt-4o', 'gpt-3.5-turbo'
  messages: [
    { role: 'system', content: systemPrompt },
    ...context.history.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ],
  temperature: 0.7,
  max_tokens: 1024,
})
const responseText = completion.choices[0]?.message?.content
*/
// =============================================

// ===== GROQ (Commented for future use) =====
// npm install openai  (Groq uses OpenAI-compatible API)
// Set GROQ_API_KEY in .env
// Uncomment the code below and comment out Gemini code
/*
import OpenAI from 'openai'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

// In generateResponse function, use:
const completion = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',  // or 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'
  messages: [
    { role: 'system', content: systemPrompt },
    ...context.history.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ],
  temperature: 0.7,
  max_tokens: 1024,
})
const responseText = completion.choices[0]?.message?.content
*/
// ===========================================

// Types
export interface ConversationContext {
  sessionId: string
  channel: 'voice' | 'chat' | 'whatsapp'
  contactId?: string
  history: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
  }>
  metadata?: {
    phoneNumber?: string
    intent?: string
    sentiment?: string
    leadScore?: number
    bookingData?: {
      name?: string
      phone?: string
      email?: string
      date?: string
      time?: string
      service?: string
    }
  }
}

export interface AIResponse {
  text: string
  intent: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  actions?: AIAction[]
  leadScore?: number
  shouldEscalate: boolean
  bookingComplete?: boolean
}

export interface AIAction {
  type: 'booking' | 'transfer' | 'callback' | 'email' | 'sms' | 'lead_capture'
  data: Record<string, unknown>
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Conversation store
const conversations = new Map<string, ConversationContext>()

/**
 * Get or create conversation context
 */
export function getConversation(sessionId: string, channel: 'voice' | 'chat' | 'whatsapp'): ConversationContext {
  let context = conversations.get(sessionId)
  
  if (!context) {
    context = {
      sessionId,
      channel,
      history: [],
      metadata: { bookingData: {} },
    }
    conversations.set(sessionId, context)
  }

  return context
}

/**
 * Clear conversation
 */
export function clearConversation(sessionId: string): void {
  conversations.delete(sessionId)
}

/**
 * Generate AI response - Professional Receptionist
 */
export async function generateResponse(
  userMessage: string,
  context: ConversationContext,
  businessContext?: {
    businessName?: string
    services?: string[]
    businessHours?: string
    customPrompt?: string
  }
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(context, businessContext)

  try {
    // ===== GEMINI (Currently Active) =====
    console.log('[AI] Calling Gemini API...')

    // Build conversation history for Gemini
    const history = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      {
        role: 'model',
        parts: [{ text: 'I understand. I am ready to help as a professional AI Receptionist. I will collect booking information systematically and confirm appointments clearly.' }],
      },
      ...context.history.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model' as const,
        parts: [{ text: m.content }],
      })),
    ]

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(userMessage)
    const responseText = result.response.text() || 
      'I apologize, could you please repeat that?'

    console.log('[AI] Gemini API response received')
    // ======================================

    // ===== OPENAI (Commented - uncomment to use) =====
    // console.log('[AI] Calling OpenAI API...')
    // const completion = await openai.chat.completions.create({
    //   model: 'gpt-4o-mini',
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     ...context.history.slice(-10).map(m => ({
    //       role: m.role as 'user' | 'assistant',
    //       content: m.content,
    //     })),
    //     { role: 'user', content: userMessage },
    //   ],
    //   temperature: 0.7,
    //   max_tokens: 1024,
    // })
    // const responseText = completion.choices[0]?.message?.content || 'I apologize, could you please repeat that?'
    // console.log('[AI] OpenAI API response received')
    // ================================================

    // ===== GROQ (Commented - uncomment to use) =====
    // console.log('[AI] Calling Groq API...')
    // const completion = await groq.chat.completions.create({
    //   model: 'llama-3.3-70b-versatile',
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     ...context.history.slice(-10).map(m => ({
    //       role: m.role as 'user' | 'assistant',
    //       content: m.content,
    //     })),
    //     { role: 'user', content: userMessage },
    //   ],
    //   temperature: 0.7,
    //   max_tokens: 1024,
    // })
    // const responseText = completion.choices[0]?.message?.content || 'I apologize, could you please repeat that?'
    // console.log('[AI] Groq API response received')
    // ===============================================

    // Analyze intent and extract booking info
    const analysis = analyzeIntentAndSentiment(userMessage, responseText)
    const extractedData = extractBookingInfo(userMessage)
    
    // Update booking data in context
    if (context.metadata?.bookingData) {
      context.metadata.bookingData = {
        ...context.metadata.bookingData,
        ...extractedData,
      }
    }

    // Check if booking is complete
    const bookingData = context.metadata?.bookingData || {}
    const bookingComplete = !!(bookingData.name && bookingData.date && bookingData.time)

    // Calculate lead score
    const leadScore = calculateLeadScore(userMessage, context, analysis)

    // Determine if escalation needed
    const shouldEscalate = determineEscalation(analysis, leadScore, context)

    // Update context
    context.history.push(
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: responseText, timestamp: new Date() }
    )
    context.metadata = {
      ...context.metadata,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      leadScore,
    }

    return {
      text: responseText,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      leadScore,
      shouldEscalate,
      bookingComplete,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[AI] Error:', errorMessage)
    
    return {
      text: 'I apologize, I\'m having trouble right now. Please try again in a moment.',
      intent: 'error',
      sentiment: 'neutral',
      confidence: 0,
      shouldEscalate: true,
    }
  }
}

/**
 * Build professional receptionist system prompt
 */
function buildSystemPrompt(
  context: ConversationContext,
  businessContext?: {
    businessName?: string
    services?: string[]
    businessHours?: string
    customPrompt?: string
  }
): string {
  const businessName = businessContext?.businessName || 'Our Business'
  const services = businessContext?.services || ['Consultation', 'Product Demo', 'Support']
  const businessHours = businessContext?.businessHours || 'Monday-Friday, 9 AM - 5 PM'
  const channel = context.channel

  const bookingData = context.metadata?.bookingData || {}
  const collectedInfo = []
  if (bookingData.name) collectedInfo.push(`Name: ${bookingData.name}`)
  if (bookingData.phone) collectedInfo.push(`Phone: ${bookingData.phone}`)
  if (bookingData.email) collectedInfo.push(`Email: ${bookingData.email}`)
  if (bookingData.date) collectedInfo.push(`Date: ${bookingData.date}`)
  if (bookingData.time) collectedInfo.push(`Time: ${bookingData.time}`)
  if (bookingData.service) collectedInfo.push(`Service: ${bookingData.service}`)

  return `You are a PROFESSIONAL AI RECEPTIONIST for ${businessName}. You work on ${channel === 'voice' ? 'phone calls' : channel === 'whatsapp' ? 'WhatsApp' : 'live chat'}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Name: ${businessName}
• Services: ${services.join(', ')}
• Business Hours: ${businessHours}
• Available Time Slots: 9:00 AM, 10:00 AM, 11:00 AM, 2:00 PM, 3:00 PM, 4:00 PM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT CONVERSATION INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Already collected: ${collectedInfo.length > 0 ? collectedInfo.join(', ') : 'Nothing yet'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ROLE & BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are a FRIENDLY, PROFESSIONAL receptionist. Your job is to:
1. Greet callers warmly
2. Help them book appointments
3. Answer questions about services
4. Collect their information
5. CONFIRM bookings clearly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOKING FLOW (FOLLOW THIS EXACTLY!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 - GREETING:
"Hello! Thank you for calling ${businessName}. This is your virtual receptionist. How can I help you today?"

STEP 2 - WHEN THEY WANT TO BOOK:
"Of course! I'd be happy to help you schedule an appointment. May I have your name, please?"

STEP 3 - COLLECT INFO (one at a time):
• Name: "Thank you, [name]. What's the best phone number to reach you?"
• Phone: "Got it. And your email address for confirmation?"
• Email: "Perfect. What date would work best for you?"
• Date: "Great. We have availability at [mention 2-3 times]. Which works for you?"
• Time: "Excellent choice. What service are you interested in?"

STEP 4 - CONFIRM BOOKING (IMPORTANT!):
When you have ALL details, say:

"Perfect! Let me confirm your appointment:

📅 APPOINTMENT CONFIRMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Name: [their name]
• Date: [date]
• Time: [time]
• Service: [service]
• Phone: [phone]
• Email: [email]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You'll receive a confirmation shortly. Is there anything else I can help you with today?"

STEP 5 - CLOSING:
"Thank you for calling ${businessName}! We look forward to seeing you on [date]. Have a wonderful day! Goodbye."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Be warm and professional ALWAYS
• Keep responses SHORT (2-3 sentences max for ${channel})
• Ask ONE question at a time
• Confirm details before finalizing
• If they mention a time/date, acknowledge it
• If slot is unavailable, offer alternatives
• Never make up information
• Always end with "Is there anything else I can help you with?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR VOICE CALLS: Speak naturally with brief pauses
FOR TEXT/CHAT: Use emoji sparingly, stay professional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${businessContext?.customPrompt || ''}`
}

/**
 * Extract booking info from message
 */
function extractBookingInfo(message: string): Record<string, string> {
  const info: Record<string, string> = {}
  const lowerMessage = message.toLowerCase()
  
  // Extract name
  const nameMatch = message.match(/(?:my name is|i'm|i am|this is|call me|it's)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i)
  if (nameMatch) info.name = nameMatch[1].trim()
  
  // Extract email
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/)
  if (emailMatch) info.email = emailMatch[0]
  
  // Extract phone
  const phoneMatch = message.match(/(?:phone|number|cell|mobile)?\s*[:\s]?\s*([+]?[\d\s()-]{10,})/i)
  if (phoneMatch) info.phone = phoneMatch[1].replace(/\s/g, '')
  
  // Extract time
  const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i)
  if (timeMatch && (lowerMessage.includes('at') || lowerMessage.includes(timeMatch[0]))) {
    let hour = parseInt(timeMatch[1])
    const meridiem = timeMatch[3]?.toLowerCase()
    if ((meridiem === 'pm' || meridiem === 'p.m.') && hour < 12) hour += 12
    if ((meridiem === 'am' || meridiem === 'a.m.') && hour === 12) hour = 0
    info.time = `${hour.toString().padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}`
  }
  
  // Extract date
  const datePatterns = [
    { regex: /(\d{4}-\d{2}-\d{2})/, format: 'ymd' },
    { regex: /(\d{1,2})\/(\d{1,2})\/?(\d{2,4})?/, format: 'mdy' },
    { regex: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, format: 'day' },
    { regex: /(tomorrow|today)/i, format: 'relative' },
  ]
  
  for (const pattern of datePatterns) {
    const match = message.match(pattern.regex)
    if (match) {
      if (pattern.format === 'day') {
        // Convert day name to date
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const targetDay = days.indexOf(match[1].toLowerCase())
        const today = new Date()
        const todayDay = today.getDay()
        let daysUntil = targetDay - todayDay
        if (daysUntil <= 0) daysUntil += 7
        const targetDate = new Date(today)
        targetDate.setDate(today.getDate() + daysUntil)
        info.date = targetDate.toISOString().split('T')[0]
      } else if (pattern.format === 'relative') {
        const today = new Date()
        if (match[1].toLowerCase() === 'tomorrow') {
          today.setDate(today.getDate() + 1)
        }
        info.date = today.toISOString().split('T')[0]
      } else if (pattern.format === 'ymd') {
        info.date = match[1]
      } else if (pattern.format === 'mdy') {
        const month = match[1].padStart(2, '0')
        const day = match[2].padStart(2, '0')
        const year = match[3] || new Date().getFullYear().toString()
        info.date = `${year}-${month}-${day}`
      }
      break
    }
  }
  
  // Extract service
  const services = ['consultation', 'demo', 'support', 'meeting', 'appointment', 'checkup', 'review']
  for (const service of services) {
    if (lowerMessage.includes(service)) {
      info.service = service.charAt(0).toUpperCase() + service.slice(1)
      break
    }
  }
  
  return info
}

/**
 * Analyze intent and sentiment
 */
function analyzeIntentAndSentiment(
  userMessage: string,
  _aiResponse: string
): {
  intent: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
} {
  const lowerMessage = userMessage.toLowerCase()
  
  let intent = 'general_inquiry'
  let confidence = 0.7

  if (lowerMessage.includes('book') || lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('reserve')) {
    intent = 'booking'
    confidence = 0.9
  } else if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much') || lowerMessage.includes('fee')) {
    intent = 'pricing_inquiry'
    confidence = 0.85
  } else if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule') || lowerMessage.includes('change')) {
    intent = 'appointment_change'
    confidence = 0.9
  } else if (lowerMessage.includes('complaint') || lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('wrong')) {
    intent = 'support'
    confidence = 0.85
  } else if (lowerMessage.includes('hours') || lowerMessage.includes('open') || lowerMessage.includes('close') || lowerMessage.includes('when')) {
    intent = 'business_hours'
    confidence = 0.95
  } else if (lowerMessage.includes('service') || lowerMessage.includes('offer') || lowerMessage.includes('do you') || lowerMessage.includes('provide')) {
    intent = 'service_inquiry'
    confidence = 0.85
  } else if (lowerMessage.includes('speak') || lowerMessage.includes('human') || lowerMessage.includes('person') || lowerMessage.includes('manager')) {
    intent = 'escalation'
    confidence = 0.95
  } else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) {
    intent = 'gratitude'
    confidence = 0.95
  } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey') || lowerMessage.includes('good morning') || lowerMessage.includes('good afternoon')) {
    intent = 'greeting'
    confidence = 0.95
  } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
    intent = 'closing'
    confidence = 0.95
  }

  const positiveWords = ['thank', 'great', 'awesome', 'helpful', 'perfect', 'excellent', 'appreciate', 'love', 'good', 'wonderful', 'yes', 'sure', 'okay']
  const negativeWords = ['bad', 'terrible', 'awful', 'frustrated', 'angry', 'disappointed', 'hate', 'upset', 'complaint', 'problem', 'issue', 'no', 'never']
  
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
  
  const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length

  if (positiveCount > negativeCount) {
    sentiment = 'positive'
    confidence = Math.min(0.95, confidence + 0.1)
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative'
    confidence = Math.min(0.95, confidence + 0.1)
  }

  return { intent, sentiment, confidence }
}

/**
 * Calculate lead score (0-100)
 */
function calculateLeadScore(
  message: string,
  context: ConversationContext,
  analysis: { intent: string; sentiment: string }
): number {
  let score = 30

  if (analysis.intent === 'booking') score += 35
  else if (analysis.intent === 'pricing_inquiry') score += 25
  else if (analysis.intent === 'service_inquiry') score += 20
  else if (analysis.intent === 'appointment_change') score += 15

  if (analysis.sentiment === 'positive') score += 10

  if (context.history.length > 2) score += 10
  if (context.history.length > 4) score += 5

  if (context.metadata?.phoneNumber || /\+?\d{10,}/.test(message)) {
    score += 15
  }

  if (/@[\w.-]+\.\w+/.test(message)) {
    score += 15
  }

  return Math.min(100, score)
}

/**
 * Determine if escalation is needed
 */
function determineEscalation(
  analysis: { intent: string; sentiment: string; confidence: number },
  leadScore: number,
  context: ConversationContext
): boolean {
  if (analysis.intent === 'escalation') return true
  if (analysis.sentiment === 'negative' && analysis.confidence < 0.6) return true
  if (leadScore >= 80) return true
  if (context.history.length > 15) return true

  return false
}

/**
 * Process voice input for phone calls
 */
export async function processVoiceInput(
  speechText: string,
  sessionId: string
): Promise<AIResponse> {
  const context = getConversation(sessionId, 'voice')
  return generateResponse(speechText, context)
}

/**
 * Get booking data from context
 */
export function getBookingData(sessionId: string): Record<string, string> | undefined {
  const context = conversations.get(sessionId)
  return context?.metadata?.bookingData
}
