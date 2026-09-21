/** The five demo chips from the spec's edge-case table. `expected` is what the call should be. */
export type WhoIsThisSample = { name: string; expected: string; extracted: string; candidates: string }

export const WHO_SAMPLES: WhoIsThisSample[] = [
  {
    name: 'Partial extract, easy legal name',
    expected: 'Northline Freight Pte. Ltd. · clear · write that legal name',
    extracted: 'northlne freight',
    candidates: `Northline Freight Pte. Ltd. | Northline
Kite & Co. International Ltd. | Kite & Co
Pebble Goods LLC | Pebble`,
  },
  {
    name: 'Cousins (two legal entities)',
    expected: 'Northline Freight Pte. Ltd. · leaning/thin · confirm before writing',
    extracted: 'Northline Freight Traders',
    candidates: `Northline Freight Pte. Ltd. | Northline
Northline Cold Chain Pte. Ltd. | Northline Cold Chain
Kite & Co. International Ltd. | Kite & Co`,
  },
  {
    name: 'House not on the list',
    expected: 'none of these · clear · leave unmatched',
    extracted: 'harbor and vale logistics',
    candidates: `Northline Freight Pte. Ltd. | Northline
Kite & Co. International Ltd. | Kite & Co`,
  },
  {
    name: 'Misspelled / OCR',
    expected: 'Northline Freight Pte. Ltd. · leaning · confirm before writing',
    extracted: 'N0RTHL1NE FRE1GHT TRD',
    candidates: `Northline Freight Pte. Ltd. | Northline
Pebble Goods LLC | Pebble`,
  },
  {
    name: 'Junk, not a customer',
    expected: 'none of these · clear · leave unmatched',
    extracted: 'invoice 4481 west dock',
    candidates: `Northline Freight Pte. Ltd. | Northline
Kite & Co. International Ltd. | Kite & Co
Pebble Goods LLC | Pebble`,
  },
]
