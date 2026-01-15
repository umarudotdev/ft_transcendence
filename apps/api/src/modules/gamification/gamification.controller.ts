import { Elysia } from "elysia";

import { notFound } from "../../common/errors";
import { authGuard } from "../../common/guards/auth.macro";
import { GamificationModel, mapGamificationError } from "./gamification.model";
import { GamificationService } from "./gamification.service";

export const gamificationController = new Elysia({ prefix: "/gamification" })
  .use(authGuard)

  // Get current user's points balance
  .get("/points", async ({ user }) => {
    const result = await GamificationService.getOrCreateUserPoints(user.id);

    return result.match(
      (points) => ({ points }),
      () => ({ points: { balance: 0, totalEarned: 0, totalSpent: 0 } })
    );
  })

  // Get points transaction history
  .get(
    "/points/history",
    async ({ user, query }) => {
      const result = await GamificationService.getPointsHistory(user.id, {
        limit: query.limit,
        offset: query.offset,
        type: query.type,
      });

      return result.match(
        (data) => data,
        () => ({ transactions: [], total: 0, hasMore: false })
      );
    },
    {
      query: GamificationModel.historyQuery,
    }
  )

  // Get login streak info
  .get("/streak", async ({ user }) => {
    const result = await GamificationService.getLoginStreak(user.id);

    return result.match(
      (streak) => ({ streak }),
      () => ({
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastLoginDate: null,
          canClaimReward: true,
        },
      })
    );
  })

  // Claim daily login reward
  .post("/daily-reward", async ({ user, request, set }) => {
    const instance = new URL(request.url).pathname;
    const result = await GamificationService.claimDailyReward(user.id);

    return result.match(
      (reward) => ({ reward }),
      (error) => {
        const problem = mapGamificationError(error, instance);
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }
    );
  })

  // Get all achievements (with user's progress)
  .get("/achievements", async ({ user }) => {
    const result = await GamificationService.getAchievementsWithStatus(user.id);

    return result.match(
      (achievements) => ({ achievements }),
      () => ({ achievements: [] })
    );
  })

  // Get only user's unlocked achievements
  .get("/achievements/me", async ({ user }) => {
    const result = await GamificationService.getUserAchievements(user.id);

    return result.match(
      (achievements) => ({ achievements }),
      () => ({ achievements: [] })
    );
  })

  // Get another user's achievements
  .get(
    "/users/:id/achievements",
    async ({ params, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await GamificationService.getUserAchievements(params.id);

      return result.match(
        (achievements) => ({ achievements }),
        () => {
          const problem = notFound("User not found", { instance });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: GamificationModel.userIdParam,
    }
  );
