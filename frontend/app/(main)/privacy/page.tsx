import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for NowBind, the open-source blogging platform.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: February 17, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                1. Information We Collect
              </h2>
              <p>
                When you use NowBind, we may collect the following information:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong className="text-foreground">
                    Account information:
                  </strong>{" "}
                  Email address and profile data provided through OAuth (Google
                  or GitHub), including display name and avatar URL
                </li>
                <li>
                  <strong className="text-foreground">Technical data:</strong>{" "}
                  IP address, user agent, browser type, and device information
                  collected automatically when you visit the Platform
                </li>
                <li>
                  <strong className="text-foreground">Content:</strong> Posts,
                  comments, and other content you create on the Platform
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                2. How We Use Your Data
              </h2>
              <p>We use collected information to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Provide and maintain the Platform</li>
                <li>Authenticate your identity and secure your account</li>
                <li>Display your profile and published content</li>
                <li>Send transactional emails (magic links, notifications)</li>
                <li>Monitor for abuse and enforce our Terms of Service</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                3. Cookies
              </h2>
              <p>
                NowBind uses only essential cookies for authentication (session
                tokens). We do not use tracking cookies, advertising cookies, or
                third-party analytics cookies. No cookie consent banner is
                required as we only use strictly necessary cookies.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                4. Third-Party OAuth
              </h2>
              <p>
                When you sign in with Google or GitHub, we receive limited
                profile information (name, email, avatar) from the OAuth
                provider. We do not access your contacts, repositories, or other
                private data. Please review the privacy policies of{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-foreground underline underline-offset-4"
                >
                  Google
                </a>{" "}
                and{" "}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  target="_blank"
                  rel="noopener"
                  className="text-foreground underline underline-offset-4"
                >
                  GitHub
                </a>{" "}
                for their data practices.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                5. AI &amp; MCP Data Access
              </h2>
              <p>
                Published posts on NowBind are accessible to AI agents and
                language models through our public Agent API, MCP server,
                structured markdown feeds, and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  llms.txt
                </code>
                . This is a core feature of the Platform. Published content is
                intentionally made available for machine consumption. Draft or
                unpublished posts are never exposed to these channels.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                6. Analytics
              </h2>
              <p>
                NowBind tracks page views on published posts to provide authors
                with readership statistics. View tracking records are anonymized
                and include the post identifier, timestamp, and whether the view
                originated from a human browser or an AI agent. We do not use
                third-party analytics services.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                7. Data Retention
              </h2>
              <p>
                We retain your account data and published content for as long as
                your account is active. If you delete your account, your
                personal data will be removed. Published posts may be retained
                in an anonymized form or removed entirely at your request.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                8. Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong className="text-foreground">Access:</strong> View all
                  personal data we hold about you through your profile settings
                </li>
                <li>
                  <strong className="text-foreground">Delete:</strong> Delete
                  your account and associated personal data at any time
                </li>
                <li>
                  <strong className="text-foreground">Export:</strong> Download
                  your published content through the API
                </li>
                <li>
                  <strong className="text-foreground">Correct:</strong> Update
                  your profile information at any time through your settings
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                9. Children&apos;s Privacy
              </h2>
              <p>
                NowBind is not intended for children under the age of 13. We do
                not knowingly collect personal information from children. If you
                believe a child has provided us with personal data, please
                contact us so we can remove it.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                10. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                indicate the date of the most recent revision at the top of this
                page. Continued use of the Platform after changes constitutes
                acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                11. Contact
              </h2>
              <p>
                If you have questions about this Privacy Policy, please reach
                out via our{" "}
                <a
                  href="https://github.com/nowbind/nowbind"
                  target="_blank"
                  rel="noopener"
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
