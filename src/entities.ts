/**
 * Common properties for event registration.
 */
export type EBEXJSCommonProperties = {
    needAwait: boolean;
    priority: number;
};

/**
 * Type for a generic record.
 */
export type GenericRecord = Record<string, unknown>;

/**
 * Parameters used to register an event listener.
 * @param event - The name of the event to register.
 * @param callback - The function to be called when the event occurs.
 * @param needAwait - Whether the callback needs to wait for previous events.
 * @param priority - The priority of the callback.
 * @param middleware - Optional middleware to use.
 */
export type EBEXJSRegisterParams<T extends object> = {
    event: string;
    callback: EBEXJSEventCallback<T>;
    middleware?: EBEXJSMiddleware<T>;
} & EBEXJSCommonProperties;

/**
 * EBEXJS API Interface, providing event handling capabilities.
 */
export interface EBEXJSApi {
    /**
     * Registers an event listener.
     * @param registerParams - Parameters used to register an event listener.
     */
    on<T extends object>(registerParams: EBEXJSRegisterParams<T>): void;

    /**
     * Unregisters an event.
     * @param event - The name of the event or an array of names.
     */
    off(event: string): void;

    /**
     * Emits an event.
     * @param event - The name of the event.
     * @param data - Optional parameters to pass to the event handlers.
     */
    emit<T extends object>(
        event: string,
        data: EBEXJSCallbackParams<T>,
    ): Promise<void>;

    /**
     * Registers a callback for an event, then unregisters it after the first execution.
     * @param registerParams - Parameters for registering the callback.
     */
    once<T extends object>(registerParams: EBEXJSRegisterParams<T>): void;

    /**
     * Adds a middleware.
     * @param middleware - Middleware to add.
     */
    use<T extends object>(middleware: EBEXJSMiddleware<T>): void;
}

/**
 * Parameters for middleware callback functions.
 * @param event - The name of the event.
 * @param data - Optional parameters to pass to the event handlers.
 * @param needAwait - Whether the callback needs to wait for previous events.
 * @param priority - The priority of the callback.
 */
export type EBEXJSMiddlewareCallbackParams<T extends object> = {
    event: string;
    data: EBEXJSCallbackParams<T>;
} & EBEXJSCommonProperties;

/**
 * Middleware callback function type.
 * @param middlewareCallbackParams - The parameters for the middleware callback.
 */
export type EBEXJSMiddlewareCallback<T extends object> = (
    middlewareCallbackParams: EBEXJSMiddlewareCallbackParams<T>,
) => void | Promise<void>;

/**
 * Properties for an event handler.
 */
export type EBEXJSEventHandler<T extends object> = Omit<
    EBEXJSRegisterParams<T>,
    "event" | "callback"
> & {
    callback: EBEXJSInternalEventCallback;
};

/**
 * Middleware interface with different stages of execution.
 */
export interface EBEXJSMiddleware<T extends object> {
    before?: EBEXJSMiddlewareCallback<T>; // Executes before event processing.
    processing?: EBEXJSMiddlewareCallback<T>; // Executes during event processing.
    after?: EBEXJSMiddlewareCallback<T>; // Executes after event processing.
}

/**
 * Type definition for event callback parameters.
 */
export type EBEXJSCallbackParams<T extends object> = T & GenericRecord;

/**
 * Type definition for the event callback function.
 * @param data - The data for the callback.
 */
export type EBEXJSEventCallback<T extends object> = (
    data: EBEXJSCallbackParams<T>,
) => void | Promise<void>;

/**
 * Type definition for the internal event callback function.
 * @param data - The data for the callback.
 */
export type EBEXJSInternalEventCallback = (
    data: EBEXJSCallbackParams<GenericRecord>,
) => Promise<void>;

/**
 * Structure of an event queue item.
 */
export interface EBEXJSEventQueueItem<T extends object>
    extends EBEXJSCommonProperties {
    event: string;
    data: EBEXJSCallbackParams<T>;
    callback: EBEXJSInternalEventCallback;
}
