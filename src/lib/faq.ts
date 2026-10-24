/** Frequently asked questions, shared by the FAQ page and the homepage. Answers describe what the platform actually does. */
export const FAQ: { q: string; a: string; group: "Brands" | "Manufacturers" | "Platform" }[] = [
  {
    group: "Brands",
    q: "How are factories matched to my project?",
    a: "When you submit a project, a rule-based engine first excludes factories that are not verified, do not make your product category, have a minimum order above your limit, cannot meet your delivery date with their lead time, lack free capacity, or are missing a certification you require. The rest are ranked by processes, fabric expertise, capacity, lead time, location and their track record on Fashinza, and you see the reasons for every score.",
  },
  {
    group: "Brands",
    q: "Who can see my designs and tech packs?",
    a: "Drafts are visible only to you. After you submit, the project and its files are visible to you, to the verified factories invited by matching, and to Fashinza administrators. Files are stored privately and every download checks your access; they are never served from public links.",
  },
  {
    group: "Brands",
    q: "Can I change my requirements after factories start quoting?",
    a: "Yes, until you accept a quotation. Every change is recorded in the project history and the factories that are quoting are notified. New tech pack uploads become new versions and earlier versions are kept.",
  },
  {
    group: "Brands",
    q: "How does quality control work?",
    a: "Inspections use ISO 2859-1 AQL sampling plans (general inspection level II). The plan sets how many units must be inspected and how many major and minor defects are acceptable. A failed batch opens a rework task and returns production to stitching; a passed batch needs your acceptance before it ships.",
  },
  {
    group: "Brands",
    q: "How do payments work?",
    a: "Each order has a milestone payment schedule — by default 30% after sample approval, 40% after you accept the QC report and 30% on delivery — which you can adjust before the first payment. This build uses a sandbox payment provider, so no real money moves. Fashinza records milestone payments; it does not operate a regulated escrow service.",
  },
  {
    group: "Manufacturers",
    q: "Why am I not receiving any opportunities?",
    a: "Only verified factories are matched. Complete your factory profile, upload your business registration and any certificates, and request verification. Projects also need to fit your categories, minimum order, capacity and lead time.",
  },
  {
    group: "Manufacturers",
    q: "How do I get verified?",
    a: "An administrator reviews your business registration and any certification documents you upload, then records a decision with a reason. Certifications only count in matching after their document has been verified.",
  },
  {
    group: "Manufacturers",
    q: "How do I update production progress?",
    a: "Each stage of an accepted order shows what evidence is needed, such as photos of cut panels. Upload it and mark the stage complete; the next stage starts and the brand is notified. Sampling and quality control complete through the brand's approval.",
  },
  {
    group: "Platform",
    q: "Is Fashinza a real company?",
    a: "Fashinza is a Final Year Project at The University of Lahore. The platform is fully functional, but organisations marked “(Demo)” are sample data for trying the workflow, not real businesses.",
  },
  {
    group: "Platform",
    q: "Do you send email notifications?",
    a: "Not in this build. All notifications are stored in your in-app notification centre, with an unread count in the top bar.",
  },
];
