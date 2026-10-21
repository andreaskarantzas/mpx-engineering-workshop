import assert from "node:assert/strict";
import test from "node:test";
import { scoreJob, rankJobs } from "../server/matching.js";
import { primaryJobs } from "../server/seed-data.js";
import { getCandidateById } from "../server/candidates.js";

test("Maya receives related credit while the count remains exact-only", () => {
  const result = scoreJob(primaryJobs[0], getCandidateById("candidate-001"));
  assert.equal(result.score, 90);
  assert.equal(result.matchedCount, 3);
  assert.deepEqual(result.skillBreakdown.map((item) => item.matched), [true, true, true, false]);
  assert.equal(result.locationFits, true);
  assert.deepEqual(result.skillBreakdown.map((item) => item.contribution), [1, 1, 1, 0.5]);
});

test("a listed specific skill gives half credit for a broader requirement", () => {
  const job = { location: "Bern", workMode: "Hybrid", skills: ["Frontend development"] };
  const candidate = { location: "Zurich", skills: ["React"] };
  const result = scoreJob(job, candidate);
  assert.equal(result.score, 40);
  assert.equal(result.matchedCount, 0);
  assert.deepEqual(result.skillBreakdown[0], {
    skill: "Frontend development",
    matched: false,
    matchType: "related",
    contribution: 0.5,
    candidateSkill: "React",
    reason: "Related skill: React → Frontend development (50% credit)",
  });
});

test("exact matching preserves normalization and takes precedence over related credit", () => {
  const job = { location: "Zurich", skills: [" frontend DEVELOPMENT "] };
  const candidate = { location: "Zurich", skills: ["React", "Frontend development"] };
  const result = scoreJob(job, candidate);
  assert.equal(result.score, 100);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.skillBreakdown[0].matchType, "exact");
  assert.equal(result.skillBreakdown[0].contribution, 1);
});

test("unrelated, reverse, and sibling relationships receive no credit", () => {
  for (const [required, possessed] of [
    ["SQL", "React"],
    ["React", "Frontend development"],
    ["Python", "TypeScript"],
  ]) {
    const result = scoreJob({ skills: [required], location: "Bern" }, { skills: [possessed], location: "Zurich" });
    assert.equal(result.score, 0);
    assert.equal(result.skillBreakdown[0].matchType, "missing");
    assert.equal(result.skillBreakdown[0].contribution, 0);
    assert.equal(result.skillBreakdown[0].reason, "Not found");
  }
});

test("related lookup is normalized and multiple supporting skills do not stack", () => {
  const job = { skills: [" PROGRAMMING languages "], location: "Bern" };
  const candidate = { skills: [" python ", " TYPESCRIPT ", "Python"], location: "Zurich" };
  const result = scoreJob(job, candidate);
  assert.equal(result.score, 40);
  assert.deepEqual(scoreJob(job, { ...candidate, skills: [...candidate.skills].reverse() }), result);
});

test("exact-only scores and remote location credit are preserved", () => {
  const candidate = { skills: ["React"], location: "Zurich" };
  const job = { skills: ["React", "Unrelated"], location: "Bern", workMode: "Hybrid" };
  assert.equal(scoreJob(job, candidate).score, 40);
  assert.equal(scoreJob({ ...job, workMode: "Remote" }, candidate).score, 60);
  assert.equal(scoreJob({ ...job, skills: ["Frontend development"], workMode: "Remote" }, candidate).score, 60);
});

test("scores reconstruct from the breakdown, stay bounded, and repeat deterministically", () => {
  for (const skills of [[], ["React"], ["Frontend development"], ["Missing"], ["React", "Frontend development", "Missing"]]) {
    for (const location of ["Zurich", "Bern"]) {
      const job = { skills, location };
      const candidate = { skills: ["React"], location: "Zurich" };
      const result = scoreJob(job, candidate);
      const contribution = result.skillBreakdown.reduce((sum, item) => sum + item.contribution, 0);
      assert.equal(result.score, Math.round((skills.length ? 80 * contribution / skills.length : 0) + (result.locationFits ? 20 : 0)));
      assert.ok(result.score >= 0 && result.score <= 100);
      assert.deepEqual(scoreJob(job, candidate), result);
    }
  }
});

test("equal scores retain title ordering and input order for identical titles", () => {
  const jobs = [
    { id: "b", title: "B", skills: ["Frontend development"] },
    { id: "a1", title: "A", skills: ["Frontend development"] },
    { id: "a2", title: "A", skills: ["Frontend development"] },
  ];
  const candidate = { skills: ["React"], location: "Zurich" };
  assert.deepEqual(rankJobs(jobs, candidate).map((job) => job.id), ["a1", "a2", "b"]);
});

test("remote roles count as a location fit and ranking is stable", () => {
  const candidate = getCandidateById("candidate-003");
  const ranked = rankJobs(primaryJobs, candidate);
  assert.equal(ranked[0].id, "job-103");
  assert.equal(ranked[0].match.locationFits, true);
});
