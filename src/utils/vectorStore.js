import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import fs from 'fs/promises';
import { encode } from 'gpt-3-encoder';
import ignore from 'ignore';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vectorStorePath = path.resolve(__dirname, '../../codetalk_vs');

function getEmbeddings(config) {
    switch (config.llm_provider) {
        case 'gemini':
            return new GoogleGenerativeAIEmbeddings({
                apiKey: config.api_key,
                modelName: config.embedding_model_name
            });
        case 'openai':
            return new OpenAIEmbeddings({
                apiKey: config.api_key,
                model: config.embedding_model_name
            });
        case 'ollama':
            return new OllamaEmbeddings({
                model: config.embedding_model_name
            });
        default:
            throw new Error(`Unsupported LLM provider for embeddings: ${config.llm_provider}`);
    }
}

async function createVectorStore() {
    const config = loadConfig();
    const fileExtensions = config.file_extensions || {
        ".js": true, ".jsx": true, ".ts": true, ".tsx": true,
        ".php": true, ".py": true, ".html": true, ".css": true
    };

    const maxTokenLimit = config.max_token_limit || 100000;
    let totalTokens = 0;

    const ig = ignore().add(config.ignore_patterns || []);

    const currentDirectory = process.cwd();
    const documents = [];

    async function walkDir(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(currentDirectory, fullPath);
            if (ig.ignores(relativePath)) continue;

            if (entry.isDirectory()) {
                const reachedLimit = await walkDir(fullPath);
                if (reachedLimit) return true;
            } else {
                const ext = path.extname(entry.name);
                if (fileExtensions[ext]) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const tokens = encode(content).length;
                        if (totalTokens + tokens > maxTokenLimit) {
                            console.log(`Reached token limit. Stopping at ${totalTokens} tokens.`);
                            return true;
                        }
                        totalTokens += tokens;
                        documents.push({ pageContent: content, metadata: { source: fullPath } });
                    } catch (error) {
                        console.warn(`Error reading file ${fullPath}: ${error.message}`);
                    }
                }
            }
        }
        return false;
    }

    try {
        const reachedLimit = await walkDir(currentDirectory);

        if (reachedLimit) {
            console.log(`Processed ${documents.length} documents before reaching token limit.`);
        } else {
            console.log(`Found ${documents.length} documents to process. Total estimated tokens: ${totalTokens}`);
        }

        const embeddings = getEmbeddings(config);

        const vectorStore = await FaissStore.fromDocuments(
            documents,
            embeddings
        );

        await vectorStore.save(vectorStorePath);
        console.log(`Vector store saved to ${vectorStorePath}`);
    } catch (error) {
        console.error('Error creating vector store:', error);
        throw error;
    }
}

async function loadVectorStore() {
    const config = loadConfig();
    const embeddings = getEmbeddings(config);
    return await FaissStore.load(vectorStorePath, embeddings);
}

async function clearVectorStore() {
    try {
        await fs.rm(vectorStorePath, { recursive: true, force: true });
        console.log(`Vector store at ${vectorStorePath} has been cleared.`);
    } catch (error) {
        console.error('Error clearing vector store:', error);
        throw error;
    }
}

async function vectorStoreExists() {
    try {
        await fs.access(vectorStorePath);
        return true;
    } catch {
        return false;
    }
}

export { clearVectorStore, createVectorStore, loadVectorStore, vectorStoreExists };

