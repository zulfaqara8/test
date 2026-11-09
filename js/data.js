// Sample data for the prototype (clearly labelled as sample in the UI).

export const HOSPITALS = [
  { id: 'cgh', name: 'City General Hospital', area: 'Civil Lines', tags: ['Cardiac', 'Trauma'], km: 2.1, beds: 14, icu: 3, vent: 2, echs: true, cashless: true },
  { id: 'lhi', name: 'Lifeline Heart Institute', area: 'Sector 12', tags: ['Cardiac'], km: 3.4, beds: 6, icu: 5, vent: 4, echs: false, cashless: true },
  { id: 'stc', name: 'Sanjeevani Trauma Centre', area: 'Ring Road', tags: ['Trauma'], km: 4.0, beds: 9, icu: 2, vent: 1, echs: true, cashless: false },
  { id: 'gdh', name: 'Govt. District Hospital', area: 'Old Town', tags: ['Trauma'], km: 5.2, beds: 22, icu: 0, vent: 0, echs: true, cashless: true },
  { id: 'amh', name: 'Aarogya Multispeciality', area: 'Tech Park', tags: ['Cardiac', 'Trauma'], km: 6.7, beds: 11, icu: 4, vent: 3, echs: false, cashless: true },
];

export const HELPLINES = [
  { num: '108', label: 'Ambulance' },
  { num: '112', label: 'Emergency' },
  { num: '100', label: 'Police' },
  { num: '101', label: 'Fire' },
  { num: '1091', label: 'Women helpline' },
];

export const SYMPTOM_CHIPS = [
  'Chest pain and sweating',
  'Road accident, head injury',
  'Grandma fainted, not waking',
  'Child has high fever and vomiting',
];

export const SOS_REASONS = [
  { id: 'heart', label: 'Heart / chest pain', icon: 'heart' },
  { id: 'accident', label: 'Accident / injury', icon: 'ambulance' },
  { id: 'breathing', label: 'Breathing trouble', icon: 'activity' },
  { id: 'other', label: 'Other emergency', icon: 'alert' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const FIRST_AID = {
  'Heart attack': [
    'Call 108 or 112 now.',
    'Sit the person down and keep them calm.',
    'If not allergic and no doctor has forbidden it, give one regular aspirin to chew.',
    'If they stop breathing, start CPR: push hard and fast in the centre of the chest.',
  ],
  Bleeding: [
    'Call 108 if the bleeding is heavy or does not slow down.',
    'Press firmly on the wound with a clean cloth. Do not lift it to check.',
    'If blood soaks through, add more cloth on top and keep pressing.',
    'Keep the person lying down. Raise the injured arm or leg if you can.',
  ],
  Choking: [
    'Ask “Are you choking?” If they cannot speak, cough or breathe, act fast.',
    'Give up to 5 firm back blows between the shoulder blades.',
    'Then give up to 5 abdominal thrusts (stand behind them, fist above the belly button, pull in and up).',
    'Alternate back blows and thrusts. Call 108. If they become unconscious, start CPR.',
  ],
  Unconscious: [
    'Shout and tap their shoulders. Check if they are breathing.',
    'Call 108 or 112 now.',
    'If breathing, roll them onto their side (recovery position). Give nothing to eat or drink.',
    'If not breathing, start CPR: 30 hard, fast chest pushes in the centre of the chest.',
  ],
  Burn: [
    'Cool the burn under cool running water for 20 minutes.',
    'Take off rings or loose clothing near the burn, unless stuck to the skin.',
    'Cover loosely with a clean non-fluffy cloth or cling film. No ice, butter or toothpaste.',
    'Call 108 for burns that are large, on the face, hands or genitals, or caused by chemicals or electricity.',
  ],
  Stroke: [
    'Think FAST: Face drooping, Arm weakness, Speech slurred, Time to call 108.',
    'Note the time the symptoms started and tell the doctors.',
    'Keep them sitting or lying comfortably. Give no food, drink or medicine.',
    'Stay with them until help arrives.',
  ],
};

// ---- Care at home --------------------------------------------------------
export const PROVIDERS = {
  Doctors: [
    { id: 'd1', name: 'Dr. A. Verma', role: 'General physician · home visits', km: 1.2, langs: 'Hindi, English', price: 500, unit: 'visit', rating: 4.8, initial: 'A' },
    { id: 'd2', name: 'Dr. S. Khan', role: 'Cardiologist', km: 2.8, langs: 'Hindi, Urdu, English', price: 900, unit: 'visit', rating: 4.9, initial: 'S' },
    { id: 'd3', name: 'Dr. P. Singh', role: 'Geriatric (elderly) care', km: 3.5, langs: 'Hindi, Punjabi', price: 700, unit: 'visit', rating: 4.7, initial: 'P' },
  ],
  Nurses: [
    { id: 'n1', name: 'Nurse R. Devi', role: 'Elder care · 8 yrs exp.', km: 1.9, langs: 'Hindi, Bhojpuri', price: 800, unit: 'day shift', rating: 4.8, initial: 'R' },
    { id: 'n2', name: 'Nurse M. Joseph', role: 'Post-surgery recovery', km: 2.4, langs: 'English, Malayalam', price: 1000, unit: 'day shift', rating: 4.9, initial: 'M' },
    { id: 'n3', name: 'Nurse A. Fatima', role: 'Night care · ICU trained', km: 4.1, langs: 'Hindi, English', price: 1100, unit: 'night', rating: 4.8, initial: 'A' },
  ],
  Paramedics: [
    { id: 'p1', name: 'R. Yadav', role: 'Patient transport · ALS', km: 2.0, langs: 'Hindi', price: 1500, unit: 'trip', rating: 4.7, initial: 'R' },
    { id: 'p2', name: 'K. Nair', role: 'Home oxygen & IV setup', km: 3.1, langs: 'English, Tamil', price: 600, unit: 'visit', rating: 4.8, initial: 'K' },
  ],
};

// ---- Community -----------------------------------------------------------
export const BLOOD_REQUESTS = [
  { id: 'b1', hospital: 'City General Hospital', group: 'O-', units: 2, ago: '12 min ago' },
  { id: 'b2', hospital: 'Sanjeevani Trauma Centre', group: 'B+', units: 1, ago: '34 min ago' },
  { id: 'b3', hospital: 'Aarogya Multispeciality', group: 'AB+', units: 3, ago: '58 min ago' },
];

export const FUNDRAISERS = [
  { id: 'f1', sample: true, title: 'Heart surgery for 6-year-old Aarav', story: 'A family needs help paying for an urgent operation at Lifeline Heart Institute.', raised: 62000, goal: 150000 },
  { id: 'f2', sample: true, title: 'Dialysis support for Ramesh ji', story: 'Twice-weekly dialysis costs are too high for a daily-wage family.', raised: 21000, goal: 80000 },
];

export const FEEDBACK_FEATURES = [
  'SOS & AI triage', 'Live dispatch map', 'Medical card', 'Medicine alarms', 'Family check-in', 'Care at home', 'Community fundraising', 'AI assistant',
];
