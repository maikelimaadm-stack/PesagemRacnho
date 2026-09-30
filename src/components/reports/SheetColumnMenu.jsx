import React from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, EyeOff, Layers, MoveHorizontal, Plus, Sigma } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Menu do título de uma coluna da folha (E1F, item 2): Ordenar, Calcular, Agrupar por esta coluna, Subtotal/Total,
// Ocultar, Adicionar coluna… e largura automática. Só desenha o modelo de domain/headerActions.headerMenuOf e
// devolve a escolha (onAction); quem muda o estado é o ReportView (applyHeaderAction). Aberto por clique no
// título (ReportSheetView), ancorado no próprio <th> por um gatilho invisível do tamanho dele.

/**
 * @param {{ menu: object, anchor: { left: number, top: number, width: number, height: number },
 *   onAction: (action: object) => void, onClose: () => void }} props
 */
export default function SheetColumnMenu({ menu, anchor, onAction, onClose }) {
  const pick = (action) => { onAction({ layout: menu.layout, ...action }); onClose(); };
  const hasColumnActions = Boolean(menu.calc || menu.group || menu.total || menu.hide || menu.add.length);
  return (
    <DropdownMenu open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DropdownMenuTrigger asChild>
        <span className="rpt-col-menu-anchor" style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rpt-mak-menu rpt-col-menu" aria-label={`Coluna ${menu.label}`} onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuLabel className="rpt-col-menu__title">{menu.label}</DropdownMenuLabel>
        {menu.sort.map((option) => (
          <DropdownMenuItem key={`${option.key}:${option.direction}`} className="text-xs" onSelect={() => pick({ type: "sort", key: option.key, direction: option.direction })}>
            {option.direction === "desc" ? <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" aria-hidden="true" />}
            <span className="rpt-col-menu__text">Ordenar: {option.label}</span>
            {option.active ? <Check className="rpt-col-menu__check h-3.5 w-3.5" aria-label="atual" /> : null}
          </DropdownMenuItem>
        ))}
        {menu.sort.length && hasColumnActions ? <DropdownMenuSeparator /> : null}
        {menu.calc ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><Sigma className="h-3.5 w-3.5" aria-hidden="true" />Calcular</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rpt-mak-menu rpt-col-menu">
              <DropdownMenuLabel className="rpt-col-menu__hint">{menu.calc.mode === "replace" ? "Conta desta coluna" : "Liga a conta nos subtotais e no total"}</DropdownMenuLabel>
              {menu.calc.options.map((option) => (menu.calc.mode === "toggle" ? (
                <DropdownMenuCheckboxItem key={option.id} className="text-xs" checked={option.active} onSelect={() => pick({ type: "calc", choice: option.id })}>{option.label}</DropdownMenuCheckboxItem>
              ) : (
                <DropdownMenuItem key={option.id} className="text-xs" disabled={option.disabled} title={option.title ?? undefined} onSelect={() => pick({ type: "calc", choice: option.id })}>
                  <span className="rpt-col-menu__text">{option.label}</span>
                  {option.active ? <Check className="rpt-col-menu__check h-3.5 w-3.5" aria-label="atual" /> : null}
                  {option.disabled ? <span className="rpt-col-menu__note">já na folha</span> : null}
                </DropdownMenuItem>
              )))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {menu.total ? (
          <DropdownMenuCheckboxItem className="text-xs" checked={menu.total.active} onSelect={() => pick({ type: "total" })}>Subtotal/Total desta coluna</DropdownMenuCheckboxItem>
        ) : null}
        {menu.group ? (
          <DropdownMenuItem className="text-xs" disabled={menu.group.disabled} title={menu.group.title ?? undefined} onSelect={() => pick({ type: "group" })}>
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="rpt-col-menu__text">{menu.group.active ? "Tirar do agrupamento" : "Agrupar por esta coluna"}</span>
            {menu.group.leavesType ? <span className="rpt-col-menu__note">Personalizado</span> : null}
          </DropdownMenuItem>
        ) : null}
        {menu.hide ? (
          <DropdownMenuItem className="text-xs" disabled={menu.hide.disabled} title={menu.hide.title ?? undefined} onSelect={() => pick({ type: "hide" })}>
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />Ocultar coluna
          </DropdownMenuItem>
        ) : null}
        {menu.add.length ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Adicionar coluna…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rpt-mak-menu rpt-col-menu rpt-col-menu--list">
              {menu.add.map((option, index) => (
                <React.Fragment key={option.key}>
                  {/* No tipo com "Colunas": as do tipo primeiro; depois as outras do relatório. */}
                  {option.group === "relatorio" && menu.add[index - 1]?.group === "tipo" ? <DropdownMenuSeparator /> : null}
                  {option.group === "relatorio" && menu.add[index - 1]?.group !== "relatorio" && menu.add.some((item) => item.group === "tipo") ? <DropdownMenuLabel className="rpt-col-menu__hint">Outras do relatório</DropdownMenuLabel> : null}
                  <DropdownMenuItem className="text-xs" onSelect={() => pick({ type: "add", add: option.key })}>{option.label}</DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {menu.width !== null ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onSelect={() => pick({ type: "resetWidth" })}>
              <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />Largura automática
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
