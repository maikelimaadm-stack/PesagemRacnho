import { Building2, CalendarCheck, Contact, Database, HeartPulse, ListChecks, PlusCircle, Skull } from "lucide-react";
import { ModeloBase1AppShell } from "@/components/modelobase1";

const NAV_ITEMS = [
  {
    id: "pec-pesagens-ind",
    title: "Pesagens",
    longTitle: "Pesagens Individuais",
    url: "PesagensIndividuais",
    Icon: ListChecks,
    group: "operacao",
  },
  {
    id: "pec-lanc-pesagens",
    title: "Lançar",
    longTitle: "Lançamento de Pesagens",
    url: "LancamentoPesagensIndividuais",
    Icon: PlusCircle,
    group: "operacao",
  },
  {
    id: "pec-manutencao",
    title: "Manutenção",
    longTitle: "Backup e Manutenção",
    url: "ManutencaoSistema",
    Icon: Database,
    group: "sistema",
  },
  {
    id: "pec-fechamento-dia",
    title: "Fechar",
    longTitle: "Fechamento do Dia",
    url: "FechamentoDia",
    Icon: CalendarCheck,
    group: "operacao",
  },
  {
    id: "pec-ficha-animal",
    title: "Animal",
    longTitle: "Ficha do Animal",
    url: "FichaAnimal",
    Icon: Contact,
    group: "operacao",
  },
  {
    id: "pec-cadastros-comerciais",
    title: "Parceiros",
    longTitle: "Cadastros Comerciais",
    url: "CadastrosComerciais",
    Icon: Building2,
    group: "cadastros",
    mobile: false,
  },
  {
    id: "pec-causas-morte",
    title: "Mortalidade",
    longTitle: "Causas de Morte",
    url: "CausasMorte",
    Icon: Skull,
    group: "cadastros",
    mobile: false,
  },
  {
    id: "pec-config-sanidade",
    title: "Sanidade",
    longTitle: "Configurações de Sanidade",
    url: "ConfiguracoesSanidade",
    Icon: HeartPulse,
    group: "cadastros",
    mobile: false,
  },
];

export default function Layout({ children }) {
  return (
    <ModeloBase1AppShell navItems={NAV_ITEMS}>
      {children}
    </ModeloBase1AppShell>
  );
}
