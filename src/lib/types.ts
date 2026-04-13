export type Unit = 'km' | 'mile';
export type Strategy = 'even' | 'negative' | 'custom';
export type NegativePct = 1 | 3 | 5;

export interface Segment {
  id: number;
  label: string;
  distanceKm: number;
  paceSecPerKm: number;
}

export interface CourseMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  type: 'official' | 'user';
  created_by?: string; // user id
}
