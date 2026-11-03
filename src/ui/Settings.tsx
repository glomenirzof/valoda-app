import type { Settings as S } from '../core/types';

export function Settings({ value, onChange }: { value: S; onChange: (s: S) => void }) {
  return (
    <div class="list">
      <label class="setting">
        <span>
          <b>Непроверенные фразы в тренировках</b>
          <small>Фразы, которые ещё не проверил репетитор. В тренировке будут с пометкой «не проверено».</small>
        </span>
        <input
          type="checkbox"
          class="switch"
          checked={value.allowUnverified}
          onChange={(e) => onChange({ ...value, allowUnverified: (e.target as HTMLInputElement).checked })}
        />
      </label>
      <label class="setting">
        <span>
          <b>Новых фраз в день</b>
          <small>8–12. При большом долге повторений новые встают на паузу сами.</small>
        </span>
        <select
          class="select"
          value={value.newPerDay}
          onChange={(e) => onChange({ ...value, newPerDay: Number((e.target as HTMLSelectElement).value) })}
        >
          {[8, 9, 10, 11, 12].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
