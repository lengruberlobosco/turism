import { Link, useOutletContext } from "react-router-dom";
import { Users, ListChecks, Siren, BookOpen, Settings, FileInput, ChevronRight } from "lucide-react";
import type { Trip, TripDay, CurrentDayResult } from "@turism/domain";

type Ctx = { trip: Trip; days: TripDay[]; current: CurrentDayResult<TripDay> };

export const MORE_LINKS = [
  { to: "emergency", icon: Siren, label: "Emergência", hint: "Contatos, seguro, tipo sanguíneo — offline" },
  { to: "travelers", icon: Users, label: "Viajantes e acerto de contas", hint: "Quem pagou o quê, quem deve a quem" },
  { to: "checklists", icon: ListChecks, label: "Checklists", hint: "Mala, fronteira, veículo e por dia" },
  { to: "book", icon: BookOpen, label: "Livro da viagem", hint: "Relato imprimível com fotos e planilha" },
  { to: "import", icon: FileInput, label: "Importar roteiro", hint: "Adicionar dias a partir de texto ou PDF" },
];

export function MorePage() {
  const { trip } = useOutletContext<Ctx>();
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 grid gap-2">
      <h1 className="text-xl font-semibold mb-1">{trip.title}</h1>
      {MORE_LINKS.map((l) => (
        <Link key={l.to} to={`../${l.to}`} className="card flex items-center gap-3 hover:border-accent/60">
          <l.icon size={20} className="text-accent" />
          <div className="flex-1"><p className="font-medium">{l.label}</p><p className="text-xs text-slate-400">{l.hint}</p></div>
          <ChevronRight size={16} className="text-slate-500" />
        </Link>
      ))}
      <Link to="/settings" className="card flex items-center gap-3 hover:border-accent/60"><Settings size={20} className="text-accent" /><div className="flex-1"><p className="font-medium">Offline e configurações</p><p className="text-xs text-slate-400">Armazenamento, backup, conta</p></div><ChevronRight size={16} className="text-slate-500" /></Link>
    </div>
  );
}
