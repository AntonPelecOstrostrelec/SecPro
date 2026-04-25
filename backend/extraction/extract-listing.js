// Extract structured fields from a real estate listing using Gemini.
//
// Input: a row from `listings` table (with title + description_raw).
// Output: structured JSON matching `listings` schema for these fields:
//   city_district, street, street_number, subtype, rooms, bathrooms,
//   floor, total_floors, condition, construction_year, year_last_renovation,
//   energy_class, orientation, parking, heating, balcony, terrace, loggia,
//   cellar, elevator, furnished, description_ai_summary, seller_type_inferred.

const { generateJson } = require('../lib/gemini');

const SYSTEM = `Si expert na slovenské realitné inzeráty. Z titulu + popisu vyextraktuj štruktúrované dáta.

PRAVIDLÁ:
- Ak hodnota nie je v texte JEDNOZNAČNE, vráť null. NIKDY neháluciuj.
- city_district: časť mesta (Petržalka, Ružinov, Karlova Ves, Staré Mesto, Sever, KVP...). Bez "Bratislava-".
- street + street_number: názov ulice a číslo (napr. "Hálova", "5"). NIE postal code, NIE city.
- subtype: konkrétny typ (1-izbový, 2-izbový, ... 5+izbový, garsónka, mezonet, novostavba, rodinný dom, apartmán...).
- rooms: počet izieb ako číslo. "garsónka" = 1.
- condition (enum):
   * novostavba — nikdy nebýval nikto / projekt vo výstavbe
   * kompletna_rekonstrukcia — zrekonštruovaný, nový po rekonštrukcii
   * ciastocna_rekonstrukcia — čiastočná, vymenené napr. okná
   * povodny_stav — pôvodný, neopravený
   * holobyt — len holé steny
- construction_year: rok postavenia (1900-2030 only)
- energy_class: jedno písmeno A B C D E F G (z certifikátu)
- orientation (enum): S J V Z SV SZ JV JZ
- parking (enum):
   * garaz — vlastná garáž
   * kryte_state — kryté parkovacie miesto
   * vonkajsie_state — vonkajšie parkovacie miesto
   * ziadne — bez parkovania
- heating (enum): plyn, dialkove, elektrina, tepelne_cerpadlo, tuhe_palivo, ine, ziadne
- balcony, terrace, loggia, cellar, elevator, furnished: TRUE iba ak SPOMENUTÉ v texte. Inak null (nie false).
- description_ai_summary: 2-3 vety v slovenčine, faktické zhrnutie kľúčových vlastností (typ, lokalita, stav, špeciality).
- seller_type_inferred: 'private' | 'agency' | 'unknown'.
   * agency — ak sa text odvoláva na realitnú kanceláriu, maklera, províziu, "RK ponuka", "naša kancelária"
   * private — ak osloví v prvej osobe, "predávame náš byt", "majiteľ"
   * unknown — nejasné

ŠPECIFIKÁ:
- "Holičkova" / "Petržalka" / "Bratislava IV - Karlova Ves" → city_district je "Karlova Ves"
- Ak energetický štítok obsahuje "B" alebo "B0" alebo "B1" → energy_class = "B"
- "rekonštruovaný v r. 2020" → year_last_renovation = 2020
- "novostavba 2024" → construction_year = 2024, condition = "novostavba"
`;

// Gemini responseSchema — strict typed JSON
const SCHEMA = {
  type: 'object',
  properties: {
    city_district:        { type: 'string', nullable: true },
    street:               { type: 'string', nullable: true },
    street_number:        { type: 'string', nullable: true },
    subtype:              { type: 'string', nullable: true },
    rooms:                { type: 'integer', nullable: true },
    bathrooms:            { type: 'integer', nullable: true },
    floor:                { type: 'integer', nullable: true },
    total_floors:         { type: 'integer', nullable: true },
    condition:            { type: 'string', enum: ['novostavba','kompletna_rekonstrukcia','ciastocna_rekonstrukcia','povodny_stav','holobyt','vo_vystavbe'], nullable: true },
    construction_year:    { type: 'integer', nullable: true },
    year_last_renovation: { type: 'integer', nullable: true },
    energy_class:         { type: 'string', enum: ['A','B','C','D','E','F','G'], nullable: true },
    orientation:          { type: 'string', enum: ['S','J','V','Z','SV','SZ','JV','JZ'], nullable: true },
    parking:              { type: 'string', enum: ['garaz','kryte_state','vonkajsie_state','ziadne'], nullable: true },
    heating:              { type: 'string', enum: ['plyn','dialkove','elektrina','tepelne_cerpadlo','tuhe_palivo','ine','ziadne'], nullable: true },
    balcony:              { type: 'boolean', nullable: true },
    terrace:              { type: 'boolean', nullable: true },
    loggia:               { type: 'boolean', nullable: true },
    cellar:               { type: 'boolean', nullable: true },
    elevator:             { type: 'boolean', nullable: true },
    furnished:            { type: 'boolean', nullable: true },
    description_ai_summary: { type: 'string', nullable: true },
    seller_type_inferred: { type: 'string', enum: ['private','agency','unknown'] },
  },
  required: ['seller_type_inferred'],
};

// Build user prompt from listing
function buildPrompt(listing) {
  return `TITULOK: ${listing.title || '(bez titulu)'}

POPIS:
${(listing.description_raw || '').slice(0, 4000)}

DATA Z PORTÁLU:
- type: ${listing.type}
- price: ${listing.price ? listing.price + ' €' : 'neuvedená'}
- size_m2: ${listing.size_m2 || 'neuvedené'}
- city: ${listing.city || 'neuvedené'}

Vráť JSON podľa schémy.`;
}

/**
 * Extract structured fields from one listing.
 * @param {Object} listing  Row from `listings` table.
 * @returns {Promise<Object>} JSON with extracted fields.
 */
async function extractListing(listing) {
  const prompt = buildPrompt(listing);
  const result = await generateJson({
    prompt,
    systemInstruction: SYSTEM,
    schema: SCHEMA,
    temperature: 0,
  });
  return result;
}

module.exports = { extractListing, buildPrompt, SYSTEM, SCHEMA };
