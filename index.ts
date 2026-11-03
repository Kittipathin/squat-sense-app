/**
 * SquatSense — Biomechanics Motion Coach
 * Squat form coaching app using the phone's accelerometer and gyroscope.
 *
 * Authors:
 *   Kittipath Inarree     6802041510279
 *   Pongsakorn Srisakat   6802041510066
 */
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
