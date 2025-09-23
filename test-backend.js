const axios = require("axios");

const API_BASE_URL = "http://localhost:5001/api";

async function testBackend() {
  console.log("🧪 Testing CineLink Backend...\n");

  try {
    // Test health endpoint
    console.log("1. Testing health endpoint...");
    const health = await axios.get(`${API_BASE_URL}/health`);
    console.log("✅ Health check:", health.data);

    // Test movie search
    console.log("\n2. Testing movie search...");
    const search = await axios.get(`${API_BASE_URL}/movies/search?q=inception`);
    console.log(
      "✅ Search results:",
      search.data.Search?.length || 0,
      "movies found"
    );
    console.log("📋 From cache:", search.data.fromCache || false);

    // Test movie details
    if (search.data.Search?.length > 0) {
      const movieId = search.data.Search[0].imdbID;
      console.log("\n3. Testing movie details...");
      const details = await axios.get(
        `${API_BASE_URL}/movies/details/${movieId}`
      );
      console.log("✅ Movie details:", details.data.Title);
      console.log("📋 From cache:", details.data.fromCache || false);
    }

    // Test recommendations
    console.log("\n4. Testing recommendations...");
    const recommendations = await axios.post(
      `${API_BASE_URL}/recommendations`,
      {
        title: "Inception",
        top_n: 5,
      }
    );
    console.log(
      "✅ Recommendations:",
      recommendations.data.recommendations?.length || 0,
      "movies"
    );
    console.log("📋 From cache:", recommendations.data.fromCache || false);

    console.log("\n🎉 All backend tests passed!");
    console.log(
      "\n📱 Your React Native app should now use the backend automatically."
    );
    console.log('🔄 Look for "✅ Backend is available" in your app logs.');
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("❌ Backend is not running. Start it with: npm run dev");
    } else {
      console.log("❌ Test failed:", error.message);
    }
  }
}

testBackend();
