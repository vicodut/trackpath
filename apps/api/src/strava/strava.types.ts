// ---------------------------------------------------------------------------
// Strava API wire types (shapes returned directly by Strava's REST API)
// ---------------------------------------------------------------------------

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number };
}

export interface StravaRefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface StravaActivityRaw {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  start_date: string;
}

export interface StravaStreamResponse {
  latlng?: {
    data: [number, number][];
  };
}

// ---------------------------------------------------------------------------
// Domain types used internally and returned by the service
// ---------------------------------------------------------------------------

export interface StravaSyncResult {
  synced: number;
  pruned: number;
  total: number;
}

export interface StravaSyncError {
  error: string;
}
