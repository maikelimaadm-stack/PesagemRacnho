import React, { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  GripVertical,
  RotateCcw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtInt } from "@/components/common/formatNumber";

const normalize = (value) => String(value || "").toLocaleLowerCase("pt-BR");

export default function MakColumnConfigDialog({
  open,
  onOpenChange,
  columns,
  order,
  visible,
  onApply,
  title = "Configuração de colunas",
  description = "Escolha as colunas exibidas na tabela e organize a ordem de apresentação.",
  availableLabel = "Colunas disponíveis",
  usedLabel = "Colunas em uso",
  usedCountSingular = "coluna",
  usedCountPlural = "colunas",
  availableSearchPlaceholder = "Procurar coluna",
  usedSearchPlaceholder = "Procurar coluna em uso",
  emptyAvailableMessage = "Nenhuma coluna disponível.",
  emptyUsedMessage = "Nenhuma coluna em uso.",
  ItemIcon = Columns3,
}) {
  const configurableColumns = useMemo(() => columns.filter((column) => !column.fixo), [columns]);
  const fixedIds = useMemo(() => columns.filter((column) => column.fixo).map((column) => column.id), [columns]);
  const configurableIds = useMemo(() => configurableColumns.map((column) => column.id), [configurableColumns]);

  const [draftOrder, setDraftOrder] = useState(() => {
    const known = order.filter((id) => columns.some((column) => column.id === id));
    const missing = columns.map((column) => column.id).filter((id) => !known.includes(id));
    return [...known, ...missing];
  });
  const [draftVisible, setDraftVisible] = useState(() => [
    ...new Set([...fixedIds, ...visible.filter((id) => configurableIds.includes(id))]),
  ]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [usedSearch, setUsedSearch] = useState("");
  const [selectedAvailable, setSelectedAvailable] = useState([]);
  const [selectedUsed, setSelectedUsed] = useState([]);

  const orderedConfigurable = draftOrder
    .map((id) => configurableColumns.find((column) => column.id === id))
    .filter(Boolean);
  const availableColumns = orderedConfigurable.filter((column) => !draftVisible.includes(column.id));
  const usedColumns = orderedConfigurable.filter((column) => draftVisible.includes(column.id));
  const filteredAvailable = availableColumns.filter((column) => normalize(column.label).includes(normalize(availableSearch)));
  const filteredUsed = usedColumns.filter((column) => normalize(column.label).includes(normalize(usedSearch)));

  const select = (id, setter, clearOther, event = {}) => {
    setter((current) => event.ctrlKey || event.metaKey || event.shiftKey
      ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      : [id]);
    clearOther([]);
  };

  const hideColumns = (ids) => {
    if (!ids.length) return;
    setDraftVisible((current) => current.filter((id) => !ids.includes(id) || fixedIds.includes(id)));
    setSelectedUsed([]);
  };

  const showColumns = (ids) => {
    if (!ids.length) return;
    setDraftVisible((current) => [...new Set([...current, ...ids])]);
    setSelectedAvailable([]);
  };

  const resetColumns = () => {
    setDraftOrder(columns.map((column) => column.id));
    setDraftVisible(columns.filter((column) => column.fixo || column.default).map((column) => column.id));
    setSelectedAvailable([]);
    setSelectedUsed([]);
    setAvailableSearch("");
    setUsedSearch("");
  };

  const handleDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const nextUsed = [...usedColumns];
    const [moved] = nextUsed.splice(result.source.index, 1);
    nextUsed.splice(result.destination.index, 0, moved);
    const hiddenIds = orderedConfigurable.filter((column) => !draftVisible.includes(column.id)).map((column) => column.id);
    setDraftOrder([...fixedIds, ...nextUsed.map((column) => column.id), ...hiddenIds]);
  };

  const commit = () => {
    onApply({ order: draftOrder, visible: draftVisible });
    onOpenChange(false);
  };

  const renderAvailableRow = (column) => {
    const selected = selectedAvailable.includes(column.id);
    return (
      <button
        key={column.id}
        type="button"
        className={`d17c-column-row${selected ? " is-selected" : ""}`}
        onClick={(event) => select(column.id, setSelectedAvailable, setSelectedUsed, event)}
        onDoubleClick={() => showColumns([column.id])}
        aria-pressed={selected}
      >
        <ItemIcon aria-hidden="true" />
        <span>{column.label}</span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large d17c-column-dialog">
        <DialogHeader className="d17c-column-dialog__header">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="d17c-column-dialog__reset"
            onClick={resetColumns}
            aria-label="Restaurar configuração padrão"
            title="Restaurar configuração padrão"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </DialogHeader>

        <div className="d17c-column-dialog__body">
          <section className="d17c-column-panel" aria-label={availableLabel}>
            <div className="d17c-column-panel__title">
              <strong>{availableLabel}</strong>
              <span>{fmtInt(availableColumns.length)}</span>
            </div>
            <label className="d17c-column-search">
              <Search aria-hidden="true" />
              <input
                value={availableSearch}
                onChange={(event) => setAvailableSearch(event.target.value)}
                placeholder={availableSearchPlaceholder}
              />
            </label>
            <div className="d17c-column-list">
              {filteredAvailable.length > 0
                ? filteredAvailable.map(renderAvailableRow)
                : <p className="d17c-column-empty">{emptyAvailableMessage}</p>}
            </div>
          </section>

          <div className="d17c-column-transfer" aria-label="Mover colunas">
            <Button type="button" variant="ghost" size="icon" onClick={() => hideColumns(usedColumns.map((column) => column.id))} disabled={!usedColumns.length} aria-label="Remover todas as colunas"><ChevronsLeft /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => hideColumns(selectedUsed)} disabled={!selectedUsed.length} aria-label="Remover colunas selecionadas"><ChevronLeft /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => showColumns(selectedAvailable)} disabled={!selectedAvailable.length} aria-label="Adicionar colunas selecionadas"><ChevronRight /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => showColumns(availableColumns.map((column) => column.id))} disabled={!availableColumns.length} aria-label="Adicionar todas as colunas"><ChevronsRight /></Button>
          </div>

          <section className="d17c-column-panel" aria-label={usedLabel}>
            <div className="d17c-column-panel__title">
              <strong>{usedLabel}</strong>
              <span>{fmtInt(usedColumns.length)} {usedColumns.length === 1 ? usedCountSingular : usedCountPlural}</span>
            </div>
            <label className="d17c-column-search">
              <Search aria-hidden="true" />
              <input
                value={usedSearch}
                onChange={(event) => setUsedSearch(event.target.value)}
                placeholder={usedSearchPlaceholder}
              />
            </label>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="d17c-columns-in-use">
                {(provided) => (
                  <div className="d17c-column-list d17c-column-list--used" ref={provided.innerRef} {...provided.droppableProps}>
                    {filteredUsed.map((column, index) => (
                      <Draggable key={column.id} draggableId={column.id} index={index} isDragDisabled={Boolean(usedSearch)}>
                        {(dragProvided, snapshot) => {
                          const selected = selectedUsed.includes(column.id);
                          return (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`d17c-column-row d17c-column-row--used${selected ? " is-selected" : ""}${snapshot.isDragging ? " is-dragging" : ""}`}
                              role="button"
                              tabIndex={0}
                              aria-pressed={selected}
                              onClick={(event) => select(column.id, setSelectedUsed, setSelectedAvailable, event)}
                              onDoubleClick={() => hideColumns([column.id])}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  select(column.id, setSelectedUsed, setSelectedAvailable, event);
                                }
                              }}
                            >
                              <span className="d17c-column-position">{index + 1}</span>
                              <GripVertical aria-hidden="true" />
                              <ItemIcon aria-hidden="true" />
                              <span>{column.label}</span>
                              <small>Em uso</small>
                            </div>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {filteredUsed.length === 0 ? <p className="d17c-column-empty">{emptyUsedMessage}</p> : null}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </section>
        </div>

        <div className="d17c-column-dialog__footer">
          <Button type="button" className="d17c-confirm-button" onClick={commit}>Ok</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
