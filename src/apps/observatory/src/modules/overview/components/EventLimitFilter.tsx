import { EVENT_LIMIT_OPTIONS } from "../event-limit";

export function EventLimitFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (limit: number) => void;
}) {
  return (
    <label className="filter event-limit-filter">
      Show
      <select
        aria-label="Number of recent events"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {EVENT_LIMIT_OPTIONS.map((limit) => (
          <option key={limit} value={limit}>
            {limit}
          </option>
        ))}
      </select>
      events
    </label>
  );
}
