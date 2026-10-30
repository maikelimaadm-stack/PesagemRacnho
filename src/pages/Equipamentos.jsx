import RequirePermission from '@/components/auth/RequirePermission';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import ScaleEquipmentCard from '@/components/equipment/ScaleEquipmentCard';
import '@/styles/auxiliary-registries.css';
import '@/styles/launch-visual.css';

// Menu SISTEMA › Balança e Equipamentos (F26): S3 (Bluetooth/COM), conexão, estabilidade, leitura e simulador,
// fora das Configurações gerais. Mesma configuração de sempre (equipmentConfigService); gravar exige settings.manage.
export default function Equipamentos() {
  return (
    <RequirePermission permission="settings.operational">
      <ModeloBase1PageContainer variant="record" className="d17b-page cadastro-emp-scope mg-empresas-scope aux-registry-page app-config-page">
        <ModeloBase1PageHeader title="Balança e Equipamentos" description="Balança ativa, conexão, estabilidade da leitura e simulador." />
        <div className="emp-form-cards-layout cad-form-cards-layout mg-prototype-cards-layout" style={{ padding: 12 }}>
          <div className="emp-form-cards-row">
            <ScaleEquipmentCard />
          </div>
        </div>
      </ModeloBase1PageContainer>
    </RequirePermission>
  );
}
