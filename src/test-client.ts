import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    ListResourcesResultSchema,
    ReadResourceResultSchema,
    ListToolsResultSchema,
    CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

async function runClient() {
    // Transport to connect to the local server
    const transport = new StdioClientTransport({
        command: "node",
        args: ["./dist/index.js"],
    });

    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        console.log("✅ Connected to MCP Server");

        // 1. List Resources
        console.log("\n--- Listing Resources ---");
        const resources = await client.request(
            { method: "resources/list" },
            ListResourcesResultSchema
        );
        console.log(JSON.stringify(resources, null, 2));

        // 2. Read First Resource (if any)
        if (resources.resources && resources.resources.length > 0) {
            const firstResource = resources.resources[0];
            console.log(`\n--- Reading Resource: ${firstResource.name} ---`);
            const content = await client.request(
                {
                    method: "resources/read",
                    params: { uri: firstResource.uri },
                },
                ReadResourceResultSchema
            );
            console.log(JSON.stringify(content, null, 2));
        }

        // 3. List Tools
        console.log("\n--- Listing Tools ---");
        const tools = await client.request(
            { method: "tools/list" },
            ListToolsResultSchema
        );
        console.log(JSON.stringify(tools, null, 2));

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        // Graceful shutdown
        await client.close();
    }
}

runClient();
