import { androidMechanicsBroadcast } from './android.broadcast.js';
import { androidMechanicsCharge } from './android.charge.js';
import { androidMechanicsCleanAcid } from './android.clean-acid.js';
import { androidMechanicsCollect } from './android.collect.js';
import { androidMechanicsDeactivateFailedTurn } from './android.deactivate-failed-turn.js';
import { androidMechanicsDeposit } from './android.deposit.js';
import { androidMechanicsDismantle } from './android.dismantle.js';
import { androidMechanicsMove } from './android.move.js';
import { androidMechanicsWithdraw } from './android.withdraw.js';

const androidMechanics = [
  androidMechanicsMove,
  androidMechanicsCharge,
  androidMechanicsCleanAcid,
  androidMechanicsCollect,
  androidMechanicsDeposit,
  androidMechanicsWithdraw,
  androidMechanicsBroadcast,
  androidMechanicsDismantle,
  androidMechanicsDeactivateFailedTurn,
];

export { androidMechanics };
