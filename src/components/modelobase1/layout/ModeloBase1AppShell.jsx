import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  CloudOff,
  Database,
  Menu,
  Moon,
  Scale,
  Sun,
  X,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import UserMenu from "@/components/auth/UserMenu";
import { APP_VERSION } from "@/versioning/versionInfo";
import ModeloBase1Tokens from "../foundations/ModeloBase1Tokens";
import "./modelo-base1-shell.css";

// Grupos padrão do menu (docs 10 §3). O Layout pode passar  com a ordem
// e os rótulos; itens sem grupo caem no primeiro. Grupos vazios não aparecem.
const DEFAULT_NAV_GROUPS = [
  { id: "operacao", label: "Operação" },
  { id: "rebanho", label: "Rebanho" },
  { id: "comercial", label: "Comercial" },
  { id: "cadastros", label: "Cadastros" },
  { id: "sistema", label: "Sistema" },
];
const GROUP_LABELS = Object.fromEntries(DEFAULT_NAV_GROUPS.map((group) => [group.id, group.label]));

function ShellNav({ items, location, onNavigate, mobile = false, navGroups = DEFAULT_NAV_GROUPS }) {
  const firstGroupId = navGroups[0]?.id;
  const groups = navGroups.map((group) => ({
    label: group.label,
    items: items.filter((item) => item.group === group.id || (!item.group && group.id === firstGroupId)),
  }));

  return (
    <nav className={`mb1-shell-nav${mobile ? " mb1-shell-nav--mobile" : ""}`} aria-label="Navegação principal">
      {groups.filter((group) => group.items.length).map((group) => (
        <div className="mb1-shell-nav__group" key={group.label}>
          <div className="mb1-shell-nav__label">{group.label}</div>
          {group.items.map((item) => {
            const active = location.pathname === createPageUrl(item.url);
            return (
              <Link
                key={item.id}
                to={createPageUrl(item.url)}
                onClick={onNavigate}
                className={`mb1-shell-nav__link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <item.Icon aria-hidden="true" />
                <span>{item.longTitle}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ShellIdentity({ compact = false }) {
  return (
    <div className={`mb1-shell-identity${compact ? " mb1-shell-identity--compact" : ""}`}>
      <span className="mb1-shell-identity__icon"><Scale aria-hidden="true" /></span>
      <div>
        <strong>Pesagens Individuais</strong>
        <span>Operação local</span>
      </div>
    </div>
  );
}

/**
 * Shell do ModeloBase1. `navItems` chega já filtrado por permissão pelo Layout
 * (doc 11 §4): o shell só renderiza o que recebe, sem decidir acesso.
 * O menu do usuário (UserMenu) fica na topbar do desktop e, no celular, dentro
 * do menu lateral; ele devolve null sem sessão (capturas e gates não quebram).
 */
export default function ModeloBase1AppShell({ children, navItems, navGroups = DEFAULT_NAV_GROUPS }) {
  const location = useLocation();
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("erp-tema") === "escuro");
  const [breadcrumbDetail, setBreadcrumbDetail] = useState("");
  const activeItem = useMemo(
    () => navItems.find((item) => location.pathname === createPageUrl(item.url)) || navItems[0] || null,
    [location.pathname, navItems],
  );
  const isWeighingLaunch = location.pathname === createPageUrl("LancamentoPesagensIndividuais");
  const isAnimalSheet = location.pathname === createPageUrl("FichaAnimal");
  const isOperationalInsight = isAnimalSheet || location.pathname === createPageUrl("FechamentoDia");
  const activeGroupLabel = (navGroups.find((group) => group.id === activeItem?.group) || navGroups[0] || { label: GROUP_LABELS.operacao }).label;

  useEffect(() => {
    const onDetail = (event) => setBreadcrumbDetail(String(event.detail || ""));
    window.addEventListener("mb1:breadcrumb-detail", onDetail);
    return () => window.removeEventListener("mb1:breadcrumb-detail", onDetail);
  }, []);

  useEffect(() => {
    if (!isAnimalSheet) setBreadcrumbDetail("");
  }, [isAnimalSheet]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("tema-claro", "tema-escuro", "escuro", "dark");
    if (darkMode) {
      root.classList.add("tema-escuro", "escuro", "dark");
      root.setAttribute("data-tema", "escuro");
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("erp-tema", "escuro");
      return;
    }
    root.classList.add("tema-claro");
    root.setAttribute("data-tema", "claro");
    root.setAttribute("data-theme", "light");
    localStorage.setItem("erp-tema", "claro");
  }, [darkMode]);

  const themeToggle = (
    <button
      type="button"
      className="mb1-shell-topbar-button mb1-theme-toggle"
      onClick={() => setDarkMode((current) => !current)}
      aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
      title={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={darkMode}
    >
      {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );

  return (
    <ModeloBase1Tokens className="mb1-app-shell d17b-shell" enterpriseScope={!isOperationalInsight}>
      <header className="mb1-desktop-topbar">
        <div className="mb1-desktop-topbar__leading">
          <button
            type="button"
            className="mb1-shell-topbar-button"
            onClick={() => setDesktopMenuOpen((open) => !open)}
            aria-label={desktopMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={desktopMenuOpen}
          >
            {desktopMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <div className="mb1-shell-breadcrumbs" aria-label="Navegação estrutural">
            <span>{activeGroupLabel}</span>
            <ChevronRight aria-hidden="true" />
            {isAnimalSheet ? (
              <>
                <Link to={createPageUrl("PesagensIndividuais")}>Pesagens Individuais</Link>
                <ChevronRight aria-hidden="true" />
              </>
            ) : null}
            <strong>{isAnimalSheet && breadcrumbDetail ? breadcrumbDetail : activeItem?.longTitle}</strong>
          </div>

          {isWeighingLaunch ? (
            <div className="mb1-shell-device-statuses" aria-label="Estado dos equipamentos">
              <span className="mb1-shell-device-status" title="Integração com balança ainda não configurada">
                <span aria-hidden="true" />Balança não configurada
              </span>
              <span className="mb1-shell-device-status" title="Integração com leitor RFID ainda não configurada">
                <span aria-hidden="true" />RFID não configurado
              </span>
            </div>
          ) : null}

          {desktopMenuOpen ? (
            <aside className="mb1-floating-sidebar is-open">
              <ShellIdentity />
              <ShellNav items={navItems} location={location} onNavigate={() => setDesktopMenuOpen(false)} navGroups={navGroups} />
              <div className="mb1-floating-sidebar__footer">
                <Database aria-hidden="true" />
                <div><strong>Dados locais</strong><span>IndexedDB · Dexie</span></div>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="mb1-desktop-topbar__status">
          <UserMenu />
          {!isOperationalInsight ? themeToggle : null}
          <span className="mb1-shell-offline"><CloudOff aria-hidden="true" /> Offline</span>
          <span className="mb1-shell-product-mark" aria-label={`Pesagens Individuais ${APP_VERSION}`} title={`Pesagens Individuais · versão ${APP_VERSION}`}>PI</span>
        </div>
      </header>

      <header className="mb1-mobile-topbar">
        <button
          type="button"
          className="mb1-shell-topbar-button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu aria-hidden="true" />
        </button>
        <ShellIdentity compact />
        {themeToggle}
        <span className="mb1-mobile-local" title={`Versão ${APP_VERSION}`}>Local</span>
      </header>

      <div className="mb1-shell-content">
        <div className="mb1-shell-page-slot">{children}</div>
      </div>

      {mobileMenuOpen ? (
        <div className="mb1-mobile-drawer-layer">
          <button type="button" className="mb1-mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu" />
          <aside className="mb1-mobile-drawer" aria-label="Menu">
            <div className="mb1-mobile-drawer__header">
              <ShellIdentity />
              <button type="button" className="mb1-shell-icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">
                <X aria-hidden="true" />
              </button>
            </div>
            <ShellNav items={navItems} location={location} onNavigate={() => setMobileMenuOpen(false)} mobile navGroups={navGroups} />
            <UserMenu variant="panel" />
          </aside>
        </div>
      ) : null}

      <nav className="mb1-mobile-bottom-nav" aria-label="Atalhos principais">
        {navItems.filter((item) => item.mobile !== false).map((item) => {
          const active = location.pathname === createPageUrl(item.url);
          return (
            <Link key={item.id} to={createPageUrl(item.url)} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
              <item.Icon aria-hidden="true" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </ModeloBase1Tokens>
  );
}
