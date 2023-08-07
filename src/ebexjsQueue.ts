import { EBEXJSEventQueueItem } from "./entities";

/**
 * Priority queue for event processing.
 */
export class EBEXJSQueue<T extends object> {
    private _data: EBEXJSEventQueueItem<T>[] = [];

    /**
     * Adds an item to the queue.
     * @param item - The item to add to the queue.
     */
    push(item: EBEXJSEventQueueItem<T>): void {
        this._data.push(item);
        this._bubbleUp();
    }

    /**
     * Removes and returns the item with the highest priority.
     * @returns The highest priority item or undefined if the queue is empty.
     */
    pop(): EBEXJSEventQueueItem<T> | undefined {
        if (this._data.length === 0) {
            return undefined;
        }

        const item = this._data[0];
        const end = this._data.pop();

        if (end !== undefined && this._data.length > 0) {
            this._data[0] = end;
            this._bubbleDown();
        }

        return item;
    }

    /**
     * Returns the length of the queue.
     * @returns The number of items in the queue.
     */
    get length(): number {
        return this._data.length;
    }

    /**
     * Reorders the queue to maintain the heap property after an item is added.
     * @private
     */
    private _bubbleUp(): void {
        let index = this._data.length - 1;
        const element = this._data[index];

        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this._data[parentIndex];

            if (element.priority <= parent.priority) {
                break;
            }

            [this._data[parentIndex], this._data[index]] = [element, parent];
            index = parentIndex;
        }
    }

    /**
     * Reorders the queue to maintain the heap property after an item is removed.
     * @private
     */
    private _bubbleDown(): void {
        let index = 0;
        const length = this._data.length;
        const element = this._data[index];

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const leftChildIdx = 2 * index + 1;
            const rightChildIdx = 2 * index + 2;
            let largestChildIdx = index;

            if (
                leftChildIdx < length &&
                this._data[leftChildIdx].priority > element.priority
            ) {
                largestChildIdx = leftChildIdx;
            }

            if (
                rightChildIdx < length &&
                this._data[rightChildIdx].priority >
                    this._data[largestChildIdx].priority
            ) {
                largestChildIdx = rightChildIdx;
            }

            if (largestChildIdx === index) {
                break;
            }

            [this._data[index], this._data[largestChildIdx]] = [
                this._data[largestChildIdx],
                element,
            ];
            index = largestChildIdx;
        }
    }
}
