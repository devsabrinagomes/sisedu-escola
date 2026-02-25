import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import QuestoesList from "./features/questoes/pages/QuestoesList";
import QuestoesNova from "./features/questoes/pages/QuestoesNova";
import ProtectedRoute from "./auth/ProtectedRoute";
import QuestaoDetalhe from "./features/questoes/pages/QuestaoDetalhe"; 
import QuestaoEditar from "./features/questoes/pages/QuestaoEditar";
import CadernosList from "./features/cadernos/pages/CadernosList";
import CadernoNovo from "./features/cadernos/pages/CadernoNovo";
import CadernoDetalhe from "./features/cadernos/pages/CadernoDetalhe";
import CadernoEditar from "./features/cadernos/pages/CadernoEditar";
import OfertasList from "./features/ofertas/pages/OfertasList";
import OfertaNova from "./features/ofertas/pages/OfertaNova";
import OfertaDetalhe from "./features/ofertas/pages/OfertaDetalhe";
import OfertaEditar from "./features/ofertas/pages/OfertaEditar";
import GabaritosList from "./features/gabaritos/pages/GabaritosList";
import GabaritoOfertaGestao from "./features/gabaritos/pages/GabaritoOfertaGestao";
import RelatoriosList from "./features/relatorios/pages/RelatoriosList";
import RelatorioOfertaDetalhe from "./features/relatorios/pages/RelatorioOfertaDetalhe";
import Suporte from "./pages/Suporte";
import Acessibilidade from "./pages/Acessibilidade";
import Privacidade from "./pages/Privacidade";
import Ajuda from "./pages/Ajuda";
import "katex/dist/katex.min.css";


export default function App() {
  return (
    <Routes>
      {/* PÚBLICA */}
      <Route path="/login" element={<Login />} />

      {/* PRIVADAS */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/questoes" element={<QuestoesList />} />
        <Route path="/questoes/nova" element={<QuestoesNova />} />
        <Route path="/questoes/:id" element={<QuestaoDetalhe />} />
        <Route path="/questoes/:id/editar" element={<QuestaoEditar />} />
        <Route path="/cadernos" element={<CadernosList />} />
        <Route path="/cadernos/novo" element={<CadernoNovo />} />
        <Route path="/cadernos/:id" element={<CadernoDetalhe />} />
        <Route path="/cadernos/:id/editar" element={<CadernoEditar />} />
        <Route path="/ofertas" element={<OfertasList />} />
        <Route path="/ofertas/nova" element={<OfertaNova />} />
        <Route path="/ofertas/:id" element={<OfertaDetalhe />} />
        <Route path="/ofertas/:id/editar" element={<OfertaEditar />} />
        <Route path="/gabaritos" element={<GabaritosList />} />
        <Route path="/gabaritos/ofertas/:offerId" element={<GabaritoOfertaGestao />} />
        <Route path="/relatorios" element={<RelatoriosList />} />
        <Route path="/relatorios/ofertas/:offerId" element={<RelatorioOfertaDetalhe />} />
        <Route path="/suporte" element={<Suporte />} />
        <Route path="/acessibilidade" element={<Acessibilidade />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/ajuda" element={<Ajuda />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
