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
            handlerId: Symbol("test"),
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
            handlerId: Symbol("test1"),
        });
        queue.push({
            event: "test2",
            callback: async () => {},
            priority: 10,
            needAwait: false,
            data: {},
            handlerId: Symbol("test2"),
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
            handlerId: Symbol("test1"),
        });
        queue.push({
            event: "test2",
            callback: async () => {},
            priority: 10,
            needAwait: false,
            data: {},
            handlerId: Symbol("test2"),
        });
        queue.push({
            event: "test3",
            callback: async () => {},
            priority: 1,
            needAwait: false,
            data: {},
            handlerId: Symbol("test3"),
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
            handlerId: Symbol("e1"),
        });
        queue.push({
            event: "e2",
            priority: 3,
            needAwait: false,
            callback: async () => {},
            data: {},
            handlerId: Symbol("e2"),
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
            handlerId: Symbol("parent"),
        });
        queue.push({
            event: "child1",
            priority: 3,
            needAwait: false,
            callback: async () => {},
            data: {},
            handlerId: Symbol("child1"),
        });
        queue.push({
            event: "child2",
            priority: 4,
            needAwait: false,
            callback: async () => {},
            data: {},
            handlerId: Symbol("child2"),
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
            handlerId: Symbol("testEvent"),
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
            handlerId: Symbol("testEvent1"),
        };

        const event2: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent2",
            data: { testKey: "testValue2" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
            handlerId: Symbol("testEvent2"),
        };

        const event3: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent3",
            data: { testKey: "testValue3" },
            callback: async (_) => {},
            needAwait: false,
            priority: 8,
            handlerId: Symbol("testEvent3"),
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
            handlerId: Symbol("testEvent1"),
        };

        const event2: EBEXJSEventQueueItem<GenericRecord> = {
            event: "testEvent2",
            data: { testKey: "testValue2" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
            handlerId: Symbol("testEvent2"),
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
            handlerId: Symbol("highestPriorityEvent"),
        };

        const highPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "highPriorityEvent",
            data: { testKey: "highValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 10,
            handlerId: Symbol("highPriorityEvent"),
        };

        const midPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "midPriorityEvent",
            data: { testKey: "midValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 5,
            handlerId: Symbol("midPriorityEvent"),
        };

        const lowPriorityEvent: EBEXJSEventQueueItem<GenericRecord> = {
            event: "lowPriorityEvent",
            data: { testKey: "lowValue" },
            callback: async (_) => {},
            needAwait: false,
            priority: 1,
            handlerId: Symbol("lowPriorityEvent"),
        };

        queue.push(highestPriorityEvent);
        queue.push(lowPriorityEvent);
        queue.push(midPriorityEvent);
        queue.push(highPriorityEvent);

        queue.pop();
        expect(queue.pop()).toEqual(highPriorityEvent);
    });

    it("should clear all items", () => {
        const queue = new EBEXJSQueue<GenericRecord>();
        queue.push({
            event: "to-clear",
            data: {},
            callback: async () => {},
            needAwait: false,
            priority: 1,
            handlerId: Symbol("to-clear"),
        });
        expect(queue.length).toBe(1);
        queue.clear();
        expect(queue.length).toBe(0);
        expect(queue.pop()).toBeUndefined();
    });
});

describe("EBEXJS", () => {
    let ebexjs: EBEXJS;
    const flush = async (): Promise<void> => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    };

    beforeEach(() => {
        ebexjs = new EBEXJS();
    });

    it("should register and emit an event", async () => {
        const callback = jest.fn();
        ebexjs.on({ event: "test", callback, needAwait: false, priority: 5 });
        await ebexjs.emit("test", {});
        await flush();
        expect(callback).toHaveBeenCalled();
    });

    it("should unregister an event", async () => {
        const callback = jest.fn();
        ebexjs.on({ event: "test", callback, needAwait: false, priority: 5 });
        ebexjs.off("test");
        await ebexjs.emit("test", {});
        await flush();
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
        await flush();
        expect(callback).toHaveBeenCalled();
        expect(middleware.before).toHaveBeenCalled();
    });

    it("should register an event handler with once and auto-unregister after the first call", async () => {
        const callback = jest.fn();
        ebexjs.once({ event: "test", callback, needAwait: false, priority: 1 });

        await ebexjs.emit("test", {});
        await ebexjs.emit("test", {});
        await flush();

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
        await flush();

        expect(middleware.before).toHaveBeenCalledTimes(2);
        expect(middleware.processing).toHaveBeenCalledTimes(2);
        expect(middleware.after).toHaveBeenCalledTimes(2);
    });

    it("should respect handler priority across events", async () => {
        const events: string[] = [];

        ebexjs.on({
            event: "alpha",
            callback: () => {
                events.push("alpha-low");
            },
            needAwait: true,
            priority: 1,
        });
        ebexjs.on({
            event: "alpha",
            callback: () => {
                events.push("alpha-high");
            },
            needAwait: true,
            priority: 10,
        });
        ebexjs.on({
            event: "beta",
            callback: () => {
                events.push("beta-mid");
            },
            needAwait: true,
            priority: 5,
        });

        await Promise.all([ebexjs.emit("alpha", {}), ebexjs.emit("beta", {})]);

        expect(events).toEqual(["alpha-high", "beta-mid", "alpha-low"]);
    });

    it("should remove handler by callback", async () => {
        const callback = jest.fn();
        ebexjs.on({
            event: "test",
            callback,
            needAwait: true,
            priority: 1,
        });

        ebexjs.off("test", callback);

        await ebexjs.emit("test", {});
        await flush();

        expect(callback).not.toHaveBeenCalled();
    });

    it("should unregister global middleware via cleanup", async () => {
        const before = jest.fn();
        const cleanup = ebexjs.use({ before });

        await ebexjs.emit("test", {});
        await flush();
        expect(before).toHaveBeenCalledTimes(0);

        const callback = jest.fn();
        ebexjs.on({
            event: "test",
            callback,
            needAwait: true,
            priority: 1,
        });

        await ebexjs.emit("test", {});
        await flush();
        expect(before).toHaveBeenCalledTimes(1);

        cleanup();

        await ebexjs.emit("test", {});
        await flush();
        expect(before).toHaveBeenCalledTimes(1);
    });

    it("should report listener count and presence", () => {
        expect(ebexjs.hasListeners()).toBe(false);
        expect(ebexjs.listenerCount()).toBe(0);

        const unsubscribe = ebexjs.on({
            event: "listeners",
            callback: () => undefined,
            needAwait: false,
            priority: 1,
        });

        expect(ebexjs.hasListeners()).toBe(true);
        expect(ebexjs.listenerCount("listeners")).toBe(1);

        unsubscribe();

        expect(ebexjs.hasListeners("listeners")).toBe(false);
        expect(ebexjs.listenerCount()).toBe(0);
    });

    it("should clear all listeners and queued events", async () => {
        const callback = jest.fn();

        ebexjs.on({
            event: "clearable",
            callback,
            needAwait: false,
            priority: 1,
        });

        ebexjs.clear();

        expect(ebexjs.listenerCount()).toBe(0);

        await ebexjs.emit("clearable", {});
        await flush();

        expect(callback).not.toHaveBeenCalled();
    });

    it("should trim event names", async () => {
        const callback = jest.fn();
        ebexjs.on({
            event: "   spaced   ",
            callback,
            needAwait: true,
            priority: 1,
        });

        await ebexjs.emit("spaced", {});
        await flush();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should reject empty event names", () => {
        expect(() => {
            ebexjs.on({
                event: "   ",
                callback: () => undefined,
                needAwait: false,
                priority: 0,
            });
        }).toThrow("Event name cannot be empty");
    });
});
