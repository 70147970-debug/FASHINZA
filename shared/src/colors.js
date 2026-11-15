/**
 * Named colours for garment briefs: all 148 CSS named colours (with their exact CSS values) plus common
 * fashion and textile colour names, each in one family for filtering. The project's "colors" field stays a
 * comma-separated string; this module turns names in it into swatches.
 *
 * Stored tokens, as the colour picker writes them:
 *   "Black"                a colour from this list (the canonical name);
 *   "Dusty teal (#4E8A8C)" a custom colour: a name with its hex value;
 *   "Pantone 19-4052 TCX"  free text (older briefs, references): shown without a swatch unless it is a name here.
 *
 * Fashion colour values are typical trade shades, not a standard: dye lots and mills differ, so briefs should
 * still carry Pantone or lab-dip references where colour matters.
 */

/** @typedef {"neutrals" | "greys" | "browns" | "reds" | "pinks" | "oranges" | "yellows" | "greens" | "blues" | "purples" | "metallics"} ColourFamily */
/** @typedef {{ name: string; hex: string; family: ColourFamily; css: boolean }} NamedColour */

/** Families in display order, each with a representative shade for its filter chip. */
export const COLOUR_FAMILIES = /** @type {const} */ ([
  { value: "neutrals", label: "Whites & neutrals", hex: "#EDE6D6" },
  { value: "greys", label: "Greys & blacks", hex: "#555557" },
  { value: "browns", label: "Browns & tans", hex: "#93502C" },
  { value: "reds", label: "Reds", hex: "#C41E3A" },
  { value: "pinks", label: "Pinks", hex: "#E7A1AE" },
  { value: "oranges", label: "Oranges", hex: "#E2725B" },
  { value: "yellows", label: "Yellows", hex: "#D0A12A" },
  { value: "greens", label: "Greens", hex: "#5A7D3A" },
  { value: "blues", label: "Blues", hex: "#1560BD" },
  { value: "purples", label: "Purples", hex: "#7851A9" },
  { value: "metallics", label: "Metallics", hex: "#B5A642" },
]);

/** The 148 CSS named colours (CSS Color Module Level 4), spelled as words. Values are the CSS definitions. */
const CSS_COLOURS = {
  neutrals: [
    ["White", "#FFFFFF"], ["Snow", "#FFFAFA"], ["Ivory", "#FFFFF0"], ["Floral white", "#FFFAF0"], ["Ghost white", "#F8F8FF"], ["White smoke", "#F5F5F5"],
    ["Seashell", "#FFF5EE"], ["Old lace", "#FDF5E6"], ["Linen", "#FAF0E6"], ["Antique white", "#FAEBD7"], ["Beige", "#F5F5DC"], ["Cornsilk", "#FFF8DC"],
    ["Papaya whip", "#FFEFD5"], ["Blanched almond", "#FFEBCD"], ["Bisque", "#FFE4C4"], ["Navajo white", "#FFDEAD"], ["Wheat", "#F5DEB3"], ["Moccasin", "#FFE4B5"],
    ["Mint cream", "#F5FFFA"], ["Honeydew", "#F0FFF0"], ["Azure", "#F0FFFF"], ["Alice blue", "#F0F8FF"], ["Lavender blush", "#FFF0F5"],
  ],
  greys: [
    ["Black", "#000000"], ["Dim gray", "#696969"], ["Dim grey", "#696969"], ["Gray", "#808080"], ["Grey", "#808080"], ["Dark gray", "#A9A9A9"],
    ["Dark grey", "#A9A9A9"], ["Light gray", "#D3D3D3"], ["Light grey", "#D3D3D3"], ["Gainsboro", "#DCDCDC"], ["Slate gray", "#708090"], ["Slate grey", "#708090"],
    ["Light slate gray", "#778899"], ["Light slate grey", "#778899"], ["Dark slate gray", "#2F4F4F"], ["Dark slate grey", "#2F4F4F"],
  ],
  browns: [
    ["Brown", "#A52A2A"], ["Saddle brown", "#8B4513"], ["Sienna", "#A0522D"], ["Chocolate", "#D2691E"], ["Peru", "#CD853F"], ["Sandy brown", "#F4A460"],
    ["Burlywood", "#DEB887"], ["Tan", "#D2B48C"], ["Rosy brown", "#BC8F8F"],
  ],
  reds: [
    ["Red", "#FF0000"], ["Dark red", "#8B0000"], ["Maroon", "#800000"], ["Firebrick", "#B22222"], ["Crimson", "#DC143C"], ["Indian red", "#CD5C5C"],
    ["Light coral", "#F08080"], ["Salmon", "#FA8072"], ["Dark salmon", "#E9967A"], ["Tomato", "#FF6347"],
  ],
  pinks: [
    ["Pink", "#FFC0CB"], ["Light pink", "#FFB6C1"], ["Hot pink", "#FF69B4"], ["Deep pink", "#FF1493"], ["Pale violet red", "#DB7093"],
    ["Medium violet red", "#C71585"], ["Misty rose", "#FFE4E1"], ["Fuchsia", "#FF00FF"], ["Magenta", "#FF00FF"],
  ],
  oranges: [["Orange", "#FFA500"], ["Dark orange", "#FF8C00"], ["Coral", "#FF7F50"], ["Orange red", "#FF4500"], ["Light salmon", "#FFA07A"], ["Peach puff", "#FFDAB9"]],
  yellows: [
    ["Yellow", "#FFFF00"], ["Light yellow", "#FFFFE0"], ["Lemon chiffon", "#FFFACD"], ["Light goldenrod yellow", "#FAFAD2"], ["Pale goldenrod", "#EEE8AA"],
    ["Khaki", "#F0E68C"], ["Dark khaki", "#BDB76B"], ["Goldenrod", "#DAA520"], ["Dark goldenrod", "#B8860B"],
  ],
  greens: [
    ["Green", "#008000"], ["Dark green", "#006400"], ["Lime", "#00FF00"], ["Lime green", "#32CD32"], ["Lawn green", "#7CFC00"], ["Chartreuse", "#7FFF00"],
    ["Green yellow", "#ADFF2F"], ["Yellow green", "#9ACD32"], ["Olive", "#808000"], ["Olive drab", "#6B8E23"], ["Dark olive green", "#556B2F"],
    ["Forest green", "#228B22"], ["Sea green", "#2E8B57"], ["Medium sea green", "#3CB371"], ["Dark sea green", "#8FBC8F"], ["Light green", "#90EE90"],
    ["Pale green", "#98FB98"], ["Spring green", "#00FF7F"], ["Medium spring green", "#00FA9A"], ["Light sea green", "#20B2AA"], ["Medium aquamarine", "#66CDAA"],
  ],
  blues: [
    ["Blue", "#0000FF"], ["Medium blue", "#0000CD"], ["Dark blue", "#00008B"], ["Navy", "#000080"], ["Midnight blue", "#191970"], ["Royal blue", "#4169E1"],
    ["Dodger blue", "#1E90FF"], ["Deep sky blue", "#00BFFF"], ["Sky blue", "#87CEEB"], ["Light sky blue", "#87CEFA"], ["Light blue", "#ADD8E6"],
    ["Powder blue", "#B0E0E6"], ["Light steel blue", "#B0C4DE"], ["Steel blue", "#4682B4"], ["Cornflower blue", "#6495ED"], ["Cadet blue", "#5F9EA0"],
    ["Cyan", "#00FFFF"], ["Aqua", "#00FFFF"], ["Light cyan", "#E0FFFF"], ["Pale turquoise", "#AFEEEE"], ["Turquoise", "#40E0D0"], ["Medium turquoise", "#48D1CC"],
    ["Dark turquoise", "#00CED1"], ["Teal", "#008080"], ["Dark cyan", "#008B8B"], ["Aquamarine", "#7FFFD4"],
  ],
  purples: [
    ["Purple", "#800080"], ["Rebecca purple", "#663399"], ["Indigo", "#4B0082"], ["Dark violet", "#9400D3"], ["Dark orchid", "#9932CC"], ["Dark magenta", "#8B008B"],
    ["Blue violet", "#8A2BE2"], ["Medium purple", "#9370DB"], ["Medium orchid", "#BA55D3"], ["Orchid", "#DA70D6"], ["Violet", "#EE82EE"], ["Plum", "#DDA0DD"],
    ["Thistle", "#D8BFD8"], ["Lavender", "#E6E6FA"], ["Slate blue", "#6A5ACD"], ["Medium slate blue", "#7B68EE"], ["Dark slate blue", "#483D8B"],
  ],
  metallics: [["Silver", "#C0C0C0"], ["Gold", "#FFD700"]],
};

/** Fashion and textile colour names (trade shades), none of which repeats a CSS name. */
const FASHION_COLOURS = {
  neutrals: [
    ["Off-white", "#F4F1EA"], ["Natural", "#EDE6D6"], ["Undyed", "#E9E2D0"], ["Ecru", "#E6DCC6"], ["Optic white", "#FBFBF8"], ["Warm white", "#F7F3EA"],
    ["Soft white", "#F5F3EE"], ["Chalk", "#F1EEE6"], ["Cream", "#F6EFD9"], ["Vanilla", "#F3E5AB"], ["Eggshell", "#F0EAD6"], ["Bone", "#E3DAC9"],
    ["Alabaster", "#EDEAE0"], ["Porcelain", "#EEEDE8"], ["Pearl", "#EAE0C8"], ["Oyster", "#DCD5C6"], ["Oatmeal", "#D8CCB4"], ["Parchment", "#F1E9D2"],
    ["Sand", "#D2C1A0"], ["Stone", "#BDB3A3"], ["Putty", "#CDBFA6"], ["Mushroom", "#BCAD9C"], ["Greige", "#B8AE9E"], ["Taupe", "#8B7E70"],
    ["Biscuit", "#E1CFA8"], ["Buttermilk", "#F7EBC6"], ["Coconut milk", "#F3EEE2"], ["Raw cotton", "#EFE9DC"], ["Calico", "#E4D5B7"], ["Pebble", "#CFC9BE"],
    ["Sandstone", "#C9B48F"], ["Cashmere", "#D8C3AA"], ["Nude", "#E3BC9A"], ["Champagne", "#F1E1C6"], ["Flax", "#D7C6A0"], ["Jute", "#C8B48A"],
    ["Hemp", "#BFB08F"], ["Light beige", "#E8DCC8"], ["Dark beige", "#BFA98B"],
  ],
  greys: [
    ["Heather grey", "#B6B5B2"], ["Grey melange", "#A9A9A6"], ["Light grey melange", "#C9C8C5"], ["Charcoal", "#3C3C3E"], ["Charcoal heather", "#555557"],
    ["Charcoal melange", "#4E4E50"], ["Dark charcoal", "#2A2B2D"], ["Ash grey", "#BDBAB4"], ["Dove grey", "#B5B1AB"], ["Pale grey", "#DCDCDA"],
    ["Mid grey", "#8C8C8A"], ["Smoke grey", "#87888A"], ["Fog", "#D6D7D2"], ["Silver grey", "#A8A9AD"], ["Gull grey", "#A4ADB0"], ["Slate", "#5B6670"],
    ["Graphite", "#474A4F"], ["Anthracite", "#383E42"], ["Iron grey", "#52575C"], ["Steel grey", "#71797E"], ["Concrete", "#9E9D98"], ["Cement", "#8E8B85"],
    ["Flint", "#6F6A64"], ["Storm grey", "#717486"], ["Granite", "#676767"], ["Gravel", "#7F7C77"], ["Battleship grey", "#848482"], ["Elephant grey", "#8A8780"],
    ["Cool grey", "#999DA3"], ["Warm grey", "#A39E96"], ["Oxford grey", "#5C5D5F"], ["Jet black", "#0A0A0A"], ["Washed black", "#2E2E2F"],
    ["Faded black", "#3A3A3A"], ["Off-black", "#1E1E1E"], ["Ink black", "#16181D"], ["Onyx", "#353839"], ["Raven", "#222126"], ["Carbon", "#2C2D2F"],
    ["Liquorice", "#1A1110"], ["Asphalt", "#434547"],
  ],
  browns: [
    ["Camel", "#C19A6B"], ["Cognac", "#93502C"], ["Chestnut", "#954535"], ["Coffee", "#6F4E37"], ["Espresso", "#3C2A21"], ["Mocha", "#70533F"],
    ["Latte", "#C5A582"], ["Cappuccino", "#A8846B"], ["Caramel", "#B97A3E"], ["Toffee", "#9E6A3C"], ["Cinnamon", "#A35A33"], ["Hazelnut", "#A67B5B"],
    ["Walnut", "#5C4033"], ["Mahogany", "#6B2F22"], ["Tobacco", "#6E5135"], ["Raw umber", "#826644"], ["Burnt umber", "#8A3324"], ["Sepia", "#704214"],
    ["Fawn", "#C8A57E"], ["Mink", "#7E6A5B"], ["Truffle", "#5E4A3E"], ["Cocoa", "#5D3F2E"], ["Dark chocolate", "#3D2B1F"], ["Milk chocolate", "#84563C"],
    ["Leather brown", "#7F4F2A"], ["Tawny", "#A8662E"], ["Russet", "#80461B"], ["Acorn", "#7A5230"], ["Pecan", "#8A5A36"], ["Bark", "#5A4535"],
    ["Clay", "#B47B5E"], ["Desert sand", "#EDC9AF"], ["Driftwood", "#A08B74"], ["Cedar", "#7A4B32"], ["Teak", "#9C6C3F"], ["Nutmeg", "#7E4A35"],
    ["Coyote brown", "#81613C"], ["Dark brown", "#4A3125"], ["Mid brown", "#85603F"], ["Light brown", "#B5835A"],
  ],
  reds: [
    ["Burgundy", "#800020"], ["Wine", "#722F37"], ["Berry", "#8B2D4A"], ["Oxblood", "#5C1A1B"], ["Claret", "#7F1734"], ["Bordeaux", "#5E1224"],
    ["Merlot", "#73343A"], ["Cherry", "#A0152C"], ["Scarlet", "#FF2400"], ["Vermilion", "#E34234"], ["Cardinal", "#C41E3A"], ["Ruby", "#9B111E"],
    ["Garnet", "#733635"], ["Carmine", "#960018"], ["Brick red", "#CB4154"], ["Pillar box red", "#D3121A"], ["Poppy", "#DC343B"], ["Lipstick red", "#C0112D"],
    ["Blood red", "#7E0A0A"], ["Cranberry", "#95182A"], ["Chilli red", "#C0261A"], ["True red", "#BF1932"], ["Signal red", "#A52019"], ["Fire engine red", "#CE2029"],
    ["Rosewood", "#65000B"], ["Marsala", "#964F4C"], ["Sangria", "#92000A"], ["Redwood", "#A45A52"], ["Cinnabar", "#E44D2E"], ["Barn red", "#7C0A02"],
    ["Candy apple red", "#FF0800"], ["Venetian red", "#C80815"], ["Deep red", "#850101"], ["Bright red", "#EE1C25"],
  ],
  pinks: [
    ["Blush", "#EFC3BC"], ["Dusty pink", "#D4A5A5"], ["Dusty rose", "#C4918F"], ["Old rose", "#C08081"], ["Baby pink", "#F4C2C2"], ["Powder pink", "#F6D3D3"],
    ["Ballet pink", "#F2CFD4"], ["Pale pink", "#FADADD"], ["Pastel pink", "#F8C8DC"], ["Rose pink", "#E7A1AE"], ["Petal pink", "#F1C4C9"], ["Bubblegum", "#FFC1CC"],
    ["Candy pink", "#E4717A"], ["Flamingo", "#FC8EAC"], ["Cerise", "#DE3163"], ["Raspberry", "#E30B5C"], ["Watermelon", "#FC6C85"], ["Salmon pink", "#FF91A4"],
    ["Coral pink", "#F88379"], ["Peony", "#E06C9F"], ["Carnation pink", "#F7A8C4"], ["Shell pink", "#F6D7D0"], ["Nude pink", "#E8C3B9"], ["Tea rose", "#E7B3AE"],
    ["Pink sand", "#E8CFC3"], ["Cameo pink", "#EFBBCC"], ["Orchid pink", "#F2BDCD"], ["Lotus pink", "#EBA3B3"], ["Neon pink", "#FF6EC7"], ["Shocking pink", "#FC0FC0"],
    ["Fuchsia pink", "#E040A0"], ["Dark pink", "#E75480"], ["Strawberry", "#FC5A8D"], ["Rouge", "#A94064"], ["Puce", "#CC8899"],
  ],
  oranges: [
    ["Rust", "#B7410E"], ["Terracotta", "#C8684B"], ["Burnt orange", "#CC5500"], ["Burnt sienna", "#E97451"], ["Tangerine", "#F28500"], ["Mandarin", "#F37A48"],
    ["Clementine", "#E96E00"], ["Pumpkin", "#FF7518"], ["Carrot", "#ED9121"], ["Apricot", "#FBCEB1"], ["Peach", "#F8C4A0"], ["Peach fuzz", "#FFBE98"],
    ["Melon", "#FDBCB4"], ["Cantaloupe", "#F7A964"], ["Nectarine", "#FF8656"], ["Mango", "#FF9F3A"], ["Papaya", "#F98B5A"], ["Persimmon", "#EC5800"],
    ["Marmalade", "#D96B1D"], ["Ginger", "#B06500"], ["Amber", "#E0902A"], ["Paprika", "#B84A2E"], ["Flame", "#E25822"], ["Sunset orange", "#FD5E53"],
    ["Safety orange", "#FF6700"], ["Hi-vis orange", "#FF6A13"], ["Neon orange", "#FF5F1F"], ["Bright orange", "#FF7A00"], ["Deep orange", "#E05A00"],
    ["Pastel orange", "#FFB347"], ["Light orange", "#FFC48C"],
  ],
  yellows: [
    ["Mustard", "#D0A12A"], ["Ochre", "#CC7722"], ["Saffron", "#F4C430"], ["Lemon", "#FFF44F"], ["Butter yellow", "#F8E58C"], ["Canary", "#FFEF00"],
    ["Sunflower", "#FFC512"], ["Daffodil", "#FFDA29"], ["Primrose", "#EEE48C"], ["Buttercup", "#F5D33F"], ["Honey", "#EBA937"], ["Maize", "#FBEC5D"],
    ["Golden yellow", "#FFDF00"], ["Dijon", "#C29A2A"], ["Turmeric", "#E5A21C"], ["Banana", "#FFE135"], ["Pastel yellow", "#FDFD96"], ["Pale yellow", "#FCF4A3"],
    ["Straw", "#E4D96F"], ["Citrine", "#E4D00A"], ["Sulphur", "#DDD06A"], ["Marigold", "#EAA221"], ["Mimosa", "#F0C05A"], ["Dandelion", "#F0E130"],
    ["Bright yellow", "#FFE700"], ["Pineapple", "#F7DD53"], ["Chamomile", "#E8D07A"], ["Custard", "#F4E29D"], ["Neon yellow", "#E6FF1A"], ["Hi-vis yellow", "#DCF21E"],
  ],
  greens: [
    ["Sage", "#9CA98A"], ["Light sage", "#C6CFB7"], ["Mint", "#B3E2C5"], ["Emerald", "#50C878"], ["Bottle green", "#006A4E"], ["Forest", "#2C4A34"],
    ["Olive green", "#6B7134"], ["Khaki green", "#7C7D55"], ["Army green", "#4B5320"], ["Military green", "#5D6B3C"], ["Loden", "#5B6440"], ["Moss", "#8A9A5B"],
    ["Fern", "#4F7942"], ["Pine", "#2A5A43"], ["Hunter green", "#355E3B"], ["British racing green", "#004225"], ["Jade", "#00A86B"], ["Kelly green", "#4CBB17"],
    ["Grass green", "#3F9B0B"], ["Apple green", "#8DB600"], ["Pistachio", "#93C572"], ["Avocado", "#568203"], ["Pea green", "#8EAB12"], ["Celadon", "#ACE1AF"],
    ["Eucalyptus", "#7D9A88"], ["Seafoam", "#9FE2BF"], ["Spearmint", "#45B08C"], ["Neon green", "#39FF14"], ["Acid green", "#B0BF1A"], ["Leaf green", "#5CA904"],
    ["Juniper", "#6D9292"], ["Spruce", "#0A5F38"], ["Basil", "#5A7D3A"], ["Matcha", "#A2B86C"], ["Deep green", "#056608"], ["Pastel green", "#77DD77"],
    ["Jungle green", "#29AB87"], ["Lichen", "#9DA67C"], ["Shamrock", "#009E60"], ["Malachite", "#0BDA51"], ["Verdigris", "#43B3AE"], ["Tea green", "#D0F0C0"],
  ],
  blues: [
    ["Cobalt", "#0047AB"], ["Denim blue", "#1560BD"], ["Light denim", "#7E9CC2"], ["Mid denim", "#4F6D96"], ["Dark denim", "#2D3E58"], ["Stonewash blue", "#7A93AE"],
    ["Rinse indigo", "#233453"], ["Chambray", "#8DA6C3"], ["Petrol", "#005F6A"], ["French navy", "#1C2541"], ["Midnight navy", "#1B2338"], ["Dark navy", "#141B2D"],
    ["Light navy", "#2E3B5E"], ["Navy melange", "#3B4560"], ["Ink blue", "#1F3A5F"], ["Air force blue", "#5D8AA8"], ["Baby blue", "#89CFF0"], ["Pale blue", "#AFDBF5"],
    ["Ice blue", "#D6ECF3"], ["Arctic blue", "#C6DEF1"], ["Glacier blue", "#A9C9D6"], ["Duck egg", "#C5DDD6"], ["Dusty blue", "#8BA3B9"], ["Periwinkle", "#CCCCFF"],
    ["Bluebell", "#A2A2D0"], ["Blueberry", "#4F86F7"], ["Electric blue", "#2C75FF"], ["Bright blue", "#0096FF"], ["True blue", "#0073CF"], ["Sapphire", "#0F52BA"],
    ["Cerulean", "#007BA7"], ["Capri blue", "#0F6FB3"], ["Ultramarine", "#3B4CC0"], ["Prussian blue", "#003153"], ["Oxford blue", "#002147"], ["Delft blue", "#1F305E"],
    ["Admiral blue", "#1D2B53"], ["Sailor blue", "#22356F"], ["Storm blue", "#476A85"], ["Sea blue", "#006994"], ["Ocean blue", "#20639B"], ["Marine blue", "#0B3D6B"],
    ["Lagoon", "#4AB1B8"], ["Peacock blue", "#006A78"], ["Deep teal", "#1F4E4F"], ["Dark teal", "#014D4E"], ["Teal blue", "#367588"],
  ],
  purples: [
    ["Mauve", "#B18A9E"], ["Mauve taupe", "#915F6D"], ["Lilac", "#C8A2C8"], ["Pale lilac", "#E1CCE6"], ["Dusty lilac", "#BFA6BF"], ["Wisteria", "#C9A0DC"],
    ["Heather purple", "#9B86A8"], ["Lavender grey", "#C4C3D0"], ["Pastel purple", "#B39EB5"], ["Light purple", "#CBC3E3"], ["Amethyst", "#9966CC"], ["Iris", "#5A4FCF"],
    ["Ultra violet", "#5F4B8B"], ["Royal purple", "#7851A9"], ["Bright purple", "#9F2FD0"], ["Electric purple", "#BF00FF"], ["Heliotrope", "#DF73FF"], ["Grape", "#6F2DA8"],
    ["Imperial purple", "#602F6B"], ["Byzantium", "#702963"], ["Boysenberry", "#873260"], ["Mulberry", "#6C2B4C"], ["Tyrian purple", "#66023C"], ["Pansy", "#6B2F70"],
    ["Aubergine", "#4A2545"], ["Eggplant", "#614051"], ["Damson", "#4F2942"], ["Blackcurrant", "#3E1F3D"], ["Prune", "#5A2A45"], ["Raisin", "#4B2E39"],
    ["Fig", "#5A3D4F"], ["Deep purple", "#452260"], ["Dark purple", "#301934"],
  ],
  metallics: [
    ["Metallic gold", "#D4AF37"], ["Gilt", "#CBA135"], ["Antique gold", "#A88B4A"], ["Old gold", "#CFB53B"], ["Pale gold", "#E6BE8A"], ["Champagne gold", "#D6B98C"],
    ["White gold", "#EDE7D9"], ["Rose gold", "#B76E79"], ["Brass", "#B5A642"], ["Antique brass", "#CD9575"], ["Bronze", "#CD7F32"], ["Copper", "#B87333"],
    ["Burnished copper", "#A6542B"], ["Metallic silver", "#AAA9AD"], ["Antique silver", "#9C9C9A"], ["Brushed silver", "#BEC2CB"], ["Platinum", "#E5E4E2"],
    ["Chrome", "#DBE4EB"], ["Pewter", "#8A8F93"], ["Nickel", "#727472"], ["Titanium", "#878681"], ["Gunmetal", "#2A3439"], ["Hematite", "#3E3F43"],
  ],
};

/**
 * Lookup key for a colour name: lower case, accents removed, letters and digits only. So "Off-white",
 * "off white" and "OFFWHITE" are the same colour, and CSS keywords ("darkslategray") find their spelled names.
 * @param {string} name
 */
export function normaliseColourName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const familyOrder = new Map(COLOUR_FAMILIES.map((f, i) => [f.value, i]));

/** @param {Record<string, [string, string][]>} table @param {boolean} css @returns {NamedColour[]} */
const rows = (table, css) =>
  Object.entries(table).flatMap(([family, list]) => list.map(([name, hex]) => ({ name, hex, family: /** @type {ColourFamily} */ (family), css })));

/**
 * Every named colour, grouped by family (in COLOUR_FAMILIES order) and sorted by name within a family.
 * @type {readonly NamedColour[]}
 */
export const COLOURS = Object.freeze(
  [...rows(CSS_COLOURS, true), ...rows(FASHION_COLOURS, false)]
    .sort((a, b) => (familyOrder.get(a.family) ?? 99) - (familyOrder.get(b.family) ?? 99) || a.name.localeCompare(b.name, "en"))
    .map((c) => Object.freeze(c)),
);

const BY_KEY = new Map(COLOURS.map((c) => [normaliseColourName(c.name), c]));

/**
 * The named colour for a name (any case, spacing or hyphenation; "gray" and "grey" are tried both ways), or
 * undefined.
 * @param {string} name
 * @returns {NamedColour | undefined}
 */
export function findColour(name) {
  const key = normaliseColourName(name);
  if (!key) return undefined;
  return BY_KEY.get(key) ?? BY_KEY.get(key.replace(/gray/g, "grey")) ?? BY_KEY.get(key.replace(/grey/g, "gray"));
}

/** @param {string} value */
export function colourFamilyLabel(value) {
  return COLOUR_FAMILIES.find((f) => f.value === value)?.label ?? value;
}

/** "#abc" or "#AABBCC" → "#AABBCC"; anything else → null. @param {string} hex */
export function normaliseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

/**
 * The colours in a stored list: split on commas, trimmed, empty parts and repeats (by name) dropped.
 * @param {string | null | undefined} value
 * @returns {string[]}
 */
export function parseColourList(value) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const part of String(value ?? "").split(",")) {
    const token = part.trim().replace(/\s+/g, " ");
    const key = colourTokenKey(token);
    if (!token || seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

/** @param {string[]} tokens */
export function formatColourList(tokens) {
  return tokens.join(", ");
}

const CUSTOM = /^(.*?)\s*\(\s*(#[0-9a-f]{3}|#[0-9a-f]{6})\s*\)$/i;

/**
 * A custom colour as stored: "Name (#RRGGBB)". Commas are removed from the name (they separate colours).
 * @param {string} name @param {string} hex
 */
export function customColourToken(name, hex) {
  const n = String(name ?? "").replace(/,/g, " ").trim().replace(/\s+/g, " ");
  const h = normaliseHex(hex) ?? "#000000";
  return n ? `${n} (${h})` : h;
}

/**
 * What a stored token shows: its name, and a swatch colour when it is a custom colour ("Name (#RRGGBB)"), a bare
 * hex value or a known colour name. `hex` is null for anything else (free text such as a Pantone reference).
 * @param {string} token
 * @returns {{ token: string; name: string; hex: string | null; kind: "named" | "custom" | "text"; colour?: NamedColour }}
 */
export function resolveColourToken(token) {
  const t = String(token ?? "").trim();
  const custom = CUSTOM.exec(t);
  if (custom) {
    const hex = normaliseHex(custom[2]);
    return { token: t, name: custom[1].trim() || /** @type {string} */ (hex), hex, kind: "custom" };
  }
  const bare = normaliseHex(t);
  if (bare && t.startsWith("#")) return { token: t, name: bare, hex: bare, kind: "custom" };
  const colour = findColour(t);
  if (colour) return { token: t, name: t, hex: colour.hex, kind: "named", colour };
  return { token: t, name: t, hex: null, kind: "text" };
}

/** Identity of a token for de-duplication: the normalised name (a custom colour by its name and hex). @param {string} token */
export function colourTokenKey(token) {
  const r = resolveColourToken(token);
  if (r.kind === "custom") return `${normaliseColourName(r.name)}|${r.hex}`;
  if (r.colour) return normaliseColourName(r.colour.name);
  return normaliseColourName(r.token) || r.token.toLowerCase();
}

/**
 * Colours matching a search, best first: exact name, then names starting with the query, then names with a word
 * starting with it, then names containing it. Spacing, hyphens and case are ignored. An empty query returns the
 * family (or every colour) in COLOURS order.
 * @param {string} query @param {{ family?: string | null }} [options]
 * @returns {NamedColour[]}
 */
export function searchColours(query, { family = null } = {}) {
  const pool = family && family !== "all" ? COLOURS.filter((c) => c.family === family) : COLOURS;
  const q = normaliseColourName(query);
  if (!q) return [...pool];
  const words = String(query).toLowerCase().trim();
  /** @type {[number, NamedColour][]} */
  const ranked = [];
  for (const c of pool) {
    const key = normaliseColourName(c.name);
    let rank = -1;
    if (key === q) rank = 0;
    else if (key.startsWith(q)) rank = 1;
    else if (c.name.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(words) || normaliseColourName(w).startsWith(q))) rank = 2;
    else if (key.includes(q)) rank = 3;
    if (rank >= 0) ranked.push([rank, c]);
  }
  return ranked.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || a[1].name.localeCompare(b[1].name, "en")).map(([, c]) => c);
}
