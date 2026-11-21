// Country names as the lists write them (English; Latvian for the LV frozen-assets list) to ISO
// 3166 alpha-2, lower-case. A name not here gives no country: screening then never reaches
// `listed` or `ruled_out` on that identifier, which is the safe side of rule 4 (sanctions.md §7).
import { normalizeText } from "@finora/domain";

const NAMES: Record<string, string> = {
  afghanistan: "af", albania: "al", algeria: "dz", armenia: "am", australia: "au", austria: "at", azerbaijan: "az",
  bahrain: "bh", belarus: "by", belgium: "be", "bosnia and herzegovina": "ba", brazil: "br", bulgaria: "bg",
  burma: "mm", myanmar: "mm", cambodia: "kh", canada: "ca", "central african republic": "cf", china: "cn",
  colombia: "co", croatia: "hr", cuba: "cu", cyprus: "cy", "czech republic": "cz", czechia: "cz", denmark: "dk",
  "democratic republic of the congo": "cd", "congo democratic republic of the": "cd", egypt: "eg", eritrea: "er",
  estonia: "ee", finland: "fi", france: "fr", georgia: "ge", germany: "de", greece: "gr", "hong kong": "hk",
  hungary: "hu", india: "in", indonesia: "id", iran: "ir", iraq: "iq", ireland: "ie", israel: "il", italy: "it",
  japan: "jp", jordan: "jo", kazakhstan: "kz", kenya: "ke", "north korea": "kp", "korea north": "kp",
  "democratic people s republic of korea": "kp", "south korea": "kr", "korea south": "kr", kosovo: "xk",
  kuwait: "kw", kyrgyzstan: "kg", laos: "la", latvia: "lv", lebanon: "lb", libya: "ly", liechtenstein: "li",
  lithuania: "lt", luxembourg: "lu", malaysia: "my", mali: "ml", malta: "mt", "marshall islands": "mh",
  mexico: "mx", moldova: "md", mongolia: "mn", montenegro: "me", morocco: "ma", netherlands: "nl",
  "new zealand": "nz", nicaragua: "ni", nigeria: "ng", "north macedonia": "mk", norway: "no", oman: "om",
  pakistan: "pk", panama: "pa", philippines: "ph", poland: "pl", portugal: "pt", qatar: "qa", romania: "ro",
  russia: "ru", "russian federation": "ru", "saudi arabia": "sa", serbia: "rs", seychelles: "sc",
  singapore: "sg", slovakia: "sk", slovenia: "si", somalia: "so", "south africa": "za", "south sudan": "ss",
  spain: "es", "sri lanka": "lk", sudan: "sd", sweden: "se", switzerland: "ch", syria: "sy", taiwan: "tw",
  tajikistan: "tj", thailand: "th", tunisia: "tn", turkey: "tr", turkiye: "tr", turkmenistan: "tm",
  uganda: "ug", ukraine: "ua", "united arab emirates": "ae", uae: "ae", "united kingdom": "gb", uk: "gb",
  "united states": "us", "united states of america": "us", usa: "us", uzbekistan: "uz", venezuela: "ve",
  vietnam: "vn", "viet nam": "vn", yemen: "ye", zimbabwe: "zw", "british virgin islands": "vg",
  "virgin islands british": "vg", "cayman islands": "ky", belize: "bz",
  // Latvian, as the LV frozen-assets list writes them
  latvija: "lv", lietuva: "lt", igaunija: "ee", krievija: "ru", "krievijas federacija": "ru", baltkrievija: "by",
  kipra: "cy", ukraina: "ua", vacija: "de", "apvienotie arabu emirati": "ae", "apvienota karaliste": "gb",
  "amerikas savienotas valstis": "us", kazahstana: "kz", turcija: "tr", kina: "cn", sveice: "ch", irana: "ir",
};

/** The ISO code of a country name or code; null when unknown. */
export function countryCode(name: string): string | null {
  const key = normalizeText(name);
  return NAMES[key] ?? (/^[a-z]{2}$/.test(key) ? key : null);
}
