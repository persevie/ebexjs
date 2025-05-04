import {
    EBEXJSEventQueueItem,
    EBEXJSApi,
    EBEXJSEventHandler,
    GenericRecord,
    EBEXJSMiddleware,
    EBEXJSRegisterParams,
    EBEXJSCallbackParams,
    EBEXJSMiddlewareCallback,
    EBEXJSMiddlewareCallbackParams,
} from "./entities";
import { EBEXJSQueue } from "./ebexjsQueue";

class EBEXJSBase {
    isProcessing = false;
    handlers = new Map<string, EBEXJSEventHandler<GenericRecord>[]>();
    queue = new EBEXJSQueue();
    globalMiddlewares: EBEXJSMiddleware<GenericRecord> = {};

    constructor() {
        this.runMiddleware = this.runMiddleware.bind(this);
        this.executeStageCallback = this.executeStageCallback.bind(this);
        this.processQueue = this.processQueue.bind(this);
    }

    /**
     * Executes the specified stage of the middleware.
     */
    async runMiddleware(
        handler: EBEXJSEventHandler<GenericRecord>,
        event: string,
        data: EBEXJSCallbackParams<GenericRecord>,
        stage: "before" | "processing" | "after",
    ): Promise<void> {
        const middlewareCallbackParams: EBEXJSMiddlewareCallbackParams<GenericRecord> =
            {
                event,
                data,
                needAwait: handler.needAwait,
                priority: handler.priority,
            };
        await this.executeStageCallback(
            handler.middleware,
            stage,
            middlewareCallbackParams,
        );
        await this.executeStageCallback(
            this.globalMiddlewares,
            stage,
            middlewareCallbackParams,
        );
    }

    /**
     * Executes a specific stage callback for the given middleware, if it exists.
     *
     * @param middleware - The middleware object that may contain the stage callback.
     * @param stage - The stage of the middleware to execute (either "before", "processing", or "after").
     * @param params - The parameters to pass to the middleware callback.
     */
    async executeStageCallback(
        middleware: EBEXJSMiddleware<GenericRecord> | undefined,
        stage: "before" | "processing" | "after",
        params: EBEXJSMiddlewareCallbackParams<GenericRecord>,
    ): Promise<void> {
        if (middleware !== undefined) {
            const middlewareOfStage = middleware[stage];

            if (middlewareOfStage !== undefined) {
                await Promise.resolve(middlewareOfStage(params));
            }
        }
    }

    /**
     * Processes the event queue, executing the callbacks for each event.
     */
    async processQueue(): Promise<void> {
        this.isProcessing = true;
        try {
            while (this.queue.length > 0) {
                const item = this.queue.pop();
                if (item === undefined) {
                    continue;
                }
                const handlers = this.handlers.get(item.event);
                if (!handlers || handlers.length === 0) {
                    continue;
                }

                const handler = handlers.find(
                    (h) => h.callback === item.callback,
                );
                if (!handler) {
                    continue;
                }
                await this.runMiddleware(
                    handler,
                    item.event,
                    item.data as GenericRecord,
                    "processing",
                );
                try {
                    item.needAwait
                        ? await item.callback(
                              (item.data ?? {}) as GenericRecord,
                          )
                        : item.callback((item.data ?? {}) as GenericRecord);
                } catch (error) {
                    console.error(`Error during event processing: ${error}`);
                }
                await this.runMiddleware(
                    handler,
                    item.event,
                    item.data as GenericRecord,
                    "after",
                );
            }
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
    }

    /**
     * Registers an event listener.
     * @param registerParams - Parameters used to register an event listener.
     */
    on<T extends object>(registerParams: EBEXJSRegisterParams<T>): void {
        const arr = this.#baseApi.handlers.get(registerParams.event) ?? [];
        arr.push({
            callback: async (
                data: EBEXJSCallbackParams<GenericRecord>,
            ): Promise<void> => {
                return await Promise.resolve(
                    registerParams.callback(data as EBEXJSCallbackParams<T>),
                );
            },
            priority: registerParams.priority,
            middleware:
                registerParams.middleware as EBEXJSMiddleware<GenericRecord>,
            needAwait: registerParams.needAwait,
        });
        this.#baseApi.handlers.set(registerParams.event, arr);
    }

    /**
     * Unregisters an event.
     * @param event - The name of the event or an array of names.
     */
    off(event: string): void {
        this.#baseApi.handlers.delete(event);
    }

    /**
     * Emits an event.
     * @param event - The name of the event.
     * @param data - Optional parameters to pass to the event handlers.
     */
    async emit<T extends object>(
        event: string,
        data: EBEXJSCallbackParams<T>,
    ): Promise<void> {
        const handlers = this.#baseApi.handlers.get(event);
        if (!handlers || handlers.length === 0) {
            return;
        }

        for (const handler of handlers) {
            await this.#baseApi.runMiddleware(
                handler,
                event,
                data as GenericRecord,
                "before",
            );
        }

        for (const handler of handlers) {
            const queueItem: EBEXJSEventQueueItem<T> = {
                needAwait: handler.needAwait,
                event,
                data,
                callback: handler.callback,
                priority: handler.priority,
            };
            this.#baseApi.queue.push(queueItem);
        }
        if (!this.#baseApi.isProcessing) {
            try {
                await this.#baseApi.processQueue();
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Registers a callback for an event, then unregisters it after the first execution.
     * @param registerParams - Parameters for registering the callback.
     */
    once<T extends object>(registerParams: EBEXJSRegisterParams<T>): void {
        const originalCallback = registerParams.callback;
        const wrapper = async (
            data: EBEXJSCallbackParams<T>,
        ): Promise<void> => {
            await originalCallback(data);

            const arr = this.#baseApi.handlers.get(registerParams.event);
            if (arr) {
                this.#baseApi.handlers.set(
                    registerParams.event,
                    arr.filter((h) => h.callback !== wrapperImpl),
                );
            }
        };

        const wrapperImpl = async (
            data: EBEXJSCallbackParams<GenericRecord>,
        ): Promise<void> => {
            await wrapper(data as EBEXJSCallbackParams<T>);
        };

        const arr = this.#baseApi.handlers.get(registerParams.event) ?? [];
        arr.push({
            callback: wrapperImpl,
            priority: registerParams.priority,
            middleware:
                registerParams.middleware as EBEXJSMiddleware<GenericRecord>,
            needAwait: registerParams.needAwait,
        });
        this.#baseApi.handlers.set(registerParams.event, arr);
    }

    /**
     * Adds a middleware.
     * @param middleware - Middleware to add.
     */
    use<T extends object>(middleware: EBEXJSMiddleware<T>): void {
        if (middleware.before !== undefined) {
            this.#baseApi.globalMiddlewares.before =
                middleware.before as EBEXJSMiddlewareCallback<GenericRecord>;
        }

        if (middleware.after !== undefined) {
            this.#baseApi.globalMiddlewares.after =
                middleware.after as EBEXJSMiddlewareCallback<GenericRecord>;
        }

        if (middleware.processing !== undefined) {
            this.#baseApi.globalMiddlewares.processing =
                middleware.processing as EBEXJSMiddlewareCallback<GenericRecord>;
        }
    }
}
