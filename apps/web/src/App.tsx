import { Routes, Route } from 'react-router-dom';
import { Elrendezes } from './komponens/Elrendezes';
import { Attekintes } from './nezet/Attekintes';
import { Kartotek } from './nezet/Kartotek';
import { Riportok } from './nezet/Riportok';
import { Kiadasok } from './nezet/Kiadasok';

export function App() {
  return (
    <Routes>
      <Route element={<Elrendezes />}>
        <Route index element={<Attekintes />} />
        <Route path="elem/:id" element={<Kartotek />} />
        <Route path="riportok" element={<Riportok />} />
        <Route path="kiadasok" element={<Kiadasok />} />
        {/* A gráfot az Elrendezes közvetlenül rendeli (teljes szélességben). */}
        <Route path="graf" element={null} />
      </Route>
    </Routes>
  );
}
