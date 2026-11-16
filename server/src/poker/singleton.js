// FILE: server/src/poker/singleton.js
import { env } from '../config/env.js';
import * as pokerRepo from '../repositories/poker.repository.js';
import { PokerRoomManager } from './roomManager.js';

let sharedManager = null;

export const getPokerRoomManager = () => {
  if (!sharedManager) {
    sharedManager = new PokerRoomManager({
      envEnabled: env.poker.enabled,
      maxActiveRooms: env.poker.maxActiveRooms,
      maxRoomsPerUserPerHour: env.poker.maxRoomsPerUserPerHour,
      saveHistoryFn: pokerRepo.saveGameHistory,
    });
  }
  return sharedManager;
};
