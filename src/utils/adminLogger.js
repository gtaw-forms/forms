// src/utils/adminLogger.js
export const logAdminActionToDiscord = async (action, formDetails, userDetails = {}) => {
  const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK; // New environment variable for admin actions
  if (!webhookUrl) {
    console.warn('VITE_ADMIN_WEBHOOK_URL is not configured. Admin actions will not be logged to Discord.');
    return;
  }

  try {
    const embed = {
      title: `Form ${action === 'add' ? 'Created' : 'Modified'}`,
      description: `Form **${formDetails.name}** (ID: ${formDetails.id}) has been ${action === 'add' ? 'created' : 'modified'}`,
      color: action === 'add' ? 5763719 : 16705372, // Green for add, Orange for modify
      fields: [
        {
          name: 'Form ID',
          value: formDetails.id,
          inline: true,
        },
        {
          name: 'Form Name',
          value: formDetails.name,
          inline: true,
        },
        {
          name: 'Category',
          value: formDetails.category || 'N/A',
          inline: true,
        },
        {
          name: 'Access Type',
          value: formDetails.accessType || 'N/A',
          inline: true,
        },
        {
          name: 'Hidden',
          value: formDetails.isHidden ? 'Yes' : 'No',
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'PHMC Forms - Admin Activity Logger',
      },
    };

    if (userDetails.username) {
      embed.fields.unshift({
        name: 'Action By',
        value: `${userDetails.username} (ID: ${userDetails.id || 'N/A'})`,
        inline: false,
      });
    }

    const payload = {
      username: 'Admin Activity Bot',
      embeds: [embed],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (loggingError) {
    console.error('Failed to log admin action to Discord:', loggingError);
  }
};
