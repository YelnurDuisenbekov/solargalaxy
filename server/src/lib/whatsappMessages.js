import {
  buildClientMessage,
  buildQualifiedFollowUpMessage,
  phoneToWaDigits,
  sendLeadWhatsAppMessage,
  sendWhatsAppText,
} from './whatsappApi.js';

export {
  buildClientMessage,
  buildQualifiedFollowUpMessage,
  phoneToWaDigits,
  sendLeadWhatsAppMessage,
  sendWhatsAppText,
};

/** @deprecated use sendWhatsAppText */
export async function sendWhatsAppCloudMessage(phone, text) {
  return sendWhatsAppText(phone, text);
}
