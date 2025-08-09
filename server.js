const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "VisitFetcher/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function fetchGamesAndVisits(ownerType, ownerId) {
  let total = 0;
  let cursor = "";
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://games.roblox.com/v2/${ownerType}/${ownerId}/games?sortOrder=Asc&limit=50${cursor ? `&cursor=${cursor}` : ""}`;
      const data = await fetchJSON(url);
      for (const game of data.data || []) {
        total += game.placeVisits || 0;
      }
      if (data.nextPageCursor) {
        cursor = data.nextPageCursor;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`Failed to fetch games for ${ownerType} ${ownerId}:`, err.message);
      // Stop fetching on error but keep total from previous pages
      hasMore = false;
    }
  }

  return total;
}

async function fetchOwnedGroups(userId) {
  try {
    const url = `https://groups.roblox.com/v1/users/${userId}/groups/roles`;
    const data = await fetchJSON(url);
    return data.data
      .filter(g => g.role.rank === 255)
      .map(g => g.group.id);
  } catch (err) {
    console.error(`Failed to fetch groups for user ${userId}:`, err.message);
    return [];
  }
}

app.get("/totalVisits", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    let totalVisits = await fetchGamesAndVisits("users", userId);

    const ownedGroups = await fetchOwnedGroups(userId);
    for (const groupId of ownedGroups) {
      try {
        totalVisits += await fetchGamesAndVisits("groups", groupId);
      } catch (err) {
        console.error(`Error fetching visits for group ${groupId}:`, err.message);
      }
    }

    res.json({ userId, totalVisits });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Visit API running on port ${PORT}`);
});
