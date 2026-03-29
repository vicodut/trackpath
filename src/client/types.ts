export interface TrackingPoint {
  id: number;
  garminId: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: string;
  velocity: number | null;
  course: number | null;
  message: string | null;
  eventType: string | null;
  createdAt: string | null;
  calculatedSpeedKmh?: number | null;
}

export interface StravaActivity {
  id: number;
  stravaId: number;
  name: string | null;
  type: string | null;
  distance: number | null;
  movingTime: number | null;
  elevationGain: number | null;
  startDate: string | null;
  coords: string | null;
}

export interface SyncResult {
  synced: number;
  total: number;
  points: TrackingPoint[];
}
