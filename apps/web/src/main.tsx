import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './allapot/auth';
import { uzenet, UzenetSav } from './allapot/uzenetek';
import { hibaSzoveg } from './api/hibaSzoveg';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
  // Biztonsági háló: minden sikertelen módosítás látható, olvasható hibát ad — kivéve, ha a
  // komponens maga jeleníti meg helyben (`meta: { helyiHiba: true }`, pl. dialógusban).
  mutationCache: new MutationCache({
    onError: (hiba, _be, _ctx, mutacio) => {
      if (!mutacio.meta?.helyiHiba) uzenet.hiba(hibaSzoveg(hiba));
    },
  }),
});

// Adat-router (a `useBlocker` — mentetlen szerkesztés védelme — csak ebben működik);
// az útvonalakat továbbra is az <App> <Routes>-a írja le.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
  },
]);

const rootElem = document.getElementById('root');
if (!rootElem) throw new Error('Hiányzik a #root elem');

createRoot(rootElem).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <UzenetSav />
    </QueryClientProvider>
  </StrictMode>,
);
