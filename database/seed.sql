-- ============================================
-- SUNSEEKER SEED DATA
-- Palma de Mallorca — 30 curated venues
-- ============================================

-- ============================================
-- SECTION 1: VENUES
-- ============================================

-- ------------------------------------
-- OLD TOWN / LA LONJA area (~39.5678° N, 2.6467° E)
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Bar Dia',
  'bar-dia-palma',
  'bar',
  ARRAY['terrace'],
  'Classic Mallorcan bar in the heart of La Lonja with a wide south-facing terrace. A local institution since the 1970s, beloved for its vermouth and tapas.',
  'Carrer del Convent de Sant Francesc, 5, La Lonja, Palma',
  39.5676, 2.6465,
  'confirmed',
  'Large south-facing street terrace with 12 tables on Plaça de la Llotja, unobstructed sun from mid-morning until early afternoon.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:00", "close": "23:00"}, "tue": {"open": "08:00", "close": "23:00"}, "wed": {"open": "08:00", "close": "23:00"}, "thu": {"open": "08:00", "close": "23:00"}, "fri": {"open": "08:00", "close": "00:00"}, "sat": {"open": "09:00", "close": "00:00"}, "sun": {"open": "09:00", "close": "22:00"}}',
  'Mo-Sa 08:00-23:00; Su 09:00-22:00',
  '+34 971 712 345',
  NULL,
  4.20, 312,
  2,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Café La Lonja',
  'cafe-la-lonja',
  'cafe',
  ARRAY['terrace'],
  'Charming café facing the Gothic Llotja de Mallorca. Perfect for a morning coffee with views of one of Palma''s most iconic buildings.',
  'Carrer de la Llotja, 2, Palma',
  39.5680, 2.6468,
  'confirmed',
  'East-facing terrace on Plaça de la Llotja, good morning sun until around 13:00 before the Llotja building casts shade.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:00", "close": "21:00"}, "tue": {"open": "08:00", "close": "21:00"}, "wed": {"open": "08:00", "close": "21:00"}, "thu": {"open": "08:00", "close": "21:00"}, "fri": {"open": "08:00", "close": "22:00"}, "sat": {"open": "08:30", "close": "22:00"}, "sun": {"open": "09:00", "close": "20:00"}}',
  'Mo-Fr 08:00-21:00; Sa 08:30-22:00; Su 09:00-20:00',
  '+34 971 720 111',
  NULL,
  4.05, 189,
  2,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'El Pesquero',
  'el-pesquero-palma',
  'restaurant',
  ARRAY['terrace'],
  'Seafood restaurant right on the waterfront with an expansive terrace overlooking the marina. Specialises in fresh local catch and paella.',
  'Moll de la Riba s/n, Passeig Marítim, Palma',
  39.5663, 2.6472,
  'confirmed',
  'Large south-facing waterfront terrace, direct sun all day from sunrise. May get gusty sea breeze in afternoons.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "12:00", "close": "23:30"}, "tue": {"open": "12:00", "close": "23:30"}, "wed": {"open": "12:00", "close": "23:30"}, "thu": {"open": "12:00", "close": "23:30"}, "fri": {"open": "12:00", "close": "00:00"}, "sat": {"open": "12:00", "close": "00:00"}, "sun": {"open": "12:00", "close": "23:00"}}',
  'Mo-Su 12:00-23:30',
  '+34 971 715 220',
  'https://elpesqueropalma.com',
  4.35, 540,
  3,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, rooftop_level, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Mirador de la Seu',
  'mirador-de-la-seu',
  'rooftop',
  ARRAY['rooftop', 'bar'],
  'Stunning rooftop bar with unobstructed views of Palma Cathedral. Perfect sunset spot in the old town.',
  'Carrer de la Portella, 12, Palma',
  39.5683, 2.6491,
  'confirmed',
  'Full rooftop terrace, open sky on all sides. Sun from morning to sunset. No shade structures — bring sunscreen.',
  TRUE,
  4,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "17:00", "close": "00:00"}, "wed": {"open": "17:00", "close": "00:00"}, "thu": {"open": "17:00", "close": "00:00"}, "fri": {"open": "16:00", "close": "01:00"}, "sat": {"open": "16:00", "close": "01:00"}, "sun": {"open": "16:00", "close": "23:00"}}',
  'Tu-Th 17:00-00:00; Fr-Sa 16:00-01:00; Su 16:00-23:00',
  '+34 971 714 088',
  NULL,
  4.60, 728,
  3,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Fontsanta Bar',
  'fontsanta-bar',
  'bar',
  ARRAY['terrace'],
  'Laid-back bar on a quiet old-town square with an intimate terrace. Popular with locals for afternoon drinks.',
  'Plaça de Santa Eulàlia, 3, Palma',
  39.5690, 2.6475,
  'confirmed',
  'Small terrace on Plaça de Santa Eulàlia, south-west facing. Gets sun from mid-morning and benefits from golden hour light.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "10:00", "close": "23:00"}, "tue": {"open": "10:00", "close": "23:00"}, "wed": {"open": "10:00", "close": "23:00"}, "thu": {"open": "10:00", "close": "23:00"}, "fri": {"open": "10:00", "close": "00:30"}, "sat": {"open": "10:00", "close": "00:30"}, "sun": {"open": "11:00", "close": "22:00"}}',
  'Mo-Th 10:00-23:00; Fr-Sa 10:00-00:30; Su 11:00-22:00',
  NULL,
  NULL,
  4.10, 95,
  1,
  'no_height'
);

-- ------------------------------------
-- PASSEIG DES BORN (~39.5684° N, 2.6490° E)
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Grand Café Cappuccino Born',
  'grand-cafe-cappuccino-born',
  'cafe',
  ARRAY['terrace'],
  'The original Cappuccino outpost on Passeig des Born, set inside a historic Modernista palace with a leafy courtyard and terrace on the promenade.',
  'Passeig des Born, 1, Palma',
  39.5686, 2.6488,
  'confirmed',
  'Terrace directly on Passeig des Born boulevard. Morning shade from building to east; full sun from 11:00 to 15:00; afternoon shade from trees. Courtyard patio also available.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:30", "close": "23:30"}, "tue": {"open": "08:30", "close": "23:30"}, "wed": {"open": "08:30", "close": "23:30"}, "thu": {"open": "08:30", "close": "23:30"}, "fri": {"open": "08:30", "close": "00:00"}, "sat": {"open": "09:00", "close": "00:00"}, "sun": {"open": "09:00", "close": "23:30"}}',
  'Mo-Fr 08:30-23:30; Sa 09:00-00:00; Su 09:00-23:30',
  '+34 971 719 764',
  'https://grupocappuccino.com',
  4.40, 1820,
  3,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Abaco Cocktail Bar',
  'abaco-cocktail-bar',
  'bar',
  ARRAY['terrace'],
  'Legendary cocktail bar in a 17th-century mansion with a spectacular courtyard overflowing with fresh flowers and exotic birds.',
  'Carrer de Sant Joan, 1, Palma',
  39.5694, 2.6484,
  'confirmed',
  'Open courtyard patio, partially shaded by mature trees and wrought iron. West-facing; good afternoon sun in summer. Candles and lanterns after dusk.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": null, "wed": {"open": "20:00", "close": "03:00"}, "thu": {"open": "20:00", "close": "03:00"}, "fri": {"open": "20:00", "close": "03:30"}, "sat": {"open": "20:00", "close": "03:30"}, "sun": {"open": "20:00", "close": "02:00"}}',
  'We-Th 20:00-03:00; Fr-Sa 20:00-03:30; Su 20:00-02:00',
  '+34 971 714 939',
  NULL,
  4.55, 640,
  4,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, rooftop_level, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Hotel Almudaina Rooftop',
  'hotel-almudaina-rooftop',
  'rooftop',
  ARRAY['rooftop', 'bar', 'terrace'],
  'Rooftop pool bar at the Hotel Almudaina with sweeping views across the Born promenade and Palma Bay.',
  'Avinguda de Jaume III, 9, Palma',
  39.5689, 2.6501,
  'confirmed',
  'Rooftop bar with pool, fully open sky. South and west facing, excellent afternoon sun and sunset views over the bay.',
  TRUE,
  5,
  TRUE,
  'manual',
  '{"mon": {"open": "11:00", "close": "22:00"}, "tue": {"open": "11:00", "close": "22:00"}, "wed": {"open": "11:00", "close": "22:00"}, "thu": {"open": "11:00", "close": "22:00"}, "fri": {"open": "11:00", "close": "23:00"}, "sat": {"open": "11:00", "close": "23:00"}, "sun": {"open": "11:00", "close": "22:00"}}',
  'Mo-Su 11:00-22:00',
  '+34 971 727 340',
  'https://hotelalmudaina.com',
  4.30, 285,
  4,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Es Baluard Terrace',
  'es-baluard-terrace',
  'restaurant',
  ARRAY['terrace', 'viewpoint'],
  'Museum café and terrace at Es Baluard Museum of Modern and Contemporary Art, perched on the old city walls with bay views.',
  'Plaça de la Porta de Santa Catalina, 10, Palma',
  39.5700, 2.6449,
  'confirmed',
  'Elevated terrace on the old city ramparts, south-west facing. Open sky with panoramic views of the marina and bay. Sun-drenched all afternoon.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "10:00", "close": "20:00"}, "wed": {"open": "10:00", "close": "20:00"}, "thu": {"open": "10:00", "close": "20:00"}, "fri": {"open": "10:00", "close": "21:00"}, "sat": {"open": "10:00", "close": "21:00"}, "sun": {"open": "10:00", "close": "15:00"}}',
  'Tu-Th 10:00-20:00; Fr-Sa 10:00-21:00; Su 10:00-15:00',
  '+34 971 908 200',
  'https://esbaluard.org',
  4.45, 412,
  2,
  'with_height'
);

-- ------------------------------------
-- SANTA CATALINA (~39.5720° N, 2.6430° E)
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Mercat de Santa Catalina — Bar Flexas',
  'mercat-santa-catalina-bar-flexas',
  'bar',
  ARRAY['terrace'],
  'Vibrant tapas bar at the edge of the Santa Catalina market with tables spilling onto the pedestrian plaza. The neighbourhood''s social hub.',
  'Plaça de la Navegació, 4, Santa Catalina, Palma',
  39.5721, 2.6428,
  'confirmed',
  'Wide open plaza terrace on the north side of the market building. South-facing, all-day sun. Tables fill up fast on weekends.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "07:30", "close": "16:00"}, "tue": {"open": "07:30", "close": "16:00"}, "wed": {"open": "07:30", "close": "16:00"}, "thu": {"open": "07:30", "close": "16:00"}, "fri": {"open": "07:30", "close": "16:00"}, "sat": {"open": "07:30", "close": "15:00"}, "sun": null}',
  'Mo-Fr 07:30-16:00; Sa 07:30-15:00',
  NULL,
  NULL,
  4.25, 210,
  1,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Tast Club',
  'tast-club-palma',
  'restaurant',
  ARRAY['terrace'],
  'Creative Mallorcan cuisine in a renovated townhouse with a beautiful inner patio. Tasting menus showcasing local products.',
  'Carrer de Sant Jaume, 6, Santa Catalina, Palma',
  39.5718, 2.6433,
  'confirmed',
  'Interior courtyard patio, partially open to sky. Protected from wind; dappled sun until early afternoon depending on season.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "13:00", "close": "16:00"}, "wed": {"open": "13:00", "close": "16:00"}, "thu": {"open": "13:00", "close": "16:00"}, "fri": {"open": "13:00", "close": "16:00"}, "sat": {"open": "13:00", "close": "16:30"}, "sun": null}',
  'Tu-Sa 13:00-16:00',
  '+34 971 710 150',
  'https://tastclub.com',
  4.65, 340,
  4,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Cafe Coffeehouse Santa Catalina',
  'coffeehouse-santa-catalina',
  'cafe',
  ARRAY['terrace'],
  'Specialty coffee shop in the heart of Santa Catalina with a small but sunny front terrace. Known for its flat whites and homemade pastries.',
  'Carrer de Cotoner, 12, Santa Catalina, Palma',
  39.5725, 2.6420,
  'confirmed',
  'Four outdoor tables on the pavement in front of the shop. South-east facing, best sun from opening until around 13:00.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:00", "close": "17:00"}, "tue": {"open": "08:00", "close": "17:00"}, "wed": {"open": "08:00", "close": "17:00"}, "thu": {"open": "08:00", "close": "17:00"}, "fri": {"open": "08:00", "close": "17:00"}, "sat": {"open": "09:00", "close": "15:00"}, "sun": {"open": "09:30", "close": "14:00"}}',
  'Mo-Fr 08:00-17:00; Sa 09:00-15:00; Su 09:30-14:00',
  NULL,
  NULL,
  4.50, 178,
  2,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Bodega La Vinya',
  'bodega-la-vinya',
  'bar',
  ARRAY['terrace'],
  'Unpretentious wine bar and bodega with an excellent selection of Mallorcan wines and charcuterie. Terrace on a quiet residential street.',
  'Carrer de la Indústria, 3, Santa Catalina, Palma',
  39.5727, 2.6415,
  'inferred',
  'Four tables on a narrow street terrace, west-facing. In shade until afternoon, then good sun from 15:00 to sunset. Protected from main road noise.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "17:00", "close": "23:30"}, "wed": {"open": "17:00", "close": "23:30"}, "thu": {"open": "17:00", "close": "23:30"}, "fri": {"open": "17:00", "close": "00:00"}, "sat": {"open": "12:00", "close": "00:00"}, "sun": {"open": "12:00", "close": "22:00"}}',
  'Tu-Th 17:00-23:30; Fr 17:00-00:00; Sa 12:00-00:00; Su 12:00-22:00',
  NULL,
  NULL,
  4.35, 124,
  2,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, rooftop_level, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Nakar Hotel Rooftop Bar',
  'nakar-hotel-rooftop',
  'rooftop',
  ARRAY['rooftop', 'bar'],
  'Sleek rooftop bar at the Nakar Hotel on Avinguda de Jaume III. Infinity pool with panoramic views over the bay and city skyline.',
  'Avinguda de Jaume III, 21, Palma',
  39.5709, 2.6472,
  'confirmed',
  'Full rooftop with infinity pool, open 360° sky. South-west facing for spectacular afternoon and sunset light over Palma Bay.',
  TRUE,
  6,
  TRUE,
  'manual',
  '{"mon": {"open": "10:00", "close": "22:00"}, "tue": {"open": "10:00", "close": "22:00"}, "wed": {"open": "10:00", "close": "22:00"}, "thu": {"open": "10:00", "close": "22:00"}, "fri": {"open": "10:00", "close": "23:00"}, "sat": {"open": "10:00", "close": "23:00"}, "sun": {"open": "10:00", "close": "22:00"}}',
  'Mo-Su 10:00-22:00',
  '+34 971 720 420',
  'https://nakarhotel.com',
  4.55, 870,
  4,
  'with_height'
);

-- ------------------------------------
-- PORTIXOL (~39.5600° N, 2.6700° E)
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Restaurante Portixol',
  'restaurante-portixol',
  'restaurant',
  ARRAY['terrace'],
  'Iconic seafront restaurant at the Hotel Portixol. Relaxed Mediterranean dining on a terrace steps from the water in the charming fishing village of Portixol.',
  'Carrer de Sirena, 27, Portixol, Palma',
  39.5598, 2.6702,
  'confirmed',
  'Large south-facing terrace on the harbour front. Direct sun all day. Sea breeze keeps it comfortable in summer. Excellent for long lunches.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "12:30", "close": "23:00"}, "tue": {"open": "12:30", "close": "23:00"}, "wed": {"open": "12:30", "close": "23:00"}, "thu": {"open": "12:30", "close": "23:00"}, "fri": {"open": "12:30", "close": "23:30"}, "sat": {"open": "12:30", "close": "23:30"}, "sun": {"open": "12:30", "close": "22:30"}}',
  'Mo-Sa 12:30-23:00; Su 12:30-22:30',
  '+34 971 441 111',
  'https://portixol.com',
  4.50, 620,
  4,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Chiringuito Portixol',
  'chiringuito-portixol',
  'bar',
  ARRAY['terrace'],
  'Laid-back beach bar at Portixol bay. Cold beers, fresh fish, and plastic chairs on the sand — exactly how a chiringuito should be.',
  'Passeig de Portixol, s/n, Portixol, Palma',
  39.5590, 2.6715,
  'confirmed',
  'Open-air terrace on the beach promenade, south-facing. Full sun from opening until sunset. Some natural shade from parasols.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "11:00", "close": "21:00"}, "tue": {"open": "11:00", "close": "21:00"}, "wed": {"open": "11:00", "close": "21:00"}, "thu": {"open": "11:00", "close": "21:00"}, "fri": {"open": "11:00", "close": "22:00"}, "sat": {"open": "10:00", "close": "22:00"}, "sun": {"open": "10:00", "close": "21:00"}}',
  'Mo-Su 10:00-21:00',
  NULL,
  NULL,
  4.00, 156,
  1,
  'none'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Nautilus Portixol',
  'nautilus-portixol',
  'cafe',
  ARRAY['terrace'],
  'Relaxed café-bar on Portixol promenade with a breezy terrace. Great for watching the small boats in the harbour over a morning coffee or cold drink.',
  'Carrer de Sirena, 13, Portixol, Palma',
  39.5605, 2.6695,
  'confirmed',
  'Promenade-facing terrace, south-east aspect. Strong morning and midday sun; shade from the building falls over the terrace after 16:00.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:00", "close": "22:00"}, "tue": {"open": "08:00", "close": "22:00"}, "wed": {"open": "08:00", "close": "22:00"}, "thu": {"open": "08:00", "close": "22:00"}, "fri": {"open": "08:00", "close": "23:00"}, "sat": {"open": "08:30", "close": "23:00"}, "sun": {"open": "08:30", "close": "21:00"}}',
  'Mo-Fr 08:00-22:00; Sa 08:30-23:00; Su 08:30-21:00',
  NULL,
  NULL,
  4.15, 98,
  2,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Sa Punteta',
  'sa-punteta-portixol',
  'restaurant',
  ARRAY['terrace', 'viewpoint'],
  'Family-run seafood restaurant at the end of the Portixol breakwater. Surrounded by water on three sides with exceptional panoramic views.',
  'Dic de l''Oest, Portixol, Palma',
  39.5582, 2.6730,
  'confirmed',
  'Fully open wraparound terrace at the tip of the breakwater. 270° open sky, strong sun all day. Very exposed — wind can be an issue.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "12:00", "close": "22:00"}, "wed": {"open": "12:00", "close": "22:00"}, "thu": {"open": "12:00", "close": "22:00"}, "fri": {"open": "12:00", "close": "23:00"}, "sat": {"open": "12:00", "close": "23:00"}, "sun": {"open": "12:00", "close": "21:00"}}',
  'Tu-Th 12:00-22:00; Fr-Sa 12:00-23:00; Su 12:00-21:00',
  '+34 971 245 033',
  NULL,
  4.40, 377,
  3,
  'none'
);

-- ------------------------------------
-- PARC DE LA MAR (parent venue)
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Parc de la Mar',
  'parc-de-la-mar',
  'park',
  ARRAY['viewpoint', 'bench'],
  'Beloved public park at the foot of Palma Cathedral, featuring a large artificial lake, contemporary sculptures, and direct views of La Seu. One of the city''s premier sun spots.',
  'Parc de la Mar, s/n, Palma',
  39.5670, 2.6500,
  'confirmed',
  'Entirely open park with unobstructed sky. South-facing slopes and benches guarantee all-day sun. Cathedral wall to the north casts shade only in early morning.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "00:00", "close": "23:59"}, "tue": {"open": "00:00", "close": "23:59"}, "wed": {"open": "00:00", "close": "23:59"}, "thu": {"open": "00:00", "close": "23:59"}, "fri": {"open": "00:00", "close": "23:59"}, "sat": {"open": "00:00", "close": "23:59"}, "sun": {"open": "00:00", "close": "23:59"}}',
  'Mo-Su 00:00-24:00',
  NULL,
  'https://www.palma.es',
  4.70, 2140,
  1,
  'with_height'
);

-- ------------------------------------
-- PARC DE SES ESTACIONS
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Parc de ses Estacions',
  'parc-de-ses-estacions',
  'park',
  ARRAY['bench'],
  'Charming urban park adjacent to the old Palma train station, with shaded walkways, fountains, and sunny open lawns. Popular with office workers at lunch.',
  'Plaça d''Espanya, s/n, Palma',
  39.5748, 2.6503,
  'confirmed',
  'Mixed park — benches along the south edge are in full sun until mid-afternoon. Northern section under mature trees. Central fountain area gets afternoon shade.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "07:00", "close": "22:00"}, "tue": {"open": "07:00", "close": "22:00"}, "wed": {"open": "07:00", "close": "22:00"}, "thu": {"open": "07:00", "close": "22:00"}, "fri": {"open": "07:00", "close": "22:00"}, "sat": {"open": "07:00", "close": "22:00"}, "sun": {"open": "08:00", "close": "22:00"}}',
  'Mo-Sa 07:00-22:00; Su 08:00-22:00',
  NULL,
  NULL,
  4.20, 315,
  1,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Café Tren — Estació Intermodal',
  'cafe-tren-estacio',
  'cafe',
  ARRAY['terrace'],
  'Casual café at the Intermodal train station with a terrace on the station forecourt. Convenient stop for commuters and day-trippers.',
  'Plaça d''Espanya, 6, Palma',
  39.5752, 2.6507,
  'inferred',
  'Open forecourt terrace, south-west facing. Exposed to full afternoon sun. Station canopy provides morning shade on eastern tables.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "06:30", "close": "21:00"}, "tue": {"open": "06:30", "close": "21:00"}, "wed": {"open": "06:30", "close": "21:00"}, "thu": {"open": "06:30", "close": "21:00"}, "fri": {"open": "06:30", "close": "21:00"}, "sat": {"open": "07:00", "close": "20:00"}, "sun": {"open": "08:00", "close": "20:00"}}',
  'Mo-Fr 06:30-21:00; Sa 07:00-20:00; Su 08:00-20:00',
  NULL,
  NULL,
  3.85, 74,
  1,
  'no_height'
);

-- ------------------------------------
-- VARIOUS ROOFTOPS & ADDITIONAL CENTER
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, rooftop_level, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Sant Francesc Hotel Singular — Rooftop',
  'sant-francesc-rooftop',
  'rooftop',
  ARRAY['rooftop', 'bar'],
  'Elegant rooftop bar at the five-star Hotel Sant Francesc, set in a restored Renaissance palace. Pool with views over the old town rooftops.',
  'Plaça de Sant Francesc, 5, Palma',
  39.5693, 2.6479,
  'confirmed',
  'Rooftop terrace with plunge pool. Full open sky with views over old-town rooftops and the cathedral tower. South-west facing, best sun from noon to closing.',
  TRUE,
  4,
  TRUE,
  'manual',
  '{"mon": {"open": "10:00", "close": "22:00"}, "tue": {"open": "10:00", "close": "22:00"}, "wed": {"open": "10:00", "close": "22:00"}, "thu": {"open": "10:00", "close": "22:00"}, "fri": {"open": "10:00", "close": "23:00"}, "sat": {"open": "10:00", "close": "23:00"}, "sun": {"open": "10:00", "close": "21:00"}}',
  'Mo-Su 10:00-22:00',
  '+34 971 495 000',
  'https://hotelsantfrancesc.com',
  4.70, 1025,
  4,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, rooftop_level, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Cuit Restaurant — Hotel Glam',
  'cuit-hotel-glam-rooftop',
  'rooftop',
  ARRAY['rooftop', 'restaurant'],
  'Gastronomy-focused rooftop restaurant at Hotel Glam Palma near Plaça d''Espanya. Contemporary Mallorcan cuisine with skyline views.',
  'Carrer dels Oms, 55, Palma',
  39.5740, 2.6492,
  'confirmed',
  'Rooftop restaurant terrace, north-facing towards the hills but open sky above. Morning shade fades by 10:00; good all-day light in summer.',
  TRUE,
  5,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "13:00", "close": "23:00"}, "wed": {"open": "13:00", "close": "23:00"}, "thu": {"open": "13:00", "close": "23:00"}, "fri": {"open": "13:00", "close": "23:30"}, "sat": {"open": "13:00", "close": "23:30"}, "sun": {"open": "13:00", "close": "22:00"}}',
  'Tu-Th 13:00-23:00; Fr-Sa 13:00-23:30; Su 13:00-22:00',
  '+34 971 225 700',
  NULL,
  4.25, 190,
  4,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Cafè Can Joan de s''Aigo',
  'can-joan-de-s-aigo',
  'cafe',
  ARRAY['terrace'],
  'Palma''s oldest café, serving ensaimades and hot chocolate since 1700. A heritage institution with a small terrace on a classic old-town street.',
  'Carrer de Can Sanç, 10, Palma',
  39.5698, 2.6496,
  'none',
  'No outdoor seating — interior historic café only. Listed here as a landmark; sunlight irrelevant.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": {"open": "08:00", "close": "21:00"}, "wed": {"open": "08:00", "close": "21:00"}, "thu": {"open": "08:00", "close": "21:00"}, "fri": {"open": "08:00", "close": "21:00"}, "sat": {"open": "08:00", "close": "21:00"}, "sun": {"open": "08:00", "close": "21:00"}}',
  'Tu-Su 08:00-21:00',
  '+34 971 710 759',
  NULL,
  4.65, 1340,
  1,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'La Botiga de Bellver',
  'la-botiga-de-bellver',
  'cafe',
  ARRAY['terrace', 'viewpoint'],
  'Café kiosk at the Bellver Castle grounds with shaded and sunny terrace areas overlooking the pine forest and distant bay.',
  'Camí de Bellver, s/n, Palma',
  39.5750, 2.6316,
  'confirmed',
  'Open terrace on the castle promontory. South-facing with wide bay views. Sun from morning to afternoon; pine trees provide natural shade on east side.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "09:00", "close": "20:00"}, "tue": {"open": "09:00", "close": "20:00"}, "wed": {"open": "09:00", "close": "20:00"}, "thu": {"open": "09:00", "close": "20:00"}, "fri": {"open": "09:00", "close": "20:00"}, "sat": {"open": "09:00", "close": "20:00"}, "sun": {"open": "10:00", "close": "19:00"}}',
  'Mo-Sa 09:00-20:00; Su 10:00-19:00',
  NULL,
  NULL,
  4.30, 228,
  1,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Quina Creu',
  'quina-creu-palma',
  'restaurant',
  ARRAY['terrace'],
  'Authentic Mallorcan restaurant near the Cathedral with a narrow but sunny street terrace. Known for its tumbet and slow-cooked lamb.',
  'Carrer de Zanglada, 2, Palma',
  39.5680, 2.6502,
  'inferred',
  'Terrace on a pedestrianised side street, south-facing. Gets direct sun from around 10:00 to 15:00 before the cathedral area buildings create shade.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "12:30", "close": "22:30"}, "tue": {"open": "12:30", "close": "22:30"}, "wed": {"open": "12:30", "close": "22:30"}, "thu": {"open": "12:30", "close": "22:30"}, "fri": {"open": "12:30", "close": "23:00"}, "sat": {"open": "12:30", "close": "23:00"}, "sun": {"open": "12:30", "close": "22:00"}}',
  'Mo-Su 12:30-22:30',
  '+34 971 723 567',
  NULL,
  4.20, 265,
  2,
  'with_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Bar Bosch',
  'bar-bosch-palma',
  'bar',
  ARRAY['terrace'],
  'Legendary Palma bar on Plaça del Rei Joan Carles I, the city''s social living room. Busy terrace, famous for its cocktails and people-watching.',
  'Plaça del Rei Joan Carles I, 6, Palma',
  39.5699, 2.6515,
  'confirmed',
  'Large terrace on Plaça del Rei Joan Carles I, open aspect to south and east. Full morning sun; partial shade from plaza trees in the afternoon.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "08:00", "close": "00:00"}, "tue": {"open": "08:00", "close": "00:00"}, "wed": {"open": "08:00", "close": "00:00"}, "thu": {"open": "08:00", "close": "00:00"}, "fri": {"open": "08:00", "close": "01:00"}, "sat": {"open": "08:00", "close": "01:00"}, "sun": {"open": "08:00", "close": "00:00"}}',
  'Mo-Th 08:00-00:00; Fr-Sa 08:00-01:00; Su 08:00-00:00',
  '+34 971 721 131',
  NULL,
  4.10, 980,
  2,
  'no_height'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Rialto Living Café',
  'rialto-living-cafe',
  'cafe',
  ARRAY['terrace'],
  'Design concept store and café in the Born area with a stunning interior courtyard. Brunch and light lunches in a stylish setting.',
  'Carrer de Sant Feliu, 3, Palma',
  39.5695, 2.6493,
  'confirmed',
  'Beautiful open-air courtyard, south-light. Partially shaded by retractable awnings; sun through central skylight from late morning.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "10:00", "close": "20:00"}, "tue": {"open": "10:00", "close": "20:00"}, "wed": {"open": "10:00", "close": "20:00"}, "thu": {"open": "10:00", "close": "20:00"}, "fri": {"open": "10:00", "close": "20:30"}, "sat": {"open": "10:00", "close": "20:30"}, "sun": null}',
  'Mo-Fr 10:00-20:00; Sa 10:00-20:30',
  '+34 971 713 331',
  'https://rialto-living.com',
  4.45, 510,
  3,
  'with_height'
);

-- ------------------------------------
-- ADDITIONAL MIXED VENUES
-- ------------------------------------

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Passeig Marítim Promenade Bar',
  'passeig-maritim-promenade-bar',
  'bar',
  ARRAY['terrace'],
  'Casual open-air bar right on Passeig Marítim, facing the sea. A simple, sunny spot for a beer with uninterrupted bay views.',
  'Passeig Marítim, 30, Palma',
  39.5650, 2.6510,
  'confirmed',
  'Terrace directly on the seafront promenade, south-facing. Full sun all day; fresh sea breeze. Open to public footpath — relaxed atmosphere.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": {"open": "10:00", "close": "23:00"}, "tue": {"open": "10:00", "close": "23:00"}, "wed": {"open": "10:00", "close": "23:00"}, "thu": {"open": "10:00", "close": "23:00"}, "fri": {"open": "10:00", "close": "00:00"}, "sat": {"open": "10:00", "close": "00:00"}, "sun": {"open": "10:00", "close": "22:00"}}',
  'Mo-Su 10:00-23:00',
  NULL,
  NULL,
  3.95, 88,
  1,
  'none'
);

INSERT INTO venues (
  name, slug, category, subcategories, description, address,
  lat, lng, outdoor_seating, outdoor_seating_notes,
  has_rooftop, is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level, building_data_quality
) VALUES (
  'Jardí de ses Bruixes',
  'jardi-de-ses-bruixes',
  'bar',
  ARRAY['terrace'],
  'Atmospheric garden bar hidden in a courtyard in the old town. Plants, fairy lights, and good cocktails in a bohemian outdoor setting.',
  'Carrer de Zavellà, 17, Palma',
  39.5703, 2.6468,
  'confirmed',
  'Enclosed garden courtyard, partly canopied. South-west light; sunny from around 14:00 to 18:00 in summer. Very sheltered from wind.',
  FALSE,
  TRUE,
  'manual',
  '{"mon": null, "tue": null, "wed": {"open": "18:00", "close": "01:00"}, "thu": {"open": "18:00", "close": "01:00"}, "fri": {"open": "18:00", "close": "02:00"}, "sat": {"open": "17:00", "close": "02:00"}, "sun": {"open": "17:00", "close": "00:00"}}',
  'We-Th 18:00-01:00; Fr 18:00-02:00; Sa 17:00-02:00; Su 17:00-00:00',
  NULL,
  NULL,
  4.55, 310,
  2,
  'with_height'
);

-- ============================================
-- SECTION 2: PARK ZONES (Parc de la Mar)
-- ============================================

-- We need to reference the Parc de la Mar venue ID:
DO $$
DECLARE
  parc_la_mar_id UUID;
  parc_ses_estacions_id UUID;
BEGIN

  SELECT id INTO parc_la_mar_id FROM venues WHERE slug = 'parc-de-la-mar';
  SELECT id INTO parc_ses_estacions_id FROM venues WHERE slug = 'parc-de-ses-estacions';

  -- Zone 1: Main lakeside benches (south-facing row)
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_la_mar_id,
    'Parc de la Mar — South Lakeside Benches',
    'bench',
    39.5665, 2.6497,
    'Row of stone benches along the south edge of the artificial lake. Completely open sky with full-day sun and direct views of the Cathedral facade reflecting in the water. The best sun spot in the park.',
    TRUE, TRUE
  );

  -- Zone 2: Cathedral viewpoint terrace (elevated platform)
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_la_mar_id,
    'Parc de la Mar — Cathedral Viewpoint Platform',
    'viewpoint',
    39.5668, 2.6504,
    'Raised stone viewing platform at the east end of the park with the best frontal view of La Seu Cathedral. South-facing, all-day sun except for early morning shadow cast by the cathedral walls behind.',
    TRUE, TRUE
  );

  -- Zone 3: West lawn area (open grass)
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_la_mar_id,
    'Parc de la Mar — West Lawn',
    'lawn',
    39.5672, 2.6488,
    'Wide open grassed area on the western side of the park. Full southern exposure with no obstructions. Popular for sunbathing and picnics. Adjacent to the park café kiosk.',
    TRUE, TRUE
  );

  -- Zone 4: Amphitheatre steps (open-air seating)
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_la_mar_id,
    'Parc de la Mar — Amphitheatre Steps',
    'zone',
    39.5667, 2.6512,
    'Open-air amphitheatre terracing at the east end of the park. Stone seating steps face south-west and catch the afternoon sun perfectly. Often used for informal gatherings and live performances in summer.',
    TRUE, TRUE
  );

  -- Zone 5: North wall benches (under Cathedral ramparts)
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_la_mar_id,
    'Parc de la Mar — Cathedral Wall Benches',
    'bench',
    39.5674, 2.6500,
    'Benches set against the ancient cathedral walls at the north edge of the park. Shaded in the morning by the wall, but receive good afternoon sun from the south. Sheltered from north wind.',
    TRUE, TRUE
  );

  -- Parc de ses Estacions zones

  -- Zone 1: South sunny bench row
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_ses_estacions_id,
    'Parc de ses Estacions — South Sunny Benches',
    'bench',
    39.5744, 2.6500,
    'Row of benches along the southern perimeter of the park facing the street. Fully exposed to southern sun from mid-morning onwards. Good for a lunch break in the sun.',
    TRUE, TRUE
  );

  -- Zone 2: Central fountain plaza
  INSERT INTO park_zones (
    parent_venue_id, name, zone_type,
    lat, lng, description, is_curated, is_active
  ) VALUES (
    parc_ses_estacions_id,
    'Parc de ses Estacions — Fountain Plaza',
    'plaza',
    39.5748, 2.6504,
    'Open circular plaza around the park''s ornamental fountain. Partially shaded by surrounding trees from mid-afternoon. Good morning and midday sun. Pleasant microclimate with fountain mist on hot days.',
    TRUE, TRUE
  );

END $$;

-- ============================================
-- SECTION 3: VERIFICATION QUERY
-- ============================================

-- Summary counts (comment out if not needed)
-- SELECT
--   (SELECT COUNT(*) FROM venues WHERE is_curated = TRUE) AS curated_venues,
--   (SELECT COUNT(*) FROM park_zones WHERE is_curated = TRUE) AS curated_zones;
