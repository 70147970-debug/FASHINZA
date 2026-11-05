import { Link } from "react-router";
import { LegalPage } from "@/components/site/legal";
import { SITE } from "@fashinza/shared/constants.js";
import { PageMeta } from "@/components/meta";

export default function PrivacyPage() {
  return (
    <>
      <PageMeta title="Privacy Policy" description="What personal data Fashinza collects, why, and how it is protected." />
      <LegalPage
        title="Privacy Policy"
        updated="23 October 2026"
        intro="Fashinza is a Final Year Project at The University of Lahore that connects fashion brands with garment manufacturers. This policy explains, in plain language, what we store and why."
        sections={[
          {
            heading: "What we collect",
            body: (
              <ul>
                <li>Account details: your name, work email, a password hash (never the password itself) and your account type.</li>
                <li>Organisation details you enter: company or factory name, location, capabilities, capacity and contact details.</li>
                <li>
                  Business records you create: projects, tech packs, sketches and other files, quotations, orders, samples, production evidence, quality
                  inspection reports, messages and disputes.
                </li>
                <li>Sign-in records: session creation time, IP address and browser user agent, used for security.</li>
                <li>Contact form messages, including your name and email.</li>
              </ul>
            ),
          },
          {
            heading: "How it is used",
            body: (
              <ul>
                <li>
                  To run the workflow you asked for: matching your project with factories, sharing it with the factories invited to quote, and tracking the
                  resulting order.
                </li>
                <li>To verify manufacturers: administrators review uploaded documents.</li>
                <li>
                  To keep accounts secure: limiting repeated sign-in attempts, managing sign-in sessions and keeping an audit log of administrative actions.
                </li>
              </ul>
            ),
          },
          {
            heading: "Who can see your data",
            body: (
              <ul>
                <li>Drafts are visible only to the brand that created them.</li>
                <li>A submitted project and its files are visible to the brand, to the verified factories matched to it, and to Fashinza administrators.</li>
                <li>
                  An order is visible to its brand, its factory and administrators. Factory verification documents are visible only to the factory and
                  administrators.
                </li>
                <li>We do not sell personal data or share it with advertisers.</li>
              </ul>
            ),
          },
          {
            heading: "Files and payments",
            body: (
              <p>
                Uploaded files are stored privately and are never published at public addresses; each download checks that you may access it. Payments are
                simulated for now: no card details are entered or stored by Fashinza, and no real money moves.
              </p>
            ),
          },
          {
            heading: "Cookies",
            body: <p>Fashinza uses one essential, http-only session cookie to keep you signed in. There are no advertising or analytics cookies.</p>,
          },
          {
            heading: "Retention and your choices",
            body: (
              <p>
                Business records are kept so that orders, payments and disputes have a complete history. You can ask for your account details to be corrected or
                your account to be closed by{" "}
                <Link
                  to="/contact"
                  className="font-medium text-accent-strong underline decoration-accent-line underline-offset-4 hover:decoration-accent-strong"
                >
                  contacting us
                </Link>{" "}
                or emailing {SITE.contactEmail}.
              </p>
            ),
          },
        ]}
      />
    </>
  );
}
