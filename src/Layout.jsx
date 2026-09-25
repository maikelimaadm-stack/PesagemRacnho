import { BarChart3, CalendarCheck, Contact, Database, Dna, Handshake, Layers, ListChecks, MapPin, PlusCircle, Settings, Skull, Syringe, Tag, Upload, Users } from "lucide-react";
import { ModeloBase1AppShell } from "@/components/modelobase1";
import RequirePermission from "@/components/auth/RequirePermission";
import { useAuth } from "@/components/auth/useAuth";

// Menu do Programa 2.0 (docs/arquitetura-produto/10-MODELO-PRODUTO-2.0.md §3).
// Grupos: operacao · rebanho · comercial (Fase 3) · cadastros · sistema.
// Cada item declara a permissão mínima para aparecer (ADR-036); a página
// continua protegida por RequirePermission mesmo se a URL for digitada.
export const NAV_GROUPS = [
  { id: "operacao", label: "Operação" },
  { id: "rebanho", label: "Rebanho" },
  { id: "comercial", label: "Comercial" },
  { id: "relatorios", label: "Relatórios" },
  { id: "cadastros", label: "Cadastros" },
  { id: "sistema", label: "Sistema" },
];

const NAV_ITEMS = [
  {
    id: "pec-lanc-pesagens",
    title: "Lançar",
    longTitle: "Lançamento de Pesagens",
    url: "LancamentoPesagensIndividuais",
    Icon: PlusCircle,
    group: "operacao",
    permission: "launch.use",
  },
  {
    id: "pec-pesagens-ind",
    title: "Pesagens",
    longTitle: "Relação de Pesagens",
    url: "PesagensIndividuais",
    Icon: ListChecks,
    group: "operacao",
    permission: "weighing.read",
  },
  // Importação: item ÚNICO do assistente de importação (arquivo → tipo → colunas → regras
  // → conciliação → conferência → resultado). Gravar pesagens exige weighing.write; o
  // serviço checa de novo e cadastros mestres exigem registry.write dentro da tela.
  {
    id: "pec-importacao",
    title: "Importação",
    longTitle: "Importação",
    url: "Importacao",
    Icon: Upload,
    group: "operacao",
    mobile: false,
    permission: "weighing.write",
  },
  // Sanidade: um único item (programas, medicamentos e aplicações em abas). Leitura por
  // weighing.read; gravação decidida por ação dentro da tela e no sanityService.
  {
    id: "pec-sanidade",
    title: "Sanidade",
    longTitle: "Sanidade",
    url: "Sanidade",
    Icon: Syringe,
    group: "operacao",
    mobile: false,
    permission: "weighing.read",
  },
  {
    id: "pec-fechamento-dia",
    title: "Fechar",
    longTitle: "Fechamento do Dia",
    url: "FechamentoDia",
    Icon: CalendarCheck,
    group: "operacao",
    permission: "session.close",
  },
  {
    id: "pec-ficha-animal",
    title: "Animal",
    longTitle: "Ficha do Animal",
    url: "FichaAnimal",
    Icon: Contact,
    group: "rebanho",
    permission: "animal.read",
  },
  {
    id: "pec-relatorios",
    title: "Relatórios",
    longTitle: "Relatórios",
    url: "Relatorios",
    Icon: BarChart3,
    group: "relatorios",
    permission: "reports.read",
  },
  {
    id: "pec-marcas",
    title: "Marcas",
    longTitle: "Marcas",
    url: "Marcas",
    Icon: Tag,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-racas",
    title: "Raças",
    longTitle: "Raças",
    url: "Racas",
    Icon: Dna,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-categorias",
    title: "Categorias",
    longTitle: "Categorias",
    url: "Categorias",
    Icon: Layers,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-parceiros",
    title: "Parceiros",
    longTitle: "Parceiros",
    url: "Parceiros",
    Icon: Handshake,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-propriedades",
    title: "Propriedades",
    longTitle: "Propriedades",
    url: "Propriedades",
    Icon: MapPin,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-causas-morte",
    title: "Mortalidade",
    longTitle: "Causas de Morte",
    url: "CausasMorte",
    Icon: Skull,
    group: "cadastros",
    mobile: false,
    permission: "registry.read",
  },
  {
    id: "pec-usuarios",
    title: "Usuários",
    longTitle: "Usuários",
    url: "Usuarios",
    Icon: Users,
    group: "sistema",
    mobile: false,
    permission: "users.manage",
  },
  // Configurações: a mesma permissão da página (ADMIN e GESTOR). O GESTOR vê só a seção
  // Relatórios (divisor da @, E1C); as demais seções são filtradas dentro da tela.
  {
    id: "pec-configuracoes",
    title: "Configurações",
    longTitle: "Configurações",
    url: "Configuracoes",
    Icon: Settings,
    group: "sistema",
    mobile: false,
    permission: "settings.operational",
  },
  {
    id: "pec-manutencao",
    title: "Manutenção",
    longTitle: "Backup e Manutenção",
    url: "ManutencaoSistema",
    Icon: Database,
    group: "sistema",
    permission: "maintenance.backup",
  },
];

export default function Layout({ children, currentPageName }) {
  const auth = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || auth?.can(item.permission));
  const current = NAV_ITEMS.find((item) => item.url === currentPageName);
  return (
    <ModeloBase1AppShell navItems={visibleItems} navGroups={NAV_GROUPS}>
      <RequirePermission permission={current?.permission}>{children}</RequirePermission>
    </ModeloBase1AppShell>
  );
}
