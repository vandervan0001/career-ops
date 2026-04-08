#!/usr/bin/env node
/**
 * send-linkedin.mjs — Reference documentation for LinkedIn outreach via Chrome MCP
 *
 * NOTE: This script does NOT execute LinkedIn actions directly.
 * LinkedIn outreach is performed via Chrome MCP tools (navigate, find, click, type)
 * within the auto-pipeline mode. This file documents the workflow as reference.
 *
 * The actual execution happens in modes/auto-pipeline.md (Etape 6) using:
 *   - mcp__Claude_in_Chrome__navigate
 *   - mcp__Claude_in_Chrome__find
 *   - mcp__Claude_in_Chrome__computer (click, type)
 *   - mcp__Claude_in_Chrome__read_page
 *
 * Usage (documentation only):
 *   node send-linkedin.mjs --help
 *   node send-linkedin.mjs --dry-run --profile "https://linkedin.com/in/target" --message-file output/message-linkedin-client-2026-04-08.txt
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Workflow Documentation
// ---------------------------------------------------------------------------

const WORKFLOW = {
  name: 'LinkedIn Connection Request with Note',
  description: 'Send a personalized connection request to a target decision-maker on LinkedIn.',
  prerequisites: [
    'Chrome browser connected via Chrome MCP extension',
    'User logged into LinkedIn in Chrome',
    'Target LinkedIn profile URL identified',
    'Message file generated (max 300 characters)',
  ],
  steps: [
    {
      step: 1,
      action: 'navigate',
      description: 'Navigate to the target LinkedIn profile',
      tool: 'mcp__Claude_in_Chrome__navigate',
      params: { url: '{target_linkedin_url}' },
      fallback: 'If profile not found, search LinkedIn for "{name} {company}" and select the best match.',
    },
    {
      step: 2,
      action: 'find_connect_button',
      description: 'Locate the "Connect" / "Se connecter" button on the profile',
      tool: 'mcp__Claude_in_Chrome__find',
      params: { query: 'Connect button or Se connecter button' },
      fallback: 'If "Connect" not visible, check if already connected or if "Follow" / "More" menu contains it.',
      edge_cases: [
        'Button may be hidden under "More..." dropdown',
        'Profile may show "Follow" instead of "Connect" (requires "More" menu)',
        'Already connected -> skip, note in tracker',
        'Pending invitation -> skip, note in tracker',
      ],
    },
    {
      step: 3,
      action: 'click_connect',
      description: 'Click the Connect button',
      tool: 'mcp__Claude_in_Chrome__computer',
      params: { action: 'left_click', coordinate: '{connect_button_coords}' },
    },
    {
      step: 4,
      action: 'add_note',
      description: 'Click "Add a note" / "Ajouter une note" in the connection dialog',
      tool: 'mcp__Claude_in_Chrome__find',
      params: { query: 'Add a note button or Ajouter une note' },
      note: 'LinkedIn sometimes skips this dialog for premium users.',
    },
    {
      step: 5,
      action: 'type_message',
      description: 'Type the personalized message (300 chars max)',
      tool: 'mcp__Claude_in_Chrome__computer',
      params: { action: 'type', text: '{message_content}' },
      constraints: [
        'Maximum 300 characters (LinkedIn hard limit)',
        'No URLs allowed in connection request notes',
        'No phone numbers (privacy rule)',
        'French for Suisse romande targets, English for international',
      ],
    },
    {
      step: 6,
      action: 'screenshot_before_send',
      description: 'Take a screenshot for traceability before sending',
      tool: 'mcp__Claude_in_Chrome__computer',
      params: { action: 'screenshot' },
      note: 'Archive in case of disputes or for consultant review.',
    },
    {
      step: 7,
      action: 'send',
      description: 'Click "Send" / "Envoyer" to dispatch the connection request',
      tool: 'mcp__Claude_in_Chrome__computer',
      params: { action: 'left_click', coordinate: '{send_button_coords}' },
    },
  ],
  error_handling: [
    {
      condition: 'CAPTCHA or human verification',
      action: 'STOP immediately. Notify the consultant. Do NOT attempt to solve.',
    },
    {
      condition: 'Rate limit ("You\'ve reached the weekly invitation limit")',
      action: 'STOP. Note in tracker. Suggest trying again next week.',
    },
    {
      condition: 'Profile not found',
      action: 'Note "Profil LinkedIn non identifie" in tracker. Continue pipeline.',
    },
    {
      condition: 'Already connected',
      action: 'Skip connection request. Consider sending a direct message instead (requires explicit user approval).',
    },
    {
      condition: 'Login required / Session expired',
      action: 'STOP. Ask consultant to re-login to LinkedIn in Chrome.',
    },
  ],
  message_framework: {
    description: 'Framework 3 phrases (from modes/contact.md)',
    structure: [
      'Phrase 1: Accroche specifique sur LEUR entreprise/defi',
      'Phrase 2: Preuve quantifiee la plus pertinente du consultant',
      'Phrase 3: Proposition d\'echange de 15 min sur un sujet precis',
    ],
    example_fr: 'J\'ai vu que {company} lance {projet}. J\'ai pilote {realisation similaire} avec {resultat}. 15 min pour echanger sur {sujet} ?',
    example_en: 'Noticed {company} is working on {project}. Led a similar {achievement} with {result}. Quick 15-min chat on {topic}?',
    max_chars: 300,
  },
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log('send-linkedin.mjs -- Reference documentation for LinkedIn outreach via Chrome MCP\n');
  console.log('This script does NOT send LinkedIn messages directly.');
  console.log('LinkedIn outreach is performed via Chrome MCP tools in the auto-pipeline mode.\n');
  console.log('Options:');
  console.log('  --help                   Show this help');
  console.log('  --dry-run                Validate message file and show what would be sent');
  console.log('  --profile <url>          Target LinkedIn profile URL');
  console.log('  --message-file <path>    Path to message file (max 300 chars)');
  console.log('  --workflow               Print the full workflow as JSON');
  process.exit(0);
}

if (args.includes('--workflow')) {
  console.log(JSON.stringify(WORKFLOW, null, 2));
  process.exit(0);
}

if (args.includes('--dry-run')) {
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const profile = getArg('--profile');
  const messageFile = getArg('--message-file');

  console.log('=== LinkedIn Outreach Dry Run ===\n');

  if (profile) {
    console.log(`Target profile: ${profile}`);
  } else {
    console.log('WARNING: No --profile specified');
  }

  if (messageFile) {
    if (existsSync(messageFile)) {
      const content = readFileSync(messageFile, 'utf-8').trim();
      const charCount = content.length;
      console.log(`Message file: ${messageFile}`);
      console.log(`Character count: ${charCount}/300`);
      if (charCount > 300) {
        console.log(`ERROR: Message exceeds 300 character limit by ${charCount - 300} chars`);
        console.log('Truncated preview:');
        console.log(`  "${content.slice(0, 300)}..."`);
      } else {
        console.log(`Message OK:`);
        console.log(`  "${content}"`);
      }
    } else {
      console.log(`ERROR: Message file not found: ${messageFile}`);
    }
  } else {
    console.log('WARNING: No --message-file specified');
  }

  console.log('\n=== This is a dry run. No LinkedIn actions were performed. ===');
  console.log('Actual sending is done via Chrome MCP tools in the auto-pipeline mode.');
  process.exit(0);
}

console.log('Use --help for usage information or --workflow for the full workflow documentation.');
