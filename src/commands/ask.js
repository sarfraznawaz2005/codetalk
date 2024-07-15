import readline from 'readline';
import { addToConversationHistory, getConversationHistory } from '../utils/conversationHistory.js';
import { initializeLLM, queryLLM } from '../utils/langchain.js';
import { createVectorStore, vectorStoreExists } from '../utils/vectorStore.js';

async function ask() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const genAI = initializeLLM();

    if (!(await vectorStoreExists())) {
        console.log("Vector store doesn't exist. Creating one now...");
        await createVectorStore();
    }

    console.log("Ask your question (type 'exit' to quit):");

    while (true) {
        const question = await new Promise(resolve => rl.question('> ', resolve));

        if (question.toLowerCase() === 'exit') {
            break;
        }

        try {
            const response = await queryLLM(genAI, question, getConversationHistory());

            addToConversationHistory('Human', question);
            addToConversationHistory('AI', response);

        } catch (error) {
            console.error('Error querying AI:', error.message);
            console.error('stack', error.stack);
        }
    }

    rl.close();
}

export { ask };

