/**
 * Firebase and application configuration template
 * 
 * IMPORTANT: Copy this file to environment.ts and fill in your actual values.
 * DO NOT commit environment.ts to version control.
 */

export const environment = {
  production: false,
  
  firebase: {
    projectId: 'placeholder_project_id',
    appId: 'placeholder_app_id',
    apiKey: 'placeholder_api_key',
    authDomain: 'placeholder_project_id.firebaseapp.com',
    storageBucket: 'placeholder_project_id.appspot.com',
    messagingSenderId: 'placeholder_messaging_sender_id',
  },
  
  yoco: {
    publicKey: 'pk_test_placeholder_public_key',
  },
  
  api: {
    workerUrl: 'http://localhost:8787',
  }
};
