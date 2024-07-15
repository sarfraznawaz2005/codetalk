# CodeTalk

CodeTalk is a node command-line tool for interacting with your codebase using natural language queries. It uses vector embeddings and language models to provide intelligent responses about your code.

## Features

- Scan your codebase and create a vector store using Faiss on local disk
- Ask questions about your code and get AI-powered responses
- Support for multiple LLM providers (OpenAI, Google Gemini, Ollama)
- Configurable file extensions and ignore patterns

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies

## Configuration

Create a `codetalk.json` file in the project root with the following structure:

````json
{
  "llm_provider": "openai",
  "api_key": "your-api-key",
  "model_name": "gpt-3.5-turbo",
  "embedding_model_name": "text-embedding-ada-002",
  "file_extensions": {
    ".js": true,
    ".jsx": true,
    ".ts": true,
    ".tsx": true,
    ".php": true,
    ".py": true,
    ".html": true,
    ".css": true
  },
  "ignore_patterns": [
    "node_modules",
    "dist",
    "build"
  ],
  "max_token_limit": 100000
}
````

Adjust the configuration according to your preferences and API keys.

## Usage

CodeTalk provides the following commands:

### Scan Codebase

Scan your codebase and create a vector store:

`node index.js scan`

### Ask Questions

Interact with your codebase by asking questions:

`node index.js ask`

### Clear Vector Store

Clear the existing vector store:

`node index.js clear`

## Supported LLM Providers

- OpenAI
- Google Gemini
- Ollama

## Dependencies

- yargs: Command-line argument parsing
- @langchain/openai: OpenAI integration
- @langchain/google-genai: Google Generative AI integration
- @langchain/community: Community LLM providers (e.g., Ollama)
- faiss-node: Vector storage and similarity search
- gpt-3-encoder: Token counting for GPT models
- ignore: .gitignore-style pattern matching

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
