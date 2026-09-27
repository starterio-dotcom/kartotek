import { Routes, Route, useParams } from 'react-router-dom';
import { Elrendezes } from './komponens/Elrendezes';
import { Attekintes } from './nezet/Attekintes';
import { Kartotek } from './nezet/Kartotek';
import { Dosszie } from './nezet/Dosszie';
import { Riportok } from './nezet/Riportok';
import { Kiadasok } from './nezet/Kiadasok';
import { Felhasznalok } from './nezet/Felhasznalok';
import { AuditNaplo } from './nezet/AuditNaplo';

/**
 * Elemenként FRISS kartoték-példány: a választott verzió, az összevetés és a nyitott
 * szerkesztő állapota nem szivároghat át egyik elemről a másikra (különben a szerkesztő
 * az előző elem mezőivel maradhatna nyitva a másik elem alatt).
 */
function ElemKartotek() {
  const { id } = useParams<{ id: string }>();
  return <Kartotek key={id} />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Elrendezes />}>
        <Route index element={<Attekintes />} />
        <Route path="elem/:id" element={<ElemKartotek />} />
        <Route path="dosszie" element={<Dosszie />} />
        <Route path="riportok" element={<Riportok />} />
        <Route path="kiadasok" element={<Kiadasok />} />
        <Route path="felhasznalok" element={<Felhasznalok />} />
        <Route path="audit" element={<AuditNaplo />} />
        {/* A gráfot az Elrendezes közvetlenül rendeli (teljes szélességben). */}
        <Route path="graf" element={null} />
      </Route>
    </Routes>
  );
}
