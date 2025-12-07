export const logAuthErrorToDiscord = async (error, context) => {
  const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
  if (!webhookUrl) {
    return; // Don't do anything if webhook is not configured
  }

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

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (loggingError) {
    console.error('Failed to log auth error to Discord:', loggingError);
  }
};