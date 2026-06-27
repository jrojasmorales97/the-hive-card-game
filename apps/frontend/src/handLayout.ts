export type HandSlotId = 'primary' | `queue-top-${number}` | 'queue-curve' | `queue-bottom-${number}`;

export type HandQueueSlot = {
  id: HandSlotId;
  card: number | null;
};

export type HandLayoutPlan = {
  primaryCard: number | null;
  topRow: HandQueueSlot[];
  curveSlot: HandQueueSlot | null;
  bottomRow: HandQueueSlot[];
  showCurve: boolean;
  slotOrder: HandSlotId[];
  cardSlotMap: Record<number, HandSlotId>;
};

export function buildHandLayout(cards: number[], maxLevel: number): HandLayoutPlan {
  const orderedCards = [...cards].sort((a, b) => a - b);
  const primaryCard = orderedCards[0] ?? null;
  const maxQueueSlotCount = Math.max(0, maxLevel - 1);
  const queueCards = orderedCards.slice(1, 1 + maxQueueSlotCount);
  const queueSlots = [...queueCards, ...Array.from({ length: Math.max(0, maxQueueSlotCount - queueCards.length) }, () => null)];
  const topCount = Math.min(5, maxQueueSlotCount);
  const showCurve = maxQueueSlotCount > 5;

  const topRow = Array.from({ length: topCount }, (_, index) => ({
    id: `queue-top-${index}` as const,
    card: queueSlots[index] ?? null,
  }));
  const curveSlot = showCurve
    ? {
        id: 'queue-curve' as const,
        card: queueSlots[5] ?? null,
      }
    : null;
  const bottomRow = Array.from({ length: Math.max(0, maxQueueSlotCount - 6) }, (_, index) => ({
    id: `queue-bottom-${index}` as const,
    card: queueSlots[index + 6] ?? null,
  }));

  const slotOrder: HandSlotId[] = [
    'primary',
    ...topRow.map((slot) => slot.id),
    ...(curveSlot ? [curveSlot.id] : []),
    ...bottomRow.map((slot) => slot.id),
  ];

  const cardSlotMap: Record<number, HandSlotId> = {};
  if (primaryCard !== null) cardSlotMap[primaryCard] = 'primary';
  [...topRow, ...(curveSlot ? [curveSlot] : []), ...bottomRow].forEach((slot) => {
    if (slot.card !== null) cardSlotMap[slot.card] = slot.id;
  });

  return {
    primaryCard,
    topRow,
    curveSlot,
    bottomRow,
    showCurve,
    slotOrder,
    cardSlotMap,
  };
}

export function buildHandSlotPath(from: HandSlotId, to: HandSlotId, slotOrder: HandSlotId[]): HandSlotId[] {
  const fromIndex = slotOrder.indexOf(from);
  const toIndex = slotOrder.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return [to];
  if (fromIndex === toIndex) return [to];

  const step = fromIndex < toIndex ? 1 : -1;
  const path: HandSlotId[] = [];
  for (let index = fromIndex; index !== toIndex + step; index += step) {
    path.push(slotOrder[index]);
  }
  return path;
}
