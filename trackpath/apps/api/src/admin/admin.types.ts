export interface AdminStatus {
  garmin: {
    configured: boolean;
    mapshareId: string | null;
    totalPoints: number;
    lastPointTime: string | null;
    pollIntervalMin: number;
  };
  strava: {
    connected: boolean;
    athleteId: string | null;
    totalActivities: number;
    lastActivityDate: string | null;
    lastActivityName: string | null;
  };
  logs: Array<{ source: string; time: string; message: string }>;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  } | null;
  isAdmin: boolean;
}
