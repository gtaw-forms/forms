import { Logging } from '@google-cloud/logging';

const logging = new Logging();

export async function getFunctionStats(hoursAgo = 24) {
  const now = new Date();
  const since = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

  const filter = [
    'resource.type = "cloud_function"',
    `timestamp >= "${since.toISOString()}"`,
  ].join('\n');

  const counts = {};

  try {
    let pageToken;
    let totalEntries = 0;
    const pageSize = 10000;

    do {
      const options = { filter, pageSize, autoPaginate: false };
      if (pageToken) options.pageToken = pageToken;

      const [entries, nextQuery] = await logging.getEntries(options);

      if (!entries || entries.length === 0) break;

      for (const entry of entries) {
        totalEntries++;
        const fn = entry.resource?.labels?.function_name;
        if (fn) {
          counts[fn] = (counts[fn] || 0) + 1;
        }
      }

      pageToken = nextQuery?.pageToken;

      if (totalEntries >= 100000) {
        console.warn('[FunctionStats] Hit entry limit (100k), stopping pagination.');
        break;
      }
    } while (pageToken);

    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    return {
      totalEntries,
      totalFunctions: Object.keys(counts).length,
      functions: sorted,
    };
  } catch (error) {
    console.error('[FunctionStats] Error querying Cloud Logging:', error.message);
    return {
      totalEntries: 0,
      totalFunctions: 0,
      functions: [],
      error: error.message,
    };
  }
}
