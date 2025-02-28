import '../components/tool-icon-button.js';
import './shape-tool/shape-tool-button.js';
import './brush-tool/brush-tool-button.js';
import './connector-tool/connector-tool-button.js';

import {
  FRAME_BACKGROUND_COLORS,
  HandIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  SelectIcon,
  TextIconLarge,
  ViewBarIcon,
} from '@blocksuite/global/config';
import { assertExists } from '@blocksuite/global/utils';
import { Bound, deserializeXYWH, getCommonBound } from '@blocksuite/phasor';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { MouseMode } from '../../../__internal__/index.js';
import type { FrameBlockModel } from '../../../frame-block/index.js';
import { getTooltipWithShortcut } from '../components/utils.js';
import type { EdgelessPageBlockComponent } from '../edgeless-page-block.js';
import { stopPropagation } from '../utils.js';

const FIT_TO_SCREEN_PADDING = 200;

@customElement('edgeless-toolbar')
export class EdgelessToolbar extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      z-index: 2;
      bottom: 28px;
      left: calc(50%);
      display: flex;
      justify-content: center;
      transform: translateX(-50%);
      user-select: none;
    }

    .edgeless-toolbar-container {
      display: flex;
      align-items: center;
      height: 48px;
      background: var(--affine-white);
      box-shadow: 0 0 12px rgba(66, 65, 73, 0.14);
      border-radius: 8px;
      fill: currentColor;
    }

    .edgeless-toolbar-container[level='second'] {
      position: absolute;
      bottom: 8px;
      transform: translateY(-100%);
    }

    .edgeless-toolbar-container[hidden] {
      display: none;
    }

    .divider {
      width: 1px;
      height: 24px;
      margin: 0 7px;
      background-color: var(--affine-divider-color);
    }

    .zoom-percent {
      display: block;
      box-sizing: border-box;
      width: 48px;
      height: 32px;
      line-height: 22px;
      padding: 5px;
      border-radius: 5px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      cursor: pointer;
    }

    .zoom-percent:hover {
      color: var(--affine-primary-color);
      background-color: var(--affine-hover-color);
    }
  `;

  @property()
  mouseMode!: MouseMode;

  @property()
  zoom!: number;

  @property()
  edgeless!: EdgelessPageBlockComponent;

  private _setMouseMode(mouseMode: MouseMode) {
    this.edgeless?.slots.mouseModeUpdated.emit(mouseMode);
  }

  private _setZoom(zoom: number) {
    const { viewport } = this.edgeless.surface;
    viewport.setZoom(zoom);
    this.edgeless.slots.viewportUpdated.emit();
  }

  private _zoomToFit() {
    const { viewport } = this.edgeless.surface;
    const { width, height } = viewport;
    const frame = this.edgeless.model.children[0] as FrameBlockModel;
    const frameXYWH = deserializeXYWH(frame.xywh);
    const frameBound = new Bound(...frameXYWH);

    const surfaceElementsBound = this.edgeless.surface.getElementsBound();

    const bound = surfaceElementsBound
      ? getCommonBound([frameBound, surfaceElementsBound])
      : frameBound;
    assertExists(bound);

    const zoom = Math.min(
      (width - FIT_TO_SCREEN_PADDING) / bound.w,
      (height - FIT_TO_SCREEN_PADDING) / bound.h
    );

    const cx = bound.x + bound.w / 2;
    const cy = bound.y + bound.h / 2;
    viewport.setZoom(zoom);
    viewport.setCenter(cx, cy);
    this.edgeless.slots.viewportUpdated.emit();
  }

  override render() {
    const type = this.mouseMode?.type;
    const { viewport } = this.edgeless.surface;
    const formattedZoom = `${Math.round(this.zoom * 100)}%`;

    return html`
      <div
        class="edgeless-toolbar-container"
        @dblclick=${stopPropagation}
        @mousedown=${stopPropagation}
        @mouseup=${stopPropagation}
        @pointerdown=${stopPropagation}
      >
        <edgeless-tool-icon-button
          .tooltip=${getTooltipWithShortcut('Select', 'V')}
          .active=${type === 'default'}
          @click=${() => this._setMouseMode({ type: 'default' })}
        >
          ${SelectIcon}
        </edgeless-tool-icon-button>
        <edgeless-tool-icon-button
          .tooltip=${getTooltipWithShortcut('Text', 'T')}
          .active=${type === 'text'}
          @click=${() =>
            this._setMouseMode({
              type: 'text',
              background: FRAME_BACKGROUND_COLORS[0],
            })}
        >
          ${TextIconLarge}
        </edgeless-tool-icon-button>
        <edgeless-shape-tool-button
          .mouseMode=${this.mouseMode}
          .edgeless=${this.edgeless}
        ></edgeless-shape-tool-button>
        <edgeless-tool-icon-button
          .disabled=${true}
          .tooltip=${'Image'}
          .active=${false}
          @click=${() => console.log('Image')}
        >
          ${ImageIcon}
        </edgeless-tool-icon-button>
        <edgeless-connector-tool-button
          .mouseMode=${this.mouseMode}
          .edgeless=${this.edgeless}
        ></edgeless-connector-tool-button>
        <edgeless-brush-tool-button
          .mouseMode=${this.mouseMode}
          .edgeless=${this.edgeless}
        ></edgeless-brush-tool-button>
        <edgeless-tool-icon-button
          .tooltip=${getTooltipWithShortcut('Hand', 'H')}
          .active=${type === 'pan'}
          @click=${() => this._setMouseMode({ type: 'pan', panning: false })}
        >
          ${HandIcon}
        </edgeless-tool-icon-button>
        <div class="divider"></div>
        <edgeless-tool-icon-button
          .tooltip=${'Fit to screen'}
          @click=${() => this._zoomToFit()}
        >
          ${ViewBarIcon}
        </edgeless-tool-icon-button>
        <edgeless-tool-icon-button
          .tooltip=${'Zoom out'}
          @click=${() => this._setZoom(Math.max(viewport.zoom - 0.1, 0.1))}
        >
          ${MinusIcon}
        </edgeless-tool-icon-button>
        <span class="zoom-percent" @click=${() => this._setZoom(1)}>
          ${formattedZoom}
        </span>
        <edgeless-tool-icon-button
          .tooltip=${'Zoom in'}
          @click=${() => this._setZoom(viewport.zoom + 0.1)}
        >
          ${PlusIcon}
        </edgeless-tool-icon-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-toolbar': EdgelessToolbar;
  }
}
