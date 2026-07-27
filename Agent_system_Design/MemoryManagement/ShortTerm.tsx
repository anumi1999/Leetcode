interface Message {
    role: 'user' | 'system' | 'assistant' | 'tool';
    content: string;
}

const history: Message[] = [];

// In-Context Memory Management

// Sliding Window Memory Management
function slidingWindow(maxMessages: number, messages: Message[]): Message[] {
    if (messages.length <= maxMessages) {
        return messages;
    }
    return [
        messages[0],
        ...messages.slice(-(maxMessages - 1))
    ]
}

// Summerizing Memory Management
async function summarizeMessages(messages: Message[], keepRecent: number = 10): Promise<Message[]> {
    if( messages.length <= keepRecent ) {
        return Promise.resolve(messages);
    }

    const oldMessages = messages.slice(1, -keepRecent);
    const recentMessages = messages.slice(-keepRecent);

    try{
        const summaryMessage = await callLLM([{
            role: 'user',
            content: `Please summarize the following messages into a concise summary:\n\n${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
        }])
        return [
            messages[0],
            {
                role: 'assistant',
                content: `Summary of previous messages: ${summaryMessage.content}`
            },
            ...recentMessages
        ]
    } catch (error) {
        console.error('Error summarizing messages:', error);
        return [
            messages[0],
            {
                role: 'assistant',
                content: 'Error summarizing previous messages.'
            },
            ...recentMessages
        ]
    }
}

// Token-Based Memory Management

function countTokens(messages: Message[]): number {
  // Rough estimate: 1 token ≈ 4 characters
  const text = messages.map(m => m.content).join(' ')
  return Math.ceil(text.length / 4)
}

async function manageContext(
  messages: Message[],
  maxTokens: number = 100000
): Promise<Message[]> {
  while (countTokens(messages) > maxTokens) {
    // Remove oldest non-system message
    messages = [
      messages[0],
      ...messages.slice(2)
    ]
  }
  return messages
}

