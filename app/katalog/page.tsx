import KatalogClient from './KatalogClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Katalog Stylu POLUTEK | Laboratorium',
  description: 'Eksperymentalna biblioteka przykładów stylu papier/cienkopis dla POLUTEK.PL',
};

export default function KatalogPage() {
  return <KatalogClient />;
}
