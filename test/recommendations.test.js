import test from "node:test";
import assert from "node:assert/strict";
import { createRecommendationCache } from "../server/recommendations.js";
import { listJobs } from "../server/catalog.js";
import { candidates } from "../server/seed-data.js";
import { rankJobs } from "../server/matching.js";

for (const order of [[0, 1, 0], [1, 0, 1]]) {
  test(`recommendations remain isolated for profile sequence ${order.join(" -> ")}`, () => {
    const getRecommendations = createRecommendationCache();
    const jobs = listJobs();
    for (const index of order) {
      const candidate = candidates[index];
      const result = getRecommendations(jobs, candidate);
      assert.equal(result.scoredForCandidateId, candidate.id);
      assert.deepEqual(result.jobs, rankJobs(jobs, candidate));
      assert.equal(result.jobs[0].id, index === 0 ? "job-101" : "job-102");
    }
  });
}
