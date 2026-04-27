-- Add instagram_url column
ALTER TABLE venues ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Fix known incorrect coordinates
UPDATE venues SET lat = 39.5706, lng = 2.6491 WHERE slug = 'nakar-hotel-rooftop';
UPDATE venues SET lat = 39.5699, lng = 2.6492 WHERE slug = 'bar-bosch-palma';
UPDATE venues SET lat = 39.5698, lng = 2.6428 WHERE slug = 'es-baluard-terrace';
UPDATE venues SET lat = 39.5714, lng = 2.6501 WHERE slug = 'hotel-almudaina-rooftop';
UPDATE venues SET lat = 39.5675, lng = 2.6505 WHERE slug = 'mirador-de-la-seu';
UPDATE venues SET lat = 39.5661, lng = 2.6513 WHERE slug = 'parc-de-la-mar';

-- Add Instagram URLs
UPDATE venues SET instagram_url = 'https://www.instagram.com/nakarhotel/' WHERE slug = 'nakar-hotel-rooftop';
UPDATE venues SET instagram_url = 'https://www.instagram.com/grupocappuccino/' WHERE slug = 'grand-cafe-cappuccino-born';
UPDATE venues SET instagram_url = 'https://www.instagram.com/tastclub/' WHERE slug = 'tast-club-palma';
UPDATE venues SET instagram_url = 'https://www.instagram.com/portixol_hotel/' WHERE slug = 'restaurante-portixol';
UPDATE venues SET instagram_url = 'https://www.instagram.com/esbaluardmuseu/' WHERE slug = 'es-baluard-terrace';

-- Confirm results
SELECT slug, lat, lng, instagram_url FROM venues ORDER BY slug;
