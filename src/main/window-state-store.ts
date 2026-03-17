import { app, screen } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  sanitizeWindowState,
  snapshotWindowState,
  type PersistedWindowState,
  type RectLike,
  type WindowKind,
  type WindowState
} from '../shared/window-state';

function createDefaultState(workArea: RectLike): PersistedWindowState {
  return {
    companion: {
      x: workArea.x + workArea.width - 220,
      y: workArea.y + 92,
      width: 180,
      height: 220,
      visible: true
    },
    panel: {
      x: workArea.x + workArea.width - 560,
      y: workArea.y + 72,
      width: 520,
      height: 720,
      visible: false
    }
  };
}

export class WindowStateStore {
  private readonly filePath = join(app.getPath('userData'), 'window-state.json');

  private state: PersistedWindowState;

  constructor() {
    this.state = this.load();
  }

  get(kind: WindowKind): WindowState {
    return this.state[kind];
  }

  update(kind: WindowKind, bounds: RectLike, visible: boolean) {
    this.state = {
      ...this.state,
      [kind]: snapshotWindowState(bounds, visible)
    };
    this.save();
  }

  setVisibility(kind: WindowKind, visible: boolean) {
    this.state = {
      ...this.state,
      [kind]: {
        ...this.state[kind],
        visible
      }
    };
    this.save();
  }

  private load(): PersistedWindowState {
    const workArea = screen.getPrimaryDisplay().workArea;
    const defaults = createDefaultState(workArea);

    if (!existsSync(this.filePath)) {
      return defaults;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedWindowState>;

      return {
        companion: sanitizeWindowState(parsed.companion, defaults.companion, workArea),
        panel: sanitizeWindowState(parsed.panel, defaults.panel, workArea)
      };
    } catch {
      return defaults;
    }
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }
}

