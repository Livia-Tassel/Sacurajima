export type WindowKind = 'companion' | 'panel';

export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

export type PersistedWindowState = {
  companion: WindowState;
  panel: WindowState;
};

export type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeWindowState(
  candidate: Partial<WindowState> | undefined,
  fallback: WindowState,
  workArea: RectLike
): WindowState {
  const minWidth = Math.min(fallback.width, workArea.width);
  const minHeight = Math.min(fallback.height, workArea.height);
  const width = Number.isFinite(candidate?.width)
    ? clamp(candidate!.width as number, minWidth, workArea.width)
    : fallback.width;
  const height = Number.isFinite(candidate?.height)
    ? clamp(candidate!.height as number, minHeight, workArea.height)
    : fallback.height;
  const maxX = workArea.x + Math.max(0, workArea.width - width);
  const maxY = workArea.y + Math.max(0, workArea.height - height);
  const x = Number.isFinite(candidate?.x) ? clamp(candidate!.x as number, workArea.x, maxX) : fallback.x;
  const y = Number.isFinite(candidate?.y) ? clamp(candidate!.y as number, workArea.y, maxY) : fallback.y;

  return {
    x,
    y,
    width,
    height,
    visible: typeof candidate?.visible === 'boolean' ? candidate.visible : fallback.visible
  };
}

export function snapshotWindowState(bounds: RectLike, visible: boolean): WindowState {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    visible
  };
}
