import makeWASocket, { DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import pino from 'pino';
import fs from 'fs';

export const whatsappState = {
  status: 'DISCONNECTED' as 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED',
  qr: null as string | null,
};

let sock: any = null;

export const initWhatsApp = async () => {
  whatsappState.status = 'CONNECTING';
  whatsappState.qr = null;

  try {
    const authDir = path.join(__dirname, '../../auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      browser: Browsers.macOS('Desktop'),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        whatsappState.qr = qr;
        whatsappState.status = 'CONNECTING';
        console.log('WhatsApp QR Code generated. Awaiting scan...');
      }

      if (connection === 'close') {
        whatsappState.status = 'DISCONNECTED';
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 5000);
        } else {
          console.log('WhatsApp logged out. Please clear auth folder and restart to pair again.');
        }
      } else if (connection === 'open') {
        whatsappState.status = 'CONNECTED';
        whatsappState.qr = null;
        console.log('WhatsApp connected successfully!');
      }
    });

  } catch (error) {
    console.error('Failed to initialize Baileys:', error);
    whatsappState.status = 'DISCONNECTED';
  }
};

export const logoutWhatsApp = async () => {
  if (sock) {
    await sock.logout();
    sock = null;
    whatsappState.status = 'DISCONNECTED';
    whatsappState.qr = null;
    const authDir = path.join(__dirname, '../../auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    console.log('WhatsApp logged out. Auth info deleted.');
  }
};

export const sendWhatsAppMessage = async (phone: string, message: string) => {
  console.log(`[WhatsApp] Attempting to send to raw phone: ${phone}`);
  
  if (whatsappState.status !== 'CONNECTED' || !sock) {
    console.log('[WhatsApp] Error: Socket is not connected to a session.');
    return { success: false, error: 'WhatsApp is not connected' };
  }

  try {
    // Format phone number: remove any non-digit chars
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Ensure it starts with 91 if it's a 10 digit number
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;
    console.log(`[WhatsApp] Sending message to JID: ${jid}`);
    const response = await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Message successfully sent to ${jid}, Msg ID: ${response?.key?.id}`);
    
    return { 
      success: true, 
      messageId: response?.key?.id 
    };
  } catch (error: any) {
    console.error('Baileys WhatsApp Error:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
};
