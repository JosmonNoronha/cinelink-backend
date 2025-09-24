const express = require("express");
const { db, auth, initialized } = require("../config/firebase-admin");
const cors = require("cors");
const router = express.Router();

// Middleware to check Firebase availability
const requireFirebase = (req, res, next) => {
  if (!initialized || !auth || !db) {
    return res.status(503).json({
      error: "Firebase Admin not available",
      message:
        "User features are disabled. Check server logs for Firebase configuration issues.",
    });
  }
  next();
};

// Middleware to verify Firebase token
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No valid authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Get user profile with all data
router.get("/profile", requireFirebase, authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Batch read user data and watchlists
    const [userDoc, watchlistsSnapshot] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("users").doc(userId).collection("watchlists").get(),
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    const watchlists = {};

    watchlistsSnapshot.forEach((doc) => {
      const data = doc.data();
      const movies = (data.movies || []).map((movie) => ({
        ...movie,
        watched: movie.watched !== undefined ? movie.watched : false,
      }));
      watchlists[doc.id] = movies;
    });

    res.json({
      user: {
        uid: userId,
        email: req.user.email,
        emailVerified: req.user.email_verified,
      },
      favorites: userData.userFavorites || [],
      watchlists,
      source: "backend",
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Health check for user service
router.get("/health", (req, res) => {
  res.json({
    service: "user",
    firebase: initialized,
    auth: !!auth,
    firestore: !!db,
    status: initialized ? "available" : "disabled",
  });
});

router.use(cors());

module.exports = router;
