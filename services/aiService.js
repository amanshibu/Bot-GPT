/**
 * services/aiService.js
 *
 * Unified AI gateway — supports Claude (Anthropic), OpenAI, and Groq.
 * Select provider via AI_PROVIDER env var ('claude' | 'openai' | 'groq').
 *
 * All providers return a normalised AiResult:
 * {
 *   isEnquiry:     boolean,
 *   reply:         string,       ← message to send to user
 *   missingFields: string[],
 *   data:          LeadData,
 * }
 */

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const logger = require('../utils/logger');
const { isValidAIResponse } = require('../utils/validators');
const { SERVICES_OFFERED, FIELD_LABELS } = require('../config/constants');

// ── Initialise clients lazily ────────────────────────────────
let anthropicClient = null;
let openaiClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic.default({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }
  return anthropicClient;
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI.default({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// ── Groq client (OpenAI-compatible, just different base URL) ──
let groqClient = null;

function getGroqClient() {
  if (!groqClient) {
    groqClient = new OpenAI.default({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
}

// ── System prompt ────────────────────────────────────────────
function buildSystemPrompt(currentData = {}) {
  const services = SERVICES_OFFERED.join(', ');
  const fieldList = Object.entries(FIELD_LABELS)
    .map(([k, v]) => `"${k}": "${v}"`)
    .join(', ');

  const currentDataStr = JSON.stringify(currentData, null, 2);

  return `You are a helpful, friendly customer support assistant for an electronics repair service in India.

==== CURRENT KNOWN DATA ====
The following information has ALREADY been collected:
${currentDataStr}
============================

Your primary job is to generate a JSON response that UPDATES this data based on the latest conversation.
- IMPORTANT: ALWAYS retain the existing known data! DO NOT output empty strings for fields that were already collected (like 'complaint' or 'details'), unless the user explicitly told you to delete them.
- NEVER replace a detailed complaint with a vague one like "not working"!!! If the user previously gave a specific complaint, KEEP IT EXACTLY.

Services offered: ${services}

Your job:
1. Detect whether the customer is making a real repair ENQUIRY or just chatting.
2. If it is an ENQUIRY, guide the customer to provide all required details.
3. Extract whatever data is available from the conversation.
4. Act as a warm, friendly human customer support agent. Be polite and conversational. Use emojis naturally. Do not sound like a robotic checklist.

REQUIRED LEAD FIELDS: ${fieldList}

IMPORTANT RULES:
- DO NOT ask for the user's phone number! We already have it from their WhatsApp account. Keep "phone" empty.
- If the customer does not have a company, store it as "N/A" or "Individual".
- "details" is OPTIONAL. If the customer has no extra details, gently accept that and store "None".
- The "model" is MANDATORY. Ask the user for their device's brand/model name. If they absolutely do not know it, accept "Unknown".
- NEVER make up or guess data.
- Only set isEnquiry=true when the customer is clearly asking for a repair service.
- **CRITICAL: Ask for missing information EXACTLY like a real human would. NEVER list out all the things you need at once. Ask for exactly ONE missing detail at a time naturally in your "reply", and wait for the user to answer before asking for the next one.**
- **CRITICAL: If the customer corrects or changes previous information (e.g., "Actually my address is XYZ" or "Change the device to a laptop"), MUST update that specific field in your JSON "data" output to the new value.**
- Do not jump to confirmation until you have collected ALL of the following mandatory fields: name, company, address, device, model, and complaint.
- DO NOT include confirmation text unless you are truly ready to confirm.

YOU MUST ALWAYS RESPOND WITH RAW JSON ONLY (no markdown, no prose, no triple backticks):
{
  "isEnquiry": true | false,
  "reply": "the message to send to the customer",
  "missingFields": ["name", "device", ...],   
  "data": {
    "name": "",
    "company": "",
    "address": "",
    "phone": "",
    "device": "",
    "model": "",
    "complaint": "",
    "details": ""
  }
}`;
}

// ── Parse AI text output to JSON safely ──────────────────────
function parseAIResponse(rawText, phone) {
  // Strip markdown code fences if the model included them despite instructions
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (isValidAIResponse(parsed)) return parsed;
    logger.warn(`[AI] Response failed schema validation for ${phone}`);
  } catch (e) {
    logger.warn(`[AI] JSON parse error for ${phone}: ${e.message}`);
  }

  // Fallback: safe default reply
  return {
    isEnquiry: false,
    reply:
      "Sorry, I didn't quite catch that. Could you please rephrase? 😊",
    missingFields: [],
    data: {
      name: '', company: '', address: '', phone: '',
      device: '', model: '', complaint: '', details: '',
    },
  };
}

// ── Build messages array for API calls ──────────────────────
function buildMessages(history, newUserMessage) {
  const messages = history.map((h) => ({
    role: h.role,
    content: h.content,
  }));
  messages.push({ role: 'user', content: newUserMessage });
  return messages;
}

// ── Claude implementation ────────────────────────────────────
async function callClaude(messages, currentData) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: buildSystemPrompt(currentData),
    messages,
  });
  return response.content[0].text;
}

// ── OpenAI implementation ────────────────────────────────────
async function callOpenAI(messages, currentData) {
  const client = getOpenAIClient();
  const systemMessage = { role: 'system', content: buildSystemPrompt(currentData) };
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [systemMessage, ...messages],
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  });
  return response.choices[0].message.content;
}

// ── Groq implementation ──────────────────────────────────────
async function callGroq(messages, currentData) {
  const client = getGroqClient();
  const systemMessage = { role: 'system', content: buildSystemPrompt(currentData) };
  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [systemMessage, ...messages],
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  });
  return response.choices[0].message.content;
}

// ── Public API ───────────────────────────────────────────────
/**
 * Process a user message through the configured AI provider.
 *
 * @param {string} userMessage — raw text from WhatsApp
 * @param {Array}  history     — prior conversation turns [{role, content}]
 * @param {string} phone       — sender ID for logging
 * @param {object} currentData — current state data to maintain context
 * @returns {Promise<AiResult>}
 */
async function processMessage(userMessage, history, phone, currentData = {}) {
  const messages = buildMessages(history, userMessage);
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();

  logger.debug(`[AI] Calling ${provider} for ${phone}`);

  let rawText;
  if (provider === 'openai') {
    rawText = await callOpenAI(messages, currentData);
  } else if (provider === 'groq') {
    rawText = await callGroq(messages, currentData);
  } else {
    rawText = await callClaude(messages, currentData);
  }

  logger.debug(`[AI] Raw response for ${phone}: ${rawText.slice(0, 200)}...`);
  return parseAIResponse(rawText, phone);
}

module.exports = { processMessage };
