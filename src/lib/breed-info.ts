// Breed information from Dog API (free, no key)
// https://dogapi.dog — 340+ dog breeds with health, temperament, lifespan data
// Also includes cat/rabbit/bird knowledge base for non-dog species

interface BreedCache {
  data: DogBreed[];
  fetchedAt: number;
}

interface DogBreed {
  id: number;
  name: string;
  temperament: string;
  life_span: string;
  bred_for: string;
  breed_group: string;
  height: { imperial: string; metric: string };
  weight: { imperial: string; metric: string };
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let breedCache: BreedCache | null = null;

// Common breed health predispositions (veterinary knowledge base)
const BREED_HEALTH: Record<string, { issues: string[]; advice: string }> = {
  'golden retriever': {
    issues: ['Hip dysplasia', 'Elbow dysplasia', 'Cancer (hemangiosarcoma, lymphoma)', 'Heart disease', 'Eye conditions (cataracts, PRA)', 'Skin allergies'],
    advice: 'Regular hip/elbow screenings from 12 months. Annual cancer screening. Maintain healthy weight to reduce joint stress. Watch for lumps/bumps.',
  },
  'labrador retriever': {
    issues: ['Hip dysplasia', 'Elbow dysplasia', 'Obesity', 'Exercise-induced collapse (EIC)', 'Eye conditions', 'Ear infections'],
    advice: 'Control portion sizes — Labs are prone to obesity. Regular ear cleaning. Exercise monitoring in hot weather.',
  },
  'german shepherd': {
    issues: ['Hip dysplasia', 'Elbow dysplasia', 'Degenerative myelopathy', 'Bloat (GDV)', 'Exocrine pancreatic insufficiency', 'Skin allergies'],
    advice: 'Feed smaller, frequent meals to reduce bloat risk. Avoid vigorous exercise 1 hour before/after meals. Annual spine evaluations.',
  },
  'french bulldog': {
    issues: ['Brachycephalic syndrome', 'Hip dysplasia', 'Cherry eye', 'Allergies', 'Heat intolerance', 'Spinal issues'],
    advice: 'Avoid exercise in heat. Use a harness (not collar) for walks. Watch for breathing difficulties. Keep cool in summer.',
  },
  'cavalier king charles spaniel': {
    issues: ['Mitral valve disease (MVD)', 'Syringomyelia', 'Hip dysplasia', 'Eye conditions', 'Ear infections'],
    advice: 'Annual cardiac screening essential — MVD affects >50% by age 10. MRI screening for syringomyelia. Regular ear cleaning.',
  },
  'cocker spaniel': {
    issues: ['Ear infections', 'Hip dysplasia', 'Eye conditions (PRA, cataracts)', 'Autoimmune hemolytic anemia', 'Hypothyroidism'],
    advice: 'Weekly ear cleaning critical — floppy ears trap moisture. Regular eye exams. Check for ticks (they love woodland).',
  },
  'jack russell terrier': {
    issues: ['Patellar luxation', 'Lens luxation', 'Deafness', 'Legg-Calvé-Perthes disease', 'Dental disease'],
    advice: 'Regular dental cleaning. Watch for limping (hip issues). Eye exams annually. Energetic — needs plenty of exercise.',
  },
  'springer spaniel': {
    issues: ['Hip dysplasia', 'Phosphofructokinase deficiency', 'Eye conditions', 'Ear infections', 'Skin allergies'],
    advice: 'Active breed — regular exercise important. Ear cleaning after swimming. DNA testing for PFK deficiency available.',
  },
  'beagle': {
    issues: ['Obesity', 'Epilepsy', 'Hypothyroidism', 'Cherry eye', 'Intervertebral disc disease', 'Ear infections'],
    advice: 'Food-motivated breed — strict portion control essential. Secure fencing needed (scent hound). Regular ear cleaning.',
  },
  'border collie': {
    issues: ['Hip dysplasia', 'Collie eye anomaly (CEA)', 'MDR1 gene mutation', 'Epilepsy', 'Trapped Neutrophil Syndrome (TNS)'],
    advice: 'MDR1 gene test essential — affects drug sensitivity. Eye screening for CEA. High energy — needs mental and physical stimulation.',
  },
  'poodle': {
    issues: ['Hip dysplasia', 'Progressive retinal atrophy', 'Epilepsy', 'Bloat (GDV)', 'Addison\'s disease', 'Sebaceous adenitis'],
    advice: 'Regular grooming to prevent skin issues. Hip screening. Bloat awareness (feed smaller meals). hypoallergenic coat — good for allergy sufferers.',
  },
  'bulldog': {
    issues: ['Brachycephalic syndrome', 'Hip dysplasia', 'Cherry eye', 'Skin fold dermatitis', 'Heat intolerance', 'Breathing difficulties'],
    advice: 'Keep cool at all times. Clean skin folds daily. Use harness for walks. Avoid overexertion. Consider pet insurance for respiratory issues.',
  },
  'dachshund': {
    issues: ['Intervertebral disc disease (IVDD)', 'Patellar luxation', 'Obesity', 'Dental disease', 'Eye conditions'],
    advice: 'CRITICAL: Prevent jumping on/off furniture. No stairs if possible. Maintain lean weight. Ramp access to beds/couches.',
  },
  'boxer': {
    issues: ['Cardiomyopathy', 'Hip dysplasia', 'Cancer (mast cell tumors)', 'Aortic stenosis', 'Hypothyroidism', 'Bloat (GDV)'],
    advice: 'Annual cardiac screening. Bloat awareness. Watch for lumps (mast cell tumors common). Avoid vigorous exercise after meals.',
  },
  'shih tzu': {
    issues: ['Brachycephalic syndrome', 'Patellar luxation', 'Eye problems (dry eye, corneal ulcers)', 'Ear infections', 'Dental disease'],
    advice: 'Daily eye cleaning and face wrinkle cleaning. Regular dental care. Avoid heat. Professional grooming every 4-6 weeks.',
  },
  'yorkshire terrier': {
    issues: ['Patellar luxation', 'Luxating trachea', 'Dental disease', 'Legg-Calvé-Perthes disease', 'Portosystemic shunt'],
    advice: 'Daily dental care essential — small breeds prone to dental disease. Use harness (collar can irritate trachea). Regular vet checks.',
  },
  'dalmatian': {
    issues: ['Deafness (bilateral/unilateral)', 'Urolithiasis (urinary stones)', 'Skin allergies', 'Hip dysplasia'],
    advice: 'BAER testing for hearing. Special diet to prevent urinary stones (low purine). Plenty of water. Active breed needs exercise.',
  },
  'siberian husky': {
    issues: ['Eye conditions (PRA, cataracts, corneal dystrophy)', 'Hip dysplasia', 'Hypothyroidism', 'Zinc-responsive dermatosis'],
    advice: 'Double coat — heavy shedding seasonally. Never shave. Eye exams annually. Escape artists — secure fencing essential.',
  },
  'miniature schnauzer': {
    issues: ['Pancreatitis', 'Bladder stones', 'Lens luxation', 'Diabetes mellitus', 'Hyperlipidemia'],
    advice: 'Low-fat diet essential — prone to pancreatitis. Regular weight monitoring. Eye exams annually. Dental care important.',
  },
};

// Cat breed health data
const CAT_BREED_HEALTH: Record<string, { issues: string[]; advice: string }> = {
  'persian': {
    issues: ['Polycystic kidney disease (PKD)', 'Hypertrophic cardiomyopathy', 'Brachycephalic syndrome', 'Dental disease', 'Tear staining'],
    advice: 'PKD DNA testing recommended. Daily face cleaning. Regular dental care. Avoid heat. Professional grooming 2-3x/week.',
  },
  'siamese': {
    issues: ['Amyloidosis (liver)', 'Progressive retinal atrophy', 'Dental disease', 'Asthma', 'Heart conditions'],
    advice: 'Annual eye exams. Dental care important. Monitor weight. Siamese are vocal — changes in vocalization may indicate pain.',
  },
  'maine coon': {
    issues: ['Hip dysplasia', 'Hypertrophic cardiomyopathy (HCM)', 'Spinal muscular atrophy', 'Polycystic kidney disease'],
    advice: 'HCM screening via echocardiogram. DNA testing for SMA. Regular weight management. Large breed — joint supplements may help.',
  },
  'ragdoll': {
    issues: ['Hypertrophic cardiomyopathy (HCM)', 'Polycystic kidney disease', 'Bladder stones'],
    advice: 'Annual cardiac screening. PKD testing. Monitor water intake (kidney health). Indoor-only recommended.',
  },
  'bengal': {
    issues: ['Hypertrophic cardiomyopathy', 'Progressive retinal atrophy', 'Flat chested kitten syndrome'],
    advice: 'Active breed — needs enrichment and vertical space. Annual eye and heart checks. DNA testing available for PRA.',
  },
};

// Rabbit health knowledge base
const RABBIT_HEALTH = {
  issues: ['GI stasis', 'Dental malocclusion', 'Flystrike (myiasis)', 'RHDV', 'Myxomatosis', 'Ear mites', 'Snuffles'],
  advice: 'Unlimited hay diet essential — prevents dental and GI issues. Annual RHDV/myxomatosis vaccination. Check rear end daily in summer (flystrike risk). Neutering recommended.',
};

// Bird health knowledge base
const BIRD_HEALTH = {
  issues: ['Respiratory infections', 'Psittacosis', 'Feather plucking', 'Egg binding', 'Vitamin A deficiency', 'Bumblefoot'],
  advice: 'Annual avian vet checkup. Balanced pellet diet (not seed-only). Avoid Teflon/non-stick cookware fumes (toxic). Full spectrum lighting important.',
};

async function fetchDogBreeds(): Promise<DogBreed[]> {
  if (breedCache && Date.now() - breedCache.fetchedAt < CACHE_TTL) {
    return breedCache.data;
  }

  try {
    const res = await fetch('https://dogapi.dog/api/v2/breeds');
    if (!res.ok) throw new Error(`Dog API error: ${res.status}`);
    const data = await res.json();
    const breeds: DogBreed[] = data.breeds || [];
    breedCache = { data: breeds, fetchedAt: Date.now() };
    return breeds;
  } catch (err) {
    console.error('Failed to fetch dog breeds:', err);
    if (breedCache) return breedCache.data;
    return [];
  }
}

export interface BreedInfo {
  name: string;
  species: string;
  temperament?: string;
  lifespan?: string;
  bred_for?: string;
  breed_group?: string;
  health_issues: string[];
  health_advice: string;
  weight_kg?: string;
  height_cm?: string;
}

export async function getBreedInfo(species: string, breed?: string): Promise<BreedInfo> {
  const lowerSpecies = species.toLowerCase();
  const lowerBreed = breed?.toLowerCase();

  if (lowerSpecies === 'dog') {
    const breeds = await fetchDogBreeds();

    if (lowerBreed) {
      const found = breeds.find(b => b.name.toLowerCase() === lowerBreed);
      if (found) {
        const health = BREED_HEALTH[lowerBreed] || { issues: ['No specific data available'], advice: 'Regular vet checkups recommended.' };
        return {
          name: found.name,
          species: 'Dog',
          temperament: found.temperament,
          lifespan: found.life_span,
          bred_for: found.bred_for,
          breed_group: found.breed_group,
          health_issues: health.issues,
          health_advice: health.advice,
          weight_kg: found.weight?.metric,
          height_cm: found.height?.metric,
        };
      }
    }

    // Return a summary of all breeds if no specific breed requested
    return {
      name: 'Dogs (all breeds)',
      species: 'Dog',
      lifespan: '10-13 years average',
      health_issues: ['Hip/elbow dysplasia', 'Dental disease', 'Obesity', 'Allergies', 'Heart disease', 'Cancer'],
      health_advice: 'Annual wellness exams recommended. Puppies need 3 vaccinations + booster. Adults need annual boosters. Dental cleaning from age 3+.',
    };
  }

  if (lowerSpecies === 'cat') {
    if (lowerBreed && CAT_BREED_HEALTH[lowerBreed]) {
      const health = CAT_BREED_HEALTH[lowerBreed];
      return {
        name: breed || 'Cat',
        species: 'Cat',
        health_issues: health.issues,
        health_advice: health.advice,
      };
    }
    return {
      name: 'Cats (all breeds)',
      species: 'Cat',
      lifespan: '12-18 years average',
      health_issues: ['Kidney disease', 'Hyperthyroidism', 'Dental disease', 'Diabetes', 'Hypertrophic cardiomyopathy'],
      health_advice: 'Indoor cats live longer on average. Annual wellness exams. Vaccinations: cat flu, FIV. Neutering from 4-6 months. Dental check from age 3.',
    };
  }

  if (lowerSpecies === 'rabbit') {
    return {
      name: 'Rabbits (all breeds)',
      species: 'Rabbit',
      lifespan: '8-12 years average',
      health_issues: RABBIT_HEALTH.issues,
      health_advice: RABBIT_HEALTH.advice,
    };
  }

  if (lowerSpecies === 'bird') {
    return {
      name: 'Birds (all species)',
      species: 'Bird',
      lifespan: '5-80+ years (varies hugely by species)',
      health_issues: BIRD_HEALTH.issues,
      health_advice: BIRD_HEALTH.advice,
    };
  }

  // Small mammals (guinea pig, hamster, etc.)
  return {
    name: `${species} (all breeds)`,
    species,
    lifespan: '2-8 years (varies by species)',
    health_issues: ['Dental disease', 'GI stasis', 'Skin parasites', 'Respiratory infections'],
    health_advice: 'Annual wellness exams. Species-specific diet essential. Handle regularly for health checks. Watch for weight changes.',
  };
}
