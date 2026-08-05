import { userMechanicsDismantleAndroid } from './user.dismantle-android.js';
import { userMechanicsLaunchAndroid } from './user.launch-android.js';
import { userMechanicsUploadAndroidScript } from './user.upload-android-script.js';

const userMechanics = [userMechanicsUploadAndroidScript, userMechanicsLaunchAndroid, userMechanicsDismantleAndroid];

export { userMechanics };
