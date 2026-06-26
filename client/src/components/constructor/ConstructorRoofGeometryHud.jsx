import { useCallback, useEffect, useState } from 'react';
import { getRoofBlueprint } from '../../utils/constructor/roofGeometryEdit.js';
import {
  clampDecimal,
  commitOnEnterKey,
  formatDecimalValue,
  parseDecimalInput,
  sanitizeDecimalTyping,
} from '../../utils/constructor/decimalInput.js';

function HudChip({
  x,
  y,
  label,
  value,
  unit,
  selected,
  kind,
  onCommit,
  onSelect,
  title,
}) {
  const decimals = kind === 'angle' ? 1 : 2;
  const [draft, setDraft] = useState(() => formatDecimalValue(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatDecimalValue(value, decimals));
  }, [value, focused, decimals]);

  if (x == null || y == null) return null;

  const commit = () => {
    const parsed = parseDecimalInput(draft);
    if (parsed == null) {
      setDraft(formatDecimalValue(value, decimals));
      setFocused(false);
      return;
    }
    const min = kind === 'angle' ? 1 : 0.1;
    const max = kind === 'angle' ? 179 : 500;
    onCommit?.(clampDecimal(parsed, min, max, decimals));
    setFocused(false);
  };

  const cancel = () => {
    setDraft(formatDecimalValue(value, decimals));
    setFocused(false);
  };

  return (
    <div
      role="group"
      className={`constructor-geo-hud__chip${selected ? ' constructor-geo-hud__chip--selected' : ''}`}
      style={{ left: x, top: y }}
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect?.()}
    >
      <span className="constructor-geo-hud__chip-label">{label}</span>
      <input
        className="constructor-geo-hud__chip-input"
        type="text"
        inputMode="decimal"
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => {
          e.stopPropagation();
          setFocused(true);
          onSelect?.();
          e.target.select();
        }}
        onChange={(e) => setDraft(sanitizeDecimalTyping(e.target.value))}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            cancel();
            e.currentTarget.blur();
            return;
          }
          commitOnEnterKey(e, commit);
        }}
        onBlur={commit}
      />
      <span className="constructor-geo-hud__chip-unit">{unit}</span>
    </div>
  );
}

/** Подписи длин и углов поверх карты в режиме чертежа */
export default function ConstructorRoofGeometryHud({
  roofPolygon,
  drawMode,
  selectedRoofVertexIndex,
  selectedRoofEdgeIndex,
  slopeEaveEdgeIndex,
  projectLatLng,
  onEdgeLengthChange,
  onVertexAngleChange,
  onVertexSelect,
  onEdgeSelect,
}) {
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (drawMode !== 'refine' || !projectLatLng?.subscribe) return undefined;
    return projectLatLng.subscribe(bump);
  }, [drawMode, projectLatLng, bump]);

  if (drawMode !== 'refine' || !roofPolygon?.length >= 3 || !projectLatLng?.project) {
    return null;
  }

  const blueprint = getRoofBlueprint(roofPolygon);
  const project = projectLatLng.project;

  return (
    <div className="constructor-geo-hud" aria-hidden>
      {blueprint.edges.map((edge) => {
        const pt = project(edge.midLat, edge.midLng);
        const isEave = slopeEaveEdgeIndex === edge.index;
        return (
          <HudChip
            key={`e-${edge.index}`}
            x={pt?.x}
            y={pt?.y}
            label={isEave ? 'К' : 'L'}
            value={edge.lengthM}
            unit="м"
            kind="length"
            selected={selectedRoofEdgeIndex === edge.index || isEave}
            title={`${isEave ? 'Карниз ската' : 'Длина стороны'} ${edge.index + 1} · Enter — применить`}
            onSelect={() => onEdgeSelect?.(edge.index)}
            onCommit={(v) => onEdgeLengthChange?.(edge.index, v)}
          />
        );
      })}
      {blueprint.vertices.map((v) => {
        const pt = project(v.lat, v.lng);
        return (
          <HudChip
            key={`v-${v.index}`}
            x={pt?.x}
            y={pt?.y}
            label="∠"
            value={v.interiorAngleDeg}
            unit="°"
            kind="angle"
            selected={selectedRoofVertexIndex === v.index}
            title={`Угол в вершине ${v.index + 1} · Enter — применить`}
            onSelect={() => onVertexSelect?.(v.index)}
            onCommit={(num) => onVertexAngleChange?.(v.index, num)}
          />
        );
      })}
    </div>
  );
}
