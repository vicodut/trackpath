export interface ClassifiableHike {
  id: number;
  startDate: string;
  endDate: string | null;
  trailCoords: [number, number][];
}

export interface ClassificationResult {
  hikeId: number;
  /** Ids of other candidate hikes whose date range also matched but lost on trail proximity. */
  nearMisses: number[];
}
