import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Last updated: March 30, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using DocFlow, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, you may not
              use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              2. Description of Service
            </h2>
            <p>
              DocFlow is a documentation platform that allows users to capture
              screen recordings, generate documentation, and manage workflow
              documentation within teams and individually.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              3. User Accounts
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You must provide accurate information when creating an account.
              </li>
              <li>
                You are responsible for maintaining the security of your account
                credentials.
              </li>
              <li>You must be at least 16 years of age to use DocFlow.</li>
              <li>One person may not maintain more than one account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              4. Acceptable Use
            </h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Use the service for any unlawful purpose or in violation of any
                applicable laws.
              </li>
              <li>
                Upload content that infringes on intellectual property rights of
                others.
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the service.
              </li>
              <li>
                Interfere with or disrupt the service or its infrastructure.
              </li>
              <li>
                Use automated means to access the service without prior written
                consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              5. Content Ownership
            </h2>
            <p>
              You retain ownership of all content you create, upload, or
              generate using DocFlow. By using the service, you grant DocFlow a
              limited license to store, process, and display your content solely
              for the purpose of providing the service to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              6. Service Availability
            </h2>
            <p>
              We strive to maintain high availability but do not guarantee
              uninterrupted access to DocFlow. We may suspend or discontinue
              parts of the service for maintenance, updates, or other
              operational reasons with reasonable notice when possible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              7. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, DocFlow and its operators
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              service. Our total liability shall not exceed the amount you paid
              for the service in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              8. Termination
            </h2>
            <p>
              We may suspend or terminate your access to DocFlow at any time for
              violations of these terms. You may delete your account at any time
              through the settings page. Upon termination, your right to use the
              service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              9. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. We will
              provide notice of material changes by posting the updated terms on
              this page. Continued use of DocFlow after changes constitutes
              acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              10. Contact
            </h2>
            <p>
              For questions about these Terms of Service, contact us at{" "}
              <a
                href="mailto:docflowops@gmail.com"
                className="text-primary hover:underline"
              >
                docflowops@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
