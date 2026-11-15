import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck, faLightbulb, faLocationDot, faPlane, faShip,
  faTruck, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type {
  DeliveryMode, DeliveryQuote, Order,
} from '../types';
import {
  buildDeliveryPlan, DEFAULT_DESTINATION_CODE, DELIVERY_DESTINATIONS,
  ORIGIN_LABEL,
} from '../utils/delivery';

const money = (amount: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const MODE_ICON = {
  SEA: faShip,
  AIR: faPlane,
  FREIGHT: faTruck,
} satisfies Record<DeliveryMode, typeof faShip>;

const COUNTRY_LABEL = {
  CA: 'Canada',
  US: 'United States',
  INTL: 'International',
} as const;

interface Props {
  order: Order;
  onChange: (quote: DeliveryQuote | null) => void;
}

export default function DeliveryPlanner({ order, onChange }: Props) {
  const [destinationCode, setDestinationCode] = useState(DEFAULT_DESTINATION_CODE);
  const plan = useMemo(
    () => buildDeliveryPlan(order, destinationCode),
    [order, destinationCode],
  );
  const [selectedMode, setSelectedMode] = useState<DeliveryMode | null>(
    plan.recommendedMode,
  );

  // Moving to another destination re-selects the planner's recommendation.
  // The user can always click a different card afterwards.
  useEffect(() => {
    setSelectedMode(plan.recommendedMode);
  }, [destinationCode, plan.recommendedMode]);

  const selected = plan.quotes.find(
    (quote) => quote.mode === selectedMode && quote.available,
  ) ?? null;

  useEffect(() => {
    onChange(selected);
  }, [selected, onChange]);

  const recommended = plan.quotes.find((quote) => quote.recommended && quote.available);

  return (
    <div className="delivery-planner">
      <div className="form-section-title">
        <span>DELIVERY PLAN</span>
        <span className="delivery-origin">
          <FontAwesomeIcon icon={faLocationDot} /> From {ORIGIN_LABEL}
        </span>
      </div>

      <div className="delivery-controls">
        <label className="field-label delivery-destination">
          Destination
          <select
            className="form-input"
            value={destinationCode}
            onChange={(event) => setDestinationCode(event.target.value)}
          >
            {(['CA', 'US', 'INTL'] as const).map((country) => (
              <optgroup key={country} label={COUNTRY_LABEL[country]}>
                {DELIVERY_DESTINATIONS
                  .filter((destination) => destination.country === country)
                  .map((destination) => (
                    <option key={destination.code} value={destination.code}>
                      {destination.city}, {destination.region}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="delivery-facts">
          <div>
            <small>DISTANCE</small>
            <strong>{plan.destination.distanceKm.toLocaleString('en-CA')} km</strong>
          </div>
          <div>
            <small>EST. CARGO</small>
            <strong>
              {plan.cargo.weightKg.toLocaleString('en-CA')} kg · {plan.cargo.volumeM3} m³
            </strong>
          </div>
          <div>
            <small>TIME TO DEADLINE</small>
            <strong>{plan.deadlineDays} day{plan.deadlineDays === 1 ? '' : 's'}</strong>
          </div>
        </div>
      </div>

      <div className={`delivery-recommendation ${recommended ? '' : 'delivery-recommendation-warn'}`}>
        <span className="delivery-recommendation-icon">
          <FontAwesomeIcon icon={recommended ? faLightbulb : faTriangleExclamation} />
        </span>
        <div>
          <strong>
            {recommended
              ? `Recommended: ${recommended.label} via ${recommended.carrier}`
              : 'No mode fully meets the deadline'}
          </strong>
          <p>{plan.recommendationReason}</p>
        </div>
        {recommended && <span className="delivery-recommendation-price">{money(recommended.price)}</span>}
      </div>

      <div className="delivery-options">
        {plan.quotes.map((quote) => {
          const isSelected = quote.mode === selectedMode;
          return (
            <button
              key={quote.mode}
              type="button"
              className={[
                'delivery-option',
                isSelected ? 'delivery-option-selected' : '',
                quote.recommended ? 'delivery-option-recommended' : '',
                quote.available ? '' : 'delivery-option-unavailable',
              ].filter(Boolean).join(' ')}
              disabled={!quote.available}
              aria-pressed={isSelected}
              onClick={() => setSelectedMode(quote.mode)}
            >
              <div className="delivery-option-head">
                <span className={`delivery-mode-badge delivery-mode-${quote.mode.toLowerCase()}`}>
                  <FontAwesomeIcon icon={MODE_ICON[quote.mode]} />
                </span>
                <span className="delivery-option-title">
                  <strong>{quote.label}</strong>
                  <small>{quote.available ? quote.carrier : 'Unavailable for this lane'}</small>
                </span>
                {quote.recommended && !isSelected && <span className="delivery-recommend-badge">Recommended</span>}
                {isSelected && <span className="delivery-selected-badge"><FontAwesomeIcon icon={faCircleCheck} /> Selected</span>}
              </div>

              <div className="delivery-option-stats">
                <div>
                  <small>TRANSIT</small>
                  <strong>{quote.available ? `${quote.transitDays} day${quote.transitDays === 1 ? '' : 's'}` : '—'}</strong>
                </div>
                <div>
                  <small>CAPACITY</small>
                  <strong>{quote.available ? quote.capacityLabel : '—'}</strong>
                </div>
                <div>
                  <small>PRICE</small>
                  <strong>{quote.available ? money(quote.price) : '—'}</strong>
                </div>
              </div>

              <div className={`delivery-option-note ${quote.available && !quote.meetsDeadline ? 'delivery-option-note-warn' : ''}`}>
                {quote.available && !quote.meetsDeadline && <FontAwesomeIcon icon={faTriangleExclamation} />}
                {quote.note}
              </div>
            </button>
          );
        })}
      </div>

      <p className="delivery-disclaimer">
        {selected
          ? <>Your choice: <strong>{selected.label} via {selected.carrier}</strong> · {money(selected.price)} · {selected.transitDays} day{selected.transitDays === 1 ? '' : 's'} transit.</>
          : 'Select an available delivery option to continue.'}
        {' '}Quotes are estimates in CAD and you make the final choice.
      </p>
    </div>
  );
}

export function DeliveryReceipt({ order }: { order: Order }) {
  if (!order.deliveryMode) return null;

  const quote = {
    SEA: 'Sea freight',
    AIR: 'Air freight',
    FREIGHT: 'Truck freight',
  }[order.deliveryMode];

  return (
    <div className="delivery-receipt">
      <div className="form-section-title"><span>DELIVERY BOOKED</span><span>{order.deliveredAt ? 'Completed' : '—'}</span></div>
      <div className="delivery-receipt-grid">
        <div><small>MODE</small><strong>{quote}</strong></div>
        <div><small>CARRIER</small><strong>{order.deliveryCarrier || '—'}</strong></div>
        <div><small>DESTINATION</small><strong>{order.deliveryDestination || '—'}</strong></div>
        <div><small>DISTANCE</small><strong>{order.deliveryDistanceKm != null ? `${Number(order.deliveryDistanceKm).toLocaleString('en-CA')} km` : '—'}</strong></div>
        <div><small>TRANSIT</small><strong>{order.deliveryTransitDays != null ? `${order.deliveryTransitDays} days` : '—'}</strong></div>
        <div><small>CAPACITY</small><strong>{order.deliveryContainer || '—'}</strong></div>
        <div><small>DELIVERY COST</small><strong>{order.deliveryPrice != null ? money(Number(order.deliveryPrice)) : '—'}</strong></div>
      </div>
    </div>
  );
}
