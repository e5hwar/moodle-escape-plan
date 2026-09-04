/**
 * Zipcode → address lookup for the company address block.
 *
 * A real deployment would hit a postal-lookup service; this stands in for one
 * so the form behaves the same way. Every US ZIP resolves to a state from its
 * 3-digit prefix (the ranges the USPS assigns by state), and the prefixes that
 * cover the major metros also resolve to that sectional centre's city. A ZIP we
 * cannot place leaves the fields alone rather than guessing at them.
 */

type Range = [start: number, end: number, state: string];

// USPS 3-digit prefix ranges, by state. Territories (PR, VI, GU, …) are left
// out — the State select is a list of the fifty states.
const STATE_RANGES: Range[] = [
  [5, 5, "New York"],
  [10, 27, "Massachusetts"],
  [28, 29, "Rhode Island"],
  [30, 38, "New Hampshire"],
  [39, 49, "Maine"],
  [50, 59, "Vermont"],
  [60, 69, "Connecticut"],
  [70, 89, "New Jersey"],
  [100, 149, "New York"],
  [150, 196, "Pennsylvania"],
  [197, 199, "Delaware"],
  [206, 219, "Maryland"],
  [220, 246, "Virginia"],
  [247, 268, "West Virginia"],
  [270, 289, "North Carolina"],
  [290, 299, "South Carolina"],
  [300, 319, "Georgia"],
  [320, 349, "Florida"],
  [350, 369, "Alabama"],
  [370, 385, "Tennessee"],
  [386, 397, "Mississippi"],
  [398, 399, "Georgia"],
  [400, 427, "Kentucky"],
  [430, 459, "Ohio"],
  [460, 479, "Indiana"],
  [480, 499, "Michigan"],
  [500, 528, "Iowa"],
  [530, 549, "Wisconsin"],
  [550, 567, "Minnesota"],
  [570, 577, "South Dakota"],
  [580, 588, "North Dakota"],
  [590, 599, "Montana"],
  [600, 629, "Illinois"],
  [630, 658, "Missouri"],
  [660, 679, "Kansas"],
  [680, 693, "Nebraska"],
  [700, 714, "Louisiana"],
  [716, 729, "Arkansas"],
  [730, 749, "Oklahoma"],
  [750, 799, "Texas"],
  [800, 816, "Colorado"],
  [820, 831, "Wyoming"],
  [832, 838, "Idaho"],
  [840, 847, "Utah"],
  [850, 865, "Arizona"],
  [870, 884, "New Mexico"],
  [889, 898, "Nevada"],
  [900, 961, "California"],
  [967, 968, "Hawaii"],
  [970, 979, "Oregon"],
  [980, 994, "Washington"],
  [995, 999, "Alaska"],
];

// Sectional-centre city per 3-digit prefix, for the prefixes that carry the
// metros most accounts sit in.
const PREFIX_CITY: Record<string, string> = {
  "021": "Boston", "022": "Boston", "024": "Waltham", "027": "Providence",
  "060": "Hartford", "068": "Stamford", "070": "Newark", "071": "Newark",
  "073": "Jersey City", "079": "Paterson", "085": "Trenton", "088": "Princeton",
  "100": "New York", "101": "New York", "102": "New York", "103": "Staten Island",
  "104": "Bronx", "110": "Queens", "112": "Brooklyn", "113": "Queens",
  "117": "Hicksville", "120": "Albany", "142": "Buffalo", "146": "Rochester",
  "132": "Syracuse", "150": "Pittsburgh", "152": "Pittsburgh", "168": "Altoona",
  "171": "Harrisburg", "180": "Allentown", "190": "Philadelphia", "191": "Philadelphia",
  "197": "Wilmington", "200": "Washington", "202": "Washington", "203": "Washington",
  "212": "Baltimore", "218": "Salisbury", "220": "Alexandria", "222": "Arlington",
  "232": "Richmond", "235": "Norfolk", "245": "Roanoke", "252": "Charleston",
  "272": "Durham", "276": "Raleigh", "282": "Charlotte", "294": "Columbia",
  "299": "Savannah",
  "303": "Atlanta", "308": "Atlanta", "310": "Macon", "322": "Jacksonville",
  "327": "Orlando", "328": "Orlando", "331": "Miami", "334": "Fort Lauderdale",
  "336": "Tampa", "352": "Birmingham", "358": "Huntsville", "362": "Montgomery",
  "370": "Nashville", "372": "Nashville", "379": "Knoxville", "381": "Memphis",
  "392": "Jackson", "402": "Louisville", "405": "Lexington", "432": "Columbus",
  "441": "Cleveland", "452": "Cincinnati", "454": "Cincinnati", "453": "Dayton",
  "436": "Toledo", "462": "Indianapolis", "465": "Fort Wayne", "482": "Detroit",
  "483": "Detroit", "495": "Grand Rapids", "502": "Des Moines", "532": "Milwaukee",
  "537": "Madison", "554": "Minneapolis", "551": "Saint Paul", "571": "Sioux Falls",
  "581": "Fargo", "591": "Billings", "606": "Chicago", "607": "Chicago",
  "600": "Arlington Heights", "617": "Springfield", "631": "Saint Louis",
  "641": "Kansas City", "652": "Columbia", "660": "Kansas City", "672": "Wichita",
  "681": "Lincoln", "701": "New Orleans",
  "708": "Baton Rouge", "722": "Little Rock", "731": "Oklahoma City",
  "741": "Tulsa", "750": "Dallas", "752": "Dallas", "760": "Fort Worth",
  "770": "Houston", "772": "Houston", "782": "San Antonio", "787": "Austin",
  "798": "El Paso", "799": "El Paso", "802": "Denver", "803": "Boulder",
  "809": "Colorado Springs", "820": "Cheyenne", "837": "Boise",
  "841": "Salt Lake City", "850": "Phoenix", "852": "Phoenix", "857": "Tucson",
  "871": "Albuquerque", "891": "Las Vegas", "895": "Reno", "900": "Los Angeles",
  "902": "Beverly Hills", "906": "Long Beach", "910": "Pasadena",
  "913": "Van Nuys", "917": "Ontario", "920": "San Diego", "921": "San Diego",
  "926": "Irvine", "928": "Anaheim", "931": "Santa Barbara", "935": "Bakersfield",
  "937": "Fresno", "941": "San Francisco", "945": "Oakland", "946": "Oakland",
  "950": "San Jose", "951": "San Jose", "958": "Sacramento", "968": "Honolulu",
  "972": "Portland", "973": "Salem", "980": "Seattle", "981": "Seattle",
  "982": "Everett", "984": "Tacoma", "992": "Spokane", "995": "Anchorage",
};

export type ZipMatch = { country: string; state: string; city?: string };

/** Resolves a 5-digit US zipcode to its country, state and (where known) city. */
export function lookupZip(zip: string): ZipMatch | null {
  const digits = zip.replace(/\D/g, "");
  if (digits.length !== 5) return null;
  const prefix = digits.slice(0, 3);
  const n = Number(prefix);
  const range = STATE_RANGES.find(([start, end]) => n >= start && n <= end);
  if (!range) return null;
  return { country: "United States", state: range[2], city: PREFIX_CITY[prefix] };
}
