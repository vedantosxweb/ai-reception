'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  MoreVertical,
  Phone,
  Video,
  Search,
  CheckCheck,
  Clock,
  User,
  Bot,
  Sparkles,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface WhatsAppContact {
  id: string
  name: string
  phone: string
  avatar: string
  lastMessage: string
  lastMessageTime: Date
  unread: number
  status: 'online' | 'offline'
}

interface WhatsAppMessage {
  id: string
  contactId: string
  content: string
  direction: 'inbound' | 'outbound'
  timestamp: Date
  status: 'sent' | 'delivered' | 'read'
  type: 'text' | 'image' | 'document'
}

const mockContacts: WhatsAppContact[] = [
  { id: '1', name: 'John Smith', phone: '+1 555-0101', avatar: '', lastMessage: 'Thanks for the information!', lastMessageTime: new Date(Date.now() - 300000), unread: 0, status: 'online' },
  { id: '2', name: 'Sarah Johnson', phone: '+1 555-0102', avatar: '', lastMessage: 'Can we reschedule to 3pm?', lastMessageTime: new Date(Date.now() - 600000), unread: 2, status: 'online' },
  { id: '3', name: 'Mike Chen', phone: '+1 555-0103', avatar: '', lastMessage: 'Great, see you then!', lastMessageTime: new Date(Date.now() - 1800000), unread: 0, status: 'offline' },
  { id: '4', name: 'Emily Davis', phone: '+1 555-0104', avatar: '', lastMessage: 'What are your business hours?', lastMessageTime: new Date(Date.now() - 3600000), unread: 1, status: 'offline' },
  { id: '5', name: 'Robert Wilson', phone: '+1 555-0105', avatar: '', lastMessage: 'I need help with my booking', lastMessageTime: new Date(Date.now() - 7200000), unread: 0, status: 'offline' },
]

const mockMessages: WhatsAppMessage[] = [
  { id: '1', contactId: '1', content: 'Hello! I saw your services online and I\'m interested.', direction: 'inbound', timestamp: new Date(Date.now() - 600000), status: 'read', type: 'text' },
  { id: '2', contactId: '1', content: 'Hello John! Thank you for reaching out. I\'d be happy to help you with information about our services. What specific service are you interested in?', direction: 'outbound', timestamp: new Date(Date.now() - 570000), status: 'read', type: 'text' },
  { id: '3', contactId: '1', content: 'I\'m looking for a consultation for my business.', direction: 'inbound', timestamp: new Date(Date.now() - 540000), status: 'read', type: 'text' },
  { id: '4', contactId: '1', content: 'Great! We offer business consultations. Would you like to schedule a call? I can check our availability for this week.', direction: 'outbound', timestamp: new Date(Date.now() - 510000), status: 'read', type: 'text' },
  { id: '5', contactId: '1', content: 'Thanks for the information!', direction: 'inbound', timestamp: new Date(Date.now() - 300000), status: 'read', type: 'text' },
]

export default function WhatsAppPanel() {
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(mockContacts[0])
  const [contacts, setContacts] = useState<WhatsAppContact[]>(mockContacts)
  const [messages, setMessages] = useState<WhatsAppMessage[]>(mockMessages)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedContact) return

    const message: WhatsAppMessage = {
      id: Date.now().toString(),
      contactId: selectedContact.id,
      content: newMessage.trim(),
      direction: 'outbound',
      timestamp: new Date(),
      status: 'sent',
      type: 'text'
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: WhatsAppMessage = {
        id: (Date.now() + 1).toString(),
        contactId: selectedContact.id,
        content: 'This is an automated response from your AI Receptionist. A team member will follow up shortly.',
        direction: 'outbound',
        timestamp: new Date(),
        status: 'sent',
        type: 'text'
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1500)
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  )

  const currentMessages = messages.filter(m => m.contactId === selectedContact?.id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage WhatsApp conversations with shared AI intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5 bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
            <MessageCircle className="w-3 h-3 mr-2 text-green-500" />
            <span className="text-green-700 dark:text-green-400">Connected</span>
          </Badge>
        </div>
      </div>

      {/* WhatsApp Interface */}
      <div className="h-[calc(100vh-12rem)] flex gap-4">
        {/* Contacts List */}
        <Card className="w-80 border-0 shadow-lg flex-shrink-0">
          <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredContacts.map((contact, index) => (
                  <motion.button
                    key={contact.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedContact(contact)}
                    className={cn(
                      "w-full p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left",
                      selectedContact?.id === contact.id && "bg-slate-50 dark:bg-slate-800/50"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white font-medium">
                          {contact.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {contact.status === 'online' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {contact.name}
                        </p>
                        <span className="text-xs text-slate-400">
                          {contact.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {contact.lastMessage}
                      </p>
                    </div>
                    {contact.unread > 0 && (
                      <Badge className="bg-green-500 text-white h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        {contact.unread}
                      </Badge>
                    )}
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 border-0 shadow-lg flex flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white">
                      {selectedContact.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-white">{selectedContact.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedContact.status === 'online' ? 'Online' : 'Last seen recently'} • {selectedContact.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  <AnimatePresence>
                    {currentMessages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex",
                          message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            message.direction === 'outbound'
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-br-sm"
                              : "bg-slate-100 dark:bg-slate-800 rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            message.direction === 'outbound' ? "text-white/70" : "text-slate-400"
                          )}>
                            <span className="text-xs">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {message.direction === 'outbound' && (
                              <CheckCheck className={cn(
                                "w-4 h-4",
                                message.status === 'read' ? "text-blue-300" : "text-white/50"
                              )} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Paperclip className="w-5 h-5 text-slate-400" />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="pr-24"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={sendMessage}
                    className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Select a conversation</h3>
                <p className="text-slate-500 dark:text-slate-400">Choose a contact to start messaging</p>
              </div>
            </div>
          )}
        </Card>

        {/* AI Insights Panel */}
        <Card className="w-72 border-0 shadow-lg hidden xl:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedContact && (
              <>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-2">Contact Summary</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedContact.name} has been in contact 5 times. Last interaction was about scheduling a consultation.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-2">Detected Intent</h4>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                    Consultation Request
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-2">Sentiment</h4>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                    Positive
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <h4 className="font-medium text-sm mb-2">Suggested Actions</h4>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <li>• Schedule consultation call</li>
                    <li>• Send service brochure</li>
                    <li>• Add to follow-up list</li>
                  </ul>
                </div>
              </>
            )}
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">AI Auto-Reply</span>
                <Badge className="bg-emerald-500">Active</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI will automatically respond to inquiries when team is unavailable.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
