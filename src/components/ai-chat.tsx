'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Loader2,
  Mic,
  Calendar,
  CheckCircle,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isLoading?: boolean
  intent?: string
  sentiment?: string
  booking?: {
    id: string
    date: Date
    contact: string
  }
  availableSlots?: AvailableSlot[]
}

interface AvailableSlot {
  date: string
  day: string
  slots: string[]
}

interface BookingData {
  name?: string
  email?: string
  phone?: string
  date?: string
  time?: string
}

const quickActions = [
  { label: 'Book Appointment', prompt: 'I would like to book an appointment' },
  { label: 'Get Pricing', prompt: 'Can you tell me about your pricing?' },
  { label: 'Contact Info', prompt: 'What is your contact information?' },
]

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Receptionist. I can help you book appointments, answer questions, and more. Would you like to schedule an appointment?",
      timestamp: new Date(),
      intent: 'greeting',
      sentiment: 'positive'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [bookingData, setBookingData] = useState<BookingData>({})
  const [collectingBooking, setCollectingBooking] = useState(false)
  // ✅ FIX: Generate a stable sessionId once per component mount so the server
  //         can maintain conversation history across messages.
  const sessionIdRef = useRef<string>(`chat_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Extract booking info from message
  // ✅ FIX: smarter extraction that handles bare name/phone responses
  const extractBookingInfo = (message: string, currentBooking: BookingData): Partial<BookingData> => {
    const info: Partial<BookingData> = {}
    const trimmed = message.trim()

    // Email (unambiguous)
    const emailMatch = trimmed.match(/[\w.-]+@[\w.-]+\.\w+/)
    if (emailMatch) info.email = emailMatch[0]

    // Phone: explicit prefix OR bare digit string 9–15 digits
    const phoneExplicit = trimmed.match(/(?:phone|number|mobile|cell|call)\s*(?:is|:)?\s*([\d\s\-+()]{9,})/i)
    const phoneBare = /^[\s+\-()\d]{9,15}$/.test(trimmed) && /\d{9,}/.test(trimmed.replace(/\D/g, ''))
    if (phoneExplicit) {
      info.phone = phoneExplicit[1].replace(/\D/g, '')
    } else if (phoneBare && !currentBooking.phone) {
      info.phone = trimmed.replace(/\D/g, '')
    }

    // Time (only when not a bare phone number)
    if (!info.phone) {
      const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i)
      if (timeMatch) {
        let hour = parseInt(timeMatch[1])
        const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, '')
        if (meridiem === 'pm' && hour < 12) hour += 12
        if (meridiem === 'am' && hour === 12) hour = 0
        if (hour >= 0 && hour <= 23) {
          info.time = `${hour.toString().padStart(2, '0')}:${(timeMatch[2] || '00').padStart(2, '0')}`
        }
      }
    }

    // Date
    const datePatterns: Array<{ regex: RegExp; format: string }> = [
      { regex: /(\d{4}-\d{2}-\d{2})/, format: 'ymd' },
      { regex: /(\d{1,2})\/(\d{1,2})\/?(\d{2,4})?/, format: 'mdy' },
      { regex: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, format: 'day' },
      { regex: /(tomorrow|today)/i, format: 'relative' },
    ]
    for (const { regex, format } of datePatterns) {
      const match = trimmed.match(regex)
      if (match) {
        if (format === 'day') {
          const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
          const targetDay = days.indexOf(match[1].toLowerCase())
          const now = new Date(); const todayDay = now.getDay()
          let daysUntil = targetDay - todayDay
          if (daysUntil <= 0) daysUntil += 7
          const d = new Date(now); d.setDate(now.getDate() + daysUntil)
          info.date = d.toISOString().split('T')[0]
        } else if (format === 'relative') {
          const d = new Date()
          if (match[1].toLowerCase() === 'tomorrow') d.setDate(d.getDate() + 1)
          info.date = d.toISOString().split('T')[0]
        } else if (format === 'ymd') {
          info.date = match[1]
        } else {
          const yr = match[3] ? (match[3].length === 2 ? '20' + match[3] : match[3]) : String(new Date().getFullYear())
          info.date = `${yr}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`
        }
        break
      }
    }

    // Name: explicit OR bare word(s) when name not yet collected and nothing else matched
    const nameExplicit = trimmed.match(/(?:my name is|i'm|i am|this is|call me|it's)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i)
    if (nameExplicit) {
      info.name = nameExplicit[1].trim()
    } else if (
      !currentBooking.name &&
      !info.phone && !info.email && !info.date && !info.time &&
      /^[a-zA-Z]+(?:\s+[a-zA-Z]+)?$/.test(trimmed) &&
      trimmed.split(' ').length <= 3 &&
      trimmed.length >= 2
    ) {
      info.name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    }

    return info
  }

  // Check if we have all required booking info
  const hasAllBookingInfo = (data: BookingData): boolean => {
    return !!(data.name && data.date && data.time)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsTyping(true)

    try {
      // Extract any booking info from the message
      const extractedInfo = extractBookingInfo(content, bookingData)
      const updatedBookingData = { ...bookingData, ...extractedInfo }
      setBookingData(updatedBookingData)

      // ✅ FIX: always include sessionId so the server maintains conversation memory
      const requestBody: Record<string, unknown> = {
        message: content.trim(),
        sessionId: sessionIdRef.current,
      }

      if (collectingBooking && hasAllBookingInfo(updatedBookingData)) {
        requestBody.bookingData = updatedBookingData
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      // Handle booking confirmation
      if (data.intent === 'booking_confirmed') {
        setCollectingBooking(false)
        setBookingData({})
      }

      // Handle availability check
      if (data.availableSlots && data.availableSlots.length > 0) {
        setCollectingBooking(true)
      }

      // Check if we should start collecting booking info
      if (data.intent === 'booking' && !collectingBooking) {
        setCollectingBooking(true)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an issue. Please try again.',
        timestamp: new Date(),
        intent: data.intent,
        sentiment: data.sentiment,
        booking: data.booking,
        availableSlots: data.availableSlots,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered a connection issue. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    // Clear server-side session
    fetch(`/api/chat?sessionId=${sessionIdRef.current}`, { method: 'DELETE' }).catch(() => {})
    // Generate fresh session id for the new conversation
    sessionIdRef.current = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your AI Receptionist. How can I assist you today?",
        timestamp: new Date(),
        intent: 'greeting'
      }
    ])
    setBookingData({})
    setCollectingBooking(false)
  }

  // Quick slot selection
  const selectSlot = (date: string, time: string) => {
    setBookingData(prev => ({ ...prev, date, time }))
    sendMessage(`I'd like ${time} on ${date}`)
  }

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)] flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <Card className="border-0 shadow-lg mb-3 lg:mb-4 flex-shrink-0">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white text-sm lg:text-base">AI Receptionist</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs lg:text-sm text-slate-500 dark:text-slate-400">Online • Powered by Gemini AI</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-9 lg:w-9" onClick={clearChat}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="flex-1 border-0 shadow-lg overflow-hidden min-h-0">
          <ScrollArea className="h-full p-3 lg:p-4">
            <div className="space-y-3 lg:space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={cn(
                      "flex gap-2 lg:gap-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] lg:max-w-[70%] rounded-2xl px-3 lg:px-4 py-2 lg:py-3",
                        message.role === 'user'
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      {/* Booking Confirmation */}
                      {message.booking && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Appointment Confirmed!</span>
                        </div>
                      )}
                      
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm lg:text-base">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      
                      {/* Available Slots */}
                      {message.availableSlots && message.availableSlots.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.availableSlots.slice(0, 3).map((slot) => (
                            <div key={slot.date} className="p-2 bg-white dark:bg-slate-700 rounded-lg">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{slot.day}</p>
                              <div className="flex flex-wrap gap-1">
                                {slot.slots.slice(0, 4).map((time) => (
                                  <Button
                                    key={time}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs"
                                    onClick={() => selectSlot(slot.date, time)}
                                  >
                                    {time}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1.5 lg:mt-2">
                        <span className={cn(
                          "text-xs",
                          message.role === 'user' ? "text-white/70" : "text-slate-400"
                        )}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.intent && (
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                            {message.intent}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-600 dark:text-slate-400" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 lg:gap-3 justify-start"
                >
                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 lg:px-4 py-2 lg:py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </Card>

        {/* Booking Status */}
        {collectingBooking && (
          <Card className="border-0 shadow-lg mt-2 flex-shrink-0">
            <CardContent className="p-2 lg:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-500">Booking:</span>
                  {bookingData.name && <Badge variant="outline" className="text-xs">{bookingData.name}</Badge>}
                  {bookingData.date && <Badge variant="outline" className="text-xs">{bookingData.date}</Badge>}
                  {bookingData.time && <Badge variant="outline" className="text-xs">{bookingData.time}</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setCollectingBooking(false); setBookingData({}) }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Input Area */}
        <Card className="border-0 shadow-lg mt-3 lg:mt-4 flex-shrink-0">
          <CardContent className="p-3 lg:p-4">
            <div className="flex gap-2 lg:gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={collectingBooking ? "Enter your name, preferred date/time..." : "Type your message..."}
                  className="w-full h-10 lg:h-12 rounded-xl pr-12 lg:pr-24 text-sm lg:text-base"
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="h-10 lg:h-12 px-4 lg:px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 lg:w-5 lg:h-5" />
                )}
              </Button>
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2.5 lg:mt-3">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(action.prompt)}
                  className="rounded-full text-xs lg:text-sm h-7 lg:h-8"
                  disabled={isLoading}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side Panel - Desktop Only */}
      <div className="w-full lg:w-80 hidden lg:block flex-shrink-0">
        <Card className="border-0 shadow-lg h-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              AI Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Intelligent Responses</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Natural language understanding with context awareness for human-like conversations.
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Appointment Booking</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatically check availability and schedule appointments with CRM integration.
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Lead Capture</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identify potential customers and capture contact information automatically.
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Sentiment Analysis</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time emotion detection for better customer experience management.
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Session Stats</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Messages</span>
                <span className="font-medium">{messages.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Avg Response</span>
                <span className="font-medium text-emerald-500">~1s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
