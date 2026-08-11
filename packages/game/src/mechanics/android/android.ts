import { androidMechanicsBroadcast } from './android.broadcast.js';
import { androidMechanicsCharge } from './android.charge.js';
import { androidMechanicsCleanAcid } from './android.clean-acid.js';
import { androidMechanicsCollect } from './android.collect.js';
import { androidMechanicsDeposit } from './android.deposit.js';
import { androidMechanicsDismantle } from './android.dismantle.js';
import { androidMechanicsLaunch } from './android.launch.js';
import { androidMechanicsMove } from './android.move.js';
import { androidMechanicsPenalizeFailedTurn, failedTurnHealthPenalty } from './android.penalize-failed-turn.js';
import { androidMechanicsWithdraw } from './android.withdraw.js';
import { androidMechanicsUpdateState } from './android.update-state.js';

const androidMechanics = [
  // State is updated alongside the action, rather than consuming a separate turn.
  androidMechanicsUpdateState,
  androidMechanicsMove,
  androidMechanicsCharge,
  androidMechanicsCleanAcid,
  androidMechanicsCollect,
  androidMechanicsDeposit,
  androidMechanicsWithdraw,
  androidMechanicsBroadcast,
  androidMechanicsLaunch,
  androidMechanicsDismantle,
  androidMechanicsPenalizeFailedTurn,
];

export { androidMechanics, failedTurnHealthPenalty };
