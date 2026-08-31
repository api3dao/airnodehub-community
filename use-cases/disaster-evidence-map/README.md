# Disaster Evidence Map

**Status:** Working  
**Category:** Public data  
**Artifact:** Interactive map

## Problem

Emergency maps combine fast-changing event and location data, but the inputs behind a marker or alert are often lost after the screen updates.

## Outcome

Attach the exact signed event and location responses to every map marker and generated alert, so another system can inspect the evidence that produced it.

## Airnode listings

- NASA EONET — natural-event context.
- USGS — earthquake and geological-event data.
- GeoDB — cities and geospatial context.

These are currently relayed listings. Their attestations prove which relay returned the response, not that API3 is the original producer of the upstream data.

## Trust pattern

Event calls → geofence → source receipts → alert evidence pack.

## Implemented flow

1. Discover and call active event operations.
2. Verify each event response locally.
3. Resolve nearby population centres or administrative areas.
4. Apply a documented geofence or distance rule.
5. Render the marker and retain every underlying receipt.
6. Export an alert evidence pack without claiming that attestation alone proves the real-world event.

The first implementation deliberately uses one location rule: a GeoDB-signed Tokyo point and a 1,500 km radius. It combines the latest active NASA EONET events with the largest recent USGS earthquakes and creates an alert only after all three inputs verify.

The interactive map uses React Leaflet 5 with Leaflet 1.9.4 and OpenStreetMap tiles. Tile attribution remains visible inside the map. The library, tiles, and Airnode calls all run directly in the browser; there is no map proxy or application backend.

## Run it

```sh
cd site
pnpm install
pnpm dev
```

Open `http://localhost:5173/?project=disaster-evidence-map`.

## Acceptance

- Every marker exposes its source receipts and verification state.
- Stale or invalid responses cannot create a trusted alert.
- The geospatial derivation is reproducible from the preserved inputs.
- Live failures are shown without inventing trusted markers or alerts.

## Contribution scope

Notifications, accounts, operational-response claims, and automated emergency actions remain out of scope.
