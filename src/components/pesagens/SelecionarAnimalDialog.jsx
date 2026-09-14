import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fmtDateBR, fmtInt, fmtNum } from '@/components/common/formatNumber';

export default function SelecionarAnimalDialog({ open, onOpenChange, numero, animais = [], onSelect }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--medium d17d-management-dialog d17d-animal-choice-dialog overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Qual é o animal {numero}?</DialogTitle>
          <DialogDescription>O mesmo número existe em mais de uma marca. Escolha a identidade correta antes de lançar.</DialogDescription>
        </DialogHeader>
        <div className="d17b-standard-dialog__body">
          <div className="d17d-management-table">
            <Table>
              <TableHeader><TableRow><TableHead>Marca</TableHead><TableHead>Sexo</TableHead><TableHead>Raça</TableHead><TableHead>Era</TableHead><TableHead>Última pesagem</TableHead><TableHead className="text-center">Histórico</TableHead><TableHead className="w-24">Ação</TableHead></TableRow></TableHeader>
              <TableBody>
                {animais.map((animal) => (
                  <TableRow key={animal.animal_id || animal.id}>
                    <TableCell className="font-semibold">{animal.marca || 'Sem marca'}</TableCell>
                    <TableCell>{animal.sexo || '-'}</TableCell>
                    <TableCell>{animal.raca || '-'}</TableCell>
                    <TableCell>{animal.era || '-'}</TableCell>
                    <TableCell><div className="d17d-rule-summary"><strong>{fmtDateBR(animal.ultima_pesagem)}</strong><small>Peso: {fmtNum(animal.ultimo_peso)}</small></div></TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{fmtInt(animal.total_registros)}</Badge></TableCell>
                    <TableCell><Button size="sm" className="d17d-animal-choice-dialog__select" onClick={() => { onSelect(animal); onOpenChange(false); }}>Selecionar</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
