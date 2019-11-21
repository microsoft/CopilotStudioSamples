const { ActivityHandler} = require('botbuilder');

module.exports = () => {
  const bot = new ActivityHandler();

  // Handler for "event" activity.
  bot.onEvent(async (context, next) => {
    const {
      activity: { name, value }
    } = context;

    await next();
  });

  // Handler for "message" activity
  bot.onMessage(async (context, next) => {
    await next();
  });

  return bot;
};
