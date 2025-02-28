import { SCROLL_THRESHOLD } from '@blocksuite/global/config';
import type { Page, UserRange } from '@blocksuite/store';

import type { BlockComponentElement } from '../../../__internal__/index.js';
import {
  contains,
  getBlockElementsExcludeSubtrees,
  getRectByBlockElement,
} from '../../../__internal__/index.js';
import { getExtendBlockRange } from '../../../__internal__/utils/block-range.js';
import type {
  IPoint,
  SelectionEvent,
} from '../../../__internal__/utils/gesture/index.js';
import type { DefaultSelectionSlots } from '../default-page-block.js';
import type { DefaultSelectionManager, PageSelectionState } from './index.js';

// distance to the upper and lower boundaries of the viewport
const threshold = SCROLL_THRESHOLD / 2;

function intersects(a: DOMRect, b: DOMRect, offset: IPoint) {
  return (
    a.left + offset.x <= b.right &&
    a.right + offset.x >= b.left &&
    a.top + offset.y <= b.bottom &&
    a.bottom + offset.y >= b.top
  );
}

// See https://github.com/toeverything/blocksuite/pull/904 and
// https://github.com/toeverything/blocksuite/issues/839#issuecomment-1411742112
// for more context.
//
// The `bound` is a rect of drag-and-drop selection.
export function filterBlocksExcludeSubtrees(
  blockCache: Map<BlockComponentElement, DOMRect>,
  bound: DOMRect,
  offset: IPoint
) {
  const entries = Array.from(blockCache.entries());
  const len = entries.length;
  const results: { block: BlockComponentElement; index: number }[] = [];

  // empty
  if (len === 0) return results;

  let prevIndex = -1;

  for (let i = 0; i < len; i++) {
    const [block, rect] = entries[i];
    if (intersects(rect, bound, offset)) {
      if (prevIndex === -1) {
        prevIndex = i;
      } else {
        let prevBlock = entries[prevIndex][0];
        // prev block before and contains block
        if (contains(prevBlock, block)) {
          // not continuous block
          if (results.length > 1) {
            continue;
          }
          prevIndex = i;
          results.shift();
        } else {
          // backward search parent block and remove its subtree
          // only keep blocks of same level
          const { previousElementSibling } = block;
          // previousElementSibling is not prev block and previousElementSibling contains prev block
          if (
            previousElementSibling &&
            previousElementSibling !== prevBlock &&
            contains(previousElementSibling, prevBlock)
          ) {
            let n = i;
            let m = results.length;
            while (n--) {
              prevBlock = entries[n][0];
              if (prevBlock === previousElementSibling) {
                results.push({ block: prevBlock, index: n });
                break;
              } else if (m > 0) {
                results.pop();
                m--;
              }
            }
          }
          prevIndex = i;
        }
      }

      results.push({ block, index: i });
    }
  }

  return results;
}

export function updateLocalSelectionRange(page: Page) {
  const blockRange = getExtendBlockRange(page);
  if (!blockRange || blockRange.type === 'Block') {
    return;
  }
  const userRange: UserRange = {
    startOffset: blockRange.startOffset,
    endOffset: blockRange.endOffset,
    blockIds: blockRange.models.map(m => m.id),
  };
  page.awarenessStore.setLocalRange(page, userRange);
}

/*
function computeSelectionType(
  selectedBlocks: Element[],
  selectionType?: PageSelectionType
) {
  let newSelectionType: PageSelectionType = selectionType ?? 'native';

  const isOnlyBlock = selectedBlocks.length === 1;
  for (const block of selectedBlocks) {
    if (selectionType) continue;
    if (!('model' in block)) continue;

    // Calculate selection type
    const model = getModelByElement(block);
    newSelectionType = 'block';

    // Other selection types are possible if only one block is selected
    if (!isOnlyBlock) continue;

    const flavour = model.flavour;
    switch (flavour) {
      case 'affine:embed': {
        newSelectionType = 'embed';
        break;
      }
      case 'affine:database': {
        newSelectionType = 'database';
        break;
      }
    }
  }
  return newSelectionType;
}
*/

export function setSelectedBlocks(
  state: PageSelectionState,
  slots: DefaultSelectionSlots,
  selectedBlocks: BlockComponentElement[],
  rects?: DOMRect[]
) {
  state.selectedBlocks = selectedBlocks;

  if (rects) {
    slots.selectedRectsUpdated.emit(rects);
    return;
  }

  const calculatedRects = [] as DOMRect[];
  for (const block of getBlockElementsExcludeSubtrees(selectedBlocks)) {
    calculatedRects.push(getRectByBlockElement(block));
  }

  slots.selectedRectsUpdated.emit(calculatedRects);
}

export interface AutoScrollHooks {
  init(): void;
  onMove(): void;
  onScroll(val: number): void;
}

export function autoScroll(
  selection: DefaultSelectionManager,
  e: SelectionEvent,
  hooks: AutoScrollHooks
) {
  const { state } = selection;
  const { y } = e;

  const { viewportElement } = selection;
  const { viewport } = state;
  const { scrollHeight, clientHeight } = viewport;
  let { scrollTop } = viewport;
  const max = scrollHeight - clientHeight;

  hooks.init();

  let auto = true;
  const autoScroll = () => {
    if (!auto) {
      state.clearRaf();
      return;
    } else {
      state.rafID = requestAnimationFrame(autoScroll);
    }

    // TODO: for the behavior of scrolling, see the native selection
    // speed easeOutQuad + easeInQuad
    if (Math.ceil(scrollTop) < max && clientHeight - y < threshold) {
      // ↓
      const d = (threshold - (clientHeight - y)) * 0.25;
      scrollTop += d;
      auto = Math.ceil(scrollTop) < max;
      viewportElement.scrollTop = scrollTop;

      hooks.onScroll(d);
    } else if (scrollTop > 0 && y < threshold) {
      // ↑
      const d = (y - threshold) * 0.25;
      scrollTop += d;
      auto = scrollTop > 0;
      viewportElement.scrollTop = scrollTop;

      hooks.onScroll(d);
    } else {
      auto = false;

      hooks.onMove();
    }
  };

  state.clearRaf();
  state.rafID = requestAnimationFrame(autoScroll);
}
