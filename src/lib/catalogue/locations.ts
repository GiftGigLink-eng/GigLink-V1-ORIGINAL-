import { StructuredLocation } from '../../types';

export interface CityOption {
  id: string;
  name: string;
}

export interface StateOption {
  id: string;
  name: string;
  cities: CityOption[];
}

export interface CountryOption {
  code: string;
  name: string;
  states: StateOption[];
}

export const APPROVED_LOCATIONS_CATALOGUE: CountryOption[] = [
  {
    code: 'NG',
    name: 'Nigeria',
    states: [
      {
        id: 'ng-lagos',
        name: 'Lagos State',
        cities: [
          { id: 'ng-lagos-ikeja', name: 'Ikeja' },
          { id: 'ng-lagos-yaba', name: 'Yaba' },
          { id: 'ng-lagos-vi', name: 'Victoria Island' },
          { id: 'ng-lagos-lekki', name: 'Lekki' },
          { id: 'ng-lagos-ikoyi', name: 'Ikoyi' },
          { id: 'ng-lagos-surulere', name: 'Surulere' },
          { id: 'ng-lagos-festac', name: 'Festac Town' },
          { id: 'ng-lagos-gbagada', name: 'Gbagada' },
          { id: 'ng-lagos-ogba', name: 'Ogba' },
          { id: 'ng-lagos-ajah', name: 'Ajah' },
          { id: 'ng-lagos-maryland', name: 'Maryland' },
          { id: 'ng-lagos-alimosho', name: 'Alimosho' },
        ],
      },
      {
        id: 'ng-fct',
        name: 'Federal Capital Territory (Abuja)',
        cities: [
          { id: 'ng-fct-abuja-central', name: 'Abuja Municipal' },
          { id: 'ng-fct-maitama', name: 'Maitama' },
          { id: 'ng-fct-asokoro', name: 'Asokoro' },
          { id: 'ng-fct-wuse', name: 'Wuse' },
          { id: 'ng-fct-garki', name: 'Garki' },
          { id: 'ng-fct-gwarinpa', name: 'Gwarinpa' },
          { id: 'ng-fct-jabi', name: 'Jabi' },
          { id: 'ng-fct-utako', name: 'Utako' },
          { id: 'ng-fct-kubwa', name: 'Kubwa' },
        ],
      },
      {
        id: 'ng-rivers',
        name: 'Rivers State',
        cities: [
          { id: 'ng-rivers-ph', name: 'Port Harcourt' },
          { id: 'ng-rivers-obio-akpor', name: 'Obio-Akpor' },
          { id: 'ng-rivers-bonny', name: 'Bonny' },
          { id: 'ng-rivers-eleme', name: 'Eleme' },
        ],
      },
      {
        id: 'ng-oyo',
        name: 'Oyo State',
        cities: [
          { id: 'ng-oyo-ibadan', name: 'Ibadan' },
          { id: 'ng-oyo-ogbomosho', name: 'Ogbomosho' },
          { id: 'ng-oyo-oyo', name: 'Oyo' },
        ],
      },
      {
        id: 'ng-kano',
        name: 'Kano State',
        cities: [
          { id: 'ng-kano-city', name: 'Kano Municipal' },
          { id: 'ng-kano-nassarawa', name: 'Nassarawa' },
          { id: 'ng-kano-fagge', name: 'Fagge' },
        ],
      },
      {
        id: 'ng-kaduna',
        name: 'Kaduna State',
        cities: [
          { id: 'ng-kaduna-city', name: 'Kaduna' },
          { id: 'ng-kaduna-zaria', name: 'Zaria' },
          { id: 'ng-kaduna-kafachan', name: 'Kafanchan' },
        ],
      },
      {
        id: 'ng-enugu',
        name: 'Enugu State',
        cities: [
          { id: 'ng-enugu-city', name: 'Enugu' },
          { id: 'ng-enugu-nsukka', name: 'Nsukka' },
        ],
      },
      {
        id: 'ng-edo',
        name: 'Edo State',
        cities: [
          { id: 'ng-edo-benin', name: 'Benin City' },
          { id: 'ng-edo-auchi', name: 'Auchi' },
          { id: 'ng-edo-ekpoma', name: 'Ekpoma' },
        ],
      },
      {
        id: 'ng-ogun',
        name: 'Ogun State',
        cities: [
          { id: 'ng-ogun-abeokuta', name: 'Abeokuta' },
          { id: 'ng-ogun-ota', name: 'Ota' },
          { id: 'ng-ogun-sagamu', name: 'Sagamu' },
          { id: 'ng-ogun-ijebu-ode', name: 'Ijebu Ode' },
        ],
      },
      {
        id: 'ng-anambra',
        name: 'Anambra State',
        cities: [
          { id: 'ng-anambra-awka', name: 'Awka' },
          { id: 'ng-anambra-onitsha', name: 'Onitsha' },
          { id: 'ng-anambra-nnewi', name: 'Nnewi' },
        ],
      },
      {
        id: 'ng-delta',
        name: 'Delta State',
        cities: [
          { id: 'ng-delta-asaba', name: 'Asaba' },
          { id: 'ng-delta-warri', name: 'Warri' },
          { id: 'ng-delta-ughelli', name: 'Ughelli' },
        ],
      },
      {
        id: 'ng-kwara',
        name: 'Kwara State',
        cities: [
          { id: 'ng-kwara-ilorin', name: 'Ilorin' },
          { id: 'ng-kwara-offa', name: 'Offa' },
        ],
      },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    states: [
      {
        id: 'us-ca',
        name: 'California',
        cities: [
          { id: 'us-ca-sf', name: 'San Francisco' },
          { id: 'us-ca-sv', name: 'San Jose' },
          { id: 'us-ca-oakland', name: 'Oakland' },
          { id: 'us-ca-la', name: 'Los Angeles' },
          { id: 'us-ca-sd', name: 'San Diego' },
          { id: 'us-ca-sacramento', name: 'Sacramento' },
          { id: 'us-ca-palo-alto', name: 'Palo Alto' },
          { id: 'us-ca-sunnyvale', name: 'Sunnyvale' },
        ],
      },
      {
        id: 'us-ny',
        name: 'New York',
        cities: [
          { id: 'us-ny-nyc', name: 'New York City' },
          { id: 'us-ny-brooklyn', name: 'Brooklyn' },
          { id: 'us-ny-manhattan', name: 'Manhattan' },
          { id: 'us-ny-queens', name: 'Queens' },
          { id: 'us-ny-buffalo', name: 'Buffalo' },
          { id: 'us-ny-albany', name: 'Albany' },
        ],
      },
      {
        id: 'us-tx',
        name: 'Texas',
        cities: [
          { id: 'us-tx-austin', name: 'Austin' },
          { id: 'us-tx-dallas', name: 'Dallas' },
          { id: 'us-tx-houston', name: 'Houston' },
          { id: 'us-tx-san-antonio', name: 'San Antonio' },
          { id: 'us-tx-fort-worth', name: 'Fort Worth' },
          { id: 'us-tx-plano', name: 'Plano' },
        ],
      },
      {
        id: 'us-wa',
        name: 'Washington',
        cities: [
          { id: 'us-wa-seattle', name: 'Seattle' },
          { id: 'us-wa-bellevue', name: 'Bellevue' },
          { id: 'us-wa-redmond', name: 'Redmond' },
          { id: 'us-wa-tacoma', name: 'Tacoma' },
        ],
      },
      {
        id: 'us-ma',
        name: 'Massachusetts',
        cities: [
          { id: 'us-ma-boston', name: 'Boston' },
          { id: 'us-ma-cambridge', name: 'Cambridge' },
          { id: 'us-ma-worcester', name: 'Worcester' },
        ],
      },
      {
        id: 'us-il',
        name: 'Illinois',
        cities: [
          { id: 'us-il-chicago', name: 'Chicago' },
          { id: 'us-il-naperville', name: 'Naperville' },
          { id: 'us-il-evanston', name: 'Evanston' },
        ],
      },
      {
        id: 'us-ga',
        name: 'Georgia',
        cities: [
          { id: 'us-ga-atlanta', name: 'Atlanta' },
          { id: 'us-ga-alpharetta', name: 'Alpharetta' },
          { id: 'us-ga-savannah', name: 'Savannah' },
        ],
      },
      {
        id: 'us-co',
        name: 'Colorado',
        cities: [
          { id: 'us-co-denver', name: 'Denver' },
          { id: 'us-co-boulder', name: 'Boulder' },
          { id: 'us-co-colorado-springs', name: 'Colorado Springs' },
        ],
      },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      {
        id: 'gb-england',
        name: 'England',
        cities: [
          { id: 'gb-england-london', name: 'London' },
          { id: 'gb-england-manchester', name: 'Manchester' },
          { id: 'gb-england-birmingham', name: 'Birmingham' },
          { id: 'gb-england-cambridge', name: 'Cambridge' },
          { id: 'gb-england-oxford', name: 'Oxford' },
          { id: 'gb-england-bristol', name: 'Bristol' },
          { id: 'gb-england-leeds', name: 'Leeds' },
          { id: 'gb-england-liverpool', name: 'Liverpool' },
          { id: 'gb-england-sheffield', name: 'Sheffield' },
        ],
      },
      {
        id: 'gb-scotland',
        name: 'Scotland',
        cities: [
          { id: 'gb-scotland-edinburgh', name: 'Edinburgh' },
          { id: 'gb-scotland-glasgow', name: 'Glasgow' },
          { id: 'gb-scotland-aberdeen', name: 'Aberdeen' },
        ],
      },
      {
        id: 'gb-wales',
        name: 'Wales',
        cities: [
          { id: 'gb-wales-cardiff', name: 'Cardiff' },
          { id: 'gb-wales-swansea', name: 'Swansea' },
        ],
      },
      {
        id: 'gb-northern-ireland',
        name: 'Northern Ireland',
        cities: [
          { id: 'gb-ni-belfast', name: 'Belfast' },
          { id: 'gb-ni-derry', name: 'Derry' },
        ],
      },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    states: [
      {
        id: 'ca-on',
        name: 'Ontario',
        cities: [
          { id: 'ca-on-toronto', name: 'Toronto' },
          { id: 'ca-on-ottawa', name: 'Ottawa' },
          { id: 'ca-on-waterloo', name: 'Waterloo' },
          { id: 'ca-on-mississauga', name: 'Mississauga' },
        ],
      },
      {
        id: 'ca-bc',
        name: 'British Columbia',
        cities: [
          { id: 'ca-bc-vancouver', name: 'Vancouver' },
          { id: 'ca-bc-victoria', name: 'Victoria' },
          { id: 'ca-bc-burnaby', name: 'Burnaby' },
        ],
      },
      {
        id: 'ca-qc',
        name: 'Quebec',
        cities: [
          { id: 'ca-qc-montreal', name: 'Montreal' },
          { id: 'ca-qc-quebec-city', name: 'Quebec City' },
          { id: 'ca-qc-laval', name: 'Laval' },
        ],
      },
    ],
  },
  {
    code: 'KE',
    name: 'Kenya',
    states: [
      {
        id: 'ke-nairobi',
        name: 'Nairobi County',
        cities: [
          { id: 'ke-nairobi-city', name: 'Nairobi' },
          { id: 'ke-nairobi-westlands', name: 'Westlands' },
          { id: 'ke-nairobi-kilimani', name: 'Kilimani' },
          { id: 'ke-nairobi-upperhill', name: 'Upper Hill' },
        ],
      },
      {
        id: 'ke-mombasa',
        name: 'Mombasa County',
        cities: [
          { id: 'ke-mombasa-city', name: 'Mombasa' },
          { id: 'ke-mombasa-nyali', name: 'Nyali' },
        ],
      },
      {
        id: 'ke-kisumu',
        name: 'Kisumu County',
        cities: [
          { id: 'ke-kisumu-city', name: 'Kisumu' },
        ],
      },
    ],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    states: [
      {
        id: 'za-gauteng',
        name: 'Gauteng',
        cities: [
          { id: 'za-jhb', name: 'Johannesburg' },
          { id: 'za-pta', name: 'Pretoria' },
          { id: 'za-sandton', name: 'Sandton' },
          { id: 'za-midrand', name: 'Midrand' },
        ],
      },
      {
        id: 'za-wc',
        name: 'Western Cape',
        cities: [
          { id: 'za-cpt', name: 'Cape Town' },
          { id: 'za-stellenbosch', name: 'Stellenbosch' },
        ],
      },
      {
        id: 'za-kzn',
        name: 'KwaZulu-Natal',
        cities: [
          { id: 'za-dbn', name: 'Durban' },
          { id: 'za-umhlanga', name: 'Umhlanga' },
        ],
      },
    ],
  },
  {
    code: 'GH',
    name: 'Ghana',
    states: [
      {
        id: 'gh-accra',
        name: 'Greater Accra',
        cities: [
          { id: 'gh-accra-city', name: 'Accra' },
          { id: 'gh-accra-tema', name: 'Tema' },
        ],
      },
      {
        id: 'gh-ashanti',
        name: 'Ashanti Region',
        cities: [
          { id: 'gh-kumasi', name: 'Kumasi' },
        ],
      },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    states: [
      {
        id: 'de-berlin',
        name: 'Berlin',
        cities: [
          { id: 'de-berlin-city', name: 'Berlin' },
        ],
      },
      {
        id: 'de-bavaria',
        name: 'Bavaria',
        cities: [
          { id: 'de-munich', name: 'Munich' },
          { id: 'de-nuremberg', name: 'Nuremberg' },
        ],
      },
      {
        id: 'de-hesse',
        name: 'Hesse',
        cities: [
          { id: 'de-frankfurt', name: 'Frankfurt am Main' },
        ],
      },
      {
        id: 'de-nrw',
        name: 'North Rhine-Westphalia',
        cities: [
          { id: 'de-cologne', name: 'Cologne' },
          { id: 'de-dusseldorf', name: 'Düsseldorf' },
        ],
      },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    states: [
      {
        id: 'in-karnataka',
        name: 'Karnataka',
        cities: [
          { id: 'in-bangalore', name: 'Bengaluru (Bangalore)' },
          { id: 'in-mysore', name: 'Mysuru' },
        ],
      },
      {
        id: 'in-maharashtra',
        name: 'Maharashtra',
        cities: [
          { id: 'in-mumbai', name: 'Mumbai' },
          { id: 'in-pune', name: 'Pune' },
          { id: 'in-navi-mumbai', name: 'Navi Mumbai' },
        ],
      },
      {
        id: 'in-telangana',
        name: 'Telangana',
        cities: [
          { id: 'in-hyderabad', name: 'Hyderabad' },
        ],
      },
      {
        id: 'in-delhi-ncr',
        name: 'Delhi NCR',
        cities: [
          { id: 'in-delhi', name: 'New Delhi' },
          { id: 'in-gurugram', name: 'Gurugram (Gurgaon)' },
          { id: 'in-noida', name: 'Noida' },
        ],
      },
      {
        id: 'in-tamilnadu',
        name: 'Tamil Nadu',
        cities: [
          { id: 'in-chennai', name: 'Chennai' },
          { id: 'in-coimbatore', name: 'Coimbatore' },
        ],
      },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    states: [
      {
        id: 'ae-dubai',
        name: 'Dubai',
        cities: [
          { id: 'ae-dubai-city', name: 'Dubai' },
        ],
      },
      {
        id: 'ae-abu-dhabi',
        name: 'Abu Dhabi',
        cities: [
          { id: 'ae-abu-dhabi-city', name: 'Abu Dhabi' },
        ],
      },
      {
        id: 'ae-sharjah',
        name: 'Sharjah',
        cities: [
          { id: 'ae-sharjah-city', name: 'Sharjah' },
        ],
      },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    states: [
      {
        id: 'sg-central',
        name: 'Central Region',
        cities: [
          { id: 'sg-singapore-city', name: 'Singapore' },
        ],
      },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    states: [
      {
        id: 'au-nsw',
        name: 'New South Wales',
        cities: [
          { id: 'au-sydney', name: 'Sydney' },
          { id: 'au-newcastle', name: 'Newcastle' },
        ],
      },
      {
        id: 'au-vic',
        name: 'Victoria',
        cities: [
          { id: 'au-melbourne', name: 'Melbourne' },
          { id: 'au-geelong', name: 'Geelong' },
        ],
      },
      {
        id: 'au-qld',
        name: 'Queensland',
        cities: [
          { id: 'au-brisbane', name: 'Brisbane' },
          { id: 'au-gold-coast', name: 'Gold Coast' },
        ],
      },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    states: [
      {
        id: 'fr-idf',
        name: 'Île-de-France',
        cities: [
          { id: 'fr-paris', name: 'Paris' },
        ],
      },
      {
        id: 'fr-aura',
        name: 'Auvergne-Rhône-Alpes',
        cities: [
          { id: 'fr-lyon', name: 'Lyon' },
          { id: 'fr-grenoble', name: 'Grenoble' },
        ],
      },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    states: [
      {
        id: 'nl-nh',
        name: 'North Holland',
        cities: [
          { id: 'nl-amsterdam', name: 'Amsterdam' },
          { id: 'nl-haarlem', name: 'Haarlem' },
        ],
      },
      {
        id: 'nl-zh',
        name: 'South Holland',
        cities: [
          { id: 'nl-rotterdam', name: 'Rotterdam' },
          { id: 'nl-the-hague', name: 'The Hague' },
        ],
      },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    states: [
      {
        id: 'ie-leinster',
        name: 'Leinster',
        cities: [
          { id: 'ie-dublin', name: 'Dublin' },
        ],
      },
      {
        id: 'ie-munster',
        name: 'Munster',
        cities: [
          { id: 'ie-cork', name: 'Cork' },
          { id: 'ie-limerick', name: 'Limerick' },
        ],
      },
    ],
  },
  {
    code: 'RW',
    name: 'Rwanda',
    states: [
      {
        id: 'rw-kigali',
        name: 'Kigali City',
        cities: [
          { id: 'rw-kigali-city', name: 'Kigali' },
        ],
      },
    ],
  },
  {
    code: 'EG',
    name: 'Egypt',
    states: [
      {
        id: 'eg-cairo',
        name: 'Cairo Governorate',
        cities: [
          { id: 'eg-cairo-city', name: 'Cairo' },
          { id: 'eg-giza', name: 'Giza' },
          { id: 'eg-alexandria', name: 'Alexandria' },
        ],
      },
    ],
  },
  {
    code: 'BR',
    name: 'Brazil',
    states: [
      {
        id: 'br-sp',
        name: 'São Paulo',
        cities: [
          { id: 'br-sp-city', name: 'São Paulo' },
          { id: 'br-campinas', name: 'Campinas' },
        ],
      },
      {
        id: 'br-rj',
        name: 'Rio de Janeiro',
        cities: [
          { id: 'br-rj-city', name: 'Rio de Janeiro' },
        ],
      },
    ],
  },
];

/**
 * Helper: Find country by name or code
 */
export function findCountry(query: string): CountryOption | undefined {
  const q = query.trim().toLowerCase();
  return APPROVED_LOCATIONS_CATALOGUE.find(
    (c) => c.name.toLowerCase() === q || c.code.toLowerCase() === q
  );
}

/**
 * Helper: Format a structured location into canonical display address
 * Country only: "Nigeria"
 * Country + State: "Lagos State, Nigeria"
 * Country + State + City: "Ikeja, Lagos State, Nigeria"
 */
export function formatStructuredLocation(loc: {
  country?: string;
  state?: string;
  city?: string;
}): string {
  const parts: string[] = [];
  if (loc.city && loc.city.trim()) {
    parts.push(loc.city.trim());
  }
  if (loc.state && loc.state.trim()) {
    parts.push(loc.state.trim());
  }
  if (loc.country && loc.country.trim()) {
    parts.push(loc.country.trim());
  }
  return parts.join(', ');
}

/**
 * Helper: Validates if a structured location object complies with approved catalogue
 */
export function validateStructuredLocation(loc: Partial<StructuredLocation> | null): boolean {
  if (!loc) return false;
  if (!loc.country || !loc.state) return false;

  const country = findCountry(loc.country);
  if (!country) return false;

  const state = country.states.find(
    (s) => s.name.toLowerCase() === loc.state?.trim().toLowerCase()
  );
  if (!state) return false;

  if (loc.city && loc.city.trim()) {
    const city = state.cities.find(
      (c) => c.name.toLowerCase() === loc.city?.trim().toLowerCase()
    );
    if (!city) return false;
  }

  return true;
}

/**
 * Helper: Sanitizes a structured location object for safe Firestore storage.
 * Strips undefined properties and returns a clean object or null.
 */
export function sanitizeStructuredLocation(loc?: Partial<StructuredLocation> | null): StructuredLocation | null {
  if (!loc || !loc.country || !loc.state) return null;
  const sanitized: StructuredLocation = {
    country: loc.country.trim(),
    state: loc.state.trim(),
    formattedAddress: loc.formattedAddress || formatStructuredLocation(loc),
  };
  if (loc.city && loc.city.trim()) {
    sanitized.city = loc.city.trim();
  }
  return sanitized;
}

