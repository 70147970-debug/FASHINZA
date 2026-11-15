import { describe, expect, it } from "vitest";
import { GarmentCategory } from "../src/enums.js";
import { GARMENT_CATEGORIES, GARMENT_CATEGORY_GROUPS, groupedGarmentCategories } from "../src/constants.js";
import { categoryLabel, formatRevisionValue } from "../src/labels.js";
import { manufacturerProfileSchema } from "../src/validation/profile.js";
import { COLOURS_MAX_LENGTH, projectDraftSchema, projectSubmitSchema } from "../src/validation/project.js";
import {
  COLOUR_FAMILIES,
  COLOURS,
  colourTokenKey,
  customColourToken,
  findColour,
  formatColourList,
  normaliseColourName,
  parseColourList,
  resolveColourToken,
  searchColours,
} from "../src/colors.js";

/** The twelve values of the legacy Prisma enum; the MERN app appends to them. */
const PRISMA_CATEGORIES = ["T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES"];

describe("garment categories", () => {
  it("keeps the Prisma values first, in order, and appends the MERN-only additions", () => {
    expect(GarmentCategory.slice(0, 12)).toEqual(PRISMA_CATEGORIES);
    expect(GarmentCategory).toHaveLength(32);
    expect(new Set(GarmentCategory).size).toBe(GarmentCategory.length);
  });

  it("has one label per enum value, in enum order", () => {
    expect(GARMENT_CATEGORIES.map((c) => c.value)).toEqual([...GarmentCategory]);
    expect(categoryLabel("ETHNIC_WEAR")).toBe("Ethnic wear (kurta, shalwar kameez)");
    expect(categoryLabel("HEADWEAR")).toBe("Caps & hats");
    expect(formatRevisionValue("category", "BAGS")).toBe("Bags & totes");
  });

  it("puts every category in exactly one group", () => {
    const grouped = GARMENT_CATEGORY_GROUPS.flatMap((g) => g.values);
    expect([...grouped].sort()).toEqual([...GarmentCategory].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const g of GARMENT_CATEGORY_GROUPS) expect(g.values.length, g.label).toBeGreaterThan(0);
    expect(groupedGarmentCategories().flatMap((g) => g.options.map((o) => o.label))).toHaveLength(32);
  });

  it("accepts the new categories in projects and factory profiles", () => {
    expect(projectDraftSchema.safeParse({ name: "Resort swim", category: "SWIMWEAR" }).success).toBe(true);
    expect(projectDraftSchema.safeParse({ name: "Resort swim", category: "NOT_A_CATEGORY" }).success).toBe(false);
    const factory = {
      businessName: "Loom Works", description: "Swimwear and lingerie unit with bonding and laser cutting.", country: "Sri Lanka", city: "Colombo",
      categories: ["SWIMWEAR", "LINGERIE"], production: ["Cut and sew"], minOrderQuantity: 100, maxMonthlyCapacity: 1000, typicalLeadTimeDays: 30,
      contactName: "A Person", contactEmail: "a@example.test",
    };
    expect(manufacturerProfileSchema.safeParse(factory).success).toBe(true);
  });
});

describe("colour list", () => {
  it("has all 148 CSS named colours and at least 250 fashion colours", () => {
    expect(COLOURS.filter((c) => c.css)).toHaveLength(148);
    expect(COLOURS.filter((c) => !c.css).length).toBeGreaterThanOrEqual(250);
    // CSS keywords are the spelled names without spaces.
    const keywords = new Set(COLOURS.filter((c) => c.css).map((c) => c.name.toLowerCase().replace(/\s+/g, "")));
    for (const k of ["aliceblue", "rebeccapurple", "lightgoldenrodyellow", "darkslategrey", "darkslategray", "navy", "white", "black"]) expect(keywords.has(k), k).toBe(true);
  });

  it("has no duplicate names, even ignoring case, spaces and hyphens", () => {
    const keys = COLOURS.map((c) => normaliseColourName(c.name));
    expect(new Set(keys).size).toBe(COLOURS.length);
    expect(new Set(COLOURS.map((c) => c.name.toLowerCase())).size).toBe(COLOURS.length);
  });

  it("uses #RRGGBB values and a known family for every colour, with every family used", () => {
    const families = new Set(COLOUR_FAMILIES.map((f) => f.value));
    for (const c of COLOURS) {
      expect(c.hex, c.name).toMatch(/^#[0-9A-F]{6}$/);
      expect(families.has(c.family), c.name).toBe(true);
      expect(c.name, c.name).not.toMatch(/[,()#]/);
    }
    for (const f of families) expect(COLOURS.some((c) => c.family === f), f).toBe(true);
    expect(COLOUR_FAMILIES).toHaveLength(11);
  });

  it("includes the common fashion names", () => {
    for (const n of ["Ecru", "Oatmeal", "Camel", "Burgundy", "Mustard", "Sage", "Terracotta", "Navy", "Charcoal heather", "Ivory", "Blush", "Rust", "Olive", "Teal", "Cobalt", "Emerald", "Plum", "Mauve", "Taupe", "Sand", "Stone", "Khaki", "Chocolate", "Cognac", "Wine", "Berry", "Coral", "Peach", "Lilac", "Lavender", "Mint", "Powder blue", "Denim blue", "Indigo", "Petrol", "Forest", "Bottle green", "Ochre", "Saffron", "Champagne", "Pewter", "Gunmetal", "Off-white", "Natural", "Undyed", "Heather grey", "Grey melange"]) {
      expect(findColour(n), n).toBeDefined();
    }
  });

  it("finds colours by name in any case, spacing or hyphenation, and by CSS keyword", () => {
    expect(findColour("off white")?.name).toBe("Off-white");
    expect(findColour("OFF-WHITE")?.hex).toBe("#F4F1EA");
    expect(findColour("darkslategray")?.name).toBe("Dark slate gray");
    expect(findColour("Heather gray")?.name).toBe("Heather grey");
    expect(findColour("Black")?.hex).toBe("#000000");
    expect(findColour("Pantone 19-4052 TCX")).toBeUndefined();
    expect(findColour("")).toBeUndefined();
  });

  it("ranks search results: exact, then prefix, then word prefix, then contains", () => {
    const names = searchColours("black").map((c) => c.name);
    expect(names[0]).toBe("Black");
    expect(names).toContain("Blackcurrant");
    expect(names).toContain("Jet black");
    expect(names.indexOf("Blackcurrant")).toBeLessThan(names.indexOf("Jet black"));
    expect(searchColours("", { family: "metallics" }).every((c) => c.family === "metallics")).toBe(true);
    expect(searchColours("", {})).toHaveLength(COLOURS.length);
    expect(searchColours("navy", { family: "greys" })).toEqual([]);
  });
});

describe("stored colour lists", () => {
  it("parses comma-separated text, dropping blanks and repeats", () => {
    expect(parseColourList("Black,  Off-white , ,black, Pantone 19-4052 TCX")).toEqual(["Black", "Off-white", "Pantone 19-4052 TCX"]);
    expect(parseColourList(null)).toEqual([]);
    expect(formatColourList(["Black", "Off-white"])).toBe("Black, Off-white");
  });

  it("stores custom colours as “Name (#RRGGBB)” and resolves every kind of token", () => {
    expect(customColourToken(" Dusty, teal ", "#4e8a8c")).toBe("Dusty teal (#4E8A8C)");
    expect(resolveColourToken("Dusty teal (#4E8A8C)")).toMatchObject({ name: "Dusty teal", hex: "#4E8A8C", kind: "custom" });
    expect(resolveColourToken("#abc")).toMatchObject({ hex: "#AABBCC", kind: "custom" });
    expect(resolveColourToken("sage")).toMatchObject({ name: "sage", hex: "#9CA98A", kind: "named" });
    expect(resolveColourToken("Washed black")).toMatchObject({ hex: "#2E2E2F", kind: "named" });
    expect(resolveColourToken("Pantone 19-4052 TCX")).toMatchObject({ hex: null, kind: "text" });
    expect(colourTokenKey("Off white")).toBe(colourTokenKey("Off-white"));
  });

  it("keeps “List at least one colour.” and allows up to 1,000 characters", () => {
    const base = {
      name: "Tee", category: "T_SHIRTS", description: "A heavyweight cotton tee with a rib neck.", fabricRequirements: "Cotton jersey", sizes: ["M"],
      quantity: 100, deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), sampleRequired: false,
    };
    const empty = projectSubmitSchema.safeParse({ ...base, colors: "" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues.find((i) => i.path[0] === "colors")?.message).toBe("List at least one colour.");
    const long = COLOURS.map((c) => c.name).join(", ").slice(0, COLOURS_MAX_LENGTH);
    expect(projectSubmitSchema.safeParse({ ...base, colors: long }).success).toBe(true);
    const tooLong = projectDraftSchema.safeParse({ name: "Tee", category: "T_SHIRTS", colors: "x".repeat(COLOURS_MAX_LENGTH + 1) });
    expect(tooLong.error?.issues[0].message).toBe("Keep the colour list under 1,000 characters.");
  });
});
