import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy", description: "What personal data Fashinza collects, why, and how it is protected." };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="23 October 2026"
      intro="Fashinza is a Final Year Project at The University of Lahore. This policy explains, in plain language, what the platform stores and why."
      sections={[
        {
          heading: "What we collect",
          body: (
            <ul>
              <li>Account details: your name, work email, a password hash (never the password itself) and your account type.</li>
              <li>Organisation details you enter: company or factory name, location, capabilities, capacity and contact details.</li>
              <li>Business records you create: projects, tech packs and other files, quotations, orders, production evidence, QC reports, messages and disputes.</li>
              <li>Sign-in records: session creation time, IP address and browser user agent, used for security.</li>
              <li>Contact form messages, including your name and email.</li>
            </ul>
          ),
        },
        {
          heading: "How it is used",
          body: (
            <ul>
              <li>To run the workflow you asked for: matching your project with factories, sharing it with the factories invited to quote, and tracking the resulting order.</li>
              <li>To verify manufacturers: administrators review uploaded documents.</li>
              <li>To keep the platform secure: rate limiting, session management and an audit log of administrative actions.</li>
            </ul>
          ),
        },
        {
          heading: "Who can see your data",
          body: (
            <ul>
              <li>Drafts are visible only to the brand that created them.</li>
              <li>A submitted project and its files are visible to the brand, to the verified factories matched to it, and to Fashinza administrators.</li>
              <li>An order is visible to its brand, its factory and administrators. Factory verification documents are visible only to the factory and administrators.</li>
              <li>We do not sell personal data or share it with advertisers.</li>
            </ul>
          ),
        },
        {
          heading: "Files and payments",
          body: (
            <p>
              Uploaded files are stored privately and are never published at public addresses; each download checks that you may access it. Payments in this
              build run through a sandbox provider: no card details are entered or stored by Fashinza.
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
              your account to be closed by <Link href="/contact" className="text-teal-700 underline">contacting us</Link> or emailing {SITE.contactEmail}.
            </p>
          ),
        },
      ]}
    />
  );
}
