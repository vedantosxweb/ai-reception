import { Headphones } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — AI Receptionist',
  description: 'Privacy Policy for the AI Receptionist SaaS platform.',
};

export default function PrivacyPolicyPage() {
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
        <h1>Privacy Policy</h1>
        <p className="lead">Last updated: March 2026</p>

        <p>
          AI Receptionist (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy
          Policy explains how we collect, use, disclose, and safeguard your information when you use our AI
          receptionist platform and related services (the &quot;Service&quot;).
        </p>

        <h2>1. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Name, email address, and password (hashed)</li>
          <li>Company name, website, and industry</li>
          <li>Billing and payment information (processed securely via our payment provider)</li>
        </ul>

        <h3>Call and Communication Data</h3>
        <p>When you use our AI receptionist service, we process:</p>
        <ul>
          <li>Inbound and outbound phone numbers</li>
          <li>Call recordings and transcripts</li>
          <li>SMS message content</li>
          <li>AI-generated conversation summaries, sentiment analysis, and intent classification</li>
        </ul>

        <h3>Usage Data</h3>
        <p>We automatically collect information about how you interact with the Service, including:</p>
        <ul>
          <li>Feature usage, call volume, and minutes consumed</li>
          <li>Browser type, IP address, and device information</li>
          <li>Log data and analytics</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide, maintain, and improve the Service</li>
          <li>To process calls and SMS messages through our AI pipeline</li>
          <li>To manage your account and subscription billing</li>
          <li>To send service notifications and support communications</li>
          <li>To detect and prevent fraud, abuse, and security threats</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li><strong>Service providers:</strong> Twilio (telephony), AI providers (OpenAI, Google, Anthropic), Resend (email), and our payment processor for billing</li>
          <li><strong>Legal requirements:</strong> When required by law, regulation, or legal process</li>
          <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
        </ul>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard security measures including encryption at rest and in transit,
          secure password hashing (bcrypt), webhook signature verification, role-based access controls,
          and audit logging. However, no method of transmission over the Internet is 100% secure.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide the Service.
          Call recordings and transcripts are retained according to your plan settings. You may request
          deletion of your data by contacting us.
        </p>

        <h2>6. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal data</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management. We do not use third-party
          advertising cookies.
        </p>

        <h2>8. Children&apos;s Privacy</h2>
        <p>
          The Service is not intended for use by individuals under the age of 18. We do not knowingly
          collect personal information from children.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by
          posting the new policy on this page and updating the &quot;Last updated&quot; date.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us through your account
          dashboard or email us at privacy@aireceptionist.com.
        </p>
      </article>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300">Home</Link>
          <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300 font-medium text-slate-700 dark:text-slate-300">Privacy Policy</Link>
        </div>
      </footer>
    </main>
  );
}
