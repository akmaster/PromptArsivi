import fs from "fs";
import path from "path";
import matter from "gray-matter";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const OUTPUT_FILE = path.join(process.cwd(), "prompts.json");

interface Prompt {
    id: string;
    title: string;
    description: string;
    content: string;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

function buildPrompts() {
    console.log("Building prompts from", PROMPTS_DIR);

    if (!fs.existsSync(PROMPTS_DIR)) {
        console.error(`Prompts directory not found: ${PROMPTS_DIR}`);
        process.exit(1);
    }

    const files = getAllFiles(PROMPTS_DIR);
    const prompts: Prompt[] = [];

    files.forEach((file) => {
        if (path.extname(file) === ".md") {
            const fileContent = fs.readFileSync(file, "utf-8");
            const { data, content } = matter(fileContent);

            if (!data.id || !data.title) {
                console.warn(`Skipping ${file}: Missing id or title in frontmatter`);
                return;
            }

            prompts.push({
                id: data.id,
                title: data.title,
                description: data.description || "",
                content: content.trim(),
            });

            console.log(`Examples parsed: ${data.id}`);
        }
    });

    const outputData = { prompts };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf-8");
    console.log(`Successfully wrote ${prompts.length} prompts to ${OUTPUT_FILE}`);
}

buildPrompts();
