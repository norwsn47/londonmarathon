-- Seed official course markers
INSERT OR IGNORE INTO official_markers (id, title, description, distance_km, lat, lng, sort_order) VALUES
  ('start',        'Start Line',    'Blackheath — Championship & Mass start', 0,         51.4730,  0.0034,  0),
  ('km10',         '10 km',         'Deptford / New Cross area',              10,        51.4830, -0.0028,  1),
  ('tower-bridge', 'Tower Bridge',  '~20 km — iconic crossing',               20,        51.5056, -0.0754,  2),
  ('half',         'Half Marathon', '21.1 km',                                21.0975,   51.5094, -0.0610,  3),
  ('km30',         '30 km',         'Isle of Dogs / Docklands',               30,        51.5050, -0.0224,  4),
  ('km40',         '40 km',         'Embankment — nearly there!',             40,        51.5057, -0.1228,  5),
  ('finish',       'Finish Line',   'The Mall',                               42.195,    51.5032, -0.1374,  6);

-- Seed spectator spots
INSERT OR IGNORE INTO spectator_spots (id, name, description, distance_km, distance_mile, lat, lng, nearest_stations, crowd_notes, sort_order) VALUES
  (
    'cutty-sark',
    'Cutty Sark, Greenwich',
    'One of the most atmospheric points on the route, ringed by the Old Royal Naval College and packed with charity cheer zones. An official accessible viewing area.',
    10.4, 6.5,
    51.4829, -0.0097,
    '["Greenwich NR/DLR","Deptford Overground","Maze Hill NR","Island Gardens DLR"]',
    'Very busy — arrive early. Avoid Cutty Sark DLR (queues up to 90 mins). Walk from Greenwich, Deptford or Maze Hill instead.',
    0
  ),
  (
    'rotherhithe',
    'Rotherhithe Peninsula',
    'A quieter double-view spot: stand on Redriff Road at ~mile 9, walk 800 m, and catch your runner again at ~mile 11 as the route loops the peninsula.',
    14.5, 9.0,
    51.4950, -0.0465,
    '["Canada Water (Jubilee + Overground)","Surrey Quays Overground","Rotherhithe Overground"]',
    'Noticeably quieter than Cutty Sark or Tower Bridge. Canada Water busy — Bermondsey (Jubilee) is calmer. Double-view possible with short walk.',
    1
  ),
  (
    'tower-bridge',
    'Tower Bridge',
    'The most iconic moment on the route. From the north bank you see runners cross at ~mile 12.5 outbound and return at ~mile 22.5 — two passes from one spot.',
    20.1, 12.5,
    51.5055, -0.0753,
    '["London Bridge NR/Jubilee/Northern","Tower Gateway DLR","Tower Hill Circle/District"]',
    'Very busy — arrive early for a barrier spot. Avoid Tower Hill station (extremely congested). Use London Bridge and walk along Tooley Street. Double-view at miles 12.5 and 22.5.',
    2
  ),
  (
    'east-smithfield',
    'East Smithfield — Tower of London',
    'The route passes here outbound (~mile 13) and on the return (~mile 22), giving two views opposite the Tower of London from a single official accessible viewing area.',
    20.9, 13.0,
    51.5083, -0.0710,
    '["Tower Gateway DLR","Tower Hill Circle/District","Cannon Street NR"]',
    'Avoid Tower Hill (extremely busy at mile 22–23). Use Tower Gateway DLR or Cannon Street. Double-view at ~miles 13 and 22.',
    3
  ),
  (
    'canary-wharf',
    'Canary Wharf — Cabot Square',
    'Wide Docklands pavements and a more relaxed atmosphere than earlier spots. South Colonnade and Cabot Square give great sightlines into the Isle of Dogs loop.',
    29.8, 18.5,
    51.5032, -0.0200,
    '["Heron Quays DLR","South Quay DLR","Canary Wharf Elizabeth/Jubilee"]',
    'Moderate crowds; wide pavements. Canary Wharf station may temporarily close — use Heron Quays DLR as backup. Good for families.',
    4
  ),
  (
    'rainbow-row',
    'Rainbow Row, Limehouse',
    'An official LGBTQIA+ cheer zone along Butcher Row — just past mile 21, the critical point where crowd noise has the most impact on runners hitting the wall.',
    33.8, 21.0,
    51.5106, -0.0417,
    '["Westferry DLR","Shadwell DLR/Overground","Poplar DLR"]',
    'Avoid Limehouse station (queues up to 90 mins). Approach on foot via Cable Street from Shadwell or Westferry DLR. Official accessible viewing area.',
    5
  ),
  (
    'embankment',
    'Victoria Embankment',
    'A long straight stretch with DJs and bands, fewer than 2 miles from the finish. Crowds are spread over 1.5 km so it''s less claustrophobic than Tower Bridge.',
    39.4, 24.5,
    51.5085, -0.1203,
    '["Embankment District/Circle/Bakerloo","Temple District/Circle","Blackfriars Circle/District/NR"]',
    'Westminster station is exit-only from 7 am on race day — do not plan to arrive there. Use Embankment, Temple or Blackfriars.',
    6
  ),
  (
    'the-mall',
    'The Mall — Finish Straight',
    'The iconic finish. Spectators on the St James''s Park side of Birdcage Walk see the decisive final turn. Post-race meeting points at Horse Guards Road are labelled A–Z by surname initial.',
    41.8, 26.0,
    51.5045, -0.1343,
    '["St James''s Park District/Circle","Charing Cross NR/Bakerloo/Northern","Embankment District/Circle/Bakerloo"]',
    'Most densely packed point on race day — arrive very early. St James''s Park south side slightly less hectic than The Mall north side. Mobile signal often unreliable.',
    7
  );
