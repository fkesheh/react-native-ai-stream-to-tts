/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import "@azure/core-asynciterator-polyfill";
import "web-streams-polyfill";

AppRegistry.registerComponent(appName, () => App);
