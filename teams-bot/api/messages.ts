import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityHandler,
} from 'botbuilder';

// ---------------------------------------------------------------------------
// Bot logic
// ---------------------------------------------------------------------------
class CaptureBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (ctx: TurnContext) => {
      const content = ctx.activity.text?.trim();

      if (!content) {
        await ctx.sendActivity('Send me a thought and I\'ll save it to Open Brain.');
        return;
      }

      const captureUrl = process.env.CAPTURE_URL;
      if (!captureUrl) {
        await ctx.sendActivity('Configuration error: CAPTURE_URL not set.');
        return;
      }

      try {
        const res = await fetch(captureUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, source: 'teams' }),
        });

        if (!res.ok) {
          const text = await res.text();
          await ctx.sendActivity(`Capture failed (${res.status}): ${text}`);
          return;
        }

        const data = (await res.json()) as {
          metadata?: { topics?: string[]; summary?: string };
        };
        const meta = data.metadata ?? {};
        const topics = (meta.topics ?? []).join(', ');
        const summary = meta.summary ?? '';

        let reply = '✅ Captured!';
        if (topics) reply += `\n**Topics:** ${topics}`;
        if (summary) reply += `\n*${summary}*`;

        await ctx.sendActivity(reply);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await ctx.sendActivity(`Error: ${message}`);
      }
    });

    this.onMembersAdded(async (ctx: TurnContext) => {
      for (const member of ctx.activity.membersAdded ?? []) {
        if (member.id !== ctx.activity.recipient.id) {
          await ctx.sendActivity(
            'Hi! I\'m Open Brain. Send me any thought and I\'ll embed and store it for you.'
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------
const auth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: process.env.MICROSOFT_APP_ID ?? '',
  MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD ?? '',
});

const adapter = new CloudAdapter(auth);
const bot = new CaptureBot();

adapter.onTurnError = async (ctx, err) => {
  console.error('Bot turn error:', err);
  await ctx.sendActivity('Something went wrong. Please try again.');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  await adapter.process(req as never, res as never, (ctx) => bot.run(ctx));
}
