import { triggerWebhookProxy } from '../services/firebaseFunctions';

export const logAuthErrorToDiscord = async (error, context) => {
  try {
    const embed = {
      title: 'Authentication Error',
      description: `An error occurred during: **${context}**`,
      color: 15158332, // Red
      fields: [
        {
          name: 'Error Message',
          value: `

${error.message || 'No message'}

`,
        },
        {
          name: 'Stack Trace',
          value: `

${error.stack || 'No stack trace'}

`,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'PHMC Forms - Auth Error Logger',
      },
    };

    const payload = {
      username: 'Auth Error Bot',
      embeds: [embed],
    };

    await triggerWebhookProxy('auth', payload);
  } catch (loggingError) {
    console.error('Failed to log auth error to Discord:', loggingError);
  }
};