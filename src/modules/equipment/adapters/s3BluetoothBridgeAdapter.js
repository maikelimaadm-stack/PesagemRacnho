// Mantido só como utilitário legado (COM virtual). O caminho oficial do S3 no app
// é Web Bluetooth em s3BluetoothAdapter.js — sem emparelhar no Windows.
export { createS3BluetoothAdapter as createS3BluetoothBridgeAdapter } from './s3BluetoothAdapter.js';
