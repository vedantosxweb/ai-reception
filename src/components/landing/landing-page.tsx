'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  MessageSquare,
  Brain,
  BarChart3,
  Clock,
  Shield,
  ArrowRight,
  Check,
  Menu,
  X,
  Zap,
  Users,
  Globe,
  Headphones,
  ChevronDown,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 49,
    minutes: 100,
    description: 'Perfect for small businesses just getting started',
    features: [
      '1 AI Receptionist',
      '1 Phone Number',
      '100 minutes/mo',
      'Basic Knowledge Base',
      'Email Support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: 149,
    minutes: 500,
    description: 'For growing teams that need more capacity',
    features: [
      '3 AI Receptionists',
      '3 Phone Numbers',
      '500 minutes/mo',
      'Advanced Knowledge Base',
      'SMS Integration',
      'Call Transfer',
      'Priority Support',
    ],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 399,
    minutes: 2000,
    description: 'For established businesses with high volume',
    features: [
      '10 AI Receptionists',
      '10 Phone Numbers',
      '2,000 minutes/mo',
      'Unlimited Knowledge Base',
      'Full SMS',
      'Advanced Analytics',
      'Custom Voices',
      'API Access',
      'Dedicated Support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 999,
    minutes: 10000,
    description: 'For large organizations with custom needs',
    features: [
      '50 AI Receptionists',
      '50 Phone Numbers',
      '10,000 minutes/mo',
      'Custom LLM',
      'White Label',
      'SSO',
      'SLA',
      'Custom Integration',
      'Dedicated Account Manager',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const FEATURES = [
  {
    icon: Phone,
    title: 'AI Voice Calls',
    description:
      'Natural-sounding AI answers every call, handles inquiries, and transfers when needed. Never miss a customer again.',
  },
  {
    icon: MessageSquare,
    title: 'SMS & Messaging',
    description:
      'Automatically respond to text messages with intelligent, context-aware replies based on your business knowledge.',
  },
  {
    icon: Brain,
    title: 'Knowledge Base',
    description:
      'Upload documents, FAQs, and business info. Your AI receptionist learns everything about your business.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description:
      'Track call volumes, response times, customer satisfaction, and usage patterns with detailed dashboards.',
  },
  {
    icon: Clock,
    title: '24/7 Availability',
    description:
      'Your AI receptionist never sleeps, never takes breaks, and handles calls around the clock — even on holidays.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'SOC 2 compliant infrastructure with encrypted calls, secure data handling, and role-based access control.',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Set Up Your Receptionist',
    description:
      'Create an account, configure your AI receptionist\'s personality, voice, and greeting. Upload your business knowledge base.',
  },
  {
    step: '2',
    title: 'Connect Your Phone Number',
    description:
      'Get a dedicated phone number or forward your existing business line. Your AI receptionist starts taking calls immediately.',
  },
  {
    step: '3',
    title: 'Let AI Handle the Rest',
    description:
      'Your receptionist answers calls, responds to texts, books appointments, and transfers important calls to your team.',
  },
];

const FAQ = [
  {
    q: 'How natural does the AI voice sound?',
    a: 'Our AI uses state-of-the-art text-to-speech technology from ElevenLabs, producing incredibly natural and human-like voices. Most callers cannot distinguish it from a real person.',
  },
  {
    q: 'Can I use my existing phone number?',
    a: 'Yes! You can forward your existing business phone number to your AI receptionist. Alternatively, we provide dedicated phone numbers with your plan.',
  },
  {
    q: 'What happens if the AI can\'t answer a question?',
    a: 'Your AI receptionist is trained on your knowledge base, but when it encounters something it can\'t handle, it seamlessly transfers the call to your team or takes a detailed message.',
  },
  {
    q: 'How quickly can I get set up?',
    a: 'Most businesses are up and running within 15 minutes. Create an account, upload your business information, configure your preferences, and you\'re live.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a free Starter plan setup so you can experience the platform. You can upgrade to a paid plan anytime to unlock more minutes, receptionists, and features.',
  },
  {
    q: 'Can the AI handle multiple calls at once?',
    a: 'Absolutely. Unlike a human receptionist, your AI can handle unlimited concurrent calls. Every caller gets an immediate answer, no hold times.',
  },
];

const STATS = [
  { value: '99.9%', label: 'Uptime' },
  { value: '<1s', label: 'Response Time' },
  { value: '24/7', label: 'Availability' },
  { value: '50+', label: 'Languages' },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Headphones className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">AI Receptionist</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-3">
            <a href="#features" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              How It Works
            </a>
            <a href="#pricing" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              Pricing
            </a>
            <a href="#faq" className="block py-2 text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>
              FAQ
            </a>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" asChild className="flex-1">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
          <Zap className="w-3 h-3 mr-1" />
          AI-Powered Business Communication
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Never Miss a Call.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">
            Ever Again.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Deploy an AI receptionist that answers calls, responds to texts, and handles customer
          inquiries 24/7 — so you can focus on growing your business.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild className="text-base px-8 h-12">
            <Link href="/signup">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-base px-8 h-12">
            <a href="#how-it-works">See How It Works</a>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to automate your front desk
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            From voice calls to SMS, knowledge bases to analytics — our platform handles it all.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Up and running in minutes</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Three simple steps to deploy your AI receptionist.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white text-xl font-bold flex items-center justify-center mx-auto mb-5">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold mb-3">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Choose the plan that fits your business. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((p) => (
            <Card
              key={p.id}
              className={cn(
                'relative border shadow-md hover:shadow-lg transition-shadow flex flex-col',
                p.highlighted && 'ring-2 ring-emerald-500 border-emerald-500'
              )}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-white border-0">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="flex-none">
                <CardTitle className="text-xl">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${p.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.minutes.toLocaleString()} minutes included
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={p.highlighted ? 'default' : 'outline'}
                  asChild
                >
                  <Link href="/signup">{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently asked questions</h2>
          <p className="text-muted-foreground text-lg">
            Got questions? We have answers.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="border rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="font-medium text-sm">{item.q}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ml-4',
                    openIndex === i && 'rotate-180'
                  )}
                />
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to automate your front desk?
        </h2>
        <p className="text-lg opacity-80 mb-8 max-w-xl mx-auto">
          Join businesses that never miss a call. Set up your AI receptionist in under 15 minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            variant="secondary"
            asChild
            className="text-base px-8 h-12"
          >
            <Link href="/signup">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Headphones className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">AI Receptionist</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI-powered receptionist for modern businesses.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Receptionist. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}
