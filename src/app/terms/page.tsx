import { Headphones } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — AI Receptionist',
  description: 'Terms of Service for the AI Receptionist SaaS platform.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">AI Receptionist</span>
          </Link>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-6 py-12 prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="lead">Last updated: March 2026</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of the AI Receptionist platform and
          related services (the &quot;Service&quot;) operated by AI Receptionist (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
          By using the Service, you agree to these Terms.
        </p>

        <h2>1. Accounts</h2>
        <p>
          You must create an account to use the Service. You are responsible for maintaining the
          confidentiality of your credentials and for all activities under your account. You must
          provide accurate and complete information and keep it updated.
        </p>

        <h2>2. Subscription Plans</h2>
        <ul>
          <li>The Service is offered through subscription plans with different feature limits</li>
          <li>Prices are subject to change with 30 days&apos; notice</li>
          <li>Subscriptions renew automatically unless canceled</li>
          <li>Usage beyond plan limits may incur overage charges as specified in your plan</li>
          <li>Refunds are handled on a case-by-case basis</li>
        </ul>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of these Terms</li>
          <li>Use the AI receptionist to impersonate a human without disclosure where legally required</li>
          <li>Make calls or send messages that violate TCPA, GDPR, or other applicable regulations</li>
          <li>Upload malicious content, exploit vulnerabilities, or interfere with the Service</li>
          <li>Resell or redistribute the Service without written permission</li>
          <li>Use the Service to provide medical, legal, or financial advice through the AI</li>
        </ul>

        <h2>4. AI-Generated Content</h2>
        <p>
          The Service uses artificial intelligence to generate responses during calls and messages.
          While we strive for accuracy, AI-generated content may contain errors. You acknowledge that:
        </p>
        <ul>
          <li>AI responses are generated automatically and may not always be accurate</li>
          <li>You are responsible for reviewing and approving the knowledge base content that informs AI responses</li>
          <li>We are not liable for any actions taken based on AI-generated responses</li>
          <li>You should configure appropriate guardrails and transfer rules for your use case</li>
        </ul>

        <h2>5. Call Recording and Data</h2>
        <ul>
          <li>Call recordings may be enabled based on your configuration</li>
          <li>You are responsible for compliance with call recording laws in your jurisdiction</li>
          <li>You must obtain necessary consents from callers where required by law</li>
          <li>Transcripts and recordings are stored securely and accessible through your dashboard</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>
          The Service, including its software, design, and documentation, is our intellectual property.
          Your content (knowledge base entries, configurations, call data) remains yours. You grant us
          a limited license to process your content solely to provide the Service.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR SERVICE
          INTERRUPTION, ARISING FROM YOUR USE OF THE SERVICE.
        </p>
        <p>
          Our total liability shall not exceed the amount you paid for the Service in the twelve (12)
          months preceding the claim.
        </p>

        <h2>8. Service Availability</h2>
        <p>
          We strive for high availability but do not guarantee uninterrupted service. We may perform
          scheduled maintenance with reasonable notice. We are not liable for downtime caused by
          third-party providers (telephony, AI, hosting).
        </p>

        <h2>9. Termination</h2>
        <ul>
          <li>You may cancel your subscription at any time through your account settings</li>
          <li>We may suspend or terminate your account for violation of these Terms</li>
          <li>Upon termination, your data will be available for export for 30 days</li>
          <li>After 30 days, your data will be permanently deleted</li>
        </ul>

        <h2>10. Changes to Terms</h2>
        <p>
          We may modify these Terms at any time. Material changes will be communicated via email or
          through the Service with at least 30 days&apos; notice. Continued use after changes take effect
          constitutes acceptance.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which we operate. Any disputes
          shall be resolved through binding arbitration, except where prohibited by law.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Contact us through your account dashboard or at
          legal@aireceptionist.com.
        </p>
      </article>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300">Home</Link>
          <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300 font-medium text-slate-700 dark:text-slate-300">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
