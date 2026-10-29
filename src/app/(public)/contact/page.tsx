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
        <div className="container-page grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <h2 className="label-caps border-t border-line-strong py-4 font-sans text-ink-muted">Other ways to reach us</h2>
            <ul className="border-t border-line">
              <li className="flex gap-4 border-b border-line py-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-accent"><Mail className="size-[18px]" strokeWidth={1.5} aria-hidden /></span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-medium leading-6 text-ink">Email</p>
                  <a className="break-all text-sm text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
                </div>
              </li>
              <li className="flex gap-4 border-b border-line py-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-accent"><MapPin className="size-[18px]" strokeWidth={1.5} aria-hidden /></span>
                <div>
                  <p className="font-display text-lg font-medium leading-6 text-ink">Location</p>
                  <p className="text-sm text-ink-muted">{SITE.location}</p>
                </div>
              </li>
              <li className="flex gap-4 border-b border-line py-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-accent"><MessageSquare className="size-[18px]" strokeWidth={1.5} aria-hidden /></span>
                <div>
                  <p className="font-display text-lg font-medium leading-6 text-ink">Already registered?</p>
                  <p className="text-sm leading-6 text-ink-muted">Report a problem with a project or order from your dashboard.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-surface lg:col-span-8">
            <div className="border-b border-line px-5 py-5 sm:px-8 sm:py-6">
              <h2 className="font-display text-[1.625rem] font-medium tracking-[-0.02em] text-ink">Send a message</h2>
              <p className="mt-1 text-sm text-ink-muted">Fields marked with an asterisk are required.</p>
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
