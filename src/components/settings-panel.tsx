'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Bot,
  Bell,
  Shield,
  Globe,
  Key,
  Palette,
  Save,
  RotateCcw,
  Check,
  Zap,
  Clock,
  MessageSquare,
  Phone,
  Database,
  Webhook
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your AI Receptionist system</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-emerald-500 to-teal-500">
            {saving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 mr-2"
                >
                  <Zap className="w-4 h-4" />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex-wrap h-auto">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="w-4 h-4" />
            AI Configuration
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Webhook className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  Business Information
                </CardTitle>
                <CardDescription>Your business details for the AI Receptionist</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" placeholder="Your Business Name" defaultValue="TechCorp Solutions" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">Business Email</Label>
                    <Input id="businessEmail" type="email" placeholder="contact@business.com" defaultValue="contact@techcorp.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessPhone">Business Phone</Label>
                    <Input id="businessPhone" placeholder="+1 555-0100" defaultValue="+1 555-0100" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="utc-5">
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc-8">Pacific Time (UTC-8)</SelectItem>
                        <SelectItem value="utc-7">Mountain Time (UTC-7)</SelectItem>
                        <SelectItem value="utc-6">Central Time (UTC-6)</SelectItem>
                        <SelectItem value="utc-5">Eastern Time (UTC-5)</SelectItem>
                        <SelectItem value="utc+0">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea id="businessAddress" placeholder="Your business address" defaultValue="123 Tech Street, Suite 100, San Francisco, CA 94105" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-500" />
                  Business Hours
                </CardTitle>
                <CardDescription>Set your operating hours for the AI Receptionist</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-28">
                        <span className="text-sm font-medium">{day}</span>
                      </div>
                      <Switch defaultChecked={day !== 'Saturday' && day !== 'Sunday'} />
                      <div className="flex items-center gap-2 flex-1">
                        <Input type="time" defaultValue="09:00" className="w-28" disabled={day === 'Saturday' || day === 'Sunday'} />
                        <span className="text-slate-400">to</span>
                        <Input type="time" defaultValue="17:00" className="w-28" disabled={day === 'Saturday' || day === 'Sunday'} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Configuration */}
        <TabsContent value="ai">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-500" />
                  AI Behavior
                </CardTitle>
                <CardDescription>Configure how the AI Receptionist responds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="greeting">Default Greeting</Label>
                  <Textarea
                    id="greeting"
                    placeholder="Hello! How can I help you today?"
                    defaultValue="Hello! Thank you for contacting us. I'm your AI assistant and I'm here to help you with bookings, inquiries, and any questions you might have. How can I assist you today?"
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">Response Tone</Label>
                  <Select defaultValue="professional">
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <Label>Response Creativity</Label>
                  <div className="space-y-2">
                    <Slider defaultValue={[0.7]} max={1} min={0} step={0.1} />
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Precise</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-escalation</Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Automatically escalate to human when AI confidence is low
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sentiment Detection</Label>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Detect customer sentiment and adjust responses
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                  FAQ Knowledge Base
                </CardTitle>
                <CardDescription>Add frequently asked questions for the AI to answer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { q: 'What are your business hours?', a: 'We are open Monday to Friday, 9 AM to 5 PM.' },
                  { q: 'How can I book an appointment?', a: 'You can book an appointment through our website, phone, or WhatsApp.' },
                  { q: 'What services do you offer?', a: 'We offer consultations, demos, and support services.' },
                ].map((faq, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="space-y-2">
                      <Label>Question {index + 1}</Label>
                      <Input defaultValue={faq.q} />
                    </div>
                    <div className="space-y-2 mt-2">
                      <Label>Answer</Label>
                      <Textarea defaultValue={faq.a} className="min-h-16" />
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  + Add FAQ
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-500" />
                  Voice Settings
                </CardTitle>
                <CardDescription>Configure text-to-speech settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voice Selection</Label>
                    <Select defaultValue="tongtong">
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tongtong">Tongtong (Warm)</SelectItem>
                        <SelectItem value="chuichui">Chuichui (Lively)</SelectItem>
                        <SelectItem value="xiaochen">Xiaochen (Professional)</SelectItem>
                        <SelectItem value="jam">Jam (British)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Speech Speed</Label>
                    <Select defaultValue="1.0">
                      <SelectTrigger>
                        <SelectValue placeholder="Select speed" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.8">Slow (0.8x)</SelectItem>
                        <SelectItem value="1.0">Normal (1.0x)</SelectItem>
                        <SelectItem value="1.2">Fast (1.2x)</SelectItem>
                        <SelectItem value="1.5">Very Fast (1.5x)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-500" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Configure how you receive alerts and updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { title: 'New Leads', description: 'Get notified when a new lead is captured', email: true, push: true },
                { title: 'Appointment Bookings', description: 'Notifications for new appointments', email: true, push: true },
                { title: 'Missed Calls', description: 'Alert when calls are missed', email: true, push: true },
                { title: 'WhatsApp Messages', description: 'New WhatsApp conversation alerts', email: false, push: true },
                { title: 'Escalations', description: 'AI escalation to human support', email: true, push: true },
                { title: 'Daily Summary', description: 'Daily performance summary email', email: true, push: false },
              ].map((notification, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <h4 className="font-medium">{notification.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{notification.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Email</span>
                      <Switch defaultChecked={notification.email} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Push</span>
                      <Switch defaultChecked={notification.push} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-emerald-500" />
                  Twilio Integration
                </CardTitle>
                <CardDescription>Configure Twilio for voice and SMS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Phone className="w-6 h-6 text-emerald-500" />
                    <div>
                      <h4 className="font-medium">Twilio</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Voice & SMS integration</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500">Connected</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input type="password" defaultValue="ACxxxxxxxxxxxxx" />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input type="password" defaultValue="••••••••••••••••" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input defaultValue="+1 555-0100" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-500" />
                  CRM Integration
                </CardTitle>
                <CardDescription>Connect your CRM system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-blue-500" />
                    <div>
                      <h4 className="font-medium">CRM Connection</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Sync contacts and appointments</p>
                    </div>
                  </div>
                  <Badge variant="outline">Configure</Badge>
                </div>
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input placeholder="https://api.yourcrm.com/v1" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="Enter your API key" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage security and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <h4 className="font-medium">Two-Factor Authentication</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <h4 className="font-medium">API Access Logging</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Log all API requests for auditing</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <h4 className="font-medium">Data Encryption</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Encrypt sensitive data at rest</p>
                </div>
                <Badge className="bg-emerald-500">Enabled</Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>API Key Management</Label>
                <div className="flex gap-2">
                  <Input type="password" defaultValue="sk_live_xxxxxxxxxxxxx" />
                  <Button variant="outline">Regenerate</Button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Last regenerated: 30 days ago
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
