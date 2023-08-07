/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    EBEXJSEventQueueItem,
    EBEXJSMiddleware,
    GenericRecord,
} from "../entities";
import { EBEXJS } from "../ebexjs";
import { EBEXJSQueue } from "../ebexjsQueue";

describe("EBEXJSQueue", () => {
    let queue: EBEXJSQueue<Record<string, unknown>>;

    beforeEach(() => {
        queue = new EBEXJSQueue();
    });

    it("should add item to the queue", () => {
        queue.push({
            event: "test",
            callback: async () => {},
            priority: 5,
            needAwait: false,
            data: {},
        });
        expect(queue.length).toBe(1);
    });

    it("should retrieve the item with the highest priority", () => {
        queue.push({
            event: "test1",
            callback: async () => {},
            priority: 5,
            needAwait: false,
            data: {},
        });
        queue.push({
            event: "test2",
            callback: async () => {},
            priority: 10,
            needAwait: false,
            data: {},
        });
        expect(queue.pop()?.event).toBe("test2");
    });

    it("should maintain correct order of priorities", () => {
        queue.push({
            event: "test1",
            callback: async () => {},
            priority: 5,
            needAwait: false,
            data: {},
        });
        queue.push({
            event: "test2",
            callback: async () => {},
            priority: 10,
            needAwait: false,
            data: {},
        });
        queue.push({
            event: "test3",
            callback: async () => {},
            priority: 1,
            needAwait: false,
            data: {},
        });
        expect(queue.pop()?.event).toBe("test2");
        expect(queue.pop()?.event).toBe("test1");
        expect(queue.pop()?.event).toBe("test3");
    });

    it("should not change order if priority is less or equal", () => {
        queue.push({
            event: "e1",
            priority: 5,
            needAwait: false,
            callback: async () => {},
            data: {},
        });
        queue.push({
            event: "e2",
            priority: 3,
            needAwait: false,
            callback: async () => {},
            data: {},
        });

        expect(queue.pop()?.event).toBe("e1");
        expect(queue.pop()?.event).toBe("e2");
    });

    it("should not swap if both children have lower priority", () => {
        queue.push({
            event: "parent",
            priority: 5,
            needAwait: false,
            callback: async () => {},
            data: {},
        });
        queue.push({
            event: "child1",
            priority: 3,
            needAwait: false,
            callback: async () => {},
            data: {},
        });
        queue.push({
            event: "child2",
            priority: 4,
            needAwait: false,
            callback: async () => {},
            data: {},
        });

        expect(queue.pop()?.event).toBe("parent");
        expect(queue.pop()?.event).toBe("child2");
        expect(queue.pop()?.event).toBe("child1");
    });

    it("should return undefined for empty queue", () => {
        const queue = new EBEXJSQueue<GenericRecord>();
        expect(queue.pop()).toBeUndefined();
    });

    it("should handle pop correctly for queue with single element", () => {
        const queue = new EBEXJSQueue<GenericRecord>();
        const event: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent",
            data: { testKey: "testValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
        };
        queue.push(event);
        expect(queue.pop()).toEqual(event);
        expect(queue.length).toBe(0);
    });

    it("should correctly reorder queue after popping the highest priority item", () => {
        const queue = new EBEXJSQueue<GenericRecord>();

        const event1: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent1",
            data: { testKey: "testValue1" },
            callback: async (_) => {},
            needAwait: false,
            priority: 10,
        };

        const event2: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent2",
            data: { testKey: "testValue2" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
        };

        const event3: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent3",
            data: { testKey: "testValue3" },
            callback: async (_) => {},
            needAwait: false,
            priority: 8,
        };

        queue.push(event1);
        queue.push(event2);
        queue.push(event3);

        expect(queue.pop()).toEqual(event1);
        expect(queue.length).toBe(2);

        expect(queue.pop()).toEqual(event3);
        expect(queue.length).toBe(1);
    });

    it("should handle pop correctly with multiple items", () => {
        const queue = new EBEXJSQueue<GenericRecord>();

        const event1: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent1",
            data: { testKey: "testValue1" },
            callback: async (_) => {},
            needAwait: false,
            priority: 10,
        };

        const event2: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent2",
            data: { testKey: "testValue2" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
        };

        queue.push(event1);
        queue.push(event2);

        expect(queue.pop()).toEqual(event1);

        expect(queue.length).toBe(1);

        expect(queue.pop()).toEqual(event2);

        expect(queue.length).toBe(0);
    });

    it("should bubble down correctly when right child has the highest priority after root removal", () => {
        const queue = new EBEXJSQueue<GenericRecord>();

        const highestPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "highestPriorityEvent",
            data: { testKey: "highestValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 100,
        };

        const highPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "highPriorityEvent",
            data: { testKey: "highValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 10,
        };

        const midPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "midPriorityEvent",
            data: { testKey: "midValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
        };

        const lowPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "lowPriorityEvent",
            data: { testKey: "lowValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 1,
        };

        // Добавляем элементы таким образом, чтобы они образовали желаемую структуру
        queue.push(highestPriorityEvent);
        queue.push(lowPriorityEvent);
        queue.push(midPriorityEvent);
        queue.push(highPriorityEvent);

        // Удалите корневой элемент, который имеет наивысший приоритет
        queue.pop();

        // Теперь, когда следующий на очереди элемент (lowPriorityEvent) стал корнем,
        // правый потомок (highPriorityEvent) должен иметь более высокий приоритет, чем левый (midPriorityEvent).
        expect(queue.pop()).toEqual(highPriorityEvent);
    });
});

describe("EBEXJS", () => {
    let ebexjs: EBEXJS;

    beforeEach(() => {
        ebexjs = new EBEXJS();
    });

    it("should register and emit an event", async () => {
        const callback = jest.fn();
        ebexjs.on({ event: "test", callback, needAwait: false, priority: 5 });
        await ebexjs.emit("test", {});
        expect(callback).toHaveBeenCalled();
    });

    it("should unregister an event", async () => {
        const callback = jest.fn();
        ebexjs.on({ event: "test", callback, needAwait: false, priority: 5 });
        ebexjs.off("test");
        await ebexjs.emit("test", {});
        expect(callback).not.toHaveBeenCalled();
    });

    it("should handle middleware", async () => {
        const callback = jest.fn();
        const middleware = { before: jest.fn() };
        ebexjs.on({
            event: "test",
            callback,
            needAwait: false,
            priority: 5,
            middleware,
        });
        await ebexjs.emit("test", {});
        expect(callback).toHaveBeenCalled();
        expect(middleware.before).toHaveBeenCalled();
    });

    it("should register an event handler with once and auto-unregister after the first call", async () => {
        const callback = jest.fn();
        ebexjs.once({ event: "test", callback, needAwait: false, priority: 1 });

        await ebexjs.emit("test", {});
        await ebexjs.emit("test", {});

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should call middleware correctly", async () => {
        const middleware: EBEXJSMiddleware<Record<string, unknown>> = {
            before: jest.fn(),
            processing: jest.fn(),
            after: jest.fn(),
        };

        const callback = jest.fn();
        ebexjs.on({
            event: "test",
            callback,
            needAwait: false,
            priority: 1,
            middleware,
        });
        ebexjs.use(middleware);

        await ebexjs.emit("test", {});

        expect(middleware.before).toHaveBeenCalledTimes(2);
        expect(middleware.processing).toHaveBeenCalledTimes(2);
        expect(middleware.after).toHaveBeenCalledTimes(2);
    });

    it("should process events in correct order", async () => {
        const events: number[] = [];
        type Data = {
            priority: number;
        };
        const callback = (data: Data): void => {
            events.push(data.priority);
        };

        ebexjs.on({
            event: "test0",
            callback: callback,
            needAwait: false,
            priority: 0,
        });
        ebexjs.on({
            event: "test1",
            callback: callback,
            needAwait: false,
            priority: 1,
        });
        ebexjs.on({
            event: "test2",
            callback: callback,
            needAwait: false,
            priority: 2,
        });

        ebexjs.emit<Data>("test0", { priority: 0 });
        ebexjs.emit<Data>("test1", { priority: 1 });
        ebexjs.emit<Data>("test2", { priority: 2 });

        setTimeout(() => {
            expect(events).toEqual([0, 2, 1]);
        }, 200);
    });
});
