import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
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


async function getStandAloneQuestion(llm, query, conv_history) {
    const prompt = `
    Given the following conversation and a follow up question, rephrase the follow up question
    to be a standalone question. If provided context does not include a follow-up question, then
    just answer with "No Question Provided".

    Be smart and think before answering. For example if user asks about overview or dependecies of
    the project, you should rephrase to include files like composer.json, package.json, README.md,
    etc files for example.

    Similarly, if user asks "I want to add remember me checkbox to login page, how do i do it", then
    you should think what type of project is this. If it is laravel project for example, you should
    rephrase accordingly to include relevant files in rephrased question. In this case, you mgiht want
    to add Controller paths and views for login page including files used in namespace in controller in
    your rephrased question.

    conversation history: ${conv_history}
    follow-up question: ${query}
    standalone question:`;

    //console.log(prompt);

    const config = loadConfig();

    let response;
    switch (config.llm_provider) {
        case 'gemini':
            const model = llm.getGenerativeModel({ model: config.model_name });
            response = await model.generateContent(prompt);
            return response.response.text();
        case 'openai':
            response = await llm.invoke(prompt);
            return response;
        case 'ollama':
            response = await llm.invoke(prompt);
            return response;
        default:
            throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
    }
}


async function queryGemini(genAI, prompt, history, config, retries = 3) {
    const model = genAI.getGenerativeModel({
        model: config.model_name,
        generationConfig: {
            maxOutputTokens: 8192,
        },
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE
            }
        ]
    });

    const context = await buildContext(prompt);
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = await constructFullPrompt(genAI, context, conversationContext, prompt);

    let fullResponse = '';

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await model.generateContentStream(fullPrompt);

            if (result.stream) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    fullResponse += chunkText;
                    process.stdout.write('\x1b[33m' + chunkText + '\x1b[0m');
                }
            } else {
                fullResponse = result.text();
                process.stdout.write('\x1b[33m' + fullResponse + '\x1b[0m');
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
    const context = await buildContext(prompt);
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = await constructFullPrompt(openai, context, conversationContext, prompt);

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
                        process.stdout.write('\x1b[33m' + buffer + '\x1b[0m');
                        buffer = '';
                    }
                },
            },
        ],
    });

    await streamingModel.invoke(fullPrompt);

    if (buffer.length > 0) {
        process.stdout.write('\x1b[33m' + buffer + '\x1b[0m');
    }

    console.log(); // for output clearity

    return fullResponse;
}

async function queryOllama(ollama, prompt, history) {
    const context = await buildContext(prompt);
    const conversationContext = formatConversationHistory(history);
    const fullPrompt = await constructFullPrompt(ollama, context, conversationContext, prompt);

    const response = await ollama.invoke(fullPrompt);
    return response;
}


async function buildContext(userQuestion) {
    const vectorStore = await loadVectorStore();

    const documents = await vectorStore.similaritySearch(userQuestion, 5);
    const context = [];

    for (const doc of documents) {
        const text = `File: ${doc.metadata.source}\n${doc.pageContent}\n\n`;
        context.push({ text, file: doc.metadata.source });
    }

    return context;
}

function formatConversationHistory(history) {
    return history.map(item => `${item.role}: ${item.content}`).join('\n');
}

async function constructFullPrompt(llm, context, conversationHistory, prompt) {

    const standAloneQuestion = await getStandAloneQuestion(llm, prompt, conversationHistory);

    // add delay of half second
    await new Promise(resolve => setTimeout(resolve, 500));

    let finalUserQuestion = standAloneQuestion.toLowerCase()
        .includes("no question provided") ? prompt : standAloneQuestion;


    finalUserQuestion = finalUserQuestion.replace("standalone question:", "").trim();

    const contextText = context.map(item => item.text).join('\n');

    const fullPrompt = `
    You are an application architect with full knowledge of project via below given context.
    Use the following context and optionally conversation history if it is not empty to answer
    the question in detail and easy to understand language. Format your response for command-line
    display: use plain text only, avoid special formatting like markdown or HTML, and structure
    information with simple indentation or line breaks if needed.

    You have access to all files and their contents via the Context given below. Ensure that your
    answer is based solely on the provided context, particularly the contents of the files.

    Context (file paths and contents):
    ${contextText}

    Conversation history:
    ${conversationHistory}

    Question: ${finalUserQuestion}
    Answer:`;

    console.log()

    if (
        !finalUserQuestion.toLowerCase().includes("no question provided") &&
        finalUserQuestion.toLowerCase() !== prompt.toLowerCase()
    ) {
        console.log('--------------------------------------------------------------------------');
        console.log('\x1b[33mConverted Smart Question: \x1b[0m', finalUserQuestion);
        console.log('--------------------------------------------------------------------------');
        console.log()
    }

    console.log('--------------------------------------------------------------------------');
    console.log('\x1b[33mMatched Context Files:\x1b[0m');
    console.log('--------------------------------------------------------------------------');
    console.log(context.map(item => '• ' + item.file).join('\n'));
    console.log('--------------------------------------------------------------------------');
    console.log()
    console.log('\x1b[0m'); // reset default color just in case.

    // console.log('________________________________________________________________');
    // console.log(fullPrompt);
    // console.log('________________________________________________________________');

    return fullPrompt;
}


export { initializeLLM, queryLLM };

