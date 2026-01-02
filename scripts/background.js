// Browser compatibility layer
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Create Nexora folder on install
browserAPI.runtime.onInstalled.addListener(async () => {
  const folders = await browserAPI.bookmarks.search({ title: "Nexora" });
  
  // Check if Nexora folder exists
  const nexoraExists = folders.some(folder => 
    folder.title === "Nexora" && !folder.url
  );
  
  if (!nexoraExists) {
    await browserAPI.bookmarks.create({ title: "Nexora" });
    console.log("✅ Nexora folder created");
  }
  
  // Set flag for first-time user
  const result = await browserAPI.storage.local.get(['hasSeenWelcome']);
  if (!result.hasSeenWelcome) {
    await browserAPI.storage.local.set({ hasSeenWelcome: false });
  }
});