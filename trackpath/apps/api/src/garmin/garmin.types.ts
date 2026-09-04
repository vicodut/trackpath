// ---------------------------------------------------------------------------
// Raw KML shapes produced by xml2js (explicitArray: false)
// Garmin's MapShare feed wraps every custom field in ExtendedData/Data nodes.
// ---------------------------------------------------------------------------

export interface KmlDataEntry {
  $: { name: string };
  value: string;
}

export interface KmlExtendedData {
  Data?: KmlDataEntry | KmlDataEntry[];
}

export interface KmlPoint {
  coordinates?: string; // "lon,lat,alt"
}

export interface KmlPlacemark {
  Point?: KmlPoint;
  ExtendedData?: KmlExtendedData;
  description?: string;
}

export interface KmlFolder {
  Placemark?: KmlPlacemark | KmlPlacemark[];
}

export interface KmlDocument {
  Folder?: KmlFolder;
  Placemark?: KmlPlacemark | KmlPlacemark[];
}

export interface KmlRoot {
  kml?: {
    Document?: KmlDocument;
  };
}

// ---------------------------------------------------------------------------
// Flat map of the device's ExtendedData fields after normalisation
// ---------------------------------------------------------------------------
export interface GarminExtData {
  Id?: string;
  'Time UTC'?: string;
  Elevation?: string;
  Velocity?: string;
  Course?: string;
  Text?: string;
  Event?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Sync state kept in memory by the service
// ---------------------------------------------------------------------------
export interface SyncStatus {
  time: string | null;
  newCount: number;
  error: string | null;
}

export interface SyncLog {
  source: 'garmin';
  time: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Request body for manual point creation — validated in the service
// ---------------------------------------------------------------------------
export interface ManualPointBody {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  message?: string | null;
  tag?: string | null;
  /** Defaults to the current default hike when omitted. */
  hikeId?: number;
}
