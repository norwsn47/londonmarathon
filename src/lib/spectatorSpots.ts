import type { Segment } from './types';

export interface SpectatorSpot {
  id: string;
  name: string;
  description: string;
  distanceMile: number;
  distanceKm: number;
  lat: number;
  lng: number;
  nearestStations: string[];
  crowdNotes: string;
  sources: string[];
}

export interface SpotPrediction extends SpectatorSpot {
  /** Seconds from gun start when runner reaches this point */
  elapsedSec: number;
  /** Wall-clock time string e.g. "10:43", or null if no start time set */
  clockTime: string | null;
}

export const SPECTATOR_SPOTS: SpectatorSpot[] = [
  {
    id: 'cutty-sark',
    name: 'Cutty Sark, Greenwich',
    description: 'One of the most atmospheric points on the route, ringed by the Old Royal Naval College and packed with charity cheer zones. An official accessible viewing area.',
    distanceMile: 6.5,
    distanceKm: 10.4,
    lat: 51.4829,
    lng: -0.0097,
    nearestStations: ['Greenwich NR/DLR', 'Deptford Overground', 'Maze Hill NR', 'Island Gardens DLR'],
    crowdNotes: 'Very busy — arrive early. Avoid Cutty Sark DLR (queues up to 90 mins). Walk from Greenwich, Deptford or Maze Hill instead.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
      'https://runready.substack.com/p/the-2025-london-marathon-course-guide-821',
    ],
  },
  {
    id: 'rotherhithe',
    name: 'Rotherhithe Peninsula',
    description: 'A quieter double-view spot: stand on Redriff Road at ~mile 9, walk 800 m, and catch your runner again at ~mile 11 as the route loops the peninsula.',
    distanceMile: 9.0,
    distanceKm: 14.5,
    lat: 51.4950,
    lng: -0.0465,
    nearestStations: ['Canada Water (Jubilee + Overground)', 'Surrey Quays Overground', 'Rotherhithe Overground'],
    crowdNotes: 'Noticeably quieter than Cutty Sark or Tower Bridge. Canada Water busy — Bermondsey (Jubilee) is calmer. Double-view possible with short walk.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
      'https://www.swlondoner.co.uk/life/23042025-the-best-london-marathon-viewing-spots-a-2025-spectators-guide',
    ],
  },
  {
    id: 'tower-bridge',
    name: 'Tower Bridge',
    description: 'The most iconic moment on the route. From the north bank you see runners cross at ~mile 12.5 outbound and return at ~mile 22.5 — two passes from one spot.',
    distanceMile: 12.5,
    distanceKm: 20.1,
    lat: 51.5055,
    lng: -0.0753,
    nearestStations: ['London Bridge NR/Jubilee/Northern', 'Tower Gateway DLR', 'Tower Hill Circle/District'],
    crowdNotes: 'Very busy — arrive early for a barrier spot. Avoid Tower Hill station (extremely congested). Use London Bridge and walk along Tooley Street. Double-view at miles 12.5 and 22.5.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
      'https://runready.substack.com/p/the-2025-london-marathon-course-guide',
      'https://www.timeout.com/london/things-to-do/where-to-watch-the-london-marathon',
    ],
  },
  {
    id: 'canary-wharf',
    name: 'Canary Wharf — Cabot Square',
    description: 'Wide Docklands pavements and a more relaxed atmosphere than earlier spots. South Colonnade and Cabot Square give great sightlines into the Isle of Dogs loop.',
    distanceMile: 18.5,
    distanceKm: 29.8,
    lat: 51.5032,
    lng: -0.0200,
    nearestStations: ['Heron Quays DLR', 'South Quay DLR', 'Canary Wharf Elizabeth/Jubilee'],
    crowdNotes: 'Moderate crowds; wide pavements. Canary Wharf station may temporarily close — use Heron Quays DLR as backup. Good for families.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
      'https://canarywharf.com/news/everything-you-need-to-enjoy-the-london-marathon-in-canary-wharf/',
    ],
  },
  {
    id: 'rainbow-row',
    name: 'Rainbow Row, Limehouse',
    description: 'An official LGBTQIA+ cheer zone along Butcher Row — just past mile 21, the critical point where crowd noise has the most impact on runners hitting the wall.',
    distanceMile: 21.0,
    distanceKm: 33.8,
    lat: 51.5106,
    lng: -0.0417,
    nearestStations: ['Westferry DLR', 'Shadwell DLR/Overground', 'Poplar DLR'],
    crowdNotes: 'Avoid Limehouse station (queues up to 90 mins). Approach on foot via Cable Street from Shadwell or Westferry DLR. Official accessible viewing area.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/article/rainbow-row-created-for-2022-tcs-london-marathon-route',
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
    ],
  },
  {
    id: 'east-smithfield',
    name: 'East Smithfield — Tower of London',
    description: 'The route passes here outbound (~mile 13) and on the return (~mile 22), giving two views opposite the Tower of London from a single official accessible viewing area.',
    distanceMile: 13.0,
    distanceKm: 20.9,
    lat: 51.5083,
    lng: -0.0710,
    nearestStations: ['Tower Gateway DLR', 'Tower Hill Circle/District', 'Cannon Street NR'],
    crowdNotes: 'Avoid Tower Hill (extremely busy at mile 22–23). Use Tower Gateway DLR or Cannon Street. Double-view at ~miles 13 and 22.',
    sources: [
      'https://www.sportonspec.co.uk/event/athletics-london-marathon/',
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
    ],
  },
  {
    id: 'embankment',
    name: 'Victoria Embankment',
    description: 'A long straight stretch with DJs and bands, fewer than 2 miles from the finish. Crowds are spread over 1.5 km so it\'s less claustrophobic than Tower Bridge.',
    distanceMile: 24.5,
    distanceKm: 39.4,
    lat: 51.5085,
    lng: -0.1203,
    nearestStations: ['Embankment District/Circle/Bakerloo', 'Temple District/Circle', 'Blackfriars Circle/District/NR'],
    crowdNotes: 'Westminster station is exit-only from 7 am on race day — do not plan to arrive there. Use Embankment, Temple or Blackfriars.',
    sources: [
      'https://www.londonmarathonevents.co.uk/london-marathon/london-marathon-spectator-guide',
      'https://strawberrytours.com/london-marathon',
    ],
  },
  {
    id: 'the-mall',
    name: 'The Mall — Finish Straight',
    description: 'The iconic finish. Spectators on the St James\'s Park side of Birdcage Walk see the decisive final turn. Post-race meeting points at Horse Guards Road are labelled A–Z by surname initial.',
    distanceMile: 26.0,
    distanceKm: 41.8,
    lat: 51.5045,
    lng: -0.1343,
    nearestStations: ['St James\'s Park District/Circle', 'Charing Cross NR/Bakerloo/Northern', 'Embankment District/Circle/Bakerloo'],
    crowdNotes: 'Most densely packed point on race day — arrive very early. St James\'s Park south side slightly less hectic than The Mall north side. Mobile signal often unreliable.',
    sources: [
      'https://runready.substack.com/p/the-2025-london-marathon-course-guide',
      'https://www.timeout.com/london/things-to-do/where-to-watch-the-london-marathon',
      'https://strawberrytours.com/london-marathon',
    ],
  },
];

/** Returns seconds elapsed from gun when the runner reaches targetKm. */
function getElapsedAtKm(segments: Segment[], targetKm: number): number {
  let remaining = targetKm;
  let elapsed = 0;
  for (const seg of segments) {
    if (remaining <= seg.distanceKm) {
      return elapsed + remaining * seg.paceSecPerKm;
    }
    elapsed += seg.distanceKm * seg.paceSecPerKm;
    remaining -= seg.distanceKm;
  }
  return elapsed;
}

/**
 * Given a runner's gun start time and pace segments, returns predicted
 * wall-clock arrival time at each spectator spot.
 *
 * @param startTime - when the runner crosses the start line (null = no prediction)
 * @param segments  - pace plan from the app
 */
export function predictSpotTimes(
  startTime: Date | null,
  segments: Segment[],
): SpotPrediction[] {
  return SPECTATOR_SPOTS.map(spot => {
    const elapsedSec = getElapsedAtKm(segments, spot.distanceKm);
    let clockTime: string | null = null;
    if (startTime) {
      const arrival = new Date(startTime.getTime() + elapsedSec * 1000);
      clockTime = arrival.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return { ...spot, elapsedSec, clockTime };
  });
}
