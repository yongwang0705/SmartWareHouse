import type {
  DeliveryDestination, DeliveryMode, DeliveryQuote, Order,
} from '../types';

/**
 * Delivery planning for orders completed in the warehouse.
 *
 * All rates and transit times below are representative demo data for the
 * Montréal distribution centre. The quotes are deterministic so the
 * recommendation stays stable while the user compares the three modes.
 */

export const ORIGIN_LABEL = 'Montréal, QC (YUL / Port of Montréal)';
export const DEFAULT_DESTINATION_CODE = 'toronto';

export const DELIVERY_DESTINATIONS: DeliveryDestination[] = [
  // Canada
  { code: 'quebec', city: 'Québec City', region: 'QC', country: 'CA', distanceKm: 255, seaport: true },
  { code: 'toronto', city: 'Toronto', region: 'ON', country: 'CA', distanceKm: 540, seaport: false },
  { code: 'ottawa', city: 'Ottawa', region: 'ON', country: 'CA', distanceKm: 200, seaport: false },
  { code: 'halifax', city: 'Halifax', region: 'NS', country: 'CA', distanceKm: 1240, seaport: true },
  { code: 'saint-john', city: 'Saint John', region: 'NB', country: 'CA', distanceKm: 740, seaport: true },
  { code: 'moncton', city: 'Moncton', region: 'NB', country: 'CA', distanceKm: 1000, seaport: false },
  { code: 'winnipeg', city: 'Winnipeg', region: 'MB', country: 'CA', distanceKm: 2350, seaport: false },
  { code: 'calgary', city: 'Calgary', region: 'AB', country: 'CA', distanceKm: 3780, seaport: false },
  { code: 'edmonton', city: 'Edmonton', region: 'AB', country: 'CA', distanceKm: 4090, seaport: false },
  { code: 'vancouver', city: 'Vancouver', region: 'BC', country: 'CA', distanceKm: 4850, seaport: true },
  { code: 'st-johns', city: "St. John's", region: 'NL', country: 'CA', distanceKm: 2050, seaport: true },

  // United States
  { code: 'new-york', city: 'New York', region: 'NY', country: 'US', distanceKm: 600, seaport: true },
  { code: 'boston', city: 'Boston', region: 'MA', country: 'US', distanceKm: 510, seaport: true },
  { code: 'philadelphia', city: 'Philadelphia', region: 'PA', country: 'US', distanceKm: 700, seaport: true },
  { code: 'baltimore', city: 'Baltimore', region: 'MD', country: 'US', distanceKm: 830, seaport: true },
  { code: 'norfolk', city: 'Norfolk', region: 'VA', country: 'US', distanceKm: 1050, seaport: true },
  { code: 'savannah', city: 'Savannah', region: 'GA', country: 'US', distanceKm: 1780, seaport: true },
  { code: 'miami', city: 'Miami', region: 'FL', country: 'US', distanceKm: 2680, seaport: true },
  { code: 'chicago', city: 'Chicago', region: 'IL', country: 'US', distanceKm: 1370, seaport: false },
  { code: 'detroit', city: 'Detroit', region: 'MI', country: 'US', distanceKm: 890, seaport: false },
  { code: 'buffalo', city: 'Buffalo', region: 'NY', country: 'US', distanceKm: 640, seaport: false },
  { code: 'cleveland', city: 'Cleveland', region: 'OH', country: 'US', distanceKm: 950, seaport: false },
  { code: 'atlanta', city: 'Atlanta', region: 'GA', country: 'US', distanceKm: 1900, seaport: false },
  { code: 'dallas', city: 'Dallas', region: 'TX', country: 'US', distanceKm: 2600, seaport: false },
  { code: 'houston', city: 'Houston', region: 'TX', country: 'US', distanceKm: 3000, seaport: true },
  { code: 'denver', city: 'Denver', region: 'CO', country: 'US', distanceKm: 3000, seaport: false },
  { code: 'phoenix', city: 'Phoenix', region: 'AZ', country: 'US', distanceKm: 4050, seaport: false },
  { code: 'los-angeles', city: 'Los Angeles', region: 'CA', country: 'US', distanceKm: 4930, seaport: true },
  { code: 'san-francisco', city: 'San Francisco', region: 'CA', country: 'US', distanceKm: 4900, seaport: true },
  { code: 'seattle', city: 'Seattle', region: 'WA', country: 'US', distanceKm: 4900, seaport: true },

  // Overseas
  { code: 'london', city: 'London', region: 'United Kingdom', country: 'INTL', distanceKm: 5600, seaport: true },
  { code: 'rotterdam', city: 'Rotterdam', region: 'Netherlands', country: 'INTL', distanceKm: 5900, seaport: true },
  { code: 'hamburg', city: 'Hamburg', region: 'Germany', country: 'INTL', distanceKm: 6200, seaport: true },
  { code: 'shanghai', city: 'Shanghai', region: 'China', country: 'INTL', distanceKm: 11800, seaport: true },
  { code: 'tokyo', city: 'Tokyo', region: 'Japan', country: 'INTL', distanceKm: 10600, seaport: true },
  { code: 'singapore', city: 'Singapore', region: 'Singapore', country: 'INTL', distanceKm: 15200, seaport: true },
  { code: 'sydney', city: 'Sydney', region: 'Australia', country: 'INTL', distanceKm: 16500, seaport: true },
  { code: 'dubai', city: 'Dubai', region: 'UAE', country: 'INTL', distanceKm: 11000, seaport: true },
  { code: 'sao-paulo', city: 'São Paulo', region: 'Brazil', country: 'INTL', distanceKm: 8200, seaport: true },
  { code: 'mexico-city', city: 'Mexico City', region: 'Mexico', country: 'INTL', distanceKm: 4000, seaport: false },
];

export interface CargoEstimate {
  units: number;
  weightKg: number;
  volumeM3: number;
}

/**
 * Orders do not carry packing dimensions, so weight and volume are estimated
 * per product with stable pseudo-dimensions derived from the product id.
 */
export function estimateCargo(order: Order): CargoEstimate {
  const items = order.items ?? [];
  let units = 0;
  let weightKg = 0;
  let volumeM3 = 0;

  for (const item of items) {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const weightPerUnit = 9 + (Math.abs(item.productId) % 8) * 2.4;
    const volumePerUnit = 0.035 + (Math.abs(item.productId) % 6) * 0.012;
    units += quantity;
    weightKg += quantity * weightPerUnit;
    volumeM3 += quantity * volumePerUnit;
  }

  return {
    units,
    weightKg: Math.round(weightKg),
    volumeM3: Math.round(volumeM3 * 10) / 10,
  };
}

export function deadlineDays(order: Order): number {
  if (!order.dueDate) return 7;
  const due = new Date(order.dueDate).getTime();
  if (Number.isNaN(due)) return 7;
  return Math.max(0, Math.ceil((due - Date.now()) / 86_400_000));
}

export function findDestination(code: string): DeliveryDestination {
  return DELIVERY_DESTINATIONS.find((destination) => destination.code === code)
    ?? DELIVERY_DESTINATIONS.find((destination) => destination.code === DEFAULT_DESTINATION_CODE)
    ?? DELIVERY_DESTINATIONS[0];
}

interface SeaCarrier {
  name: string;
  base: number;
  perKm: number;
  speedKmDay: number;
  portFee: number;
  handlingDays: number;
  lclBase: number;
  lclPerM3: number;
  lclPerKg: number;
  lclPerKm: number;
}

interface AirCarrier {
  name: string;
  base: number;
  perKg: number;
  speedKmDay: number;
  securityFee: number;
}

interface FreightCarrier {
  name: string;
  base: number;
  ltlPerKm: number;
  perKg: number;
  perM3: number;
  ftlBase: number;
  ftlPerKm: number;
}

const SEA_CARRIERS: SeaCarrier[] = [
  {
    name: 'Maersk Line', base: 840, perKm: 0.185, speedKmDay: 760,
    portFee: 240, handlingDays: 2, lclBase: 250, lclPerM3: 52, lclPerKg: 0.10,
    lclPerKm: 0.017,
  },
  {
    name: 'CMA CGM', base: 880, perKm: 0.175, speedKmDay: 720,
    portFee: 225, handlingDays: 2, lclBase: 265, lclPerM3: 49, lclPerKg: 0.11,
    lclPerKm: 0.018,
  },
  {
    name: 'MSC', base: 920, perKm: 0.168, speedKmDay: 700,
    portFee: 210, handlingDays: 3, lclBase: 240, lclPerM3: 55, lclPerKg: 0.095,
    lclPerKm: 0.019,
  },
];

const AIR_CARRIERS: AirCarrier[] = [
  { name: 'Cargojet', base: 280, perKg: 1.05, speedKmDay: 8200, securityFee: 85 },
  { name: 'Air Canada Cargo', base: 320, perKg: 0.98, speedKmDay: 8600, securityFee: 95 },
  { name: 'FedEx Express', base: 350, perKg: 1.18, speedKmDay: 9000, securityFee: 75 },
];

const FREIGHT_CARRIERS: FreightCarrier[] = [
  { name: 'Day & Ross', base: 135, ltlPerKm: 0.50, perKg: 0.032, perM3: 18, ftlBase: 260, ftlPerKm: 2.05 },
  { name: 'TFI International', base: 150, ltlPerKm: 0.46, perKg: 0.035, perM3: 20, ftlBase: 250, ftlPerKm: 1.98 },
  { name: 'TransX', base: 125, ltlPerKm: 0.54, perKg: 0.028, perM3: 16, ftlBase: 275, ftlPerKm: 2.15 },
  { name: 'XPO', base: 165, ltlPerKm: 0.43, perKg: 0.038, perM3: 22, ftlBase: 240, ftlPerKm: 1.92 },
];

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const customsDays = (destination: DeliveryDestination) =>
  destination.country === 'CA' ? 0 : 1;

const customsFees = (destination: DeliveryDestination) =>
  destination.country === 'CA' ? 0 : 220;

interface Candidate {
  quote: DeliveryQuote;
  transitDays: number;
}

function pickBest(candidates: Candidate[], deadline: number): Candidate {
  const onTime = candidates.filter((candidate) => candidate.transitDays <= deadline);
  const pool = onTime.length > 0 ? onTime : candidates;
  return pool.reduce((best, candidate) =>
    candidate.quote.price < best.quote.price ? candidate : best);
}

function seaContainers(cargo: CargoEstimate) {
  const fortyFoot = cargo.volumeM3 > 28 || cargo.weightKg > 21_000;
  const volumeCapacity = fortyFoot ? 60 : 28;
  const weightCapacity = fortyFoot ? 24_000 : 21_000;
  const count = Math.max(
    1,
    Math.ceil(cargo.volumeM3 / volumeCapacity),
    Math.ceil(cargo.weightKg / weightCapacity),
  );
  const type = fortyFoot ? "40' HC" : "20' dry";
  return {
    count,
    label: `${count} × ${type} container${count === 1 ? '' : 's'} (${volumeCapacity} m³ / ${(weightCapacity / 1000)} t each)`,
  };
}

function unavailableQuote(
  mode: DeliveryMode,
  label: string,
  reason: string,
): DeliveryQuote {
  return {
    mode,
    label,
    carrier: '—',
    destination: '',
    distanceKm: 0,
    transitDays: 0,
    price: 0,
    container: '',
    capacityLabel: '—',
    available: false,
    unavailableReason: reason,
    meetsDeadline: false,
    recommended: false,
    note: reason,
  };
}

function buildSeaQuote(
  destination: DeliveryDestination,
  cargo: CargoEstimate,
  deadline: number,
): DeliveryQuote {
  if (!destination.seaport) {
    return unavailableQuote(
      'SEA',
      'Sea freight',
      'No seaport at this destination. Sea freight requires a port and final-mile drayage.',
    );
  }

  const containers = seaContainers(cargo);
  const routeKm = destination.distanceKm * 1.18;
  const borderDays = customsDays(destination);
  const borderFee = customsFees(destination);
  // Small shipments move as LCL (a share of a 20' container); once the cargo
  // no longer fits comfortably in a shared box, whole containers are quoted.
  const lcl = cargo.volumeM3 <= 15 && cargo.weightKg <= 10_000;
  const capacityLabel = lcl
    ? `LCL · ${cargo.volumeM3} m³ / ${cargo.weightKg.toLocaleString('en-CA')} kg (shared 20' container)`
    : containers.label;

  const candidates = SEA_CARRIERS.map((carrier) => {
    const transitDays = Math.ceil(
      routeKm / carrier.speedKmDay
        + carrier.handlingDays
        + (lcl ? 2 : 0)
        + borderDays,
    );
    const price = roundMoney(
      lcl
        ? carrier.lclBase
          + cargo.volumeM3 * carrier.lclPerM3
          + cargo.weightKg * carrier.lclPerKg
          + routeKm * carrier.lclPerKm
          + borderFee
        : (carrier.base + routeKm * carrier.perKm + carrier.portFee + borderFee)
          * containers.count,
    );
    return {
      transitDays,
      quote: {
        mode: 'SEA' as const,
        label: 'Sea freight',
        carrier: carrier.name,
        destination: `${destination.city}, ${destination.region}`,
        distanceKm: destination.distanceKm,
        transitDays,
        price,
        container: lcl ? 'LCL' : containers.label,
        capacityLabel,
        available: true,
        meetsDeadline: transitDays <= deadline,
        recommended: false,
        note: '',
      },
    };
  });

  return pickBest(candidates, deadline).quote;
}

function buildAirQuote(
  destination: DeliveryDestination,
  cargo: CargoEstimate,
  deadline: number,
): DeliveryQuote {
  const chargeableWeight = Math.max(cargo.weightKg, cargo.volumeM3 * 167);
  const uldCount = Math.max(1, Math.ceil(chargeableWeight / 1200));
  const borderDays = customsDays(destination);
  const borderFee = customsFees(destination);

  const candidates = AIR_CARRIERS.map((carrier) => {
    const transitDays = Math.max(
      2,
      1 + Math.ceil(destination.distanceKm / carrier.speedKmDay) + borderDays,
    );
    const price = roundMoney(
      carrier.base
        + chargeableWeight * (carrier.perKg + destination.distanceKm / 20_000)
        + carrier.securityFee
        + borderFee,
    );
    return {
      transitDays,
      quote: {
        mode: 'AIR' as const,
        label: 'Air freight',
        carrier: carrier.name,
        destination: `${destination.city}, ${destination.region}`,
        distanceKm: destination.distanceKm,
        transitDays,
        price,
        container: `${uldCount} × air ULD`,
        capacityLabel: `${uldCount} × ULD (1.2 t / 10 m³ each)`,
        available: true,
        meetsDeadline: transitDays <= deadline,
        recommended: false,
        note: '',
      },
    };
  });

  return pickBest(candidates, deadline).quote;
}

function buildFreightQuote(
  destination: DeliveryDestination,
  cargo: CargoEstimate,
  deadline: number,
): DeliveryQuote {
  if (destination.country === 'INTL') {
    return unavailableQuote(
      'FREIGHT',
      'Truck freight',
      'Road freight covers Canada and the continental US only. Use sea or air for overseas lanes.',
    );
  }

  const ltl = cargo.weightKg <= 5000 && cargo.volumeM3 <= 25;
  const borderFee = customsFees(destination);
  const truckCount = Math.max(
    1,
    Math.ceil(cargo.weightKg / 24_000),
    Math.ceil(cargo.volumeM3 / 60),
  );
  const capacityLabel = ltl
    ? `LTL · shared 53' trailer (${cargo.weightKg.toLocaleString('en-CA')} kg booked)`
    : `${truckCount} × 53' dry van (24 t / 60 m³ each)`;

  const candidates = FREIGHT_CARRIERS.map((carrier) => {
    const transitDays = Math.max(
      1,
      Math.ceil(
        0.4
        + destination.distanceKm / 800
        + (destination.country === 'US' ? 0.8 : 0),
      ),
    );
    const price = roundMoney(
      ltl
        ? carrier.base
          + destination.distanceKm * carrier.ltlPerKm
          + cargo.weightKg * carrier.perKg
          + cargo.volumeM3 * carrier.perM3
          + borderFee
        : (carrier.ftlBase + destination.distanceKm * carrier.ftlPerKm)
          * truckCount
          + borderFee,
    );
    return {
      transitDays,
      quote: {
        mode: 'FREIGHT' as const,
        label: 'Truck freight',
        carrier: carrier.name,
        destination: `${destination.city}, ${destination.region}`,
        distanceKm: destination.distanceKm,
        transitDays,
        price,
        container: ltl ? 'LTL' : `${truckCount} × 53' dry van`,
        capacityLabel,
        available: true,
        meetsDeadline: transitDays <= deadline,
        recommended: false,
        note: '',
      },
    };
  });

  return pickBest(candidates, deadline).quote;
}

export interface DeliveryPlan {
  destination: DeliveryDestination;
  cargo: CargoEstimate;
  deadlineDays: number;
  quotes: DeliveryQuote[];
  recommendedMode: DeliveryMode | null;
  recommendationReason: string;
}

export function buildDeliveryPlan(
  order: Order,
  destinationCode: string,
): DeliveryPlan {
  const destination = findDestination(destinationCode);
  const cargo = estimateCargo(order);
  const days = deadlineDays(order);

  const quotes = [
    buildSeaQuote(destination, cargo, days),
    buildAirQuote(destination, cargo, days),
    buildFreightQuote(destination, cargo, days),
  ];

  const feasible = quotes.filter(
    (quote) => quote.available && quote.meetsDeadline,
  );

  let recommendedMode: DeliveryMode | null = null;
  let recommendationReason = '';

  if (feasible.length === 0) {
    const fastest = quotes
      .filter((quote) => quote.available)
      .sort((a, b) => a.transitDays - b.transitDays || a.price - b.price)[0];
    if (fastest) {
      recommendedMode = fastest.mode;
      recommendationReason = `No mode meets the ${days}-day deadline. ${fastest.label} is the fastest available option.`;
    } else {
      recommendationReason = 'No delivery mode is available for this destination.';
    }
  } else {
    const sea = feasible.find((quote) => quote.mode === 'SEA');
    const freight = feasible.find((quote) => quote.mode === 'FREIGHT');

    if (destination.seaport && sea) {
      recommendedMode = 'SEA';
      recommendationReason = `${destination.city} is a seaport, so sea freight is recommended for this lane.`;
    } else if (destination.country === 'US' && days >= 10 && freight) {
      recommendedMode = 'FREIGHT';
      recommendationReason = `US destination with ${days} days before the deadline, so truck freight is recommended.`;
    } else {
      const cheapest = feasible.reduce((best, quote) =>
        quote.price < best.price ? quote : best);
      recommendedMode = cheapest.mode;
      recommendationReason = `${cheapest.label} is the most economical option that still meets the ${days}-day deadline.`;
    }
  }

  const decorated = quotes.map((quote) => {
    const recommended = quote.mode === recommendedMode;
    let note = quote.note;

    if (!quote.available) {
      note = quote.unavailableReason ?? 'Unavailable for this lane.';
    } else if (!quote.meetsDeadline) {
      note = `Misses the deadline by ${quote.transitDays - days} day${quote.transitDays - days === 1 ? '' : 's'}.`;
    } else if (recommended) {
      note = recommendationReason;
    } else {
      const spare = days - quote.transitDays;
      note = `Meets deadline${spare > 0 ? ` with ${spare} day${spare === 1 ? '' : 's'} to spare` : ' on the due date'}.`;
    }

    return { ...quote, recommended, note };
  });

  return {
    destination,
    cargo,
    deadlineDays: days,
    quotes: decorated,
    recommendedMode,
    recommendationReason,
  };
}
