/**
 * @file src/core/db.ts
 * @description Manages the lowdb JSON database for persistent chat history.
 */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import * as os from 'os';
import { ChatMessage } from '../types.js';

// Define the structure of our database
interface DbData {
  sessions: {
    [sessionId: string]: ChatMessage[];
  };
}

// Path to the JSON file that will store the data
const dbPath = path.join(os.homedir(), '.claude-code', 'chat-history.json');

// Create a new instance of the JSONFile adapter
const adapter = new JSONFile<DbData>(dbPath);
const db = new Low<DbData>(adapter, { sessions: {} }); // Default data

/**
 * Ensures the database is loaded from the file.
 */
async function ensureDbLoaded() {
  if (db.data === null) {
    await db.read();
    // Set default data if the file is empty
    db.data ||= { sessions: {} };
  }
}

/**
 * Retrieves the chat history for a given session ID.
 * @param sessionId The unique identifier for the user's session.
 * @returns An array of chat messages.
 */
export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  await ensureDbLoaded();
  return db.data?.sessions[sessionId] || [];
}

/**
 * Saves the chat history for a given session ID.
 * @param sessionId The unique identifier for the user's session.
 * @param history The array of chat messages to save.
 */
export async function saveHistory(sessionId: string, history: ChatMessage[]) {
  await ensureDbLoaded();
  if (db.data) {
    db.data.sessions[sessionId] = history;
    await db.write();
  }
}