const getUtcFormattedDateTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
};

const getUtcFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
};

export { getUtcFormattedDateTime, getUtcFormattedTime };
