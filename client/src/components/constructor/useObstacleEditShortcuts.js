import { useCallback, useEffect, useRef } from 'react';
import { duplicateObstacle, snapshotObstacles } from '../../utils/constructor/obstacleEditHistory.js';
import { migrateObstacle } from '../../utils/constructor/obstacles.js';
import { getPolygonRef } from '../../utils/constructor/roofFacets.js';

const MAX_UNDO = 60;

function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"]');
}

/**
 * Ctrl+C / Ctrl+V / Ctrl+Z для препятствий на карте и в 3D.
 */
export function useObstacleEditShortcuts({
  enabled = true,
  obstacles,
  selectedObstacleId,
  roofPolygon,
  onMutateObstacles,
}) {
  const clipboardRef = useRef(null);
  const pasteGenRef = useRef(0);
  const undoRef = useRef([]);

  const recordUndo = useCallback((currentObstacles) => {
    undoRef.current.push(snapshotObstacles(currentObstacles));
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
  }, []);

  const mutateObstacles = useCallback((recipe) => {
    onMutateObstacles((s) => {
      recordUndo(s.obstacles);
      return recipe(s);
    });
  }, [onMutateObstacles, recordUndo]);

  const copySelected = useCallback(() => {
    const obs = (obstacles || []).find((o) => o.id === selectedObstacleId);
    if (!obs) return false;
    clipboardRef.current = migrateObstacle(obs);
    pasteGenRef.current = 0;
    return true;
  }, [obstacles, selectedObstacleId]);

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current || !roofPolygon || roofPolygon.length < 3) return false;
    const { refLat, refLng } = getPolygonRef(roofPolygon);
    pasteGenRef.current += 1;
    const dup = duplicateObstacle(
      clipboardRef.current,
      refLat,
      refLng,
      pasteGenRef.current * 1.2,
    );
    mutateObstacles((s) => ({
      ...s,
      obstacles: [...(s.obstacles || []), dup],
      selectedObstacleId: dup.id,
      obstacleShape: dup.shape,
    }));
    return true;
  }, [roofPolygon, mutateObstacles]);

  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (!stack.length) return false;
    const prev = stack.pop();
    onMutateObstacles((s) => ({
      ...s,
      obstacles: prev,
      selectedObstacleId: prev.some((o) => o.id === s.selectedObstacleId)
        ? s.selectedObstacleId
        : null,
    }), { skipUndo: true });
    return true;
  }, [onMutateObstacles]);

  const beginObstacleGesture = useCallback(() => {
    recordUndo(obstacles);
  }, [obstacles, recordUndo]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.code === 'KeyC') {
        if (!copySelected()) return;
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyV') {
        if (!pasteClipboard()) return;
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyZ' && !e.shiftKey) {
        if (!undo()) return;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, copySelected, pasteClipboard, undo]);

  return {
    mutateObstacles,
    recordUndo,
    beginObstacleGesture,
    copySelected,
    pasteClipboard,
    undo,
    canPaste: !!clipboardRef.current,
    undoCount: undoRef.current.length,
  };
}
