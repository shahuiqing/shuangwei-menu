import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function run() {
  const configText = await readFile('./firebase-applet-config.json', 'utf-8');
  const firebaseConfig = JSON.parse(configText);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const docRef = doc(db, 'settings', 'global');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    console.log('--- FOUND SETTINGS ---');
    if (data.categories) {
      console.log('Categories count:', data.categories.length);
      for (const cat of data.categories) {
        console.log(`Category: ${cat.name} (${cat.id})`);
        if (cat.items) {
          for (const item of cat.items) {
            console.log(` - Item: ${item.title} (ID: ${item.id}, Image: ${item.image ? 'has image' : 'NO IMAGE'})`);
          }
        }
      }
    } else {
      console.log('No categories in settings doc');
    }
  } else {
    console.log('No settings/global document found');
  }
}

run().catch(console.error);
