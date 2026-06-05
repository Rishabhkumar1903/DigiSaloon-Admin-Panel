const functions = require("firebase-functions/v1"); // 🔥 THE MAGIC FIX (v1 explicitly import kiya)
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendBroadcastNotification = functions.firestore
  .document("broadcasts/{docId}")
  .onCreate(async (snap, context) => {
    const broadcastData = snap.data();
    
    const targetCollection = broadcastData.target; // 'users' ya 'partners'
    const title = broadcastData.title;
    const message = broadcastData.message;
    const imageUrl = broadcastData.imageUrl || null;

    console.log(`Sending broadcast to ${targetCollection}...`);

    try {
      // 1. Target collection se saare users/partners fetch karo
      const snapshot = await admin.firestore().collection(targetCollection).get();
      
      const tokens = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Check karo ki user ke paas fcmToken hai ya nahi
        if (data.fcmToken) {
          tokens.push(data.fcmToken);
        }
      });

      if (tokens.length === 0) {
        console.log("Koi FCM token nahi mila.");
        return null;
      }

      console.log(`Total tokens found: ${tokens.length}`);

      // 2. Notification Payload Set karo
      const payload = {
        notification: {
          title: title,
          body: message,
        },
        tokens: tokens,
      };

      // Agar image hai toh usko bhi payload me add karo
      if (imageUrl) {
        payload.notification.imageUrl = imageUrl;
      }

      // 3. Messages Bhejo (Firebase allow maximum 500 tokens per batch)
      const chunkSize = 500;
      for (let i = 0; i < tokens.length; i += chunkSize) {
        const tokenChunk = tokens.slice(i, i + chunkSize);
        payload.tokens = tokenChunk;
        
        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log(`Batch ${Math.floor(i / chunkSize) + 1} sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
      }

      // 4. Update status in database
      return snap.ref.update({ status: 'Delivered', deliveredCount: tokens.length });

    } catch (error) {
      console.error("Broadcast bhejne mein error aayi:", error);
      return snap.ref.update({ status: 'Failed', error: error.message });
    }
  });