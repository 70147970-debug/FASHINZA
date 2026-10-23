import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { ContactForm } from "./contact-form";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a question to the Fashinza team about using the platform as a brand or a manufacturer.",
};

export default function ContactPage() {
  return (
    <section className="py-14 sm:py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">Contact</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Talk to the Fashinza team</h1>
          <p className="mt-4 text-muted">
            Questions about briefing a project, registering your factory or verification? Send us a message and the
            team will reply by email.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex gap-3">
              <Mail className="size-5 text-teal" aria-hidden />
              <div><p className="font-medium text-navy">Email</p><a className="text-muted hover:text-navy" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></div>
            </li>
            <li className="flex gap-3">
              <MapPin className="size-5 text-teal" aria-hidden />
              <div><p className="font-medium text-navy">Location</p><p className="text-muted">{SITE.location}</p></div>
            </li>
            <li className="flex gap-3">
              <MessageSquare className="size-5 text-teal" aria-hidden />
              <div><p className="font-medium text-navy">Already registered?</p><p className="text-muted">Report a problem with a project or order from your dashboard.</p></div>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="mb-6 text-lg font-semibold">Send a message</h2>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
