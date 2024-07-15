import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ollama } from "@langchain/community/llms/ollama";
import { OpenAI } from "@langchain/openai";
import { loadConfig } from './config.js';
import { loadVectorStore } from './vectorStore.js';

function initializeLLM() {
    const config = loadConfig();
    switch (config.llm_provider) {
        case 'gemini':
            return new GoogleGenerativeAI(config.api_key);
        case 'openai':
            return new OpenAI({
                apiKey: config.api_key,
                modelName: config.model_name
            });
        case 'ollama':
            return new Ollama({ model: config.model_name });
        default:
            throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
    }
}

async function queryLLM(llm, prompt, history) {
    const config = loadConfig();

    switch (config.llm_provider) {
        case 'gemini':
            return queryGemini(llm, prompt, history, config);
        case 'openai':
            return queryOpenAI(llm, prompt, history, config);
        case 'ollama':
            return queryOllama(llm, prompt, history, config);
        default:
            throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
    }
}

async function queryGemini(genAI, prompt, history, config, retries = 3) {
    const model = genAI.getGenerativeModel({ model: config.model_name });
    const context = await buildContext();
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = constructFullPrompt(context, conversationContext, prompt);

    let fullResponse = '';

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await model.generateContentStream(fullPrompt);

            if (result.stream) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    fullResponse += chunkText;
                    process.stdout.write('\x1b[34m' + chunkText + '\x1b[0m');
                }
            } else {
                fullResponse = result.text();
                process.stdout.write('\x1b[34m' + fullResponse + '\x1b[0m');
            }

            return fullResponse;
        } catch (error) {
            if (error.message.includes('Failed to parse stream') && attempt < retries - 1) {
                console.warn(`Stream parsing failed. Retrying (${attempt + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
            } else {
                throw error;
            }
        }
    }

    throw new Error('Max retries reached. Unable to get a response from the API.');
}


async function queryOpenAI(openai, prompt, history, config) {
    const context = await buildContext();
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = constructFullPrompt(context, conversationContext, prompt);

    let fullResponse = '';
    let buffer = '';
    const streamingModel = new OpenAI({
        apiKey: config.api_key,
        modelName: openai.modelName,
        streaming: true,
        callbacks: [
            {
                handleLLMNewToken(token) {
                    fullResponse += token;
                    buffer += token;
                    if (buffer.length > 20 || token.includes('\n')) {
                        process.stdout.write('\x1b[34m' + buffer + '\x1b[0m');
                        buffer = '';
                    }
                },
            },
        ],
    });

    await streamingModel.invoke(fullPrompt);

    if (buffer.length > 0) {
        process.stdout.write('\x1b[34m' + buffer + '\x1b[0m');
    }
    console.log();

    return fullResponse;
}

async function queryOllama(ollama, prompt, history, config) {
    const context = await buildContext();
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = constructFullPrompt(context, conversationContext, prompt);

    const response = await ollama.invoke(fullPrompt);
    return response;
}


async function buildContext() {
    const vectorStore = await loadVectorStore();

    // TODO: we need to increase second argument to get more documents for llm context, however it is giving too many requests error, need to fix.
    const documents = await vectorStore.similaritySearch("", 10);
    const maxContextLength = 10000000;
    let context = "";

    for (const doc of documents) {
        const newContent = `File: ${doc.metadata.source}\n${doc.pageContent}\n\n`;
        //if (context.length + newContent.length > maxContextLength) break;
        context += newContent;
    }
    return context;
}

function formatConversationHistory(history) {
    return history.map(item => `${item.role}: ${item.content}`).join('\n');
}

function constructFullPrompt(context, conversationHistory, prompt) {
    const fullPrompt = `
    Use the following context and optionally conversation history if it is not empty to
    answer the question in detail and easy to understand language. Format your response
    for command-line display: use plain text only, avoid special formatting like markdown
    or HTML, and structure information with simple indentation or line breaks if needed.

    Context:
    ${context}

    Conversation history:
    ${conversationHistory}

    Question: ${prompt}
    Answer:`;

    console.log('________________________________________________________________');
    console.log(fullPrompt);
    console.log('________________________________________________________________');

    return fullPrompt;
}


export { initializeLLM, queryLLM };

