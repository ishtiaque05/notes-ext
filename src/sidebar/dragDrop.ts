/**
 * Drag and drop logic for sidebar items
 */
import { CapturedItem } from '../types';

let dragSrcEl: HTMLElement | null = null;

export interface DragDropHandlers {
    handleDragStart: (e: DragEvent) => void;
    handleDragOver: (e: DragEvent) => boolean;
    handleDragEnter: (e: DragEvent) => void;
    handleDragLeave: (e: DragEvent) => void;
    handleDragEnd: (e: DragEvent) => void;
    handleDrop: (e: DragEvent) => boolean;
}

export function setupDragAndDrop(
    onReorder: (newItems: CapturedItem[]) => void,
    getCurrentItems: () => CapturedItem[]
): DragDropHandlers {
    return {
        handleDragStart(e: DragEvent) {
            const target = e.currentTarget as HTMLElement;
            target.classList.add('dragging');
            dragSrcEl = target;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', target.dataset.itemId || '');
            }
        },

        handleDragOver(e: DragEvent) {
            if (e.preventDefault) e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            return false;
        },

        handleDragEnter(e: DragEvent) {
            (e.currentTarget as HTMLElement).classList.add('drag-over');
        },

        handleDragLeave(e: DragEvent) {
            (e.currentTarget as HTMLElement).classList.remove('drag-over');
        },

        handleDragEnd(e: DragEvent) {
            (e.currentTarget as HTMLElement).classList.remove('dragging');
            const items = document.querySelectorAll('.item');
            items.forEach((item) => item.classList.remove('drag-over'));
        },

        handleDrop(e: DragEvent) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();

            const target = e.currentTarget as HTMLElement;
            if (dragSrcEl !== target) {
                const items = getCurrentItems();
                const srcId = dragSrcEl?.dataset.itemId;
                const targetId = target.dataset.itemId;

                const srcIndex = items.findIndex((i) => i.id === srcId);
                const targetIndex = items.findIndex((i) => i.id === targetId);

                if (srcIndex !== -1 && targetIndex !== -1) {
                    const newItems = [...items];
                    const [movedItem] = newItems.splice(srcIndex, 1);
                    newItems.splice(targetIndex, 0, movedItem);

                    // Update orders
                    newItems.forEach((item, index) => {
                        item.order = index;
                    });

                    onReorder(newItems);
                }
            }
            return false;
        },
    };
}
