#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
const DEFAULT_CONFIG = {
    apiUrl: process.env.OBSIDIAN_API_URL || "http://localhost:27124",
    apiKey: process.env.OBSIDIAN_API_KEY,
};
class ObsidianTodosServer {
    server;
    config;
    constructor(config = DEFAULT_CONFIG) {
        this.config = config;
        this.server = new Server({
            name: "obsidian-todos-mcp-server",
            version: "1.2.4",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    async fetchApi(endpoint, options = {}) {
        const url = `${this.config.apiUrl}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        };
        if (this.config.apiKey) {
            headers["Authorization"] = this.config.apiKey;
        }
        const response = await fetch(url, {
            ...options,
            headers,
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "list_todos",
                    description: "List all incomplete todos from Obsidian vault using Dataview",
                    inputSchema: {
                        type: "object",
                        properties: {
                            status: {
                                type: "string",
                                description: "The todo status (e.g. ' ', '!', '*'",
                            },
                            completed: {
                                type: "boolean",
                                description: "Do you want completed tasks only?"
                            },
                            path: {
                                type: "string",
                                description: "Only search beneath this path"
                            },
                            tag: {
                                type: "string",
                                description: "only match on these tags"
                            },
                            exclude: {
                                type: "string",
                                description: "A comma separated list of paths to exclude"
                            }
                        }
                    },
                },
                {
                    name: "add_todo",
                    description: "Add a new todo to today's daily note in Obsidian",
                    inputSchema: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                                description: "The todo text to add",
                            },
                        },
                        required: ["text"],
                    },
                },
                {
                    name: "update_todo",
                    description: "Update an existing todo in Obsidian (mark complete, change text, etc.)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file: {
                                type: "string",
                                description: "Path to the file containing the todo",
                            },
                            line: {
                                type: "number",
                                description: "Line number of the todo (0-indexed)",
                            },
                            text: {
                                type: "string",
                                description: "New text for the todo",
                            },
                            completed: {
                                type: "boolean",
                                description: "Whether the todo should be marked complete",
                            },
                        },
                        required: ["file", "line"],
                    },
                },
                {
                    name: "get_todo_stats",
                    description: "Get statistics about todos (total, by file, etc.)",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "list_due_dates",
                    description: "List all due dates from tables under # Due Dates headings in Obsidian",
                    inputSchema: {
                        type: "object",
                        properties: {
                            start: {
                                type: "string",
                                description: "Start date in YYYY-MM-DD format (optional)",
                            },
                            end: {
                                type: "string",
                                description: "End date in YYYY-MM-DD format (optional)",
                            },
                            query: {
                                type: "string",
                                description: "Query/tag filter (optional)",
                            },
                        },
                    },
                },
            ],
        }));
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case "list_todos": {
                        const { status, completed, path, tag, exclude } = args;
                        // Build query parameters
                        const params = new URLSearchParams();
                        if (status)
                            params.append("status", status);
                        if (completed !== undefined)
                            params.append("completed", completed.toString());
                        if (path)
                            params.append("path", path);
                        if (tag)
                            params.append("tag", tag);
                        if (exclude)
                            params.append("exclude", exclude);
                        const queryString = params.toString();
                        const endpoint = queryString ? `/todos/?${queryString}` : "/todos/";
                        const result = await this.fetchApi(endpoint);
                        // Process and filter the results
                        const todos = result.todos || result || [];
                        const processedTodos = [];
                        const seenIds = new Set(); // For deduplication
                        for (const todo of todos) {
                            // Filter out completed tasks when completed=false
                            if (completed === false && todo.status === "x") {
                                continue;
                            }
                            // Extract only the required fields
                            const filteredTodo = {
                                text: todo.text,
                                path: todo.path,
                                line: todo.line,
                                position: todo.position,
                                status: todo.status,
                                completed: todo.completed,
                                fullyCompleted: todo.fullyCompleted,
                                scheduled: todo.scheduled,
                                due: todo.due,
                                start: todo.start
                            };
                            // Add parent_id if it exists
                            if (todo.id) {
                                filteredTodo.parent_id = todo.parent_id || null;
                            }
                            // Create a unique key for deduplication
                            const uniqueKey = `${todo.path}-${todo.line}-${todo.text}`;
                            if (!seenIds.has(uniqueKey)) {
                                seenIds.add(uniqueKey);
                                processedTodos.push(filteredTodo);
                            }
                            // Process children if they exist
                            if (todo.children && todo.children.length > 0) {
                                for (const child of todo.children) {
                                    const childUniqueKey = `${child.path}-${child.line}-${child.text}`;
                                    if (!seenIds.has(childUniqueKey)) {
                                        seenIds.add(childUniqueKey);
                                        const processedChild = {
                                            text: child.text,
                                            path: child.path,
                                            line: child.line,
                                            position: child.position,
                                            status: child.status,
                                            completed: child.completed,
                                            fullyCompleted: child.fullyCompleted,
                                            scheduled: child.scheduled,
                                            due: child.due,
                                            start: child.start,
                                            parent_id: todo.id || `${todo.path}-${todo.line}-${todo.text}`
                                        };
                                        processedTodos.push(processedChild);
                                    }
                                }
                            }
                        }
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({ todos: processedTodos }, null, 2),
                                },
                            ],
                        };
                    }
                    case "add_todo": {
                        const { text } = args;
                        const result = await this.fetchApi("/todos/", {
                            method: "POST",
                            body: JSON.stringify({ text }),
                        });
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case "update_todo": {
                        const { file, line, text, completed } = args;
                        const result = await this.fetchApi("/todos/", {
                            method: "PUT",
                            body: JSON.stringify({ file, line, text, completed }),
                        });
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    case "get_todo_stats": {
                        const todos = await this.fetchApi("/todos/");
                        const stats = {
                            total: todos.todos?.length || 0,
                            byFile: todos.todos?.reduce((acc, todo) => {
                                acc[todo.file] = (acc[todo.file] || 0) + 1;
                                return acc;
                            }, {}),
                        };
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(stats, null, 2),
                                },
                            ],
                        };
                    }
                    case "list_due_dates": {
                        const { start, end, query } = args;
                        // Build query parameters
                        const params = new URLSearchParams();
                        if (start)
                            params.append("start", start);
                        if (end)
                            params.append("end", end);
                        if (query)
                            params.append("query", query);
                        const queryString = params.toString();
                        const endpoint = queryString ? `/due-dates/?${queryString}` : "/due-dates/";
                        const result = await this.fetchApi(endpoint);
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify(result, null, 2),
                                },
                            ],
                        };
                    }
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Obsidian Todos MCP Server running on stdio");
    }
}
// Start the server
const server = new ObsidianTodosServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map