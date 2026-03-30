import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 30, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Information We Collect
            </h2>
            <p className="mb-2">
              When you use DocFlow, we may collect the following information:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">
                  Account information:
                </strong>{" "}
                name, email address, and profile picture when you sign in with
                Google.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong>{" "}
                recordings, generated documents, and workspace settings you
                create within the platform.
              </li>
              <li>
                <strong className="text-foreground">Technical data:</strong>{" "}
                browser type, device information, and IP address for analytics
                and security purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                To provide, maintain, and improve DocFlow's features and
                services.
              </li>
              <li>To authenticate your identity and manage your account.</li>
              <li>To communicate important updates about the service.</li>
              <li>
                To detect and prevent fraud, abuse, or security incidents.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. Data Sharing
            </h2>
            <p>
              We do not sell your personal data. We may share information with
              third-party service providers (e.g., hosting, analytics) solely to
              operate and improve DocFlow. These providers are bound by
              confidentiality obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. Data Storage & Security
            </h2>
            <p>
              Your data is stored securely using industry-standard encryption
              and access controls. We use Supabase for database hosting and
              implement appropriate technical and organizational measures to
              protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Your Rights
            </h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction or deletion of your data.</li>
              <li>Export your data in a portable format.</li>
              <li>Withdraw consent for data processing at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Cookies
            </h2>
            <p>
              DocFlow uses essential cookies and local storage to maintain your
              authentication session. We do not use third-party tracking
              cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the updated policy
              on this page with a revised date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at{" "}
              <a
                href="mailto:Jasowills01@gmail.com"
                className="text-primary hover:underline"
              >
                Jasowills01@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
