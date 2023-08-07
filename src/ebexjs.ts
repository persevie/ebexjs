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
    handlers = new Map<string, EBEXJSEventHandler<GenericRecord>>();
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

        this.executeStageCallback(
            handler.middleware,
            stage,
            middlewareCallbackParams,
        );
        this.executeStageCallback(
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

                const handler = this.handlers.get(item.event);

                if (handler === undefined) {
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
        if (!this.#baseApi.handlers.has(registerParams.event)) {
            this.#baseApi.handlers.set(registerParams.event, {
                callback: async (
                    data: EBEXJSCallbackParams<GenericRecord>,
                ): Promise<void> => {
                    return await Promise.resolve(
                        registerParams.callback(
                            data as EBEXJSCallbackParams<T>,
                        ),
                    );
                },
                priority: registerParams.priority,
                middleware:
                    registerParams.middleware as EBEXJSMiddleware<GenericRecord>,
                needAwait: registerParams.needAwait,
            });
        }
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
        const handler = this.#baseApi.handlers.get(event);

        if (handler === undefined) {
            return;
        }

        await this.#baseApi.runMiddleware(
            handler,
            event,
            data as GenericRecord,
            "before",
        );

        const queueItem: EBEXJSEventQueueItem<T> = {
            needAwait: handler.needAwait,
            event,
            data,
            callback: handler.callback,
            priority: handler.priority,
        };

        this.#baseApi.queue.push(queueItem);

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
        registerParams.callback = async (
            data: EBEXJSCallbackParams<T>,
        ): Promise<void> => {
            await originalCallback(data);
            this.off(registerParams.event);
        };

        this.on(registerParams);
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
