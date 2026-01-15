import { Elysia } from "elysia";

import { notFound } from "../../common/errors";
import { authGuard } from "../../common/guards/auth.macro";
import { RankingsModel, mapRankingError } from "./rankings.model";
import { RankingsService } from "./rankings.service";

export const rankingsController = new Elysia({ prefix: "/rankings" })
  .use(authGuard)

  // Get global leaderboard
  .get(
    "/leaderboard",
    async ({ query }) => {
      const result = await RankingsService.getLeaderboard({
        limit: query.limit,
        offset: query.offset,
        tier: query.tier,
      });

      return result.match(
        (data) => data,
        () => ({ entries: [], total: 0, hasMore: false })
      );
    },
    {
      query: RankingsModel.leaderboardQuery,
    }
  )

  // Get top 10 players
  .get("/leaderboard/top", async () => {
    const result = await RankingsService.getTopPlayers(10);

    return result.match(
      (entries) => ({ entries }),
      () => ({ entries: [] })
    );
  })

  // Get current user's ranking
  .get("/me", async ({ user }) => {
    const result = await RankingsService.getOrCreatePlayerRating(user.id);

    return result.match(
      (ranking) => ({ ranking }),
      () => ({ ranking: null })
    );
  })

  // Get current user's rating history
  .get(
    "/history",
    async ({ user, query }) => {
      const result = await RankingsService.getRatingHistory(user.id, {
        limit: query.limit,
        offset: query.offset,
      });

      return result.match(
        (data) => data,
        () => ({ entries: [], total: 0, hasMore: false })
      );
    },
    {
      query: RankingsModel.historyQuery,
    }
  )

  // Get specific user's ranking
  .get(
    "/users/:id",
    async ({ params, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await RankingsService.getUserRanking(params.id);

      return result.match(
        (ranking) => {
          if (!ranking) {
            const problem = notFound("Ranking not found for user", {
              instance,
            });
            set.status = problem.status;
            set.headers["Content-Type"] = "application/problem+json";
            return problem;
          }
          return { ranking };
        },
        () => {
          const problem = notFound("Ranking not found", { instance });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: RankingsModel.userIdParam,
    }
  )

  // Get specific user's rating history
  .get(
    "/users/:id/history",
    async ({ params, query }) => {
      const result = await RankingsService.getRatingHistory(params.id, {
        limit: query.limit,
        offset: query.offset,
      });

      return result.match(
        (data) => data,
        () => ({ entries: [], total: 0, hasMore: false })
      );
    },
    {
      params: RankingsModel.userIdParam,
      query: RankingsModel.historyQuery,
    }
  )

  // Get all seasons
  .get("/seasons", async () => {
    const result = await RankingsService.getSeasons();

    return result.match(
      (seasons) => ({ seasons }),
      () => ({ seasons: [] })
    );
  })

  // Get current season
  .get("/seasons/current", async () => {
    const result = await RankingsService.getCurrentSeason();

    return result.match(
      (season) => ({ season }),
      () => ({ season: null })
    );
  })

  // Get season results
  .get(
    "/seasons/:seasonId/results",
    async ({ params, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await RankingsService.getSeasonResults(params.seasonId);

      return result.match(
        (rankings) => ({ rankings }),
        (error) => {
          const problem = mapRankingError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: RankingsModel.seasonIdParam,
    }
  );
