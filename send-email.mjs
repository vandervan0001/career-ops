#!/usr/bin/env node
/**
 * send-email.mjs — Send emails via SMTP for consulting-ops
 *
 * Usage:
 *   node send-email.mjs --test                    # Send test email to yourself
 *   node send-email.mjs --to x@y.com --subject "..." --body "..." [--attachment file.pdf]
 *
 * Reads SMTP config from config/smtp.yml
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createTransport } from 'nodemailer';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SMTP_FILE = join(ROOT, 'config', 'smtp.yml');

function loadSmtpConfig() {
  if (!existsSync(SMTP_FILE)) {
    console.error('ERREUR: config/smtp.yml introuvable. Copiez config/smtp.example.yml et remplissez vos identifiants.');
    process.exit(1);
  }
  const raw = readFileSync(SMTP_FILE, 'utf-8');
  const config = yaml.load(raw);
  return config.smtp;
}

function createMailTransport(smtp) {
  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.auth.user,
      pass: smtp.auth.pass,
    },
  });
}

async function sendEmail({ to, subject, body, html, attachments, smtp }) {
  const transporter = createMailTransport(smtp);

  const mailOptions = {
    from: `"${smtp.from.name}" <${smtp.from.address}>`,
    to,
    subject,
    text: body,
  };

  if (html) mailOptions.html = html;
  if (attachments) mailOptions.attachments = attachments;

  const info = await transporter.sendMail(mailOptions);
  return info;
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.includes('--test')) {
  const smtp = loadSmtpConfig();
  console.log(`Envoi d'un email test a ${smtp.auth.user}...`);

  try {
    const info = await sendEmail({
      to: smtp.auth.user,
      subject: 'consulting-ops — Test SMTP OK',
      body: `Ceci est un email de test envoye par consulting-ops.\n\nDate: ${new Date().toISOString()}\nServeur: ${smtp.host}:${smtp.port}\n\nSi vous recevez cet email, la configuration SMTP fonctionne correctement.\n\n— Vanguard Systems`,
      smtp,
    });
    console.log(`Email envoye avec succes.`);
    console.log(`  Message ID: ${info.messageId}`);
    console.log(`  Destinataire: ${smtp.auth.user}`);
  } catch (err) {
    console.error(`ERREUR d'envoi: ${err.message}`);
    if (err.code === 'EAUTH') {
      console.error('-> Verifiez le mot de passe dans config/smtp.yml');
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`-> Impossible de se connecter a ${smtp.host}:${smtp.port}`);
    }
    process.exit(1);
  }
} else {
  // Parse CLI args
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const to = getArg('--to');
  const subject = getArg('--subject');
  const body = getArg('--body');
  const bodyFile = getArg('--body-file');
  const attachment = getArg('--attachment');

  if (!to || !subject) {
    console.log('Usage:');
    console.log('  node send-email.mjs --test');
    console.log('  node send-email.mjs --to dest@email.com --subject "Objet" --body "Corps du message"');
    console.log('  node send-email.mjs --to dest@email.com --subject "Objet" --body-file message.txt --attachment cv.pdf');
    process.exit(0);
  }

  const smtp = loadSmtpConfig();
  const emailBody = bodyFile && existsSync(bodyFile) ? readFileSync(bodyFile, 'utf-8') : (body || '');
  const attachments = attachment && existsSync(attachment) ? [{ path: attachment }] : undefined;

  try {
    const info = await sendEmail({ to, subject, body: emailBody, attachments, smtp });
    console.log(`Email envoye a ${to} (${info.messageId})`);
  } catch (err) {
    console.error(`ERREUR: ${err.message}`);
    process.exit(1);
  }
}
