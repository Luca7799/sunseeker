-- Coordinate corrections verified via OpenStreetMap Nominatim geocoding
-- Run this in Supabase SQL Editor

-- Nakar Hotel: Avinguda de Jaume III, 21 (was placed ~400m off)
UPDATE venues SET lat = 39.5719, lng = 2.6453 WHERE slug = 'nakar-hotel-rooftop';

-- Es Baluard museum terrace: Plaça Porta de Santa Catalina (longitude was ~280m too far east)
UPDATE venues SET lat = 39.5702, lng = 2.6410 WHERE slug = 'es-baluard-terrace';

-- Bar Abaco: Carrer Sant Joan, old town (longitude corrected)
UPDATE venues SET lat = 39.5690, lng = 2.6452 WHERE slug = 'abaco-cocktail-bar';

-- Parc de la Mar: seafront park below the cathedral
UPDATE venues SET lat = 39.5659, lng = 2.6485 WHERE slug = 'parc-de-la-mar';

-- Mercat de Santa Catalina: the actual market building (was ~330m too far east)
UPDATE venues SET lat = 39.5712, lng = 2.6383 WHERE slug = 'mercat-santa-catalina-bar-flexas';

-- El Pesquero: port-side restaurant (latitude and longitude both corrected)
UPDATE venues SET lat = 39.5686, lng = 2.6422 WHERE slug = 'el-pesquero-palma';

-- Tast Club: verified location in central Palma
UPDATE venues SET lat = 39.5715, lng = 2.6480 WHERE slug = 'tast-club-palma';

-- Bar Bosch: Plaça del Rei Joan Carles I (same plaza as Cappuccino Born)
UPDATE venues SET lat = 39.5687, lng = 2.6490 WHERE slug = 'bar-bosch-palma';

-- Confirm all current positions
SELECT name, slug, lat, lng FROM venues ORDER BY name;
