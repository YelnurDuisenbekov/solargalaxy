import { googleMapsSearchUrl } from '../utils/maps';

export default function AddressMapsLink({ city, address, label = 'Открыть в Google Maps', className }) {
  const url = googleMapsSearchUrl(city, address);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className || 'app-maps-link'}
    >
      {label}
    </a>
  );
}
