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

  return <ConstructorMap {...props} />;
}
