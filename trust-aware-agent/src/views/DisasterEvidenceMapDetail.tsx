import { useEffect, useMemo, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { LiveCallLoading, ProjectDetailFrame, VerificationStamp } from '../components/ProjectDetailFrame';
import { callVerifiedListing, downloadJson } from '../lib';
import type { ListingCallSpec, VerifiedCall } from '../lib';
import { haversineKilometers } from '../lib/useCases';

const WATCH_RADIUS_KM = 1500;

const EONET_SPEC: ListingCallSpec = {
  id: 'eonet',
  name: 'NASA EONET',
  url: 'https://airnode-eonet.fly.dev/',
  operation: 'getEvents',
  address: '0x84A69892825178Fb1602fb78412E21728efee6a6',
  provenance: 'third-party',
  parameters: { status: 'open', limit: '8', days: '30' },
};

const USGS_SPEC: ListingCallSpec = {
  id: 'usgs',
  name: 'USGS',
  url: 'https://airnode-usgs.fly.dev/',
  operation: 'queryEvents',
  address: '0x5aF744115e2577513D878D4263Db73b3E77E7630',
  provenance: 'third-party',
  parameters: { format: 'geojson', minmagnitude: '5.5', limit: '8', orderby: 'magnitude' },
};

const GEODB_SPEC: ListingCallSpec = {
  id: 'geodb',
  name: 'GeoDB',
  url: 'https://airnode-geodb.fly.dev/',
  operation: 'city',
  address: '0xBeA7EB5366e0260664Ff8d96362588F0313e395F',
  provenance: 'third-party',
  parameters: { cityId: 'Q1490', languageCode: 'en', asciiMode: 'false' },
};

interface EonetData {
  events?: Array<{
    id: string;
    title: string;
    categories?: Array<{ id: string; title: string }>;
    geometry?: Array<{
      coordinates?: [number, number];
      date?: string;
      magnitudeValue?: number;
      magnitudeUnit?: string;
    }>;
  }>;
}

interface UsgsData {
  features?: Array<{
    id: string;
    properties?: { title?: string; mag?: number; alert?: string | null; time?: number };
    geometry?: { coordinates?: [number, number, number?] };
  }>;
}

interface GeoDbData {
  data?: {
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    population?: number;
  };
}

interface EvidenceMarker {
  id: string;
  title: string;
  kind: 'watch-area' | 'natural-event' | 'earthquake';
  sourceId: 'geodb' | 'eonet' | 'usgs';
  source: string;
  latitude: number;
  longitude: number;
  detail: string;
  distanceKm: number;
  alert: boolean;
}

function markerColor(marker: EvidenceMarker): string {
  if (marker.alert) return '#8b423a';
  if (marker.kind === 'watch-area') return '#355b42';
  if (marker.kind === 'earthquake') return '#815d2e';
  return '#607568';
}

function FitMapToEvidence({ markers }: { markers: EvidenceMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;
    map.invalidateSize();
    map.fitBounds(
      markers.map((marker) => [marker.latitude, marker.longitude] as [number, number]),
      { padding: [34, 34], maxZoom: 5 },
    );
  }, [map, markers]);

  return null;
}

export function DisasterEvidenceMapDetail() {
  const [calls, setCalls] = useState<VerifiedCall[]>([]);
  const [markers, setMarkers] = useState<EvidenceMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? null;
  const selectedCall = calls.find((call) => call.spec.id === selectedMarker?.sourceId) ?? null;
  const alerts = markers.filter((marker) => marker.alert);
  const watchArea = markers.find((marker) => marker.kind === 'watch-area') ?? null;

  const evidencePack = useMemo(() => calls.length !== 3 ? null : {
    schemaVersion: '1.0',
    type: 'airnodehub.disaster-evidence-map',
    createdAt: new Date().toISOString(),
    rule: {
      watchArea: 'Tokyo, Japan',
      radiusKilometers: WATCH_RADIUS_KM,
      eventPolicy: 'USGS magnitude >= 6 or active NASA natural event',
    },
    inputs: calls,
    derivedMarkers: markers,
  }, [calls, markers]);

  async function scanEvents() {
    setRunning(true);
    setError('');
    setCalls([]);
    setMarkers([]);
    setSelectedMarkerId(null);

    try {
      const [eonet, usgs, geodb] = await Promise.all([
        callVerifiedListing<EonetData>(EONET_SPEC),
        callVerifiedListing<UsgsData>(USGS_SPEC),
        callVerifiedListing<GeoDbData>(GEODB_SPEC),
      ]);
      const city = geodb.attestation.data.data;
      if (
        !city ||
        typeof city.latitude !== 'number' ||
        typeof city.longitude !== 'number'
      ) {
        throw new Error('GeoDB did not return the pinned watch area.');
      }

      const origin = { latitude: city.latitude, longitude: city.longitude };
      const cityMarker: EvidenceMarker = {
        id: 'watch-tokyo',
        title: `${city.name ?? 'Tokyo'}, ${city.country ?? 'Japan'}`,
        kind: 'watch-area',
        sourceId: 'geodb',
        source: 'GeoDB',
        latitude: city.latitude,
        longitude: city.longitude,
        detail: `${(city.population ?? 0).toLocaleString('en-US')} people · ${WATCH_RADIUS_KM.toLocaleString()} km rule`,
        distanceKm: 0,
        alert: false,
      };

      const naturalEvents: EvidenceMarker[] = (eonet.attestation.data.events ?? []).flatMap((event) => {
        const geometry = event.geometry?.at(-1);
        const coordinates = geometry?.coordinates;
        if (!coordinates || coordinates.length < 2) return [];
        const point = { longitude: coordinates[0], latitude: coordinates[1] };
        const distanceKm = haversineKilometers(origin, point);
        const category = event.categories?.[0]?.title ?? 'Natural event';
        return [{
          id: `eonet-${event.id}`,
          title: event.title,
          kind: 'natural-event' as const,
          sourceId: 'eonet' as const,
          source: 'NASA EONET',
          latitude: point.latitude,
          longitude: point.longitude,
          detail: `${category}${geometry?.magnitudeValue ? ` · ${geometry.magnitudeValue} ${geometry.magnitudeUnit ?? ''}` : ''}`,
          distanceKm,
          alert: distanceKm <= WATCH_RADIUS_KM,
        }];
      });

      const earthquakes: EvidenceMarker[] = (usgs.attestation.data.features ?? []).flatMap((feature) => {
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates || coordinates.length < 2) return [];
        const point = { longitude: coordinates[0], latitude: coordinates[1] };
        const magnitude = feature.properties?.mag ?? 0;
        const distanceKm = haversineKilometers(origin, point);
        return [{
          id: `usgs-${feature.id}`,
          title: feature.properties?.title ?? feature.id,
          kind: 'earthquake' as const,
          sourceId: 'usgs' as const,
          source: 'USGS',
          latitude: point.latitude,
          longitude: point.longitude,
          detail: `Magnitude ${magnitude.toFixed(1)} · ${feature.properties?.alert ?? 'no PAGER alert'}`,
          distanceKm,
          alert: distanceKm <= WATCH_RADIUS_KM && magnitude >= 6,
        }];
      });

      const nextMarkers = [cityMarker, ...naturalEvents, ...earthquakes];
      setCalls([eonet, usgs, geodb]);
      setMarkers(nextMarkers);
      setSelectedMarkerId(
        nextMarkers.find((marker) => marker.alert)?.id ?? cityMarker.id,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }

  return (
    <ProjectDetailFrame
      title="Disaster Evidence Map"
      tagline="Turn changing event feeds into alerts that keep the signed evidence behind every marker."
      category="Public data"
      listings="NASA +2"
      runtime="Browser-only"
      repoPath="use-cases/disaster-evidence-map/README.md"
      problem="Emergency maps often lose the exact source responses that produced a marker or alert."
      outcome="A Tokyo watch area combines independently verified event, earthquake, and city inputs."
      boundary="These relay signatures prove returned bytes and timing. They do not prove that an event happened in the physical world."
      prompt={{
        path: '/prompts/disaster-evidence-map.md',
        title: 'Ask an agent to build an alert from signed public data.',
        description: 'This prompt combines verified event, earthquake, and city responses while keeping the receipt behind every marker and alert.',
      }}
    >
      <section className="live-demo-heading" id="live-demo" aria-labelledby="disaster-demo-title">
        <h2 id="disaster-demo-title">Tokyo watch area</h2>
        <p>Alert when a strong earthquake or active NASA event falls within 1,500 km of the verified city point.</p>
      </section>

      <section className="demo-workbench disaster-workbench" aria-live="polite">
        <div className="workbench-toolbar">
          <div><strong>Pacific event scan</strong><span>8 NASA events · 8 largest recent earthquakes · GeoDB city</span></div>
          <button className="workbench-run" disabled={running} onClick={scanEvents} type="button">
            {running ? 'Verifying event feeds…' : 'Scan signed event feeds'}
          </button>
        </div>

        {running && (
          <LiveCallLoading
            title="Building the map from three signed feeds"
            detail="Event, earthquake, and city responses are arriving independently. The map unlocks only when all three pass local verification."
            sources={['NASA EONET', 'USGS', 'GeoDB']}
          />
        )}

        {!running && !calls.length && !error && (
          <div className="workbench-empty">
            <span className="empty-glyph">⌖</span>
            <strong>No unsigned marker enters this map</strong>
            <p>The map appears only after all three live responses pass request, signer, signature, and freshness checks.</p>
          </div>
        )}
        {error && <div className="workbench-error"><strong>Scan stopped</strong><span>{error}</span></div>}

        {calls.length === 3 && (
          <div className="evidence-map-layout" id="evidence">
            <div className="evidence-map">
              <MapContainer
                center={[35.689444444, 139.691666666]}
                className="leaflet-evidence-map"
                minZoom={2}
                scrollWheelZoom
                worldCopyJump
                zoom={3}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={19}
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitMapToEvidence markers={markers} />
                {watchArea && (
                  <Circle
                    center={[watchArea.latitude, watchArea.longitude]}
                    pathOptions={{
                      color: '#355b42',
                      dashArray: '6 7',
                      fillColor: '#355b42',
                      fillOpacity: 0.06,
                      weight: 1.5,
                    }}
                    radius={WATCH_RADIUS_KM * 1000}
                  />
                )}
                {markers.map((marker) => {
                  const color = markerColor(marker);
                  return (
                    <CircleMarker
                      center={[marker.latitude, marker.longitude]}
                      eventHandlers={{ click: () => setSelectedMarkerId(marker.id) }}
                      key={marker.id}
                      pathOptions={{
                        color: 'white',
                        fillColor: color,
                        fillOpacity: 0.94,
                        opacity: 1,
                        weight: selectedMarker?.id === marker.id ? 3 : 2,
                      }}
                      radius={selectedMarker?.id === marker.id ? 10 : marker.alert ? 8 : 6}
                    >
                      <Popup>
                        <strong>{marker.title}</strong>
                        <span>{marker.source} · {Math.round(marker.distanceKm).toLocaleString()} km from Tokyo</span>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
              <div className={`map-alert-summary ${alerts.length ? 'has-alerts' : ''}`}>
                <i>{alerts.length ? '!' : '✓'}</i>
                <span><strong>{alerts.length ? `${alerts.length} trusted alerts` : 'No events crossed the rule'}</strong><small>Derived only from {calls.length} verified receipts</small></span>
              </div>
              <div className="map-legend" aria-hidden="true">
                <span><i className="is-city" />Watch area</span>
                <span><i className="is-event" />Natural event</span>
                <span><i className="is-quake" />Earthquake</span>
              </div>
            </div>

            <aside className="marker-inspector">
              {selectedMarker && selectedCall && (
                <>
                  <span>{selectedMarker.source}</span>
                  <h3>{selectedMarker.title}</h3>
                  <p>{selectedMarker.detail}</p>
                  <dl>
                    <div><dt>Distance to Tokyo</dt><dd>{Math.round(selectedMarker.distanceKm).toLocaleString()} km</dd></div>
                    <div><dt>Rule result</dt><dd>{selectedMarker.alert ? 'Alert created' : selectedMarker.kind === 'watch-area' ? 'Watch origin' : 'Outside threshold'}</dd></div>
                    <div><dt>Coordinates</dt><dd>{selectedMarker.latitude.toFixed(3)}, {selectedMarker.longitude.toFixed(3)}</dd></div>
                  </dl>
                  <VerificationStamp ageSeconds={selectedCall.verification.ageSeconds} provenance="third-party" />
                  <details>
                    <summary>View signed receipt</summary>
                    <pre>{JSON.stringify(selectedCall, null, 2)}</pre>
                  </details>
                </>
              )}
            </aside>
          </div>
        )}

        {evidencePack && (
          <div className="evidence-export">
            <div><strong>Alert evidence pack</strong><span>Three signed inputs, the geofence rule, and every derived marker.</span></div>
            <button onClick={() => downloadJson('disaster-evidence-pack.json', evidencePack)} type="button">Download evidence pack</button>
          </div>
        )}
      </section>
    </ProjectDetailFrame>
  );
}
