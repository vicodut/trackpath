import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

// The Railway project also hosts unrelated apps (calibre-wa, ghost, MySQL, livetrack2,
// bridgeStatus). This partial owns only trackpath's resources; anything not declared here
// is left alone. See docs/adr/0001-railway-infrastructure-as-code.md.
export const partial = "trackpath";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 500 });
  const trackpath = service("trackpath", {
    source: github("vicodut/trackpath", { branch: "main", checkSuites: false, rootDirectory: "/" }),
    build: { builder: "RAILPACK", watchPatterns: ["/trackpath/**"] },
    replicas: { "us-west2": 1 },
    domains: ["vico.camp"],
    env: {
      ADMIN_EMAILS: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      DATABASE_URL: Postgres.env.DATABASE_URL,
      GITHUB_CLIENT_ID: preserve(),
      GITHUB_CLIENT_SECRET: preserve(),
      MAPSHARE_ID: preserve(),
      POLL_INTERVAL_MIN: preserve(),
      STRAVA_CLIENT_ID: preserve(),
      STRAVA_CLIENT_SECRET: preserve(),
    },
  });

  return project("stunning-manifestation", {
    resources: [Postgres, postgresVolume, trackpath],
  });
});
