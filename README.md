<p align="center">
<img height="60" alt="Statemanjs logo" src="./assets/ebexjs.png">
</p>

[![codecov](https://codecov.io/gh/persevie/ebexjs/branch/main/graph/badge.svg?token=XI61QMHGQ2)](https://codecov.io/gh/persevie/ebexjs)

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

- [Introduction](#introduction)
- [API](#api)
- [Event Prioritization](#event-prioritization)
  - [Middleware Support](#middleware-support)
- [Async/Await Support](#asyncawait-support)
- [When to use EBEXJS?](#when-to-use-ebexjs)
- [Usage](#usage)
- [Example: ToDo App](#example-todo-app)
- [For contributors](#for-contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Introduction

EBEXJS (**E**vent **B**us **Ex**ecutor) is a tiny, high-performance, flexible event bus designed for local application communication, event management, and decoupled interaction between components.

**Key features**:

- Priority-based Event Queue: EBEXJS includes a priority-based event queue. It ensures that events are processed based on their priority, with higher priority events processed before lower priority ones.
- High performance: EBEXJS is designed with performance in mind. It uses a priority queue based binary heap data structure for event management, ensuring high-performance event processing and prioritization.
- Concurrent and Sequential Processing: Events can be set to wait for previous events to complete (`needAwait` property) or to be processed concurrently, offering flexibility in event handling based on use-case requirements.
- Clear API: EBEXJS has a clear and easy-to-use API.
- TypeScript support: EBEXJS's code is written in TypeScript, providing type safety and clear type definitions for developers.
- Middleware Integration: EBEXJS supports middleware execution at different stages of event processing - before, during, and after an event. This offers high flexibility in event management and customization.
- Small size: EBEXJS has a tiny size of only less than 5KB, making it easy to include in your project without being too big.
- Safety tooling: Input validation, listener diagnostics, and queue flushing APIs help keep long-running apps healthy without extra plumbing.

# API

```ts
/**
 * Registers an event listener.
 * @param registerParams - Parameters used to register an event listener.
 */
on<T extends object>(
    registerParams: EBEXJSRegisterParams<T>,
): EBEXJSUnsubscribe;

/**
 * Unregisters an event.
 * @param event - The name of the event or an array of names.
 */
off(event: string, callback?: EBEXJSEventCallback<GenericRecord>): void;

/**
 * Emits an event.
 * @param event - The name of the event.
 * @param data - Optional parameters to pass to the event handlers.
 */
emit<T extends object>(
    event: string,
    data?: EBEXJSCallbackParams<T>,
): Promise<void>;

/**
 * Registers a callback for an event, then unregisters it after the first execution.
 * @param registerParams - Parameters for registering the callback.
 */
once<T extends object>(
    registerParams: EBEXJSRegisterParams<T>,
): EBEXJSUnsubscribe;

/**
 * Adds a middleware.
 * @param middleware - Middleware to add.
 */
use<T extends object>(middleware: EBEXJSMiddleware<T>): EBEXJSUnsubscribe;

/**
 * Returns the number of listeners for the given event (or all events when omitted).
 */
listenerCount(event?: string): number;

/**
 * Checks whether listeners exist for the given event (or any event when omitted).
 */
hasListeners(event?: string): boolean;

/**
 * Removes every listener and clears the internal queue.
 */
clear(): void;
```

# Event Prioritization

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

## Middleware Support

There is 2 types of middleware:

- Global Middleware: With the `use` method, global middlewares can be set that run for every event. This is ideal for functionalities like logging or analytics that need to be executed for multiple events.
- Event-specific Middleware: In addition to global middlewares, specific middleware can be associated with individual events, providing fine-grained control over event processing.

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

# Async/Await Support

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
    const unsubscribe = ebexjs.on({
        event: "eventName",
        callback: (data) => {
            console.log("Event occurred with data:", data);
        },
        needAwait: false,
        priority: 1,
    });
    ```

    The returned function can be used to unsubscribe without remembering the original callback:

    ```typescript
    unsubscribe();
    ```

3. **Emitting Events**

    ```typescript
    ebexjs.emit("eventName", { key: "value" });
    ```

4. **Unregistering Event Handlers**

    ```typescript
    // Remove every listener for the event
    ebexjs.off("eventName");

    // Remove only the specified handler
    ebexjs.off("eventName", callback);
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

6. **Introspection & Maintenance**

    ```typescript
    ebexjs.listenerCount(); // total listeners across all events
    ebexjs.listenerCount("eventName"); // listeners for a specific event
    ebexjs.hasListeners(); // any listeners?
    ebexjs.clear(); // drop all listeners and pending queue work
    ```

# Example: ToDo App

A complete event-driven todo application demonstrating EBEXJS features is available: [**examples/todoapp.html**](examples/todoapp.html)

```html
<main class="app">
    <h1>Tasks</h1>
    <form id="todo-form" autocomplete="off">
        <input
            id="todo-input"
            type="text"
            placeholder="What needs to be done?"
            aria-label="Add a new todo"
        />
        <button type="submit">Add</button>
    </form>

    <section class="toolbar">
        <div class="filters" role="group" aria-label="Todo filters">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="active">Active</button>
            <button class="filter-btn" data-filter="completed">
                Completed
            </button>
        </div>
        <div class="summary" id="summary">0 items · 0 completed</div>
        <button id="clear-completed" class="ghost-btn" type="button">
            Clear completed
        </button>
    </section>

    <ul id="todo-list" aria-live="polite"></ul>
    <div class="empty-state" id="empty-state">No tasks yet.</div>
</main>

<script type="module">
    import { EBEXJS } from "../packages/ebexjs.mjs";

    const bus = new EBEXJS();

    const Events = Object.freeze({
        ADD_TODO: "ADD_TODO",
        TOGGLE_TODO: "TOGGLE_TODO",
        DELETE_TODO: "DELETE_TODO",
        CLEAR_COMPLETED: "CLEAR_COMPLETED",
        FILTER_CHANGED: "FILTER_CHANGED",
        STATE_UPDATED: "STATE_UPDATED",
    });

    const store = {
        todos: [],
        filter: "all",
        nextId: 1,
    };

    const summaryEl = document.querySelector("#summary");
    const form = document.querySelector("#todo-form");
    const input = document.querySelector("#todo-input");
    const todoList = document.querySelector("#todo-list");
    const emptyStateEl = document.querySelector("#empty-state");
    const clearCompletedBtn = document.querySelector("#clear-completed");
    const filterButtons = Array.from(
        document.querySelectorAll(".filter-btn[data-filter]"),
    );

    const createSnapshot = () => ({
        todos: store.todos.map((todo) => ({ ...todo })),
        filter: store.filter,
        total: store.todos.length,
        completed: store.todos.filter((todo) => todo.completed).length,
    });

    const broadcastState = async () => {
        await bus.emit(Events.STATE_UPDATED, createSnapshot());
    };

    const withGuard = (handler) => async (payload) => {
        try {
            await handler(payload ?? {});
        } catch (error) {
            console.error("TodoApp handler error", error);
        }
    };

    bus.on({
        event: Events.ADD_TODO,
        priority: 100,
        needAwait: true,
        callback: withGuard(async ({ text }) => {
            const normalized = (text ?? "").trim();
            if (normalized.length === 0) {
                return;
            }
            store.todos.push({
                id: store.nextId++,
                text: normalized,
                completed: false,
                createdAt: Date.now(),
            });
            await broadcastState();
        }),
    });

    bus.on({
        event: Events.TOGGLE_TODO,
        priority: 100,
        needAwait: true,
        callback: withGuard(async ({ id }) => {
            const todo = store.todos.find((item) => item.id === Number(id));
            if (!todo) {
                return;
            }
            todo.completed = !todo.completed;
            await broadcastState();
        }),
    });

    bus.on({
        event: Events.DELETE_TODO,
        priority: 100,
        needAwait: true,
        callback: withGuard(async ({ id }) => {
            const numericId = Number(id);
            store.todos = store.todos.filter((todo) => todo.id !== numericId);
            await broadcastState();
        }),
    });

    bus.on({
        event: Events.CLEAR_COMPLETED,
        priority: 100,
        needAwait: true,
        callback: withGuard(async () => {
            store.todos = store.todos.filter((todo) => !todo.completed);
            await broadcastState();
        }),
    });

    bus.on({
        event: Events.FILTER_CHANGED,
        priority: 100,
        needAwait: true,
        callback: withGuard(async ({ filter }) => {
            if (!filter) {
                return;
            }
            store.filter = filter;
            await broadcastState();
        }),
    });

    bus.on({
        event: Events.STATE_UPDATED,
        priority: 10,
        needAwait: false,
        callback: ({ todos, filter, total, completed }) => {
            const filters = {
                all: () => true,
                active: (todo) => !todo.completed,
                completed: (todo) => todo.completed,
            };
            const applyFilter = filters[filter] ?? filters.all;
            const visibleTodos = todos.filter(applyFilter);

            todoList.innerHTML = "";
            if (visibleTodos.length === 0) {
                emptyStateEl.hidden = false;
            } else {
                emptyStateEl.hidden = true;
                const fragment = document.createDocumentFragment();
                for (const todo of visibleTodos) {
                    const item = document.createElement("li");
                    item.classList.toggle("completed", todo.completed);
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = todo.completed;
                    checkbox.dataset.id = String(todo.id);
                    checkbox.setAttribute("aria-label", `Toggle ${todo.text}`);

                    const text = document.createElement("span");
                    text.className = "todo-text";
                    text.textContent = todo.text;

                    const removeBtn = document.createElement("button");
                    removeBtn.type = "button";
                    removeBtn.textContent = "Remove";
                    removeBtn.dataset.id = String(todo.id);
                    removeBtn.className = "filter-btn";

                    item.append(checkbox, text, removeBtn);
                    fragment.append(item);
                }
                todoList.append(fragment);
            }

            summaryEl.textContent = `${total} item${
                total === 1 ? "" : "s"
            } · ${completed} completed`;

            for (const button of filterButtons) {
                const isActive = button.dataset.filter === filter;
                button.classList.toggle("active", isActive);
                button.setAttribute(
                    "aria-pressed",
                    isActive ? "true" : "false",
                );
            }

            clearCompletedBtn.disabled = completed === 0;
        },
    });

    bus.use({
        processing: ({ event }) => {
            if (event === Events.STATE_UPDATED) {
                return;
            }
            console.info(`[bus] processing ${event}`);
        },
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value;
        input.value = "";
        void bus.emit(Events.ADD_TODO, { text });
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            input.value = "";
        }
    });

    todoList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-id]");
        if (!button) {
            return;
        }
        const { id } = button.dataset;
        void bus.emit(Events.DELETE_TODO, { id });
    });

    todoList.addEventListener("change", (event) => {
        const checkbox = event.target.closest("input[type='checkbox']");
        if (!checkbox) {
            return;
        }
        const { id } = checkbox.dataset;
        void bus.emit(Events.TOGGLE_TODO, { id });
    });

    clearCompletedBtn.addEventListener("click", () => {
        void bus.emit(Events.CLEAR_COMPLETED);
    });

    for (const button of filterButtons) {
        button.addEventListener("click", () => {
            const { filter } = button.dataset;
            void bus.emit(Events.FILTER_CHANGED, { filter });
        });
    }

    void bus.emit(Events.STATE_UPDATED, createSnapshot());
</script>
```

---

EBEXJS provides a streamlined, highly performant, and flexible way to manage application-wide events. By using priority queues, offering concurrent and sequential event processing, and allowing robust middleware integration, EBEXJS serves as an invaluable tool in a developer's toolkit. Whether you're building a small application or a large-scale project, EBEXJS ensures efficient communication and interaction between components while maintaining a modular and maintainable structure. Give EBEXJS a try and experience a modern approach to event-driven development.

# For contributors

See [CONTRIBUTING.md](https://github.com/persevie/ebexjs/blob/main/CONTRIBUTING.md).
