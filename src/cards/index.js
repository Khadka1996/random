// The catalog. To add a card: create src/cards/<id>.js (see templates/new-card.js) and list it here.
import retryStorm from './retry-storm.js';
import cacheStampede from './cache-stampede.js';
import lostUpdate from './lost-update.js';
import doubleCharge from './double-charge.js';
import clockSkew from './clock-skew.js';
import unboundedQueue from './unbounded-queue.js';
import poisonMessage from './poison-message.js';
import nPlusOne from './n-plus-one.js';

export const cards = [retryStorm, cacheStampede, lostUpdate, doubleCharge, clockSkew, unboundedQueue, poisonMessage, nPlusOne];
export const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
