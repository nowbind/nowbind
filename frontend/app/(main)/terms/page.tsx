import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for NowBind, the open-source blogging platform.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: February 17, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using NowBind (&quot;the Platform&quot;), you
                agree to be bound by these Terms of Service. If you do not
                agree, do not use the Platform.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                2. Eligibility
              </h2>
              <p>
                You must be at least 13 years of age to use NowBind. By using
                the Platform, you represent that you meet this requirement.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                3. Accounts
              </h2>
              <p>
                You may sign in via email magic link or OAuth (Google, GitHub).
                You are responsible for maintaining the security of your account
                credentials. You must not share your account or impersonate
                another person.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                4. Content Ownership &amp; License
              </h2>
              <p>
                You retain full ownership of the content you publish on NowBind.
                By publishing a post, you grant NowBind a worldwide,
                non-exclusive, royalty-free license to host, display, distribute,
                and make your content available through the Platform, including
                through RSS feeds, API endpoints, and structured data formats.
              </p>
              <p className="mt-2">
                NowBind is open source under the GNU Affero General Public
                License v3.0 (AGPL-3.0). The Platform software is freely
                available, but user-generated content remains owned by its
                respective authors. If you modify and host NowBind as a network
                service, you must release your modifications under AGPL-3.0.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                5. AI &amp; Machine Access
              </h2>
              <p>
                NowBind is designed to be both human-readable and AI-agent
                consumable. When you publish a post, it becomes accessible to AI
                agents and language models through:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  The public Agent API (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    /api/v1/agent/*
                  </code>
                  )
                </li>
                <li>The MCP (Model Context Protocol) server endpoint</li>
                <li>
                  Structured markdown and{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    llms.txt
                  </code>{" "}
                  feeds
                </li>
                <li>JSON-LD structured data embedded in pages</li>
              </ul>
              <p className="mt-2">
                By publishing content, you acknowledge and consent to this
                machine access. If you do not want your content accessible to AI
                agents, do not publish it on NowBind.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                6. API Key Usage
              </h2>
              <p>
                API keys (prefixed{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  nb_
                </code>
                ) are issued for programmatic access to the Platform. You must
                keep your API keys confidential and must not share them publicly.
                Abuse of API keys, including exceeding rate limits or attempting
                to circumvent security measures, may result in key revocation and
                account suspension.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                7. Prohibited Content
              </h2>
              <p>You must not publish content that:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  Is illegal, defamatory, or infringes intellectual property
                </li>
                <li>Contains malware, phishing, or deceptive links</li>
                <li>
                  Is spam, auto-generated bulk content, or SEO manipulation
                </li>
                <li>
                  Harasses, threatens, or promotes violence against any person
                </li>
                <li>Contains sexually explicit material involving minors</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                8. Termination
              </h2>
              <p>
                We may suspend or terminate your account at any time for
                violation of these terms. You may delete your account at any time
                through your profile settings. Upon termination, your published
                posts may be removed from the Platform.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                9. Disclaimers
              </h2>
              <p>
                NowBind is provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, express or
                implied. We do not guarantee uninterrupted or error-free service.
                We are not responsible for the accuracy or reliability of
                user-generated content.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                10. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, NowBind and its
                maintainers shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your use
                of the Platform.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                11. Changes to These Terms
              </h2>
              <p>
                We may update these terms from time to time. Continued use of
                the Platform after changes constitutes acceptance of the revised
                terms. We will indicate the date of the most recent revision at
                the top of this page.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                12. Contact
              </h2>
              <p>
                If you have questions about these terms, please reach out via
                our{" "}
                <a
                  href="https://github.com/nowbind/nowbind"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-4"
                >
                  GitHub repository
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
