import { rankJobs } from "./matching.js";

export function createRecommendationCache() {
  return function getRecommendations(jobs, candidate) {
    // Recompute from this request's inputs to keep rankings isolated by profile.
    return {
      scoredForCandidateId: candidate.id,
      jobs: rankJobs(jobs, candidate),
    };
  };
}
