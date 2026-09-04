/**
 * Country reference data for the address and phone fields.
 *
 * United States and Canada lead the list — they are the overwhelming majority
 * of accounts — and every other country follows in alphabetical order, so the
 * two common picks are one click away without hunting for them mid-list. The
 * address Country select and the phone dial-code select both read this table,
 * which is what keeps them in the same order.
 *
 * `dial` is the calling code without its "+". NANP members carry their full
 * three-digit code (Jamaica is 1876, not 1), the way a phone picker lists them,
 * so the longest-match lookup in `findDialOption` can tell them apart from the
 * bare +1.
 */

export type CountryInfo = {
  name: string;
  /** ISO 3166-1 alpha-2, shown as the dial option's label prefix ("US +1"). */
  iso: string;
  dial: string;
};

const REST_OF_WORLD: CountryInfo[] = [
  { name: "Afghanistan", iso: "AF", dial: "93" },
  { name: "Albania", iso: "AL", dial: "355" },
  { name: "Algeria", iso: "DZ", dial: "213" },
  { name: "Andorra", iso: "AD", dial: "376" },
  { name: "Angola", iso: "AO", dial: "244" },
  { name: "Antigua and Barbuda", iso: "AG", dial: "1268" },
  { name: "Argentina", iso: "AR", dial: "54" },
  { name: "Armenia", iso: "AM", dial: "374" },
  { name: "Australia", iso: "AU", dial: "61" },
  { name: "Austria", iso: "AT", dial: "43" },
  { name: "Azerbaijan", iso: "AZ", dial: "994" },
  { name: "Bahamas", iso: "BS", dial: "1242" },
  { name: "Bahrain", iso: "BH", dial: "973" },
  { name: "Bangladesh", iso: "BD", dial: "880" },
  { name: "Barbados", iso: "BB", dial: "1246" },
  { name: "Belarus", iso: "BY", dial: "375" },
  { name: "Belgium", iso: "BE", dial: "32" },
  { name: "Belize", iso: "BZ", dial: "501" },
  { name: "Benin", iso: "BJ", dial: "229" },
  { name: "Bhutan", iso: "BT", dial: "975" },
  { name: "Bolivia", iso: "BO", dial: "591" },
  { name: "Bosnia and Herzegovina", iso: "BA", dial: "387" },
  { name: "Botswana", iso: "BW", dial: "267" },
  { name: "Brazil", iso: "BR", dial: "55" },
  { name: "Brunei", iso: "BN", dial: "673" },
  { name: "Bulgaria", iso: "BG", dial: "359" },
  { name: "Burkina Faso", iso: "BF", dial: "226" },
  { name: "Burundi", iso: "BI", dial: "257" },
  { name: "Cabo Verde", iso: "CV", dial: "238" },
  { name: "Cambodia", iso: "KH", dial: "855" },
  { name: "Cameroon", iso: "CM", dial: "237" },
  { name: "Central African Republic", iso: "CF", dial: "236" },
  { name: "Chad", iso: "TD", dial: "235" },
  { name: "Chile", iso: "CL", dial: "56" },
  { name: "China", iso: "CN", dial: "86" },
  { name: "Colombia", iso: "CO", dial: "57" },
  { name: "Comoros", iso: "KM", dial: "269" },
  { name: "Congo (Brazzaville)", iso: "CG", dial: "242" },
  { name: "Congo (Kinshasa)", iso: "CD", dial: "243" },
  { name: "Costa Rica", iso: "CR", dial: "506" },
  { name: "Côte d'Ivoire", iso: "CI", dial: "225" },
  { name: "Croatia", iso: "HR", dial: "385" },
  { name: "Cuba", iso: "CU", dial: "53" },
  { name: "Cyprus", iso: "CY", dial: "357" },
  { name: "Czechia", iso: "CZ", dial: "420" },
  { name: "Denmark", iso: "DK", dial: "45" },
  { name: "Djibouti", iso: "DJ", dial: "253" },
  { name: "Dominica", iso: "DM", dial: "1767" },
  { name: "Dominican Republic", iso: "DO", dial: "1809" },
  { name: "Ecuador", iso: "EC", dial: "593" },
  { name: "Egypt", iso: "EG", dial: "20" },
  { name: "El Salvador", iso: "SV", dial: "503" },
  { name: "Equatorial Guinea", iso: "GQ", dial: "240" },
  { name: "Eritrea", iso: "ER", dial: "291" },
  { name: "Estonia", iso: "EE", dial: "372" },
  { name: "Eswatini", iso: "SZ", dial: "268" },
  { name: "Ethiopia", iso: "ET", dial: "251" },
  { name: "Fiji", iso: "FJ", dial: "679" },
  { name: "Finland", iso: "FI", dial: "358" },
  { name: "France", iso: "FR", dial: "33" },
  { name: "Gabon", iso: "GA", dial: "241" },
  { name: "Gambia", iso: "GM", dial: "220" },
  { name: "Georgia", iso: "GE", dial: "995" },
  { name: "Germany", iso: "DE", dial: "49" },
  { name: "Ghana", iso: "GH", dial: "233" },
  { name: "Greece", iso: "GR", dial: "30" },
  { name: "Grenada", iso: "GD", dial: "1473" },
  { name: "Guatemala", iso: "GT", dial: "502" },
  { name: "Guinea", iso: "GN", dial: "224" },
  { name: "Guinea-Bissau", iso: "GW", dial: "245" },
  { name: "Guyana", iso: "GY", dial: "592" },
  { name: "Haiti", iso: "HT", dial: "509" },
  { name: "Honduras", iso: "HN", dial: "504" },
  { name: "Hungary", iso: "HU", dial: "36" },
  { name: "Iceland", iso: "IS", dial: "354" },
  { name: "India", iso: "IN", dial: "91" },
  { name: "Indonesia", iso: "ID", dial: "62" },
  { name: "Iran", iso: "IR", dial: "98" },
  { name: "Iraq", iso: "IQ", dial: "964" },
  { name: "Ireland", iso: "IE", dial: "353" },
  { name: "Israel", iso: "IL", dial: "972" },
  { name: "Italy", iso: "IT", dial: "39" },
  { name: "Jamaica", iso: "JM", dial: "1876" },
  { name: "Japan", iso: "JP", dial: "81" },
  { name: "Jordan", iso: "JO", dial: "962" },
  { name: "Kazakhstan", iso: "KZ", dial: "7" },
  { name: "Kenya", iso: "KE", dial: "254" },
  { name: "Kiribati", iso: "KI", dial: "686" },
  { name: "Kosovo", iso: "XK", dial: "383" },
  { name: "Kuwait", iso: "KW", dial: "965" },
  { name: "Kyrgyzstan", iso: "KG", dial: "996" },
  { name: "Laos", iso: "LA", dial: "856" },
  { name: "Latvia", iso: "LV", dial: "371" },
  { name: "Lebanon", iso: "LB", dial: "961" },
  { name: "Lesotho", iso: "LS", dial: "266" },
  { name: "Liberia", iso: "LR", dial: "231" },
  { name: "Libya", iso: "LY", dial: "218" },
  { name: "Liechtenstein", iso: "LI", dial: "423" },
  { name: "Lithuania", iso: "LT", dial: "370" },
  { name: "Luxembourg", iso: "LU", dial: "352" },
  { name: "Madagascar", iso: "MG", dial: "261" },
  { name: "Malawi", iso: "MW", dial: "265" },
  { name: "Malaysia", iso: "MY", dial: "60" },
  { name: "Maldives", iso: "MV", dial: "960" },
  { name: "Mali", iso: "ML", dial: "223" },
  { name: "Malta", iso: "MT", dial: "356" },
  { name: "Marshall Islands", iso: "MH", dial: "692" },
  { name: "Mauritania", iso: "MR", dial: "222" },
  { name: "Mauritius", iso: "MU", dial: "230" },
  { name: "Mexico", iso: "MX", dial: "52" },
  { name: "Micronesia", iso: "FM", dial: "691" },
  { name: "Moldova", iso: "MD", dial: "373" },
  { name: "Monaco", iso: "MC", dial: "377" },
  { name: "Mongolia", iso: "MN", dial: "976" },
  { name: "Montenegro", iso: "ME", dial: "382" },
  { name: "Morocco", iso: "MA", dial: "212" },
  { name: "Mozambique", iso: "MZ", dial: "258" },
  { name: "Myanmar", iso: "MM", dial: "95" },
  { name: "Namibia", iso: "NA", dial: "264" },
  { name: "Nauru", iso: "NR", dial: "674" },
  { name: "Nepal", iso: "NP", dial: "977" },
  { name: "Netherlands", iso: "NL", dial: "31" },
  { name: "New Zealand", iso: "NZ", dial: "64" },
  { name: "Nicaragua", iso: "NI", dial: "505" },
  { name: "Niger", iso: "NE", dial: "227" },
  { name: "Nigeria", iso: "NG", dial: "234" },
  { name: "North Korea", iso: "KP", dial: "850" },
  { name: "North Macedonia", iso: "MK", dial: "389" },
  { name: "Norway", iso: "NO", dial: "47" },
  { name: "Oman", iso: "OM", dial: "968" },
  { name: "Pakistan", iso: "PK", dial: "92" },
  { name: "Palau", iso: "PW", dial: "680" },
  { name: "Palestine", iso: "PS", dial: "970" },
  { name: "Panama", iso: "PA", dial: "507" },
  { name: "Papua New Guinea", iso: "PG", dial: "675" },
  { name: "Paraguay", iso: "PY", dial: "595" },
  { name: "Peru", iso: "PE", dial: "51" },
  { name: "Philippines", iso: "PH", dial: "63" },
  { name: "Poland", iso: "PL", dial: "48" },
  { name: "Portugal", iso: "PT", dial: "351" },
  { name: "Qatar", iso: "QA", dial: "974" },
  { name: "Romania", iso: "RO", dial: "40" },
  { name: "Russia", iso: "RU", dial: "7" },
  { name: "Rwanda", iso: "RW", dial: "250" },
  { name: "Saint Kitts and Nevis", iso: "KN", dial: "1869" },
  { name: "Saint Lucia", iso: "LC", dial: "1758" },
  { name: "Saint Vincent and the Grenadines", iso: "VC", dial: "1784" },
  { name: "Samoa", iso: "WS", dial: "685" },
  { name: "San Marino", iso: "SM", dial: "378" },
  { name: "São Tomé and Príncipe", iso: "ST", dial: "239" },
  { name: "Saudi Arabia", iso: "SA", dial: "966" },
  { name: "Senegal", iso: "SN", dial: "221" },
  { name: "Serbia", iso: "RS", dial: "381" },
  { name: "Seychelles", iso: "SC", dial: "248" },
  { name: "Sierra Leone", iso: "SL", dial: "232" },
  { name: "Singapore", iso: "SG", dial: "65" },
  { name: "Slovakia", iso: "SK", dial: "421" },
  { name: "Slovenia", iso: "SI", dial: "386" },
  { name: "Solomon Islands", iso: "SB", dial: "677" },
  { name: "Somalia", iso: "SO", dial: "252" },
  { name: "South Africa", iso: "ZA", dial: "27" },
  { name: "South Korea", iso: "KR", dial: "82" },
  { name: "South Sudan", iso: "SS", dial: "211" },
  { name: "Spain", iso: "ES", dial: "34" },
  { name: "Sri Lanka", iso: "LK", dial: "94" },
  { name: "Sudan", iso: "SD", dial: "249" },
  { name: "Suriname", iso: "SR", dial: "597" },
  { name: "Sweden", iso: "SE", dial: "46" },
  { name: "Switzerland", iso: "CH", dial: "41" },
  { name: "Syria", iso: "SY", dial: "963" },
  { name: "Taiwan", iso: "TW", dial: "886" },
  { name: "Tajikistan", iso: "TJ", dial: "992" },
  { name: "Tanzania", iso: "TZ", dial: "255" },
  { name: "Thailand", iso: "TH", dial: "66" },
  { name: "Timor-Leste", iso: "TL", dial: "670" },
  { name: "Togo", iso: "TG", dial: "228" },
  { name: "Tonga", iso: "TO", dial: "676" },
  { name: "Trinidad and Tobago", iso: "TT", dial: "1868" },
  { name: "Tunisia", iso: "TN", dial: "216" },
  { name: "Türkiye", iso: "TR", dial: "90" },
  { name: "Turkmenistan", iso: "TM", dial: "993" },
  { name: "Tuvalu", iso: "TV", dial: "688" },
  { name: "Uganda", iso: "UG", dial: "256" },
  { name: "Ukraine", iso: "UA", dial: "380" },
  { name: "United Arab Emirates", iso: "AE", dial: "971" },
  { name: "United Kingdom", iso: "GB", dial: "44" },
  { name: "Uruguay", iso: "UY", dial: "598" },
  { name: "Uzbekistan", iso: "UZ", dial: "998" },
  { name: "Vanuatu", iso: "VU", dial: "678" },
  { name: "Vatican City", iso: "VA", dial: "379" },
  { name: "Venezuela", iso: "VE", dial: "58" },
  { name: "Vietnam", iso: "VN", dial: "84" },
  { name: "Yemen", iso: "YE", dial: "967" },
  { name: "Zambia", iso: "ZM", dial: "260" },
  { name: "Zimbabwe", iso: "ZW", dial: "263" },
];

export const COUNTRY_INFO: CountryInfo[] = [
  { name: "United States", iso: "US", dial: "1" },
  { name: "Canada", iso: "CA", dial: "1" },
  ...REST_OF_WORLD,
];

/** Names alone, for the address Country select. */
export const COUNTRIES = COUNTRY_INFO.map((c) => c.name);

/* ─────────────── Phone dial codes ─────────────── */

/* The phone picker is keyed on the country NAME, because that is what Figma
 * 938:961 lists: the name reads as the option and the dial code sits right-
 * aligned beside it. The collapsed field shows the short "US ( +1 )" form
 * instead, since the control is only wide enough for that. */

export const DEFAULT_PHONE_COUNTRY = COUNTRY_INFO[0].name;

function infoFor(name: string): CountryInfo {
  return COUNTRY_INFO.find((c) => c.name === name) ?? COUNTRY_INFO[0];
}

/** The "+<code>" a country contributes to the stored phone number. */
export function dialCodeFor(name: string): string {
  return `+${infoFor(name).dial}`;
}

/** The collapsed field's label — "US ( +1 )". */
export function dialLabelFor(name: string): string {
  const c = infoFor(name);
  return `${c.iso} ( +${c.dial} )`;
}

/** Resolves a stored "+1 555-…" back to a country. Longest code wins, so
 *  "+1876 …" reads as Jamaica rather than the US; a plain "+1" can't say which
 *  +1 country it came from and settles on the first, the US. */
export function findPhoneCountry(phone: string): string | null {
  let bestName: string | null = null;
  let bestLen = 0;
  for (const c of COUNTRY_INFO) {
    if (phone.startsWith(`+${c.dial}`) && c.dial.length > bestLen) {
      bestName = c.name;
      bestLen = c.dial.length;
    }
  }
  return bestName;
}
