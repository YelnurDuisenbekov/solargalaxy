import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import ConstructorGoogleMap from './ConstructorGoogleMap';
import ConstructorMap from './ConstructorMap';

/** Google Maps при наличии ключа, иначе бесплатный Leaflet/OSM */
export default function ConstructorMapView(props) {
  const { ready, hasKey, error } = useGoogleMaps();

  if (hasKey && !ready && !error) {
    return (
      <div className="constructor-map-wrap">
        <div className="constructor-map constructor-map--loading">Загрузка Google Maps…</div>
      </div>
    );
  }

  if (hasKey && ready) {
    return <ConstructorGoogleMap {...props} mapType={props.mapStyle || 'hybrid'} />;
  }

  return (
    <>
      {!hasKey && (
        <p className="constructor-map-fallback-note">
          Спутник Esri (бесплатный режим). Для детального снимка в городах задайте{' '}
          <code>VITE_GOOGLE_MAPS_API_KEY</code> в Vercel.
        </p>
      )}
      <ConstructorMap {...props} />
    </>
  );
}
