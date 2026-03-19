// ---------------------------------------------------------------------------
// Mock data — coherent sales story shared across analytics tools
// ---------------------------------------------------------------------------

export const SOURCES = [
  {
    id: "ds-sales",
    name: "Sales Database",
    type: "postgresql",
    rowCount: 45230,
  },
  { id: "ds-crm", name: "CRM Export", type: "csv", rowCount: 12840 },
  { id: "ds-web", name: "Web Analytics", type: "bigquery", rowCount: 198400 },
  {
    id: "ds-inventory",
    name: "Inventory System",
    type: "mysql",
    rowCount: 8920,
  },
];

export const SCHEMA = [
  { name: "date", type: "date" },
  { name: "product", type: "string" },
  { name: "region", type: "string" },
  { name: "revenue", type: "number" },
  { name: "units_sold", type: "number" },
  { name: "cost", type: "number" },
  { name: "customer_id", type: "string" },
  { name: "channel", type: "string" },
];

export const SAMPLE_ROWS = [
  {
    date: "2025-01-15",
    product: "Widget Pro",
    region: "North",
    revenue: 349,
    units_sold: 7,
    cost: 140,
    customer_id: "C-1042",
    channel: "online",
  },
  {
    date: "2025-01-16",
    product: "Gadget Plus",
    region: "West",
    revenue: 189,
    units_sold: 3,
    cost: 72,
    customer_id: "C-2187",
    channel: "retail",
  },
  {
    date: "2025-01-17",
    product: "Widget Pro",
    region: "South",
    revenue: 498,
    units_sold: 10,
    cost: 200,
    customer_id: "C-3301",
    channel: "online",
  },
];

export const QUERY_ROWS = [
  {
    date: "2025-01-15",
    product: "Widget Pro",
    region: "North",
    revenue: 349,
    units_sold: 7,
  },
  {
    date: "2025-01-16",
    product: "Gadget Plus",
    region: "West",
    revenue: 189,
    units_sold: 3,
  },
  {
    date: "2025-01-17",
    product: "Widget Pro",
    region: "South",
    revenue: 498,
    units_sold: 10,
  },
  {
    date: "2025-01-18",
    product: "Gizmo Basic",
    region: "East",
    revenue: 124,
    units_sold: 4,
  },
  {
    date: "2025-01-19",
    product: "Widget Pro",
    region: "North",
    revenue: 412,
    units_sold: 8,
  },
  {
    date: "2025-01-20",
    product: "Gadget Plus",
    region: "West",
    revenue: 67,
    units_sold: 1,
  },
  {
    date: "2025-01-21",
    product: "Widget Pro",
    region: "South",
    revenue: 523,
    units_sold: 11,
  },
  {
    date: "2025-01-22",
    product: "Gizmo Basic",
    region: "East",
    revenue: 248,
    units_sold: 8,
  },
  {
    date: "2025-01-23",
    product: "Widget Pro",
    region: "North",
    revenue: 156,
    units_sold: 3,
  },
  {
    date: "2025-01-24",
    product: "Gadget Plus",
    region: "South",
    revenue: 312,
    units_sold: 6,
  },
];

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
