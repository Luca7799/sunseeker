/**
 * palma-venues.ts
 *
 * Seed script — inserts the 10 most important Palma de Mallorca venues into
 * the Sunseeker database via the Supabase admin client.
 *
 * Run with:
 *   NEXT_PUBLIC_SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/seed/palma-venues.ts
 *
 * The upsert is idempotent: re-running the script will update existing rows
 * rather than creating duplicates.  Conflict resolution is on the `slug` column.
 */

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  );
  process.exit(1);
}

// Use the admin / service-role client so RLS is bypassed for seeding
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Venue data
// ---------------------------------------------------------------------------
// location is stored as PostGIS geography — we send as GeoJSON Point so the
// database trigger / Supabase can coerce it.  If your schema expects a text
// WKT or lat/lon columns directly, adjust accordingly.

interface VenueSeed {
  slug: string;
  name: string;
  venue_type: string;
  description: string;
  address: string;
  lat: number;
  lon: number;
  google_maps_url?: string;
  website_url?: string;
  average_rating?: number;
  price_level?: number; // 1–4
  outdoor_seating: boolean;
  is_curated: boolean;
  status: string;
  tags: string[];
  opening_hours?: Record<string, string>;
  sun_notes?: string;
}

const VENUES: VenueSeed[] = [
  {
    slug: "passeig-del-born",
    name: "Passeig del Born",
    venue_type: "plaza",
    description:
      "Palma's most elegant promenade, lined with plane trees, cafés, and fine restaurants. The south-facing terraces enjoy sun throughout the afternoon.",
    address: "Passeig del Born, 07012 Palma de Mallorca",
    lat: 39.5693,
    lon: 2.6503,
    website_url: undefined,
    average_rating: 4.6,
    price_level: 3,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["promenade", "terrace", "afternoon-sun", "historic"],
    opening_hours: {},
    sun_notes:
      "Terraces on the south-west side receive direct sun from midday until sunset in summer.",
  },
  {
    slug: "plaza-mayor",
    name: "Plaza Mayor",
    venue_type: "plaza",
    description:
      "The historic heart of Palma's old town. A grand arcaded square with outdoor café seating. Opens up to full sky exposure from late morning.",
    address: "Plaça Major, 07001 Palma de Mallorca",
    lat: 39.5706,
    lon: 2.6509,
    website_url: undefined,
    average_rating: 4.3,
    price_level: 2,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["plaza", "historic", "cafes", "central"],
    sun_notes:
      "Centre of the square is fully sunlit from 10:00–17:00 in summer. Arcaded edges remain shaded.",
  },
  {
    slug: "cafe-la-lonja",
    name: "Café La Lonja",
    venue_type: "cafe",
    description:
      "Beloved neighbourhood café next to Palma's Gothic exchange building. South-facing terrace spills onto the waterfront square.",
    address: "Carrer de la Llotja, 2, 07012 Palma de Mallorca",
    lat: 39.5672,
    lon: 2.6470,
    website_url: undefined,
    average_rating: 4.2,
    price_level: 2,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["cafe", "terrace", "waterfront", "historic"],
    opening_hours: {
      monday: "08:00–22:00",
      tuesday: "08:00–22:00",
      wednesday: "08:00–22:00",
      thursday: "08:00–22:00",
      friday: "08:00–00:00",
      saturday: "08:00–00:00",
      sunday: "09:00–21:00",
    },
    sun_notes: "Terrace faces south-west; sunny from noon. Best October–April.",
  },
  {
    slug: "parc-de-la-mar",
    name: "Parc de la Mar",
    venue_type: "park",
    description:
      "Modern seafront park below the Cathedral with an artificial lake and wide open lawns. Completely unobstructed by buildings — one of Palma's sunniest outdoor spaces.",
    address: "Parc de la Mar, 07001 Palma de Mallorca",
    lat: 39.5667,
    lon: 2.6530,
    website_url: undefined,
    average_rating: 4.5,
    price_level: 1,
    outdoor_seating: false,
    is_curated: true,
    status: "active",
    tags: ["park", "seafront", "open-sky", "family-friendly"],
    sun_notes:
      "Fully exposed to sky. Direct sun from sunrise to sunset on clear days.",
  },
  {
    slug: "restaurant-adriatic",
    name: "Restaurant Adriatic",
    venue_type: "restaurant",
    description:
      "Upmarket seafood restaurant with a large rooftop terrace overlooking the bay. Exceptional afternoon and evening sun exposure.",
    address: "Passeig Marítim, 28, 07014 Palma de Mallorca",
    lat: 39.5638,
    lon: 2.6280,
    website_url: undefined,
    average_rating: 4.4,
    price_level: 4,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["restaurant", "rooftop", "seafood", "sea-views"],
    opening_hours: {
      tuesday: "13:00–23:00",
      wednesday: "13:00–23:00",
      thursday: "13:00–23:00",
      friday: "13:00–23:30",
      saturday: "13:00–23:30",
      sunday: "13:00–22:00",
    },
    sun_notes:
      "Rooftop terrace receives sun all afternoon. Elevated position avoids building shadows.",
  },
  {
    slug: "placa-de-la-reina",
    name: "Plaça de la Reina",
    venue_type: "plaza",
    description:
      "Elegant square at the foot of Passeig del Born with a central fountain and café terraces. Well-protected from north wind, ideal in winter sun.",
    address: "Plaça de la Reina, 07012 Palma de Mallorca",
    lat: 39.5686,
    lon: 2.6506,
    website_url: undefined,
    average_rating: 4.4,
    price_level: 2,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["plaza", "fountain", "terrace", "year-round"],
    sun_notes:
      "Southern aspect and low surrounding buildings mean sun from ~10:00 in winter.",
  },
  {
    slug: "can-joan-de-s-aigo",
    name: "Can Joan de S'Aigo",
    venue_type: "cafe",
    description:
      "Palma's oldest café (1700), famous for hot chocolate and ensaimades. Small terrace on a narrow old-town street with morning east sun.",
    address: "Carrer de Can Sanç, 10, 07001 Palma de Mallorca",
    lat: 39.5713,
    lon: 2.6532,
    website_url: "https://canjoandesaigo.com",
    average_rating: 4.5,
    price_level: 1,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["cafe", "historic", "traditional", "morning-sun"],
    opening_hours: {
      monday: "08:00–21:00",
      tuesday: "CLOSED",
      wednesday: "08:00–21:00",
      thursday: "08:00–21:00",
      friday: "08:00–21:00",
      saturday: "08:00–21:00",
      sunday: "08:00–21:00",
    },
    sun_notes:
      "Narrow street — direct sun only 09:00–12:00 in summer. Go for morning visits.",
  },
  {
    slug: "portixol-harbour",
    name: "Portixol Harbour",
    venue_type: "waterfront",
    description:
      "Relaxed fishing village neighbourhood with harbour-side restaurants and a promenade. Faces south-east for excellent morning sun.",
    address: "Portitxol, 07006 Palma de Mallorca",
    lat: 39.5590,
    lon: 2.6690,
    website_url: undefined,
    average_rating: 4.6,
    price_level: 2,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["harbour", "seafood", "morning-sun", "relaxed"],
    sun_notes:
      "South-east orientation catches sun from sunrise until early afternoon. Low-rise surroundings.",
  },
  {
    slug: "mercado-del-olivar",
    name: "Mercado del Olivar",
    venue_type: "market",
    description:
      "Palma's main covered market with a tapas bar that opens onto a small sunny courtyard. Indoor seating is an option when outdoor sun is limited.",
    address: "Plaça de l'Olivar, 07002 Palma de Mallorca",
    lat: 39.5743,
    lon: 2.6523,
    website_url: "https://mercadodelolivar.com",
    average_rating: 4.3,
    price_level: 2,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["market", "tapas", "courtyard", "indoor-option"],
    opening_hours: {
      monday: "07:00–14:30",
      tuesday: "07:00–14:30",
      wednesday: "07:00–14:30",
      thursday: "07:00–14:30",
      friday: "07:00–14:30",
      saturday: "07:00–15:00",
      sunday: "CLOSED",
    },
    sun_notes:
      "Courtyard receives midday sun. Surrounding buildings cast shadows after 14:00.",
  },
  {
    slug: "terraza-nakar",
    name: "Terraza Nakar Hotel",
    venue_type: "rooftop_bar",
    description:
      "Rooftop pool bar on one of Palma's boutique hotels. Panoramic views over the old town and Cathedral. Open sky — virtually no shadow obstructions.",
    address: "Passeig del Born, 13, 07012 Palma de Mallorca",
    lat: 39.5699,
    lon: 2.6497,
    website_url: "https://nakarhotel.com",
    average_rating: 4.7,
    price_level: 4,
    outdoor_seating: true,
    is_curated: true,
    status: "active",
    tags: ["rooftop", "bar", "pool", "panoramic", "luxury"],
    opening_hours: {
      monday: "12:00–23:00",
      tuesday: "12:00–23:00",
      wednesday: "12:00–23:00",
      thursday: "12:00–23:00",
      friday: "12:00–00:00",
      saturday: "12:00–00:00",
      sunday: "12:00–22:00",
    },
    sun_notes:
      "Rooftop level — direct sun all day in summer. Wind can be strong in winter.",
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Transforms a VenueSeed into the row shape expected by the `venues` table.
 * Adjust column names here to match your actual schema.
 */
function toRow(v: VenueSeed): Record<string, unknown> {
  return {
    slug:              v.slug,
    name:              v.name,
    venue_type:        v.venue_type,
    description:       v.description,
    address:           v.address,
    // Supabase accepts a GeoJSON geometry string for geography columns
    location:          `SRID=4326;POINT(${v.lon} ${v.lat})`,
    google_maps_url:   v.google_maps_url ?? null,
    website_url:       v.website_url ?? null,
    average_rating:    v.average_rating ?? null,
    price_level:       v.price_level ?? null,
    outdoor_seating:   v.outdoor_seating,
    is_curated:        v.is_curated,
    status:            v.status,
    tags:              v.tags,
    opening_hours:     v.opening_hours ?? {},
    sun_notes:         v.sun_notes ?? null,
  };
}

async function seed(): Promise<void> {
  console.log(`Seeding ${VENUES.length} venues into Supabase …\n`);

  const rows = VENUES.map(toRow);

  const { data, error } = await supabase
    .from("venues")
    .upsert(rows, {
      onConflict: "slug",
      ignoreDuplicates: false, // update existing rows
    })
    .select("id, slug, name");

  if (error) {
    console.error("Upsert failed:", error.message);
    console.error("Details:", error.details ?? "(none)");
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.warn("Upsert returned no rows — the table may already be up to date.");
  } else {
    console.log("Upserted venues:");
    for (const row of data) {
      console.log(`  [${row.id}]  ${row.slug.padEnd(28)}  ${row.name}`);
    }
  }

  console.log(`\nDone. ${data?.length ?? 0} venues seeded.`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

seed().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
