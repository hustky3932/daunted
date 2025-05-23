import { type IAgentRuntime, type UUID, logger } from '@elizaos/core';

import Chat from './tasks/chat';
import Twitter from './tasks/twitter';
import TwitterParser from './tasks/twitterParser';

// let's not make it a dependency
//import type { ITradeService } from '../../degenTrader/types';

/**
 * Registers tasks for the agent to perform various Intel-related actions.
 * * @param { IAgentRuntime } runtime - The agent runtime object.
 * @param { UUID } [worldId] - The optional world ID to associate with the tasks.
 * @returns {Promise<void>} - A promise that resolves once tasks are registered.
 */
export const registerTasks = async (runtime: IAgentRuntime, worldId?: UUID) => {
  worldId = runtime.agentId; // this is global data for the agent

  // first, get all tasks with tags "queue", "repeat", "autofun" and delete them
  const tasks = await runtime.getTasks({
    tags: ['queue', 'repeat', 'autofun'],
  });

  for (const task of tasks) {
    await runtime.deleteTask(task.id);
  }

  // shouldn't plugin-solana and plugin-evm handle this?
  runtime.registerTaskWorker({
    name: 'AUTOFUN_INTEL_SYNC_WALLET',
    validate: async (_runtime, _message, _state) => {
      return true; // TODO: validate after certain time
    },
    execute: async (runtime, _options, task) => {
      /*
      const birdeye = new Birdeye(runtime);
      try {
        await birdeye.syncWallet();
      } catch (error) {
        logger.error('Failed to sync wallet', error);
        // kill this task
        //await runtime.deleteTask(task.id);
      }
      */
    },
  });
  runtime.createTask({
    name: 'AUTOFUN_INTEL_SYNC_WALLET',
    description: 'Sync wallet from Birdeye',
    worldId,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updateInterval: 1000 * 60 * 5, // 5 minutes
    },
    tags: ['queue', 'repeat', 'autofun', 'immediate'],
  });

  runtime.registerTaskWorker({
    name: 'AUTOFUN_INTEL_SYNC_RAW_AUTOFUN_CHAT',
    validate: async (_runtime, _message, _state) => {
      return true; // TODO: validate after certain time
    },
    execute: async (runtime, _options, task) => {
      const chat = new Chat(runtime);
      try {
        await chat.syncChats();
      } catch (error) {
        logger.debug('Failed to sync tokens', error);
        // kill this task
        //await runtime.deleteTask(task.id);
      }
    },
  });
  runtime.createTask({
    name: 'AUTOFUN_INTEL_SYNC_RAW_AUTOFUN_CHAT',
    description: 'Check autofun chat rooms',
    worldId,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updateInterval: 1000 * 60 * 5, // 5 minutes
    },
    tags: ['queue', 'repeat', 'autofun', 'immediate'],
  });

  // Only create the Twitter sync task if the Twitter service exists
  const twitterService = runtime.getService('twitter');
  if (twitterService) {
    runtime.registerTaskWorker({
      name: 'AUTOFUN_INTEL_SYNC_RAW_TWEETS',
      validate: async (runtime, _message, _state) => {
        // Check if Twitter service exists and return false if it doesn't
        const twitterService = runtime.getService('twitter');
        if (!twitterService) {
          // Log only once when we'll be removing the task
          logger.debug(
            'Twitter service not available, removing AUTOFUN_INTEL_SYNC_RAW_TWEETS task'
          );

          // Get all tasks of this type
          const tasks = await runtime.getTasksByName('AUTOFUN_INTEL_SYNC_RAW_TWEETS');

          // Delete all these tasks
          for (const task of tasks) {
            await runtime.deleteTask(task.id);
          }

          return false;
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        try {
          const twitter = new Twitter(runtime);
          await twitter.syncRawTweets();
        } catch (error) {
          logger.error('Failed to sync raw tweets', error);
        }
      },
    });

    runtime.createTask({
      name: 'AUTOFUN_INTEL_SYNC_RAW_TWEETS',
      description: 'Sync raw tweets from Twitter',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 15, // 15 minutes
      },
      tags: ['queue', 'repeat', 'autofun', 'immediate'],
    });

    runtime.registerTaskWorker({
      name: 'AUTOFUN_INTEL_INTEL_PARSE_TWEETS',
      validate: async (runtime, _message, _state) => {
        // Check if Twitter service exists and return false if it doesn't
        const twitterService = runtime.getService('twitter');
        if (!twitterService) {
          // The main task handler above will take care of removing all Twitter tasks
          return false; // This will prevent execution
        }
        return true;
      },
      execute: async (runtime, _options, task) => {
        const twitterParser = new TwitterParser(runtime);
        try {
          await twitterParser.parseTweets();
        } catch (error) {
          logger.error('Failed to parse tweets', error);
        }
      },
    });

    runtime.createTask({
      name: 'AUTOFUN_INTEL_INTEL_PARSE_TWEETS',
      description: 'Parse tweets',
      worldId,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updateInterval: 1000 * 60 * 60 * 24, // 24 hours
      },
      tags: ['queue', 'repeat', 'autofun', 'immediate'],
    });
  } else {
    logger.debug(
      'WARNING: Twitter service not found, skipping creation of INTEL_SYNC_RAW_TWEETS task'
    );
  }
};
