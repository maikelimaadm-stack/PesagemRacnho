// Configurar balança: o APP procura e conecta. Usuário só liga o Bluetooth do PC.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { getEquipmentConfig, updateEquipmentConfig } from '@/modules/equipment/application/equipmentConfigService';
import { connectConfiguredScale, disconnectScale, ensureScaleReady, getStatus } from '@/modules/equipment/application/scaleService';

const ADAPTERS = [
  { value: 'none', label: 'Nenhuma (peso só digitado)' },
  { value: 's3-bluetooth', label: 'Tru-Test S3 — Bluetooth (o app procura)' },
  { value: 'simulator', label: 'Simulador (teste — preenche o campo Peso)' },
  { value: 's3-usb', label: 'Tru-Test S3 — cabo USB (opcional)' },
];

function equipmentApi() {
  return typeof window !== 'undefined' ? window.pesagemApp?.equipment : null;
}

export default function ScaleEquipmentCard() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(() => getStatus());
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [devices, setDevices] = useState(null); // null fechado | [] | [...]
  const [source, setSource] = useState('bluetooth');

  const reload = useCallback(async () => {
    const next = await getEquipmentConfig();
    setConfig(next);
    await ensureScaleReady();
    setStatus(getStatus());
  }, []);

  useEffect(() => {
    reload().catch(() => toast.error('Não foi possível carregar a configuração da balança.'));
  }, [reload]);

  useEffect(() => {
    const api = equipmentApi();
    if (!api?.onDeviceList) return undefined;
    // Só onDeviceList — o listener legado de serial sobrescrevia a lista BT e o clique
    // mandava chooseSerialPort no S3 (não conectava).
    return api.onDeviceList((payload) => {
      const nextSource = payload?.source === 'serial' ? 'serial' : 'bluetooth';
      setSource(nextSource);
      setDevices(
        (Array.isArray(payload?.devices) ? payload.devices : []).map((device) => ({
          ...device,
          id: device.id || device.deviceId || device.portId,
          kind: device.kind || nextSource,
          label: device.label || device.deviceName || device.displayName || 'Dispositivo',
        })),
      );
      setSearching(false);
    });
  }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      await disconnectScale();
      const next = await updateEquipmentConfig(patch);
      setConfig(next);
      await ensureScaleReady();
      setStatus(getStatus());
      toast.success('Balança atualizada.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível salvar a balança.');
    } finally {
      setSaving(false);
    }
  };

  const cancelSearch = async () => {
    const api = equipmentApi();
    try {
      await api?.cancelBluetoothDevice?.();
      await api?.cancelSerialPort?.();
    } catch { /* ignore */ }
    setDevices(null);
    setSearching(false);
  };

  const chooseDevice = async (device) => {
    const api = equipmentApi();
    const id = device.id || device.deviceId || device.portId;
    if (!id) {
      toast.error('Dispositivo sem identificador. Tente Procurar de novo.');
      return;
    }
    const useSerial = device.kind === 'serial' || (source === 'serial' && device.kind !== 'bluetooth');
    try {
      toast.message(useSerial ? `Abrindo porta ${device.label}…` : `Conectando a ${device.label}…`);
      if (useSerial) {
        await api?.chooseSerialPort?.(id);
      } else {
        await api?.chooseBluetoothDevice?.(id);
      }
    } catch (error) {
      toast.error(error?.message || 'Não foi possível selecionar o dispositivo.');
      await cancelSearch();
    }
  };

  const searchDevices = async () => {
    if (!equipmentApi()) {
      toast.error('Abra o app desktop para o sistema procurar a balança.');
      return;
    }
    setSearching(true);
    setDevices([]);
    try {
      if (config?.adapter !== 's3-bluetooth' && config?.adapter !== 's3-usb') {
        await save({ adapter: 's3-bluetooth' });
      }
      // Abre a busca Bluetooth no app (lista aparece abaixo). Sem painel do Windows.
      await connectConfiguredScale({ forcePicker: true });
      setConfig(await getEquipmentConfig());
      setStatus(getStatus());
      setDevices(null);
      toast.success('Balança conectada pelo sistema. O peso deve aparecer no Lançamento.');
    } catch (error) {
      const msg = String(error?.message || '');
      if (/Nenhum dispositivo|No device|cancelled|canceled|BLUETOOTH_NO_DEVICE|SERIAL_NO_PORT/i.test(msg) || error?.code === 'BLUETOOTH_NO_DEVICE') {
        toast.error('Nada selecionado. Deixe o Bluetooth do PC ligado, o S3 ligado/visível, e escolha o aparelho na lista.');
      } else {
        toast.error(error?.message || 'Não foi possível conectar à balança.');
      }
      setDevices(null);
    } finally {
      setSearching(false);
    }
  };

  if (!config) {
    return (
      <div className="emp-form-card" data-width-type="CAMPO_PRINCIPAL" style={{ flex: '1 1 100%' }}>
        <header className="emp-form-card__header"><h3>Equipamentos</h3><p>Carregando…</p></header>
      </div>
    );
  }

  return (
    <div className="emp-form-card" data-width-type="CAMPO_PRINCIPAL" style={{ flex: '1 1 100%' }}>
      <header className="emp-form-card__header">
        <h3>Equipamentos · Balança</h3>
        <p>
          Tru-Test / Datamars S3. <strong>Só ligue o Bluetooth do computador</strong> —
          não precisa emparelhar no Windows (lá some sozinho). O sistema procura e conecta.
        </p>
      </header>
      <div className="emp-form-card__body space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Balança ativa</Label>
          <Select value={config.adapter} onValueChange={(adapter) => save({ adapter })} disabled={saving || searching}>
            <SelectTrigger className="h-8 text-xs" aria-label="Balança ativa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADAPTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="h-8 text-xs" onClick={searchDevices} disabled={saving || searching}>
            {searching ? 'Procurando…' : 'Procurar dispositivos'}
          </Button>
          {config.rememberedBluetooth?.deviceName || config.rememberedBluetooth?.deviceId ? (
            <span className="text-[11px]" style={{ color: 'var(--mb1-text-3)' }}>
              Último: {config.rememberedBluetooth.deviceName || config.rememberedBluetooth.deviceId}
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--mb1-text-3)' }}>
              Bluetooth do PC ligado → Procurar → escolher o S3 na lista
            </span>
          )}
        </div>

        {devices ? (
          <div className="rounded-md border border-[var(--mb1-border,#e5e7eb)] bg-[var(--mb1-bg-field,#f1f3f4)] p-3 space-y-2" role="listbox" aria-label="Dispositivos encontrados">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs">
                {searching ? 'Procurando dispositivos…' : 'Dispositivos encontrados'}
                {source === 'bluetooth' ? ' (Bluetooth)' : ' (porta COM)'}
              </strong>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelSearch}>Cancelar</Button>
            </div>
            {devices.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--mb1-text-2)' }}>
                Ainda nenhum aparelho. Deixe o S3 ligado e perto do PC, com o Bluetooth do Windows apenas <em>ligado</em>
                (sem precisar emparelhar). A lista atualiza sozinha quando o sistema achar.
              </p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-auto">
                {devices.map((device) => (
                  <li key={device.id}>
                    <button
                      type="button"
                      className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost w-full justify-start text-left text-xs h-auto min-h-[28px] py-1.5 px-2"
                      onClick={() => chooseDevice(device)}
                    >
                      <span className="font-semibold">{device.label}</span>
                      {device.bluetoothLikely ? <span className="ml-auto text-[10px] opacity-70">BT</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={config.autoFillOnStable}
            onCheckedChange={(checked) => save({ autoFillOnStable: Boolean(checked) })}
            disabled={saving}
          />
          Preencher o campo Peso automaticamente com o que aparece no monitor
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={config.beepOnStable !== false}
            onCheckedChange={(checked) => save({ beepOnStable: Boolean(checked) })}
            disabled={saving}
            aria-label="Bip quando o peso estabilizar"
          />
          Bip curto (1 toque) quando o peso estabilizar na pesagem automática — não toca com a balança vazia
        </label>
        <div className="space-y-1">
          <Label className="text-xs">Cor do indicador (online / ícone no Peso)</Label>
          <Select
            value={config.statusAccent || 'green'}
            onValueChange={(statusAccent) => save({ statusAccent })}
            disabled={saving}
          >
            <SelectTrigger className="h-8 text-xs" aria-label="Cor do indicador da balança">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="green">Verde</SelectItem>
              <SelectItem value="blue">Azul</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--mb1-text-3)' }}>
          Estado: {status.label}{status.detail ? ` · ${status.detail}` : ''}
          {status.lastStableKg != null ? ` · último estável ${String(status.lastStableKg).replace('.', ',')} kg` : ''}
        </p>
      </div>
    </div>
  );
}
