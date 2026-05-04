import { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export type ProgressNotificationParams = {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
};

export type ProgressExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const WAITING_WORDS = [
  'Accomplishing',
  'Actioning',
  'Actualizing',
  'Architecting',
  'Baking',
  'Beaming',
  "Beboppin'",
  'Befuddling',
  'Billowing',
  'Blanching',
  'Bloviating',
  'Boogieing',
  'Boondoggling',
  'Booping',
  'Bootstrapping',
  'Brewing',
  'Bunning',
  'Burrowing',
  'Calculating',
  'Canoodling',
  'Caramelizing',
  'Cascading',
  'Catapulting',
  'Cerebrating',
  'Channeling',
  'Channelling',
  'Choreographing',
  'Churning',
  'Clauding',
  'Coalescing',
  'Cogitating',
  'Combobulating',
  'Composing',
  'Computing',
  'Concocting',
  'Considering',
  'Contemplating',
  'Cooking',
  'Crafting',
  'Creating',
  'Crunching',
  'Crystallizing',
  'Cultivating',
  'Deciphering',
  'Deliberating',
  'Determining',
  'Dilly-dallying',
  'Discombobulating',
  'Doing',
  'Doodling',
  'Drizzling',
  'Ebbing',
  'Effecting',
  'Elucidating',
  'Embellishing',
  'Enchanting',
  'Envisioning',
  'Evaporating',
  'Fermenting',
  'Fiddle-faddling',
  'Finagling',
  'Flambéing',
  'Flibbertigibbeting',
  'Flowing',
  'Flummoxing',
  'Fluttering',
  'Forging',
  'Forming',
  'Frolicking',
  'Frosting',
  'Gallivanting',
  'Galloping',
  'Garnishing',
  'Generating',
  'Gesticulating',
  'Germinating',
  'Gitifying',
  'Grooving',
  'Gusting',
  'Harmonizing',
  'Hashing',
  'Hatching',
  'Herding',
  'Honking',
  'Hullaballooing',
  'Hyperspacing',
  'Ideating',
  'Imagining',
  'Improvising',
  'Incubating',
  'Inferring',
  'Infusing',
  'Ionizing',
  'Jitterbugging',
  'Julienning',
  'Kneading',
  'Leavening',
  'Levitating',
  'Lollygagging',
  'Manifesting',
  'Marinating',
  'Meandering',
  'Metamorphosing',
  'Misting',
  'Moonwalking',
  'Moseying',
  'Mulling',
  'Mustering',
  'Musing',
  'Nebulizing',
  'Nesting',
  'Newspapering',
  'Noodling',
  'Nucleating',
  'Orbiting',
  'Orchestrating',
  'Osmosing',
  'Perambulating',
  'Percolating',
  'Perusing',
  'Philosophising',
  'Photosynthesizing',
  'Pollinating',
  'Pondering',
  'Pontificating',
  'Pouncing',
  'Precipitating',
  'Prestidigitating',
  'Processing',
  'Proofing',
  'Propagating',
  'Puttering',
  'Puzzling',
  'Quantumizing',
  'Razzle-dazzling',
  'Razzmatazzing',
  'Recombobulating',
  'Reticulating',
  'Roosting',
  'Ruminating',
  'Sautéing',
  'Scampering',
  'Schlepping',
  'Scurrying',
  'Seasoning',
  'Shenaniganing',
  'Shimmying',
  'Simmering',
  'Skedaddling',
  'Sketching',
  'Slithering',
  'Smooshing',
  'Sock-hopping',
  'Spelunking',
  'Spinning',
  'Sprouting',
  'Stewing',
  'Sublimating',
  'Swirling',
  'Swooping',
  'Symbioting',
  'Synthesizing',
  'Tempering',
  'Thinking',
  'Thundering',
  'Tinkering',
  'Tomfoolering',
  'Topsy-turvying',
  'Transfiguring',
  'Transmuting',
  'Twisting',
  'Undulating',
  'Unfurling',
  'Unravelling',
  'Vibing',
  'Waddling',
  'Wandering',
  'Warping',
  'Whatchamacalliting',
  'Whirlpooling',
  'Whirring',
  'Whisking',
  'Wibbling',
  'Working',
  'Wrangling',
  'Zesting',
  'Zigzagging',
];

const getRandomWaitingWord = (): string => {
  const index = Math.floor(Math.random() * WAITING_WORDS.length);
  return `${WAITING_WORDS[index]}...`;
};

export class ProgressNotifier {
  private extra?: ProgressExtra;

  private startTime: number;

  private progressToken?: string | number;

  private waitingIntervalId?: NodeJS.Timeout;

  constructor(extra?: ProgressExtra) {
    this.extra = extra;
    this.startTime = Date.now();
    this.progressToken = extra?._meta?.progressToken as string | number | undefined;
  }

  private canSendProgress(): boolean {
    return this.progressToken !== undefined && this.extra?.sendNotification !== undefined;
  }

  async notify(message: string, progress?: number, total?: number): Promise<void> {
    if (!this.canSendProgress()) {
      return;
    }

    try {
      await this.extra!.sendNotification({
        method: 'notifications/progress',
        params: {
          progressToken: this.progressToken!,
          progress: progress ?? 0,
          total: total ?? 1,
          message,
        },
      } as ServerNotification);
    } catch {
      // Silently ignore if client doesn't support progress notifications
    }
  }

  async notifyAfterDelay(message: string, delayMs: number = 3000): Promise<NodeJS.Timeout | null> {
    if (!this.canSendProgress()) {
      return null;
    }

    return setTimeout(async () => {
      await this.notify(message);
    }, delayMs);
  }

  startWaitingNotifications(initialDelayMs: number = 3000, intervalMs: number = 5000): void {
    if (!this.canSendProgress()) {
      return;
    }

    setTimeout(() => {
      this.notify(getRandomWaitingWord());

      this.waitingIntervalId = setInterval(() => {
        this.notify(getRandomWaitingWord());
      }, intervalMs);
    }, initialDelayMs);
  }

  stopWaitingNotifications(): void {
    if (this.waitingIntervalId) {
      clearInterval(this.waitingIntervalId);
      this.waitingIntervalId = undefined;
    }
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}

// eslint-disable-next-line no-restricted-syntax
export async function withProgress<T>(
  extra: ProgressExtra,
  stages: {
    onStart?: string;
    onWaiting?: string;
    onProcessing?: string;
    waitingDelayMs?: number;
  },
  operation: (notifier: ProgressNotifier) => Promise<T>
): Promise<T> {
  const notifier = new ProgressNotifier(extra);
  let waitingTimeout: NodeJS.Timeout | null = null;

  try {
    if (stages.onStart) {
      await notifier.notify(stages.onStart, 0, 1);
    }

    if (stages.onWaiting) {
      waitingTimeout = await notifier.notifyAfterDelay(
        stages.onWaiting,
        stages.waitingDelayMs ?? 3000
      );
    }

    const result = await operation(notifier);

    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
    }

    if (stages.onProcessing) {
      await notifier.notify(stages.onProcessing, 0.9, 1);
    }

    return result;
  } finally {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
    }
  }
}
