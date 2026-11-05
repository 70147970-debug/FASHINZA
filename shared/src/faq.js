/**
 * Frequently asked questions for the FAQ page. Answers describe only what Fashinza actually does today.
 * @type {{ q: string; a: string; group: "Brands" | "Manufacturers" | "Platform" }[]}
 */
export const FAQ = [
  {
    group: "Brands",
    q: "How are factories matched to my project?",
    a: "Matching follows published rules. First, factories are left out if they are not verified, do not make your garment category, have a minimum order quantity (MOQ) above your limit, cannot meet your deadline with their lead time, lack free production capacity, or are missing a certification you require. The remaining factories are ranked on production processes, fabric experience, capacity, lead time, location and their record on Fashinza, and you see the reasons behind every score. There is no AI model involved today.",
  },
  {
    group: "Brands",
    q: "What do I need to start a project?",
    a: "A garment category, a description, the quantity and target price, your deadline, and the fabrics, colours and sizes you need. A tech pack (PDF or image, up to 10 MB) is required to submit; you can also add design sketches, reference images and documents such as measurement charts. Drafts are saved at every step, so you can finish later.",
  },
  {
    group: "Brands",
    q: "Who can see my designs and tech packs?",
    a: "Drafts are visible only to you. After you submit, the project and its files are visible to you, to the verified manufacturers invited through matching, and to Fashinza administrators. Files are stored privately and are never shared through public links.",
  },
  {
    group: "Brands",
    q: "Can I change my requirements after factories start quoting?",
    a: "Yes, until you accept a quotation. Every change is recorded in the project history and the manufacturers who are quoting are notified. A new tech pack becomes a new version, and earlier versions are kept.",
  },
  {
    group: "Brands",
    q: "How do samples work?",
    a: "After you accept a quotation, the manufacturer submits a sample with photos and notes. You approve it or ask for changes, and each round is kept. Bulk production starts only after you approve a sample.",
  },
  {
    group: "Brands",
    q: "How does quality inspection work?",
    a: "Inspections follow ISO 2859-1 AQL sampling plans (general inspection level II). The plan sets how many garments are inspected and how many major and minor defects are acceptable. A failed batch opens a rework task and goes back to stitching; a passed batch needs your acceptance before it ships.",
  },
  {
    group: "Brands",
    q: "How do payments work?",
    a: "Each order has a milestone payment schedule: by default 30% after sample approval, 40% after you accept the quality inspection report and 30% on delivery. You can adjust it before the first payment. Payments are simulated for now, so no real money moves, and Fashinza does not hold funds or offer an escrow service.",
  },
  {
    group: "Manufacturers",
    q: "Why am I not receiving any opportunities?",
    a: "Only verified factories are matched. Complete your factory profile, upload your business registration and any certificates, and request verification. Projects also need to fit your garment categories, MOQ, monthly capacity and lead time.",
  },
  {
    group: "Manufacturers",
    q: "How do I get verified?",
    a: "An administrator reviews your business registration and any certificates you upload, then records a decision with a reason. A certification counts in matching only after its document has been verified.",
  },
  {
    group: "Manufacturers",
    q: "What goes into a quotation?",
    a: "A per-garment breakdown of making, fabric, finishing and packaging costs, plus sampling cost, logistics and tax, along with your minimum quantity, production time and how long the offer is valid. Fashinza calculates the total. You can revise a quotation, and earlier versions stay in its history.",
  },
  {
    group: "Manufacturers",
    q: "How do I update production progress?",
    a: "Each stage of an accepted order shows the evidence it needs, such as photos of cut panels or garments on the line. Upload it and mark the stage complete; the next stage starts and the brand is notified. Sampling and quality inspection complete when the brand approves them.",
  },
  {
    group: "Platform",
    q: "Is Fashinza a real company?",
    a: "Fashinza is a Final Year Project at The University of Lahore. It works end to end, but organisations marked “(Demo)” are example data for trying the workflow, not real businesses, and the photographs on the website are generic garment-industry images, not Fashinza partners.",
  },
  {
    group: "Platform",
    q: "Do you send email notifications?",
    a: "Not yet. All notifications appear in your in-app notification centre, with an unread count at the top of every page.",
  },
];
