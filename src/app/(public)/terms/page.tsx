import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms for using the Fashinza platform." };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="23 October 2026"
      intro="These terms describe how the Fashinza platform may be used. Fashinza is an academic project; it is provided as a working demonstration and not as a commercial service."
      sections={[
        {
          heading: "Accounts",
          body: (
            <ul>
              <li>You must give accurate details and keep your password private. You are responsible for activity under your account.</li>
              <li>Brand accounts may only describe products they intend to have made. Manufacturer accounts must represent a real business and upload genuine documents.</li>
              <li>Administrators may suspend accounts that break these terms; suspensions are recorded with a reason.</li>
            </ul>
          ),
        },
        {
          heading: "What Fashinza does and does not do",
          body: (
            <ul>
              <li>Fashinza matches brands with verified factories, records quotations and orders, and tracks production, quality control and payment milestones.</li>
              <li>Matching scores describe compatibility with your stated requirements. They are not a guarantee of quality, delivery or price.</li>
              <li>Verification confirms that an administrator reviewed a factory&apos;s documents. It is not an on-site audit.</li>
              <li>Fashinza is not a party to the supply contract between a brand and a factory and does not take title to goods.</li>
            </ul>
          ),
        },
        {
          heading: "Quotations and orders",
          body: (
            <p>
              A quotation is the factory&apos;s offer on the terms shown, valid until its expiry date. When a brand accepts it, an order is created on exactly
              those terms. Changes to price, quantity or terms are recorded in the quotation history.
            </p>
          ),
        },
        {
          heading: "Payments",
          body: (
            <p>
              Payment milestones are processed through a payment provider. In this build the provider is a sandbox and no real money is transferred.
              Fashinza does not hold funds and does not offer a regulated escrow service.
            </p>
          ),
        },
        {
          heading: "Your content",
          body: (
            <p>
              You keep ownership of the designs and documents you upload. You allow Fashinza to store them and show them to the parties described in the{" "}
              <Link href="/privacy" className="text-teal-700 underline">Privacy Policy</Link> so the workflow can operate. Do not upload content you do not have the right to share.
            </p>
          ),
        },
        {
          heading: "Disputes",
          body: <p>Either party to an order can raise a dispute. Administrators review the order history and record a resolution, but their decision does not replace any legal remedy you may have.</p>,
        },
        {
          heading: "Contact",
          body: <p>Questions about these terms can be sent through the <Link href="/contact" className="text-teal-700 underline">contact page</Link>.</p>,
        },
      ]}
    />
  );
}
