import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import QuestoesList from "./features/questoes/pages/QuestoesList";
import QuestoesNova from "./features/questoes/pages/QuestoesNova";
import ProtectedRoute from "./auth/ProtectedRoute";
import QuestaoDetalhe from "./features/questoes/pages/QuestaoDetalhe"; 
import QuestaoEditar from "./features/questoes/pages/QuestaoEditar";
import CadernosList from "./pages/CadernosList";
import OfertasList from "./pages/OfertasList";
import Gabaritos from "./pages/Gabaritos";
import Relatorios from "./pages/Relatorios";
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
        <Route path="/ofertas" element={<OfertasList />} />
        <Route path="/gabaritos" element={<Gabaritos />} />
        <Route path="/relatorios" element={<Relatorios />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
