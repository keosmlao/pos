export const COSTING_METHODS = [
  { value: 'FIFO', label: 'FIFO', sub: 'ຊື້ກ່ອນ ອອກກ່ອນ', desc: 'ໃຊ້ຕົ້ນທຶນຂອງສິນຄ້າທີ່ຊື້ເຂົ້າມາກ່ອນສຸດ' },
  { value: 'LIFO', label: 'LIFO', sub: 'ຊື້ຫຼັງ ອອກກ່ອນ', desc: 'ໃຊ້ຕົ້ນທຶນຂອງສິນຄ້າທີ່ຊື້ເຂົ້າມາລ່າສຸດ' },
  { value: 'AVG', label: 'Average', sub: 'ສະເລ່ຍຖ່ວງນ້ຳໜັກ', desc: 'ສະເລ່ຍຖ່ວງຕາມຈຳນວນທີ່ຊື້ເຂົ້າ' },
  { value: 'LAST', label: 'Last', sub: 'ລາຄາລ່າສຸດ', desc: 'ໃຊ້ລາຄາຊື້ຄັ້ງລ່າສຸດ' },
];

export const COSTING_METHOD_LABELS = Object.fromEntries(
  COSTING_METHODS.map((m) => [m.value, m.label])
);

export const DEFAULT_COSTING_METHOD = 'AVG';
