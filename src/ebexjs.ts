import {
    EBEXJSEventQueueItem,
    EBEXJSApi,
    EBEXJSEventHandler,
    EBEXJSHandlerId,
    GenericRecord,
    EBEXJSMiddleware,
    EBEXJSRegisterParams,
    EBEXJSCallbackParams,
    EBEXJSMiddlewareCallback,
    EBEXJSMiddlewareCallbackParams,
} from "./entities";
import { EBEXJSQueue } from "./ebexjsQueue";

type MiddlewareStage = "before" | "processing" | "after";
const MAX_PRIORITY = Number.MAX_SAFE_INTEGER;

class EBEXJSBase {
    isProcessing = false;
    handlers = new Map<string, Array<EBEXJSEventHandler<GenericRecord>>>();
    handlerLookup = new Map<
        string,
        Map<EBEXJSHandlerId, EBEXJSEventHandler<GenericRecord>>
    >();
    queue = new EBEXJSQueue<GenericRecord>();
    globalMiddlewares: Record<
        MiddlewareStage,
        Set<EBEXJSMiddlewareCallback<GenericRecord>>
    > = {
        before: new Set(),
        processing: new Set(),
        after: new Set(),
    };

    constructor() {
        this.ensureProcessing = this.ensureProcessing.bind(this);
    }

    normalizeEventName(event: string): string {
        if (typeof event !== "string") {
            throw new TypeError("Event name must be a string");
        }

        const normalized = event.trim();

        if (normalized.length === 0) {
            throw new Error("Event name cannot be empty");
        }

        return normalized;
    }

    normalizePriority(priority: number): number {
        if (!Number.isFinite(priority)) {
            return 0;
        }

        const truncated = Math.trunc(priority);
        if (truncated > MAX_PRIORITY) {
            return MAX_PRIORITY;
        }

        if (truncated < -MAX_PRIORITY) {
            return -MAX_PRIORITY;
        }

        return truncated;
    }

    toBooleanNeedAwait(value: boolean): boolean {
        return value === true;
    }

    registerHandler(
        event: string,
        handler: EBEXJSEventHandler<GenericRecord>,
    ): void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        list.sort((a, b) => b.priority - a.priority);
        this.handlers.set(event, list);

        const lookup =
            this.handlerLookup.get(event) ??
            new Map<EBEXJSHandlerId, EBEXJSEventHandler<GenericRecord>>();
        lookup.set(handler.id, handler);
        this.handlerLookup.set(event, lookup);
    }

    removeHandlerById(event: string, handlerId: EBEXJSHandlerId): void {
        const list = this.handlers.get(event);
        if (!list) {
            return;
        }

        const filtered = list.filter((handler) => handler.id !== handlerId);
        if (filtered.length > 0) {
            this.handlers.set(event, filtered);
        } else {
            this.handlers.delete(event);
        }

        const lookup = this.handlerLookup.get(event);
        if (lookup) {
            lookup.delete(handlerId);
            if (lookup.size === 0) {
                this.handlerLookup.delete(event);
            }
        }
    }

    removeAllHandlers(event: string): void {
        this.handlers.delete(event);
        this.handlerLookup.delete(event);
    }

    removeHandlersByCallback(
        event: string,
        callback: EBEXJSEventHandler<GenericRecord>["originalCallback"],
    ): void {
        const list = this.handlers.get(event);
        if (!list) {
            return;
        }

        const targets = list.filter(
            (handler) => handler.originalCallback === callback,
        );

        for (const handler of targets) {
            this.removeHandlerById(event, handler.id);
        }
    }

    listenerCount(event?: string): number {
        if (event === undefined) {
            let total = 0;
            for (const handlers of this.handlers.values()) {
                total += handlers.length;
            }
            return total;
        }

        return this.handlers.get(event)?.length ?? 0;
    }

    hasListeners(event?: string): boolean {
        if (event === undefined) {
            for (const handlers of this.handlers.values()) {
                if (handlers.length > 0) {
                    return true;
                }
            }
            return false;
        }

        return (this.handlers.get(event)?.length ?? 0) > 0;
    }

    clearAll(): void {
        this.handlers.clear();
        this.handlerLookup.clear();
        this.queue.clear();
    }

    getHandler(
        event: string,
        handlerId: EBEXJSHandlerId,
    ): EBEXJSEventHandler<GenericRecord> | undefined {
        return this.handlerLookup.get(event)?.get(handlerId);
    }

    addGlobalMiddleware(
        stage: MiddlewareStage,
        middleware: EBEXJSMiddlewareCallback<GenericRecord>,
    ): () => void {
        const bucket = this.globalMiddlewares[stage];
        bucket.add(middleware);
        return () => bucket.delete(middleware);
    }

    private async drainQueue(): Promise<void> {
        while (this.queue.length > 0) {
            const item = this.queue.pop();
            if (!item) {
                continue;
            }

            const handler = this.getHandler(item.event, item.handlerId);
            if (!handler) {
                continue;
            }

            const params = this.buildMiddlewareParams(handler, item);

            await this.runMiddleware(handler, params, "before");

            const execution = this.executeHandler(handler, item, params);

            if (handler.needAwait) {
                await execution;
            } else {
                void execution;
            }
        }
    }

    private buildMiddlewareParams(
        handler: EBEXJSEventHandler<GenericRecord>,
        item: EBEXJSEventQueueItem<GenericRecord>,
    ): EBEXJSMiddlewareCallbackParams<GenericRecord> {
        return {
            event: item.event,
            data: item.data,
            needAwait: handler.needAwait,
            priority: handler.priority,
        };
    }

    private async executeHandler(
        handler: EBEXJSEventHandler<GenericRecord>,
        item: EBEXJSEventQueueItem<GenericRecord>,
        params: EBEXJSMiddlewareCallbackParams<GenericRecord>,
    ): Promise<void> {
        await this.runMiddleware(handler, params, "processing");

        try {
            await Promise.resolve(handler.callback(item.data));
        } catch (error) {
            this.handleError(error, item.event, handler.id, "handler");
        }

        await this.runMiddleware(handler, params, "after");
    }

    private async runMiddleware(
        handler: EBEXJSEventHandler<GenericRecord>,
        params: EBEXJSMiddlewareCallbackParams<GenericRecord>,
        stage: MiddlewareStage,
    ): Promise<void> {
        await this.invokeMiddlewareStage(handler.middleware, params, stage);
        await this.invokeGlobalStage(params, stage);
    }

    private async invokeMiddlewareStage(
        middleware: EBEXJSMiddleware<GenericRecord> | undefined,
        params: EBEXJSMiddlewareCallbackParams<GenericRecord>,
        stage: MiddlewareStage,
    ): Promise<void> {
        if (!middleware) {
            return;
        }

        const stageCallback = middleware[stage];
        if (!stageCallback) {
            return;
        }

        try {
            await Promise.resolve(stageCallback(params));
        } catch (error) {
            this.handleError(
                error,
                params.event,
                undefined,
                `middleware:${stage}`,
            );
        }
    }

    private async invokeGlobalStage(
        params: EBEXJSMiddlewareCallbackParams<GenericRecord>,
        stage: MiddlewareStage,
    ): Promise<void> {
        const callbacks = this.globalMiddlewares[stage];
        if (callbacks.size === 0) {
            return;
        }

        for (const callback of callbacks) {
            try {
                await Promise.resolve(callback(params));
            } catch (error) {
                this.handleError(
                    error,
                    params.event,
                    undefined,
                    `global:${stage}`,
                );
            }
        }
    }

    private handleError(
        error: unknown,
        event: string,
        handlerId: EBEXJSHandlerId | undefined,
        source: string,
    ): void {
        const details: Record<string, unknown> = {
            event,
            source,
        };

        if (handlerId !== undefined) {
            details.handlerId = handlerId.toString();
        }

        console.error("[EBEXJS]", details, error);
    }

    async ensureProcessing(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        try {
            do {
                await this.drainQueue();
            } while (this.queue.length > 0);
        } finally {
            this.isProcessing = false;
        }
    }
}

/**
 * EBEXJS API Interface, providing event handling capabilities.
 */
export class EBEXJS implements EBEXJSApi {
    #baseApi: EBEXJSBase;

    constructor() {
        this.#baseApi = new EBEXJSBase();

        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
        this.emit = this.emit.bind(this);
        this.once = this.once.bind(this);
        this.use = this.use.bind(this);
        this.listenerCount = this.listenerCount.bind(this);
        this.hasListeners = this.hasListeners.bind(this);
        this.clear = this.clear.bind(this);
    }

    on<T extends object>(registerParams: EBEXJSRegisterParams<T>): () => void {
        const eventName = this.#baseApi.normalizeEventName(
            registerParams.event,
        );
        const priority = this.#baseApi.normalizePriority(
            registerParams.priority,
        );
        const needAwait = this.#baseApi.toBooleanNeedAwait(
            registerParams.needAwait,
        );
        const { callback, middleware } = registerParams;

        const handlerId: EBEXJSHandlerId = Symbol(
            `ebexjs-handler:${eventName}`,
        );

        const internalHandler: EBEXJSEventHandler<GenericRecord> = {
            id: handlerId,
            needAwait,
            priority,
            middleware: middleware as
                | EBEXJSMiddleware<GenericRecord>
                | undefined,
            originalCallback:
                callback as unknown as EBEXJSEventHandler<GenericRecord>["originalCallback"],
            callback: async (
                data: EBEXJSCallbackParams<GenericRecord>,
            ): Promise<void> => {
                await Promise.resolve(
                    callback(data as EBEXJSCallbackParams<T>),
                );
            },
        };

        this.#baseApi.registerHandler(eventName, internalHandler);

        return (): void => {
            this.#baseApi.removeHandlerById(eventName, handlerId);
        };
    }

    off(
        event: string,
        callback?: EBEXJSEventHandler<GenericRecord>["originalCallback"],
    ): void {
        const eventName = this.#baseApi.normalizeEventName(event);

        if (!callback) {
            this.#baseApi.removeAllHandlers(eventName);
            return;
        }

        this.#baseApi.removeHandlersByCallback(eventName, callback);
    }

    async emit<T extends object>(
        event: string,
        data?: EBEXJSCallbackParams<T>,
    ): Promise<void> {
        const eventName = this.#baseApi.normalizeEventName(event);
        const handlers = this.#baseApi.handlers.get(eventName);
        if (!handlers || handlers.length === 0) {
            return;
        }

        const payload = (data ?? {}) as EBEXJSCallbackParams<GenericRecord>;

        for (const handler of handlers) {
            const queueItem: EBEXJSEventQueueItem<GenericRecord> = {
                needAwait: handler.needAwait,
                event: eventName,
                data: payload,
                callback: handler.callback,
                priority: handler.priority,
                handlerId: handler.id,
            };
            this.#baseApi.queue.push(queueItem);
        }

        await this.#baseApi.ensureProcessing();
    }

    once<T extends object>(
        registerParams: EBEXJSRegisterParams<T>,
    ): () => void {
        let isActive = true;
        let unsubscribe: () => void = () => undefined;

        const wrappedCallback = async (
            data: EBEXJSCallbackParams<T>,
        ): Promise<void> => {
            if (!isActive) {
                return;
            }

            isActive = false;
            unsubscribe();

            await registerParams.callback(data);
        };

        unsubscribe = this.on<T>({
            ...registerParams,
            callback: wrappedCallback,
        });

        return (): void => {
            if (!isActive) {
                return;
            }

            isActive = false;
            unsubscribe();
        };
    }

    use<T extends object>(middleware: EBEXJSMiddleware<T>): () => void {
        const cleanupFns: Array<() => void> = [];

        if (middleware.before) {
            cleanupFns.push(
                this.#baseApi.addGlobalMiddleware(
                    "before",
                    middleware.before as EBEXJSMiddlewareCallback<GenericRecord>,
                ),
            );
        }
        if (middleware.processing) {
            cleanupFns.push(
                this.#baseApi.addGlobalMiddleware(
                    "processing",
                    middleware.processing as EBEXJSMiddlewareCallback<GenericRecord>,
                ),
            );
        }
        if (middleware.after) {
            cleanupFns.push(
                this.#baseApi.addGlobalMiddleware(
                    "after",
                    middleware.after as EBEXJSMiddlewareCallback<GenericRecord>,
                ),
            );
        }

        return (): void => {
            for (const cleanup of cleanupFns) {
                cleanup();
            }
        };
    }

    listenerCount(event?: string): number {
        if (event === undefined) {
            return this.#baseApi.listenerCount();
        }

        const eventName = this.#baseApi.normalizeEventName(event);
        return this.#baseApi.listenerCount(eventName);
    }

    hasListeners(event?: string): boolean {
        if (event === undefined) {
            return this.#baseApi.hasListeners();
        }

        const eventName = this.#baseApi.normalizeEventName(event);
        return this.#baseApi.hasListeners(eventName);
    }

    clear(): void {
        this.#baseApi.clearAll();
    }
}
