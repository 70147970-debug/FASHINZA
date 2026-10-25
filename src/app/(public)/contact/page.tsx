import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { ContactForm } from "./contact-form";
import { PageHero } from "@/components/site/marketing";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send a question to the Fashinza team about using the platform as a brand or a manufacturer.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the Fashinza team"
        description="Questions about briefing a project, registering your factory or verification? Send us a message and the team will reply by email."
      />
      <section className="bg-canvas py-12 lg:py-20">
        <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-12">
          <div className="lg:pt-2">
            <h2 className="label-caps mb-4 font-sans text-muted">Other ways to reach us</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white shadow-card">
              <li className="flex gap-4 p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><Mail className="size-[18px]" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="font-display text-[0.9375rem] font-semibold text-navy">Email</p>
                  <a className="break-all text-sm text-teal-700 hover:underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
                </div>
              </li>
              <li className="flex gap-4 p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><MapPin className="size-[18px]" aria-hidden /></span>
                <div>
                  <p className="font-display text-[0.9375rem] font-semibold text-navy">Location</p>
                  <p className="text-sm text-muted">{SITE.location}</p>
                </div>
              </li>
              <li className="flex gap-4 p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700"><MessageSquare className="size-[18px]" aria-hidden /></span>
                <div>
                  <p className="font-display text-[0.9375rem] font-semibold text-navy">Already registered?</p>
                  <p className="text-sm leading-6 text-muted">Report a problem with a project or order from your dashboard.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-white shadow-card">
            <div className="border-b border-line-subtle px-5 py-4 sm:px-8 sm:py-5">
              <h2 className="font-display text-lg font-semibold text-navy">Send a message</h2>
              <p className="mt-0.5 text-sm text-muted">Fields marked with an asterisk are required.</p>
            </div>
            <div className="p-5 sm:p-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
