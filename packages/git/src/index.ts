/**
 * @forgeai/git
 *
 * ForgeAI's Git integration boundary: types plus a `GitService` interface.
 *
 * There is no implementation in Module 0, and there is no HTTP-based Git provider either —
 * ForgeAI talks to the local repository only, through `CommandRunnerPort`, so that every Git
 * operation passes the same permission gate as any other command.
 */

export * from "./git-types";
export * from "./git-service";
