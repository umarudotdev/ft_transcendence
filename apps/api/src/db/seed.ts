import { reset } from "drizzle-seed";

import { hashPassword } from "../modules/auth/password";
import { db } from "./index";
import * as schema from "./schema";

async function main() {
  console.log("Resetting database...");
  await reset(db, schema);

  console.log("Creating seed data...");

  // Hash a common password for all test users
  const passwordHash = await hashPassword("Password123!");

  // ============================================================================
  // USERS
  // ============================================================================
  console.log("Creating users...");

  const userNames = [
    "Admin User",
    "Moderator User",
    "Alice Johnson",
    "Bob Smith",
    "Charlie Brown",
    "Diana Prince",
    "Ethan Hunt",
    "Fiona Apple",
    "George Lucas",
    "Hannah Montana",
    "Ivan Petrov",
    "Julia Roberts",
    "Kevin Hart",
    "Luna Lovegood",
    "Mike Tyson",
    "Nancy Drew",
    "Oscar Wilde",
    "Penny Lane",
    "Quinn Hughes",
    "Rachel Green",
    "Steve Rogers",
    "Tina Turner",
    "Uma Thurman",
    "Victor Hugo",
    "Wendy Darling",
    "Xavier Woods",
    "Yara Shahidi",
    "Zack Morris",
    "Aaron Paul",
    "Bella Swan",
    "Chris Evans",
    "Daisy Ridley",
    "Emma Watson",
    "Frank Ocean",
    "Grace Kelly",
    "Henry Cavill",
    "Iris West",
    "Jack Sparrow",
    "Kate Winslet",
    "Leo Messi",
    "Maya Angelou",
    "Noah Centineo",
    "Olivia Pope",
    "Peter Parker",
    "Queen Latifah",
    "Ryan Gosling",
    "Sarah Connor",
    "Tom Holland",
    "Ursula Major",
    "Vince Vaughn",
  ];

  const userInserts = userNames.map((name, i) => ({
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    passwordHash,
    emailVerified: true,
    displayName: name,
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    createdAt: new Date(Date.now() - (50 - i) * 24 * 60 * 60 * 1000), // Staggered creation dates
    updatedAt: new Date(),
  }));

  const insertedUsers = await db
    .insert(schema.users)
    .values(userInserts)
    .returning();

  const adminUser = insertedUsers[0];
  const modUser = insertedUsers[1];
  const regularUsers = insertedUsers.slice(2);

  // ============================================================================
  // USER ROLES
  // ============================================================================
  console.log("Creating user roles...");

  await db.insert(schema.userRoles).values([
    { userId: adminUser.id, role: "admin", assignedBy: adminUser.id },
    { userId: modUser.id, role: "moderator", assignedBy: adminUser.id },
  ]);

  // ============================================================================
  // SEASONS
  // ============================================================================
  console.log("Creating seasons...");

  const seasons = await db
    .insert(schema.seasons)
    .values([
      {
        name: "Season 1 - Genesis",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-03-31"),
        isActive: false,
      },
      {
        name: "Season 2 - Rise",
        startDate: new Date("2024-04-01"),
        endDate: new Date("2024-06-30"),
        isActive: false,
      },
      {
        name: "Season 3 - Legends",
        startDate: new Date("2024-07-01"),
        endDate: new Date("2024-12-31"),
        isActive: true,
      },
    ])
    .returning();

  const activeSeason = seasons[2];

  // ============================================================================
  // ACHIEVEMENTS
  // ============================================================================
  console.log("Creating achievements...");

  const achievementDefs = [
    // Gameplay achievements
    {
      code: "first_win",
      name: "First Victory",
      description: "Win your first match",
      icon: "trophy",
      points: 10,
      category: "gameplay",
      targetProgress: 1,
    },
    {
      code: "win_streak_5",
      name: "On Fire",
      description: "Win 5 matches in a row",
      icon: "fire",
      points: 50,
      category: "gameplay",
      targetProgress: 5,
    },
    {
      code: "win_streak_10",
      name: "Unstoppable",
      description: "Win 10 matches in a row",
      icon: "zap",
      points: 100,
      category: "gameplay",
      targetProgress: 10,
    },
    {
      code: "perfect_game",
      name: "Perfect Game",
      description: "Win a match without conceding a point",
      icon: "star",
      points: 25,
      category: "gameplay",
      targetProgress: 1,
    },
    {
      code: "comeback_king",
      name: "Comeback King",
      description: "Win a match after being down 0-5",
      icon: "crown",
      points: 75,
      category: "gameplay",
      targetProgress: 1,
      isSecret: true,
    },
    // Milestone achievements
    {
      code: "matches_10",
      name: "Getting Started",
      description: "Play 10 matches",
      icon: "target",
      points: 15,
      category: "milestone",
      targetProgress: 10,
    },
    {
      code: "matches_50",
      name: "Regular Player",
      description: "Play 50 matches",
      icon: "medal",
      points: 50,
      category: "milestone",
      targetProgress: 50,
    },
    {
      code: "matches_100",
      name: "Veteran",
      description: "Play 100 matches",
      icon: "award",
      points: 100,
      category: "milestone",
      targetProgress: 100,
    },
    {
      code: "wins_25",
      name: "Winner",
      description: "Win 25 matches",
      icon: "check-circle",
      points: 50,
      category: "milestone",
      targetProgress: 25,
    },
    {
      code: "wins_100",
      name: "Champion",
      description: "Win 100 matches",
      icon: "trophy",
      points: 150,
      category: "milestone",
      targetProgress: 100,
    },
    // Social achievements
    {
      code: "first_friend",
      name: "Social Butterfly",
      description: "Add your first friend",
      icon: "user-plus",
      points: 10,
      category: "social",
      targetProgress: 1,
    },
    {
      code: "friends_10",
      name: "Popular",
      description: "Have 10 friends",
      icon: "users",
      points: 25,
      category: "social",
      targetProgress: 10,
    },
    {
      code: "login_streak_7",
      name: "Dedicated",
      description: "Log in 7 days in a row",
      icon: "calendar",
      points: 30,
      category: "social",
      targetProgress: 7,
    },
    {
      code: "login_streak_30",
      name: "Committed",
      description: "Log in 30 days in a row",
      icon: "calendar-check",
      points: 100,
      category: "social",
      targetProgress: 30,
    },
  ];

  const achievements = await db
    .insert(schema.achievements)
    .values(achievementDefs)
    .returning();

  // ============================================================================
  // PLAYER RATINGS
  // ============================================================================
  console.log("Creating player ratings...");

  const ratingInserts = insertedUsers.map((user, i) => {
    // Give varied ratings - admin and early users get higher ratings
    const baseRating = 1000 + Math.floor((50 - i) * 15) + (i % 7) * 30;
    const tier =
      baseRating < 1100
        ? "bronze"
        : baseRating < 1300
          ? "silver"
          : baseRating < 1500
            ? "gold"
            : "platinum";
    return {
      userId: user.id,
      rating: baseRating,
      peakRating: baseRating + Math.floor(Math.random() * 100),
      gamesRated: 10 + Math.floor(Math.random() * 40),
      tier,
      seasonId: activeSeason.id,
      lastActivityAt: new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      ),
    };
  });

  await db.insert(schema.playerRatings).values(ratingInserts);

  // ============================================================================
  // MATCHES
  // ============================================================================
  console.log("Creating matches...");

  const matchInserts: schema.NewMatch[] = [];
  const ratingHistoryInserts: schema.NewRatingHistory[] = [];

  // Create 200 matches between random users
  for (let i = 0; i < 200; i++) {
    const player1Idx = Math.floor(Math.random() * insertedUsers.length);
    let player2Idx = Math.floor(Math.random() * insertedUsers.length);
    while (player2Idx === player1Idx) {
      player2Idx = Math.floor(Math.random() * insertedUsers.length);
    }

    const player1 = insertedUsers[player1Idx];
    const player2 = insertedUsers[player2Idx];

    // Generate realistic scores (first to 11, win by 2)
    const p1Skill = 50 - player1Idx; // Earlier users are slightly better
    const p2Skill = 50 - player2Idx;
    const skillDiff = p1Skill - p2Skill;

    let player1Score: number;
    let player2Score: number;

    if (Math.random() < 0.5 + skillDiff * 0.02) {
      // Player 1 wins
      player1Score = 11;
      player2Score = Math.floor(Math.random() * 10);
      // Close games sometimes
      if (Math.random() < 0.3) {
        player2Score = 9 + Math.floor(Math.random() * 2);
        player1Score = player2Score + 2;
      }
    } else {
      // Player 2 wins
      player2Score = 11;
      player1Score = Math.floor(Math.random() * 10);
      if (Math.random() < 0.3) {
        player1Score = 9 + Math.floor(Math.random() * 2);
        player2Score = player1Score + 2;
      }
    }

    const winnerId = player1Score > player2Score ? player1.id : player2.id;
    const createdAt = new Date(Date.now() - (200 - i) * 2 * 60 * 60 * 1000); // Staggered over time

    matchInserts.push({
      player1Id: player1.id,
      player2Id: player2.id,
      player1Score,
      player2Score,
      winnerId,
      gameType: "pong",
      isAiGame: false,
      duration: 120 + Math.floor(Math.random() * 180), // 2-5 minutes
      createdAt,
    });
  }

  // Add some AI games
  for (let i = 0; i < 30; i++) {
    const playerIdx = Math.floor(Math.random() * insertedUsers.length);
    const player = insertedUsers[playerIdx];
    const playerWins = Math.random() < 0.6;

    matchInserts.push({
      player1Id: player.id,
      player2Id: null,
      player1Score: playerWins ? 11 : Math.floor(Math.random() * 9),
      player2Score: playerWins ? Math.floor(Math.random() * 9) : 11,
      winnerId: playerWins ? player.id : null,
      gameType: "pong",
      isAiGame: true,
      duration: 90 + Math.floor(Math.random() * 120),
      createdAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000),
    });
  }

  const insertedMatches = await db
    .insert(schema.matches)
    .values(matchInserts)
    .returning();

  // Create rating history for non-AI matches
  for (const match of insertedMatches.filter(
    (m) => !m.isAiGame && m.player2Id
  )) {
    const ratingChange = 15 + Math.floor(Math.random() * 10);

    ratingHistoryInserts.push(
      {
        userId: match.player1Id,
        matchId: match.id,
        ratingBefore: 1000,
        ratingAfter:
          match.winnerId === match.player1Id
            ? 1000 + ratingChange
            : 1000 - ratingChange,
        ratingChange:
          match.winnerId === match.player1Id ? ratingChange : -ratingChange,
        createdAt: match.createdAt,
      },
      {
        userId: match.player2Id!,
        matchId: match.id,
        ratingBefore: 1000,
        ratingAfter:
          match.winnerId === match.player2Id
            ? 1000 + ratingChange
            : 1000 - ratingChange,
        ratingChange:
          match.winnerId === match.player2Id ? ratingChange : -ratingChange,
        createdAt: match.createdAt,
      }
    );
  }

  await db.insert(schema.ratingHistory).values(ratingHistoryInserts);

  // ============================================================================
  // FRIENDSHIPS
  // ============================================================================
  console.log("Creating friendships...");

  const friendshipInserts: schema.NewFriend[] = [];
  const friendPairs = new Set<string>();

  // Create 100 accepted friendships
  for (let i = 0; i < 100; i++) {
    const user1Idx = Math.floor(Math.random() * insertedUsers.length);
    let user2Idx = Math.floor(Math.random() * insertedUsers.length);
    while (user2Idx === user1Idx) {
      user2Idx = Math.floor(Math.random() * insertedUsers.length);
    }

    const pairKey = [user1Idx, user2Idx].sort().join("-");
    if (friendPairs.has(pairKey)) continue;
    friendPairs.add(pairKey);

    friendshipInserts.push({
      userId: insertedUsers[user1Idx].id,
      friendId: insertedUsers[user2Idx].id,
      status: "accepted",
    });
  }

  // Add some pending requests
  for (let i = 0; i < 20; i++) {
    const user1Idx = Math.floor(Math.random() * insertedUsers.length);
    let user2Idx = Math.floor(Math.random() * insertedUsers.length);
    while (user2Idx === user1Idx) {
      user2Idx = Math.floor(Math.random() * insertedUsers.length);
    }

    const pairKey = [user1Idx, user2Idx].sort().join("-");
    if (friendPairs.has(pairKey)) continue;
    friendPairs.add(pairKey);

    friendshipInserts.push({
      userId: insertedUsers[user1Idx].id,
      friendId: insertedUsers[user2Idx].id,
      status: "pending",
    });
  }

  await db.insert(schema.friends).values(friendshipInserts);

  // ============================================================================
  // USER POINTS & TRANSACTIONS
  // ============================================================================
  console.log("Creating points and transactions...");

  const pointsInserts = insertedUsers.map((user) => {
    const balance = 100 + Math.floor(Math.random() * 500);
    return {
      userId: user.id,
      balance,
      totalEarned: balance + Math.floor(Math.random() * 200),
      totalSpent: Math.floor(Math.random() * 200),
    };
  });

  await db.insert(schema.userPoints).values(pointsInserts);

  const transactionTypes: schema.PointsTransactionType[] = [
    "win",
    "daily_login",
    "streak_bonus",
    "achievement",
  ];

  const transactionInserts: schema.NewPointsTransaction[] = [];
  for (const user of insertedUsers.slice(0, 20)) {
    for (let i = 0; i < 10; i++) {
      transactionInserts.push({
        userId: user.id,
        amount: 10 + Math.floor(Math.random() * 40),
        type: transactionTypes[
          Math.floor(Math.random() * transactionTypes.length)
        ],
        description: "Points earned",
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
        ),
      });
    }
  }

  await db.insert(schema.pointsTransactions).values(transactionInserts);

  // ============================================================================
  // LOGIN STREAKS
  // ============================================================================
  console.log("Creating login streaks...");

  const streakInserts = insertedUsers.map((user) => ({
    userId: user.id,
    currentStreak: Math.floor(Math.random() * 14),
    longestStreak: Math.floor(Math.random() * 30) + 5,
    lastLoginDate: new Date(
      Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000)
    ),
  }));

  await db.insert(schema.loginStreaks).values(streakInserts);

  // ============================================================================
  // USER ACHIEVEMENTS
  // ============================================================================
  console.log("Creating user achievements...");

  const userAchievementInserts: schema.NewUserAchievement[] = [];

  // Give some achievements to users
  for (const user of insertedUsers.slice(0, 30)) {
    const numAchievements = 1 + Math.floor(Math.random() * 5);
    const shuffledAchievements = [...achievements].sort(
      () => Math.random() - 0.5
    );

    for (
      let i = 0;
      i < numAchievements && i < shuffledAchievements.length;
      i++
    ) {
      userAchievementInserts.push({
        userId: user.id,
        achievementId: shuffledAchievements[i].id,
        unlockedAt: new Date(
          Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)
        ),
      });
    }
  }

  await db.insert(schema.userAchievements).values(userAchievementInserts);

  // ============================================================================
  // REPORTS
  // ============================================================================
  console.log("Creating reports...");

  const reportReasons: schema.ReportReason[] = [
    "afk",
    "cheating",
    "harassment",
    "inappropriate_name",
    "other",
  ];

  const reportInserts: schema.NewReport[] = [];

  // Create 15 resolved reports
  for (let i = 0; i < 15; i++) {
    const reporterIdx = Math.floor(Math.random() * regularUsers.length);
    let reportedIdx = Math.floor(Math.random() * regularUsers.length);
    while (reportedIdx === reporterIdx) {
      reportedIdx = Math.floor(Math.random() * regularUsers.length);
    }

    reportInserts.push({
      reporterId: regularUsers[reporterIdx].id,
      reportedUserId: regularUsers[reportedIdx].id,
      reason: reportReasons[Math.floor(Math.random() * reportReasons.length)],
      description:
        "User was reported for inappropriate behavior during the match.",
      status: "resolved",
      resolvedBy: modUser.id,
      resolvedAt: new Date(
        Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)
      ),
      resolution: "warning",
      createdAt: new Date(
        Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
      ),
    });
  }

  // Create 8 pending reports
  for (let i = 0; i < 8; i++) {
    const reporterIdx = Math.floor(Math.random() * regularUsers.length);
    let reportedIdx = Math.floor(Math.random() * regularUsers.length);
    while (reportedIdx === reporterIdx) {
      reportedIdx = Math.floor(Math.random() * regularUsers.length);
    }

    reportInserts.push({
      reporterId: regularUsers[reporterIdx].id,
      reportedUserId: regularUsers[reportedIdx].id,
      reason: reportReasons[Math.floor(Math.random() * reportReasons.length)],
      description: i % 2 === 0 ? "Player left the game mid-match." : null,
      status: "pending",
      createdAt: new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      ),
    });
  }

  const insertedReports = await db
    .insert(schema.reports)
    .values(reportInserts)
    .returning();

  // ============================================================================
  // SANCTIONS
  // ============================================================================
  console.log("Creating sanctions...");

  const sanctionTypes: schema.SanctionType[] = ["warning", "timeout", "ban"];
  const sanctionInserts: schema.NewSanction[] = [];

  // Create some sanctions for resolved reports
  const resolvedReports = insertedReports.filter(
    (r) => r.status === "resolved"
  );
  for (let i = 0; i < Math.min(10, resolvedReports.length); i++) {
    const report = resolvedReports[i];
    const sanctionType = sanctionTypes[Math.floor(Math.random() * 2)]; // warning or timeout

    sanctionInserts.push({
      userId: report.reportedUserId,
      type: sanctionType,
      reason: `Sanction issued following report investigation (Report #${report.id})`,
      reportId: report.id,
      issuedBy: modUser.id,
      expiresAt:
        sanctionType === "timeout"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          : null,
      isActive: sanctionType !== "warning",
      createdAt: report.resolvedAt ?? new Date(),
    });
  }

  // Create one revoked sanction
  sanctionInserts.push({
    userId: regularUsers[5].id,
    type: "timeout",
    reason: "Excessive harassment in chat",
    issuedBy: modUser.id,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
    isActive: false,
    revokedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    revokedBy: adminUser.id,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  });

  await db.insert(schema.sanctions).values(sanctionInserts);

  // ============================================================================
  // AUDIT LOG
  // ============================================================================
  console.log("Creating audit log entries...");

  const auditInserts: schema.NewModerationAuditLogEntry[] = [
    {
      actorId: adminUser.id,
      action: "role_changed",
      targetUserId: modUser.id,
      details: JSON.stringify({ oldRole: "user", newRole: "moderator" }),
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
    ...resolvedReports.slice(0, 10).map((report) => ({
      actorId: modUser.id,
      action: "report_resolved",
      targetUserId: report.reportedUserId,
      targetId: report.id,
      targetType: "report",
      details: JSON.stringify({
        resolution: report.resolution,
        reason: report.reason,
      }),
      createdAt: report.resolvedAt ?? new Date(),
    })),
    {
      actorId: adminUser.id,
      action: "sanction_revoked",
      targetUserId: regularUsers[5].id,
      details: JSON.stringify({
        sanctionType: "timeout",
        reason: "Appeal accepted",
      }),
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  ];

  await db.insert(schema.moderationAuditLog).values(auditInserts);

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  console.log("Creating notifications...");

  const notificationTypes: schema.NotificationType[] = [
    "achievement",
    "friend_request",
    "rank_change",
    "system",
  ];

  const notificationInserts: schema.NewNotification[] = [];

  for (const user of insertedUsers.slice(0, 20)) {
    const numNotifications = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numNotifications; i++) {
      const type =
        notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      const isRead = Math.random() > 0.4;

      notificationInserts.push({
        userId: user.id,
        type,
        title:
          type === "achievement"
            ? "Achievement Unlocked!"
            : type === "friend_request"
              ? "New Friend Request"
              : type === "rank_change"
                ? "Rank Updated"
                : "System Notification",
        message:
          type === "achievement"
            ? "You've earned a new achievement!"
            : type === "friend_request"
              ? "Someone wants to be your friend."
              : type === "rank_change"
                ? "Your ranking has changed."
                : "Welcome to ft_transcendence!",
        isRead,
        readAt: isRead ? new Date() : null,
        createdAt: new Date(
          Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)
        ),
      });
    }
  }

  await db.insert(schema.notifications).values(notificationInserts);

  // ============================================================================
  // NOTIFICATION PREFERENCES
  // ============================================================================
  console.log("Creating notification preferences...");

  const prefInserts = insertedUsers.map((user) => ({
    userId: user.id,
    matchInvites: true,
    friendRequests: true,
    achievements: true,
    rankChanges: true,
    systemMessages: true,
    chatMessages: true,
    emailNotifications: Math.random() > 0.7,
  }));

  await db.insert(schema.notificationPreferences).values(prefInserts);

  // ============================================================================
  // CHAT CHANNELS & MESSAGES
  // ============================================================================
  console.log("Creating chat channels and messages...");

  // Create some DM channels
  const dmChannels: schema.NewChannel[] = [];
  for (let i = 0; i < 20; i++) {
    dmChannels.push({
      type: "dm",
      createdBy: regularUsers[i % regularUsers.length].id,
    });
  }

  const insertedChannels = await db
    .insert(schema.channels)
    .values(dmChannels)
    .returning();

  // Add members to DM channels (2 per channel)
  const memberInserts: schema.NewChannelMember[] = [];
  for (let i = 0; i < insertedChannels.length; i++) {
    const channel = insertedChannels[i];
    const user1 = regularUsers[i % regularUsers.length];
    const user2 = regularUsers[(i + 1) % regularUsers.length];

    memberInserts.push(
      { channelId: channel.id, userId: user1.id, role: "member" },
      { channelId: channel.id, userId: user2.id, role: "member" }
    );
  }

  await db.insert(schema.channelMembers).values(memberInserts);

  // Create messages in channels
  const messageTexts = [
    "Hey! Good game!",
    "Thanks for playing",
    "Rematch?",
    "That was close!",
    "Nice shot!",
    "GG WP",
    "Want to play again later?",
    "Great match!",
    "You're really good at this",
    "Let me know when you're free",
  ];

  const messageInserts: schema.NewMessage[] = [];
  for (let i = 0; i < insertedChannels.length; i++) {
    const channel = insertedChannels[i];
    const user1 = regularUsers[i % regularUsers.length];
    const user2 = regularUsers[(i + 1) % regularUsers.length];

    // 3-8 messages per channel
    const numMessages = 3 + Math.floor(Math.random() * 6);
    for (let j = 0; j < numMessages; j++) {
      messageInserts.push({
        channelId: channel.id,
        senderId: j % 2 === 0 ? user1.id : user2.id,
        content: messageTexts[Math.floor(Math.random() * messageTexts.length)],
        createdAt: new Date(Date.now() - (numMessages - j) * 5 * 60 * 1000), // 5 min apart
      });
    }
  }

  await db.insert(schema.messages).values(messageInserts);

  // ============================================================================
  // DONE
  // ============================================================================

  console.log("\n✅ Seed completed successfully!");
  console.log(`
Summary:
- ${insertedUsers.length} users created (1 admin, 1 moderator, ${regularUsers.length} regular)
- ${insertedMatches.length} matches created
- ${friendshipInserts.length} friendships created
- ${achievements.length} achievements defined
- ${userAchievementInserts.length} achievements unlocked
- ${insertedReports.length} reports created (${resolvedReports.length} resolved, ${insertedReports.length - resolvedReports.length} pending)
- ${sanctionInserts.length} sanctions created
- ${auditInserts.length} audit log entries
- ${insertedChannels.length} chat channels with messages
- ${notificationInserts.length} notifications

Test credentials:
- Admin: admin.user@example.com / Password123!
- Moderator: moderator.user@example.com / Password123!
- Regular user: alice.johnson@example.com / Password123!
`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
