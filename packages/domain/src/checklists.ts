export type ChecklistKind = "packing" | "day" | "border" | "vehicle";

export const CHECKLIST_KINDS: Array<{ id: ChecklistKind; label: string; icon: string }> = [
  { id: "packing", label: "Mala", icon: "🧳" },
  { id: "day", label: "Do dia", icon: "📅" },
  { id: "border", label: "Fronteira / documentos", icon: "🛂" },
  { id: "vehicle", label: "Veículo", icon: "🚗" },
];

/** Templates iniciais (docs/04 §2.1). Itens são sugestões editáveis. */
export const CHECKLIST_TEMPLATES: Record<Exclude<ChecklistKind, "day">, string[]> = {
  packing: [
    "Passaporte / RG", "Cartões e dinheiro em espécie", "Carregadores e adaptador de tomada", "Power bank", "Remédios de uso contínuo",
    "Seguro viagem (impresso ou offline)", "Cópias dos vouchers offline", "Roupas para o clima previsto", "Kit de higiene", "Óculos / protetor solar",
  ],
  border: [
    "Passaporte válido (mín. 6 meses)", "Visto ou autorização eletrônica", "CNH e permissão internacional (PID)", "Documento do veículo e seguro carta verde",
    "Comprovante de hospedagem", "Comprovante de meios financeiros", "Certificado de vacinação", "Chip / eSIM ou roaming ativado", "Moeda local ou câmbio",
  ],
  vehicle: [
    "Tanque cheio e autonomia calculada", "Pneus (calibragem e estepe)", "Óleo, água e fluidos", "Triângulo, macaco e chave de roda", "Kit de primeiros socorros",
    "Documentos do veículo", "Tag de pedágio / cartão", "GPS com mapas offline", "Cabos e suporte de celular",
  ],
};
