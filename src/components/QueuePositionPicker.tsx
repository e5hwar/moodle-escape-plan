import { Fragment } from "react";

export type QueuePickItem = { id: string; headingEn: string };

/**
 * Scrollable queue with clickable "insert here" slots between every pair of
 * existing items. `index` is the chosen slot (0..items.length); the moving /
 * new item is rendered as a dashed placeholder at that slot.
 */
export function QueuePositionPicker({
  items,
  index,
  onChange,
  movingLabel,
}: {
  items: QueuePickItem[];
  index: number;
  onChange: (i: number) => void;
  movingLabel: string;
}) {
  return (
    <div className="sp-qpicker">
      <PickerSlot
        index={0}
        selected={index === 0}
        onSelect={onChange}
        movingLabel={movingLabel}
      />
      {items.map((s, i) => {
        const displayPos = i + 1 + (index <= i ? 1 : 0);
        return (
          <Fragment key={s.id}>
            <div className="sp-qpicker-item">
              <span className="sp-qpicker-item-pos">{displayPos}</span>
              <span className="sp-qpicker-item-name">{s.headingEn}</span>
            </div>
            <PickerSlot
              index={i + 1}
              selected={index === i + 1}
              onSelect={onChange}
              movingLabel={movingLabel}
              isEnd={i + 1 === items.length}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function PickerSlot({
  index,
  selected,
  onSelect,
  movingLabel,
  isEnd,
}: {
  index: number;
  selected: boolean;
  onSelect: (i: number) => void;
  movingLabel: string;
  isEnd?: boolean;
}) {
  if (selected) {
    return (
      <div className="sp-qpicker-new">
        <span className="sp-qpicker-new-pos">{index + 1}</span>
        <span className="sp-qpicker-new-name">{movingLabel}</span>
        <span className="sp-qpicker-new-tag">NEW</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="sp-qpicker-slot"
      onClick={() => onSelect(index)}
    >
      <span className="sp-qpicker-slot-line" />
      <span className="sp-qpicker-slot-label">
        + Insert here{isEnd ? " (end)" : ""}
      </span>
      <span className="sp-qpicker-slot-line" />
    </button>
  );
}
