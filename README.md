<p align="center">
<img height="60" alt="Statemanjs logo" src="./assets/ebexjs.png">
</p>

```ts
// Create an instance of EBEXJS
const ebexjs = new EBEXJS();

enum EBEXEvents {
    EVENT_1 = "event1",
}

type Event1CbData = {
    name: string;
};

// Register an event listener
ebexjs.on<Event1CbData>({
    event: EventKind.EVENT_1,
    callback: (data) => console.log(`Hello ${data.name}`),
    priority: 5,
    needAwait: false,
});

// Emit an event
ebexjs.emit<Event1CbData>(EventKind.EVENT_1, { name: "world" });
// --> Hello world
```

# Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

-   [Introduction](#introduction)
-   [API](#api)
-   [**Event Prioritization**](#event-prioritization) - [**Middleware Support**](#middleware-support)
-   [**Async/Await Support**](#asyncawait-support)
-   [When to use EBEXJS?](#when-to-use-ebexjs)
-   [Usage](#usage)
-   [Example: ToDo App](#example-todo-app)
-   [For contributors](#for-contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Introduction

EBEXJS (**E**vent **B**us **Ex**ecutor) is a tiny, high-performance, flexible event bus designed for local application communication, event management, and decoupled interaction between components.

**Key features**:

-   Priority-based Event Queue: EBEXJS includes a priority-based event queue. It ensures that events are processed based on their priority, with higher priority events processed before lower priority ones.
-   High performance: EBEXJS is designed with performance in mind. It uses a priority queue based binary heap data structure for event management, ensuring high-performance event processing and prioritization.
-   Concurrent and Sequential Processing: Events can be set to wait for previous events to complete (`needAwait` property) or to be processed concurrently, offering flexibility in event handling based on use-case requirements.
-   Clear API: EBEXJS has a clear and easy-to-use API.
-   TypeScript support: EBEXJS's code is written in TypeScript, providing type safety and clear type definitions for developers.
-   Middleware Integration: EBEXJS supports middleware execution at different stages of event processing - before, during, and after an event. This offers high flexibility in event management and customization.
-   Small size: EBEXJS has a tiny size of only less than 5KB, making it easy to include in your project without being too big.

# API

```ts
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
```

# **Event Prioritization**

EBEXJS provides a mechanism for prioritizing event processing. Each event listener can be registered with a priority value. The event queue uses a priority queue internally to ensure higher priority events are processed first.

Let's take a look:

```ts
const ebexjs = new EBEXJS();

enum EBEXEvents {
    ZERO = "zero",
    ONE = "one",
    PRIMARY = "primary",
    MID = "mid",
    MAIN = "main",
    TWO = "two",
    AFTER_ASYNC = "afterAsync",
}

ebexjs.use({
    processing: (params) => {
        console.log("---");
        console.log(
            `Emiting event - ${params.event} with priority - ${params.priority}`,
        );
    },
    after: (params) => {
        console.log(
            `Emited event - ${params.event} with priority - ${params.priority}`,
        );
        console.log("---");
    },
});

ebexjs.on({
    event: EBEXEvents.ZERO,
    callback: () => {},
    needAwait: false,
    priority: 0,
});
ebexjs.on({
    event: EBEXEvents.ONE,
    callback: () => {},
    needAwait: false,
    priority: 1,
});
ebexjs.on({
    event: EBEXEvents.PRIMARY,
    callback: () => {},
    needAwait: false,
    priority: 10,
});
ebexjs.on({
    event: EBEXEvents.MID,
    callback: async () => {
        await new Promise((resolve) => {
            setTimeout(() => {
                console.log("after 1 second delay");
                resolve(null);
            }, 1000);
        });
    },
    needAwait: true,
    priority: 5,
    middleware: {
        after: (params) => {
            console.log(`mid ev cb priority is - ${params.priority}`);
        },
    },
});
ebexjs.on({
    event: EBEXEvents.MAIN,
    callback: () => {},
    needAwait: false,
    priority: 100,
});
ebexjs.on({
    event: EBEXEvents.TWO,
    callback: () => {},
    needAwait: false,
    priority: 2,
});
ebexjs.on({
    event: EBEXEvents.AFTER_ASYNC,
    callback: () => {
        console.log("after async");
    },
    needAwait: false,
    priority: 1,
});

ebexjs.emit(EBEXEvents.ZERO, {}); // <-- will be emitted first due to an empty queue on emit.
ebexjs.emit(EBEXEvents.ZERO, {});
ebexjs.emit(EBEXEvents.ZERO, {});
ebexjs.emit(EBEXEvents.ONE, {});
ebexjs.emit(EBEXEvents.ONE, {});
ebexjs.emit(EBEXEvents.ONE, {});
ebexjs.emit(EBEXEvents.PRIMARY, {});
ebexjs.emit(EBEXEvents.PRIMARY, {});
ebexjs.emit(EBEXEvents.TWO, {});
ebexjs.emit(EBEXEvents.MAIN, {});
ebexjs.emit(EBEXEvents.MID, {});
ebexjs.emit(EBEXEvents.AFTER_ASYNC, {});
ebexjs.emit(EBEXEvents.MAIN, {});

// --> output:
// Emiting event - zero with priority - 0
// Emited event - zero with priority - 0
// ---
// Emiting event - main with priority - 100
// Emited event - main with priority - 100
// ---
// Emiting event - main with priority - 100
// Emited event - main with priority - 100
// ---
// Emiting event - primary with priority - 10
// Emited event - primary with priority - 10
// ---
// Emiting event - primary with priority - 10
// Emited event - primary with priority - 10
// ---
// Emiting event - mid with priority - 5
// after 1 second delay
// mid ev cb priority is - 5
// Emited event - mid with priority - 5
// ---
// Emiting event - two with priority - 2
// Emited event - two with priority - 2
// ---
// Emiting event - one with priority - 1
// Emited event - one with priority - 1
// ---
// Emiting event - one with priority - 1
// Emited event - one with priority - 1
// ---
// Emiting event - afterAsync with priority - 1
// after async
// Emited event - afterAsync with priority - 1
// ---
// Emiting event - one with priority - 1
// Emited event - one with priority - 1
// ---
// Emiting event - zero with priority - 0
// Emited event - zero with priority - 0
// ---
// Emiting event - zero with priority - 0
// Emited event - zero with priority - 0
// ---
```

#### **Middleware Support**

There is 2 types of middleware:

-   Global Middleware: With the `use` method, global middlewares can be set that run for every event. This is ideal for functionalities like logging or analytics that need to be executed for multiple events.
-   Event-specific Middleware: In addition to global middlewares, specific middleware can be associated with individual events, providing fine-grained control over event processing.

Both types hase the same interface:

```ts
/**
 * Middleware interface with different stages of execution.
 */
interface EBEXJSMiddleware<T extends object> {
    before?: EBEXJSMiddlewareCallback<T>; // Executes before event processing.
    processing?: EBEXJSMiddlewareCallback<T>; // Executes during event processing.
    after?: EBEXJSMiddlewareCallback<T>; // Executes after event processing.
}

/**
 * Middleware callback function type.
 * @param middlewareCallbackParams - The parameters for the middleware callback.
 */
type EBEXJSMiddlewareCallback<T extends object> = (
    middlewareCallbackParams: EBEXJSMiddlewareCallbackParams<T>,
) => void | Promise<void>;

/**
 * Parameters for middleware callback functions.
 * @param event - The name of the event.
 * @param data - Optional parameters to pass to the event handlers.
 * @param needAwait - Whether the callback needs to wait for previous events.
 * @param priority - The priority of the callback.
 */
type EBEXJSMiddlewareCallbackParams<T extends object> = {
    event: string;
    data: EBEXJSCallbackParams<T>;
} & EBEXJSCommonProperties;

/**
 * Type definition for event callback parameters.
 */
type EBEXJSCallbackParams<T extends object> = T & GenericRecord;

/**
 * Type for a generic record.
 */
type GenericRecord = Record<string, unknown>;

/**
 * Common properties for event registration.
 */
type EBEXJSCommonProperties = {
    needAwait: boolean;
    priority: number;
};
```

# **Async/Await Support**

EBEXJS supports asynchronous operations, allowing you to decide if an event needs to wait for previous events to be completed before it's processed even if your callback is synchronous. It's useful in scenarios where the order of event processing matters.

# When to use EBEXJS?

EBEXJS is particularly useful when you want to build applications with a high degree of decoupling among components. It provides an effective way to handle communication between components without needing direct references to each other. This results in a more modular and maintainable application structure.

Moreover, it's great for applications that require prioritized event handling and middleware functionality for added flexibility during event processing.

# Usage

1. **Instalation and Initialization**

    ```bash
    npm install @persevie/ebexjs
    ```

    ```typescript
    const { EBEXJS } from "@persevie/ebexjs";

    const ebexjs = new EBEXJS();
    ```

2. **Registering Event Handlers**

    ```typescript
    ebexjs.on({
        event: "eventName",
        callback: (data) => {
            console.log("Event occurred with data:", data);
        },
        needAwait: false,
        priority: 1,
    });
    ```

3. **Emitting Events**

    ```typescript
    ebexjs.emit("eventName", { key: "value" });
    ```

4. **Unregistering Event Handlers**

    ```typescript
    ebexjs.off("eventName");
    ```

5. **Using Middleware**

    - **Global Middleware** (applies to all events)

        ```typescript
        ebexjs.use({
            before: ({ event, data }) => {
                console.log(`Before event ${event} with data:`, data);
            },
        });
        ```

    - **Event-specific Middleware**

        ```typescript
        ebexjs.on({
            event: "eventName",
            callback: (data) => {
                /* ... */
            },
            middleware: {
                processing: ({ event, data }) => {
                    console.log(`Processing event ${event} with data:`, data);
                },
            },
            needAwait: false,
            priority: 1,
        });
        ```

# Example: ToDo App

First, let's define an example application to showcase EBEXJS's features. We'll use a simple ToDo app:

1. **Types & Enum Definitions**

    ```typescript
    enum EBEXEvents {
        ADD_TODO = "ADD_TODO",
        REMOVE_TODO = "REMOVE_TODO",
        TOGGLE_TODO = "TOGGLE_TODO",
    }

    type TodoItem = {
        id: number;
        title: string;
        done: boolean;
    };
    ```

2. **HTML Structure**

    ```html
    <div id="app">
        <input type="text" id="todoInput" placeholder="Add a new todo" />
        <button id="addTodoBtn">Add</button>
        <ul id="todoList"></ul>
    </div>
    <script src="./build.js"></script>
    ```

3. **App Logic (TypeScript)**

    ```typescript
    const { EBEXJS } from "@persevie/ebexjs";

    const ebexjs = new EBEXJS();

    let todoList: TodoItem[] = [];
    let lastId = 0;

    // Event handlers
    ebexjs.on<TodoItem>({
        event: EBEXEvents.ADD_TODO,
        callback: (data) => {
            data.id = ++lastId;
            todoList.push(data);
            renderTodos();
        },
        needAwait: false,
        priority: 1,
    });

    ebexjs.on<number>({
        event: EBEXEvents.REMOVE_TODO,
        callback: (data) => {
            todoList = todoList.filter((todo) => todo.id !== data);
            renderTodos();
        },
        needAwait: false,
        priority: 1,
    });

    ebexjs.on<number>({
        event: EBEXEvents.TOGGLE_TODO,
        callback: (data) => {
            const todo = todoList.find((todo) => todo.id === data);
            if (todo) todo.done = !todo.done;
            renderTodos();
        },
        needAwait: false,
        priority: 1,
    });

    // Middleware
    ebexjs.use({
        before: ({ event }) => {
            console.log(`About to process event: ${event}`);
        },
    });

    // App Logic
    document.getElementById("addTodoBtn")!.addEventListener("click", () => {
        const inputElem = document.getElementById(
            "todoInput",
        ) as HTMLInputElement;
        const title = inputElem.value.trim();
        if (title) {
            ebexjs.emit(EBEXEvents.ADD_TODO, { id: 0, title, done: false });
            inputElem.value = "";
        }
    });

    function renderTodos() {
        const listElem = document.getElementById(
            "todoList",
        ) as HTMLUListElement;
        listElem.innerHTML = "";
        todoList.forEach((todo) => {
            const li = document.createElement("li");
            li.textContent = `${todo.done ? "✅" : "❌"} ${todo.title}`;
            li.addEventListener("click", () => {
                ebexjs.emit(EBEXEvents.TOGGLE_TODO, todo.id);
            });
            li.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                ebexjs.emit(EBEXEvents.REMOVE_TODO, todo.id);
            });
            listElem.appendChild(li);
        });
    }
    ```

With the above structure and code, you have a basic ToDo app that leverages EBEXJS for event handling.

---

EBEXJS provides a streamlined, highly performant, and flexible way to manage application-wide events. By using priority queues, offering concurrent and sequential event processing, and allowing robust middleware integration, EBEXJS serves as an invaluable tool in a developer's toolkit. Whether you're building a small application or a large-scale project, EBEXJS ensures efficient communication and interaction between components while maintaining a modular and maintainable structure. Give EBEXJS a try and experience a modern approach to event-driven development.

# For contributors

See [CONTRIBUTING.md](https://github.com/persevie/ebexjs/blob/main/CONTRIBUTING.md).
