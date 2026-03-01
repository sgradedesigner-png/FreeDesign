import { useParams } from 'react-router-dom';
import { WizardContainer } from '@/components/product-wizard/WizardContainer';

export default function ProductWizardPage() {
  const { id } = useParams<{ id: string }>();

  console.log('🧙 ProductWizardPage rendering with id:', id);
  console.log('🧙 Current pathname:', window.location.pathname);

  return <WizardContainer productId={id} />;
}
