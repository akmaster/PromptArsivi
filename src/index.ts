#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE = path.join(__dirname, "..", "prompts.json");

interface Prompt {
    id: string;
    title: string;
    description: string;
    content: string;
}

interface PromptsData {
    prompts: Prompt[];
}

class PromptArsiviServer {
    private server: Server;
    private prompts: Prompt[] = [];

    constructor() {
        this.server = new Server(
            {
                name: "prompt-arsivi-server",
                version: "0.1.0",
            },
            {
                capabilities: {
                    resources: {},
                    tools: {},
                },
            }
        );

        this.setupResourceHandlers();
        this.setupToolHandlers();

        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    private async loadPrompts(): Promise<void> {
        const githubUrl = process.env.GITHUB_PROMPTS_URL;
        if (githubUrl) {
            try {
                const response = await fetch(githubUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch from GitHub: ${response.statusText}`);
                }
                const data = await response.json() as PromptsData;
                this.prompts = data.prompts;
                return;
            } catch (error) {
                console.error("Error loading prompts from GitHub:", error);
                // Fallback to empty or potentially local file? Let's treat it as error for now or fallback
            }
        }

        try {
            const data = await fs.readFile(PROMPTS_FILE, "utf-8");
            const parsed: PromptsData = JSON.parse(data);
            this.prompts = parsed.prompts;
        } catch (error) {
            console.error("Error loading prompts:", error);
            // Initialize with empty array if file doesn't exist or is invalid
            this.prompts = [];
        }
    }

    private async savePrompts(): Promise<void> {
        const data: PromptsData = { prompts: this.prompts };
        await fs.writeFile(PROMPTS_FILE, JSON.stringify(data, null, 2), "utf-8");
    }

    private setupResourceHandlers() {
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            await this.loadPrompts();
            return {
                resources: this.prompts.map((prompt) => ({
                    uri: `prompt://arsiv/${prompt.id}`,
                    name: prompt.title,
                    description: prompt.description,
                    mimeType: "text/plain",
                })),
            };
        });

        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            await this.loadPrompts();
            const url = new URL(request.params.uri);
            const id = url.pathname.replace(/^\//, "");
            const prompt = this.prompts.find((p) => p.id === id);

            if (!prompt) {
                throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${id}`);
            }

            return {
                contents: [
                    {
                        uri: request.params.uri,
                        mimeType: "text/plain",
                        text: prompt.content,
                    },
                ],
            };
        });
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "add_prompt",
                        description: "Yeni bir prompt ekler",
                        inputSchema: {
                            type: "object",
                            properties: {
                                id: { type: "string", description: "Prompt için benzersiz ID" },
                                title: { type: "string", description: "Prompt başlığı" },
                                description: { type: "string", description: "Prompt açıklaması" },
                                content: { type: "string", description: "Prompt içeriği" },
                            },
                            required: ["id", "title", "content"],
                        },
                    },
                    {
                        name: "list_prompts_json",
                        description: "Tüm promptları JSON formatında listeler (Resource listesinden daha detaylı)",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            await this.loadPrompts();

            if (request.params.name === "add_prompt") {
                const args = request.params.arguments as any;
                if (!args.id || !args.title || !args.content) {
                    throw new McpError(ErrorCode.InvalidParams, "Missing required arguments");
                }

                if (this.prompts.find(p => p.id === args.id)) {
                    throw new McpError(ErrorCode.InvalidParams, `Prompt with ID ${args.id} already exists`);
                }

                const newPrompt: Prompt = {
                    id: args.id,
                    title: args.title,
                    description: args.description || "",
                    content: args.content
                };

                this.prompts.push(newPrompt);
                await this.savePrompts();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Prompt '${args.title}' with ID '${args.id}' added successfully.`
                        }
                    ]
                };
            }

            if (request.params.name === "list_prompts_json") {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(this.prompts, null, 2)
                        }
                    ]
                };
            }

            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Prompt Arşivi MCP Server running on stdio");
    }
}

const server = new PromptArsiviServer();
server.run().catch(console.error);
