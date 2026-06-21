import { useAuth } from '../../context/AuthContext';
import AuctionsPage from './AuctionsPage';
import ContractorPage from './ContractorPage';

export default function AuctionsRoute({ mode = 'open' }) {
  const { isContractor } = useAuth();
  if (isContractor) {
    return <ContractorPage tab={mode === 'results' ? 'results' : 'auctions'} />;
  }
  return <AuctionsPage mode={mode} />;
}
