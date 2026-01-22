// ========================================
// Highway Hustle Backend - Test Examples
// ========================================

const BASE_URL = "http://localhost:5000/api";

// ========== Example 1: Load Player (Auto-creates if not exists) ==========
async function loadPlayer() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/all?user=${wallet}`);
  const data = await response.json();
  
  console.log("Player loaded:", data);
  return data;
}

// ========== Example 2: Update Player Currency ==========
async function updateCurrency() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/game?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currency: 50000,
      playerName: "SpeedKing"
    })
  });
  
  const data = await response.json();
  console.log("Currency updated:", data);
  return data;
}

// ========== Example 3: Unlock Vehicle ==========
async function unlockVehicle() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/vehicle?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      LamborghiniOwned: 1,
      selectedPlayerCarIndex: 4
    })
  });
  
  const data = await response.json();
  console.log("Vehicle unlocked:", data);
  return data;
}

// ========== Example 4: Update Best Score ==========
async function updateBestScore() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/gamemode?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bestScoreOneWay: 1500,
      bestScoreTwoWay: 2000
    })
  });
  
  const data = await response.json();
  console.log("Best score updated:", data);
  return data;
}

// ========== Example 5: Set Achievement for Galxe ==========
async function setAchievement() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/all?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignData: {
        Achieved1000M: true
      }
    })
  });
  
  const data = await response.json();
  console.log("Achievement set:", data);
  return data;
}

// ========== Example 6: Check Achievement (Galxe Integration) ==========
async function checkAchievement() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/check-user-achievement?user=${wallet}`);
  const data = await response.json();
  
  console.log("Achievement check:", data);
  
  // Galxe handler logic
  if (data.data.Achieved1000M === true) {
    console.log("✅ User qualified (return 1)");
    return 1;
  } else {
    console.log("❌ User not qualified (return 0)");
    return 0;
  }
}

// ========== Example 7: Update Privy Data ==========
async function updatePrivyData() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  const response = await fetch(`${BASE_URL}/player/privy?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      discord: "SpeedKing#1234",
      telegram: "@speedking",
      email: "speedking@example.com"
    })
  });
  
  const data = await response.json();
  console.log("Privy data updated:", data);
  return data;
}

// ========== Example 8: Query by Different Identifiers ==========
async function queryByEmail() {
  const email = "speedking@example.com";
  
  const response = await fetch(`${BASE_URL}/player/all?user=${email}`);
  const data = await response.json();
  
  console.log("Player loaded by email:", data);
  return data;
}

async function queryByDiscord() {
  const discord = "SpeedKing#1234";
  
  const response = await fetch(`${BASE_URL}/player/all?user=${discord}`);
  const data = await response.json();
  
  console.log("Player loaded by Discord:", data);
  return data;
}

// ========== Example 9: Get Leaderboard ==========
async function getLeaderboard() {
  const response = await fetch(`${BASE_URL}/leaderboard`);
  const data = await response.json();
  
  console.log("Top 10 players:", data.leaderboard);
  return data;
}

// ========== Example 10: Complete Game Session Flow ==========
async function completeGameSession() {
  const wallet = "0x1234567890123456789012345678901234567890";
  
  // 1. Load player
  const player = await fetch(`${BASE_URL}/player/all?user=${wallet}`).then(r => r.json());
  console.log("Session started for:", player.data.userGameData.playerName);
  
  // 2. Update game stats after race
  await fetch(`${BASE_URL}/player/game?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currency: player.data.userGameData.currency + 1000, // Earned 1000 in race
      totalPlayedTime: player.data.userGameData.totalPlayedTime + 5.5 // 5.5 minutes
    })
  });
  
  // 3. Update best score if beaten
  await fetch(`${BASE_URL}/player/gamemode?user=${wallet}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bestScoreOneWay: 1800 // New high score
    })
  });
  
  // 4. Check if achievement unlocked
  if (1800 >= 1000) { // Reached 1000M
    await fetch(`${BASE_URL}/player/all?user=${wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignData: { Achieved1000M: true }
      })
    });
    console.log("🎉 Achievement unlocked!");
  }
  
  console.log("Session complete!");
}

// ========================================
// UNITY C# EXAMPLES
// ========================================

/*
// Load player state in Unity
IEnumerator LoadPlayerState(string walletAddress)
{
    string url = $"http://localhost:5000/api/player/all?user={walletAddress}";
    UnityWebRequest request = UnityWebRequest.Get(url);
    
    yield return request.SendWebRequest();
    
    if (request.result == UnityWebRequest.Result.Success)
    {
        string json = request.downloadHandler.text;
        PlayerDataResponse response = JsonUtility.FromJson<PlayerDataResponse>(json);
        
        // Apply to game
        PlayerPrefs.SetInt("Currency", response.data.userGameData.currency);
        PlayerPrefs.SetString("PlayerName", response.data.userGameData.playerName);
        PlayerPrefs.Save();
        
        Debug.Log($"Loaded player: {response.data.userGameData.playerName}");
    }
}

// Update currency in Unity
IEnumerator UpdateCurrency(string walletAddress, int newCurrency)
{
    string url = $"http://localhost:5000/api/player/game?user={walletAddress}";
    
    GameDataUpdate updateData = new GameDataUpdate {
        currency = newCurrency
    };
    
    string json = JsonUtility.ToJson(updateData);
    
    UnityWebRequest request = new UnityWebRequest(url, "POST");
    byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Content-Type", "application/json");
    
    yield return request.SendWebRequest();
    
    if (request.result == UnityWebRequest.Result.Success)
    {
        Debug.Log("Currency updated successfully!");
    }
}

[System.Serializable]
public class PlayerDataResponse
{
    public bool success;
    public PlayerData data;
}

[System.Serializable]
public class PlayerData
{
    public UserGameData userGameData;
    public PlayerVehicleData playerVehicleData;
    public PlayerGameModeData playerGameModeData;
}

[System.Serializable]
public class UserGameData
{
    public string playerName;
    public int currency;
    public float totalPlayedTime;
}

[System.Serializable]
public class GameDataUpdate
{
    public int currency;
    public string playerName;
}
*/

// ========================================
// Run examples (Node.js)
// ========================================

// Uncomment to run:
// loadPlayer();
// updateCurrency();
// checkAchievement();
// completeGameSession();