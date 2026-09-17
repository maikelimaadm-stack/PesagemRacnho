import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, RotateCcw } from "lucide-react";
import { fmtInt } from "@/components/common/formatNumber";
import { toast } from "sonner";
import {
  advanceIdentifierSequence,
  formatSequenceIdentifier,
  nextFreeIdentifier,
  parseSequenceIdentifier,
} from "@/modules/weighing/domain/launchContext";

// Sequência automática de identificadores do Cadastro. As regras (formato
// prefixo + dígitos, próximo livre, avanço) vivem em launchContext; o componente
// guarda só o cursor. A página recebe o controle por `controllerRef` (sem ponte
// global em window) e decide, com stateAfterSave, o Nº e o foco depois de salvar.
export default function SequenciaBrincos({ visivel = true, brincoAtual, onSetNumeroAnimal, numerosUsados, onFocusPeso, onAtivoChange, controllerRef }) {
  const [usarSequencia, setUsarSequencia] = useState(false);
  const [brincoInicial, setBrincoInicial] = useState("");
  const [brincoFinal, setBrincoFinal] = useState("");
  const [direcao, setDirecao] = useState("crescente");
  const [pulados, setPulados] = useState(0);
  const [ativoInterno, setAtivoInterno] = useState(false);

  const sequenciaRef = useRef(null);
  const numerosUsadosRef = useRef(numerosUsados || new Set());

  useEffect(() => {
    numerosUsadosRef.current = numerosUsados || new Set();
  }, [numerosUsados]);

  const pararSequencia = useCallback(() => {
    sequenciaRef.current = null;
    setAtivoInterno(false);
    setPulados(0);
    onAtivoChange?.(false);
  }, [onAtivoChange]);

  useEffect(() => {
    if (!usarSequencia) {
      pararSequencia();
    }
  }, [usarSequencia, pararSequencia]);

  const iniciarSequencia = () => {
    if (!usarSequencia || !brincoInicial.trim()) return;

    const partes = parseSequenceIdentifier(brincoInicial);
    if (!partes) {
      // Fora do formato não há como avançar: antes a sequência ficava "ativa" sem
      // cursor e cada Cadastro mostrava "Sequência finalizada!" (V-12).
      toast.error("Brinco inicial deve ter letras opcionais seguidas de números (ex.: 7000 ou BR007).");
      return;
    }
    const partesFinal = brincoFinal.trim() ? parseSequenceIdentifier(brincoFinal) : null;
    if (brincoFinal.trim() && !partesFinal) {
      toast.error("Brinco final deve ter letras opcionais seguidas de números.");
      return;
    }
    const limite = partesFinal ? partesFinal.numero : null;
    const livre = nextFreeIdentifier({ prefixo: partes.prefixo, inicio: partes.numero, limite, digitos: partes.digitos, usados: numerosUsadosRef.current, direcao });

    if (!livre) {
      toast.info("Todos os números do intervalo já estão cadastrados!");
      return;
    }

    sequenciaRef.current = {
      prefixo: partes.prefixo,
      numeroAtual: livre.numero,
      numeroInicial: partes.numero,
      digitos: partes.digitos,
      numeroFinal: limite,
      direcao,
    };

    setPulados(livre.pulos);
    setAtivoInterno(true);
    onAtivoChange?.(true);
    onSetNumeroAnimal?.(livre.formatado);
    onFocusPeso?.();
  };

  useEffect(() => {
    if (!controllerRef) return undefined;
    if (!ativoInterno) {
      controllerRef.current = null;
      return undefined;
    }
    controllerRef.current = {
      // Identificador atual do cursor (para devolver o Nº depois de uma edição).
      atual: () => {
        const seq = sequenciaRef.current;
        return seq ? formatSequenceIdentifier(seq.prefixo, seq.numeroAtual, seq.digitos) : null;
      },
      // Marca o atual como usado e devolve o próximo; quem aplica Nº e foco é a página.
      avancar: (usadosAtualizado) => {
        const resultado = advanceIdentifierSequence(sequenciaRef.current, usadosAtualizado || numerosUsadosRef.current);
        if (resultado.usados) numerosUsadosRef.current = resultado.usados;
        if (!resultado.ok) {
          sequenciaRef.current = null;
          setAtivoInterno(false);
          setPulados(0);
          onAtivoChange?.(false);
          return { ok: false };
        }
        sequenciaRef.current = resultado.state;
        setPulados((prev) => prev + resultado.pulos);
        return { ok: true, formatado: resultado.formatado, pulos: resultado.pulos };
      },
      getState: () => sequenciaRef.current,
    };
    return () => {
      controllerRef.current = null;
    };
  }, [ativoInterno, controllerRef, onAtivoChange]);

  return (
    <div className={visivel ? "mt-2 p-3 border-t bg-slate-50 rounded" : "hidden"}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="usar-sequencia-brincos" className="text-xs flex items-center gap-2">
            <Checkbox
              id="usar-sequencia-brincos"
              checked={usarSequencia}
              onCheckedChange={(checked) => setUsarSequencia(checked === true)}
              aria-label="Ativar sequência"
            />
            <span>Brinco inicial</span>
          </Label>
          <Input
            value={brincoInicial}
            onChange={(e) => setBrincoInicial(e.target.value)}
            className="h-8 text-xs w-28"
            placeholder="Ex: 7000"
            disabled={!usarSequencia}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Brinco final</Label>
          <Input
            value={brincoFinal}
            onChange={(e) => setBrincoFinal(e.target.value)}
            className="h-8 text-xs w-28"
            placeholder="Ex: 7500"
            disabled={!usarSequencia}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Direção</Label>
          <Select value={direcao} onValueChange={setDirecao} disabled={!usarSequencia}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crescente">Frente para trás</SelectItem>
              <SelectItem value="decrescente">Trás para frente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={iniciarSequencia}
          disabled={!usarSequencia || !brincoInicial.trim()}
          className="emp-toolbar-btn emp-toolbar-btn-save gap-1"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Iniciar
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pararSequencia}
          disabled={!ativoInterno}
          className="h-8 text-xs gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reiniciar
        </Button>

        {usarSequencia && ativoInterno && (
          <div className="space-y-1">
            <Label className="text-xs">Brinco atual</Label>
            <Input value={brincoAtual || ""} readOnly className="h-8 text-xs w-28 font-semibold" />
          </div>
        )}

        {usarSequencia && pulados > 0 && (
          <div className="text-xs text-slate-500 pb-1">
            Pulados: {fmtInt(pulados)}
          </div>
        )}
      </div>
    </div>
  );
}
